"""Admin dashboard figures, computed from orders, refunds and stock in a few queries."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.v1.models.base import OrderStatus, PaymentMethod, PaymentStatus, ProductStatus, RefundStatus, SalesChannel
from src.app.api.v1.models.catalog import Category, Product, ProductVariant
from src.app.api.v1.models.order import Order, OrderItem, Refund
from src.app.api.v1.models.users import User
from src.app.api.v1.schemas.stats import (
    Attention,
    CategorySales,
    DashboardStats,
    DayPoint,
    PeriodTotals,
    TopProduct,
)

_AGENT_CHANNELS = (SalesChannel.AGENT, SalesChannel.WHATSAPP, SalesChannel.VOICE)
_CENT = Decimal("0.01")


def _money(v) -> Decimal:
    return Decimal(v or 0).quantize(_CENT)


class StatsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _net():
        """Each order's total minus its successful refunds, as a column expression."""
        refunded = (
            select(func.coalesce(func.sum(Refund.amount), 0))
            .where(Refund.order_id == Order.id, Refund.status == RefundStatus.SUCCEEDED)
            .correlate(Order)
            .scalar_subquery()
        )
        return Order.total - refunded

    async def _totals(self, start: datetime, end: datetime) -> PeriodTotals:
        net = self._net()
        in_range = and_(Order.created_at >= start, Order.created_at < end, Order.status != OrderStatus.CANCELLED)
        revenue, orders, agent = (
            await self.db.execute(
                select(
                    func.coalesce(func.sum(net), 0),
                    func.count(Order.id),
                    func.coalesce(func.sum(case((Order.channel.in_(_AGENT_CHANNELS), net), else_=0)), 0),
                ).where(in_range)
            )
        ).one()
        new_customers = await self.db.scalar(
            select(func.count(User.id)).where(User.created_at >= start, User.created_at < end, User.deleted_at.is_(None))
        )
        return PeriodTotals(
            revenue=_money(revenue),
            orders=orders,
            average_order=_money(Decimal(revenue) / orders) if orders else _money(0),
            agent_revenue=_money(agent),
            new_customers=new_customers or 0,
        )

    async def dashboard(self, days: int, tz: str) -> DashboardStats:
        now = datetime.now(timezone.utc)
        start, prev_start = now - timedelta(days=days), now - timedelta(days=2 * days)
        current = await self._totals(start, now)
        previous = await self._totals(prev_start, start)

        # Daily series in the admin's time zone, with empty days filled in.
        net = self._net()
        day = func.date(func.timezone(tz, Order.created_at)).label("day")
        by_channel = {
            ch: func.coalesce(func.sum(case((Order.channel == ch, net), else_=0)), 0).label(ch.value) for ch in SalesChannel
        }
        rows = await self.db.execute(
            select(day, func.coalesce(func.sum(net), 0), func.count(Order.id), *by_channel.values())
            .where(Order.created_at >= start, Order.status != OrderStatus.CANCELLED)
            .group_by(day)
        )
        found = {r[0]: r for r in rows.all()}
        local_today = (await self.db.scalar(select(func.date(func.timezone(tz, func.now())))))
        series = []
        for i in range(days - 1, -1, -1):
            d = local_today - timedelta(days=i)
            r = found.get(d)
            series.append(
                DayPoint(
                    date=d,
                    revenue=_money(r[1] if r else 0),
                    orders=r[2] if r else 0,
                    web=_money(r[3] if r else 0),
                    agent=_money(r[4] if r else 0),
                    whatsapp=_money(r[5] if r else 0),
                    voice=_money(r[6] if r else 0),
                )
            )

        # Item sales by category and top products (from order lines in the period).
        lines_in_period = and_(OrderItem.order_id == Order.id, Order.created_at >= start, Order.status != OrderStatus.CANCELLED)
        # Grouped by label: a repeated expression would bind "Uncategorised" twice and Postgres sees two columns.
        category = func.coalesce(Category.name, "Uncategorised").label("category")
        sales = func.sum(OrderItem.line_total).label("sales")
        cat_rows = await self.db.execute(
            select(category, sales)
            .select_from(OrderItem)
            .join(Order, lines_in_period)
            .outerjoin(Product, Product.id == OrderItem.product_id)
            .outerjoin(Category, Category.id == Product.category_id)
            .group_by(category)
            .order_by(sales.desc())
        )
        categories = [CategorySales(category=name, revenue=_money(total)) for name, total in cat_rows.all()]

        units = func.sum(OrderItem.quantity)
        top_rows = await self.db.execute(
            select(OrderItem.product_id, func.max(OrderItem.product_name), func.max(OrderItem.image_url), units, func.sum(OrderItem.line_total))
            .select_from(OrderItem)
            .join(Order, lines_in_period)
            .group_by(OrderItem.product_id)
            .order_by(units.desc(), func.sum(OrderItem.line_total).desc())
            .limit(5)
        )
        top_products = [
            TopProduct(product_id=str(pid) if pid else None, name=name, image_url=img, units=u, revenue=_money(rev))
            for pid, name, img, u, rev in top_rows.all()
        ]

        # Things to act on now (not limited to the period).
        status_counts = dict(
            (await self.db.execute(select(Order.status, func.count()).group_by(Order.status))).all()
        )
        cod_unpaid = await self.db.scalar(
            select(func.count(Order.id)).where(
                Order.payment_method == PaymentMethod.CASH_ON_DELIVERY,
                Order.payment_status == PaymentStatus.PENDING,
                Order.status.not_in((OrderStatus.CANCELLED, OrderStatus.RETURNED)),
            )
        )
        low_stock = await self.db.scalar(
            select(func.count(ProductVariant.id))
            .join(Product, Product.id == ProductVariant.product_id)
            .where(
                Product.deleted_at.is_(None),
                Product.status != ProductStatus.ARCHIVED,
                ProductVariant.stock_qty <= Product.low_stock_threshold,
            )
        )
        attention = Attention(
            to_pack=status_counts.get(OrderStatus.CONFIRMED, 0),
            to_ship=status_counts.get(OrderStatus.PACKED, 0),
            low_stock=low_stock or 0,
            cod_unpaid=cod_unpaid or 0,
            awaiting_payment=status_counts.get(OrderStatus.PENDING, 0),
        )

        return DashboardStats(
            days=days,
            timezone=tz,
            current=current,
            previous=previous,
            series=series,
            categories=categories,
            top_products=top_products,
            attention=attention,
        )

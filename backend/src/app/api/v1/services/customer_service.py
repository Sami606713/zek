"""Admin customer views: every account with its order count and spend, in one query."""

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.v1.models.address import Address
from src.app.api.v1.models.audit_log import AuditLog
from src.app.api.v1.models.base import PaymentStatus, RefundStatus
from src.app.api.v1.models.order import Order, Refund
from src.app.api.v1.models.users import User
from src.app.api.v1.schemas.address import AddressResponse
from src.app.api.v1.schemas.customer import (
    CustomerAccessUpdate,
    CustomerDetail,
    CustomerListResponse,
    CustomerRow,
    CustomerSegment,
    CustomerSort,
    CustomerSummary,
)

# Orders whose money was taken (refunds are subtracted separately).
_PAID = (PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED)


class CustomerService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Building blocks ─────────────────────────────────────────────────────

    @staticmethod
    def _order_stats():
        return (
            select(
                Order.user_id.label("user_id"),
                func.count(Order.id).label("orders"),
                func.max(Order.created_at).label("last_order"),
                func.sum(case((Order.payment_status.in_(_PAID), Order.total), else_=0)).label("gross"),
            )
            .where(Order.user_id.is_not(None))
            .group_by(Order.user_id)
            .subquery()
        )

    @staticmethod
    def _refund_stats():
        return (
            select(Order.user_id.label("user_id"), func.sum(Refund.amount).label("refunded"))
            .join(Refund, Refund.order_id == Order.id)
            .where(Order.user_id.is_not(None), Refund.status == RefundStatus.SUCCEEDED)
            .group_by(Order.user_id)
            .subquery()
        )

    @staticmethod
    def _location():
        return (
            select(func.concat(Address.city, ", ", Address.country))
            .where(Address.user_id == User.id)
            .order_by(Address.is_default.desc(), Address.created_at)
            .limit(1)
            .correlate(User)
            .scalar_subquery()
        )

    def _rows(self):
        orders, refunds = self._order_stats(), self._refund_stats()
        count = func.coalesce(orders.c.orders, 0)
        refunded = func.coalesce(refunds.c.refunded, 0)
        spent = func.coalesce(orders.c.gross, 0) - refunded
        query = (
            select(User, count.label("orders"), spent.label("spent"), refunded.label("refunded"),
                   orders.c.last_order, self._location().label("location"))
            .outerjoin(orders, orders.c.user_id == User.id)
            .outerjoin(refunds, refunds.c.user_id == User.id)
            .where(User.deleted_at.is_(None))
        )
        return query, count, spent, orders.c.last_order

    @staticmethod
    def _row(user: User, orders: int, spent, last_order, location) -> dict:
        return dict(
            id=user.id, username=user.username, email=user.email, full_name=user.full_name,
            phone_number=user.phone_number, role=user.role, is_active=user.is_active,
            is_verified=user.is_verified, is_superuser=user.is_superuser, is_locked=user.is_locked,
            login_attempts=user.login_attempts, created_at=user.created_at, last_login_at=user.last_login_at,
            orders_count=orders, total_spent=Decimal(spent or 0), last_order_at=last_order, location=location,
        )

    # ── Queries ─────────────────────────────────────────────────────────────

    async def list(
        self,
        *,
        search: str | None = None,
        segment: CustomerSegment | None = None,
        sort: CustomerSort = CustomerSort.NEWEST,
        skip: int = 0,
        limit: int = 20,
    ) -> CustomerListResponse:
        query, count, spent, last_order = self._rows()
        since = datetime.now(timezone.utc) - timedelta(days=30)

        if search and search.strip():
            like = f"%{search.strip()}%"
            query = query.where(
                or_(User.email.ilike(like), User.username.ilike(like), User.full_name.ilike(like), User.phone_number.ilike(like))
            )
        if segment == CustomerSegment.NEW:
            query = query.where(User.created_at >= since)
        elif segment == CustomerSegment.REPEAT:
            query = query.where(count >= 2)
        elif segment == CustomerSegment.NO_ORDERS:
            query = query.where(count == 0)
        elif segment == CustomerSegment.ADMINS:
            query = query.where(or_(User.role == "admin", User.is_superuser.is_(True)))
        elif segment == CustomerSegment.LOCKED:
            query = query.where(User.is_locked.is_(True))
        elif segment == CustomerSegment.INACTIVE:
            query = query.where(User.is_active.is_(False))

        total = await self.db.scalar(select(func.count()).select_from(query.subquery())) or 0
        order_by = {
            CustomerSort.NEWEST: [User.created_at.desc()],
            CustomerSort.SPENT: [spent.desc(), User.created_at.desc()],
            CustomerSort.ORDERS: [count.desc(), User.created_at.desc()],
            CustomerSort.LAST_ORDER: [last_order.desc().nulls_last(), User.created_at.desc()],
            CustomerSort.NAME: [func.lower(func.coalesce(User.full_name, User.username))],
        }[sort]
        rows = await self.db.execute(query.order_by(*order_by).offset(skip).limit(limit))
        items = [
            CustomerRow(**self._row(user, orders, spent_, last, loc))
            for user, orders, spent_, _refunded, last, loc in rows.all()
        ]
        return CustomerListResponse(items=items, total=total, skip=skip, limit=limit, summary=await self._summary(since))

    async def _summary(self, since: datetime) -> CustomerSummary:
        query, count, spent, _ = self._rows()
        stats = query.with_only_columns(User.id, User.created_at, User.is_locked, count.label("orders"), spent.label("spent")).subquery()
        row = (
            await self.db.execute(
                select(
                    func.count(),
                    func.count().filter(stats.c.created_at >= since),
                    func.count().filter(stats.c.orders >= 1),
                    func.count().filter(stats.c.orders >= 2),
                    func.coalesce(func.avg(stats.c.spent).filter(stats.c.orders >= 1), 0),
                    func.count().filter(stats.c.is_locked.is_(True)),
                ).select_from(stats)
            )
        ).one()
        customers, new, buyers, repeat, average, locked = row
        return CustomerSummary(
            customers=customers,
            new_30d=new,
            repeat_rate=(repeat / buyers) if buyers else 0.0,
            average_spent=Decimal(average).quantize(Decimal("0.01")),
            locked=locked,
        )

    async def get(self, user_id: uuid.UUID) -> CustomerDetail:
        query, *_ = self._rows()
        row = (await self.db.execute(query.where(User.id == user_id))).first()
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
        user, orders, spent, refunded, last, loc = row
        addresses = await self.db.scalars(
            select(Address).where(Address.user_id == user_id).order_by(Address.is_default.desc(), Address.created_at)
        )
        paid_orders = await self.db.scalar(
            select(func.count(Order.id)).where(Order.user_id == user_id, Order.payment_status.in_(_PAID))
        ) or 0
        gross = Decimal(spent or 0) + Decimal(refunded or 0)
        return CustomerDetail(
            **self._row(user, orders, spent, last, loc),
            refunded_total=Decimal(refunded or 0),
            average_order=(gross / paid_orders).quantize(Decimal("0.01")) if paid_orders else Decimal("0"),
            addresses=[AddressResponse.model_validate(a) for a in addresses],
        )

    # ── Access ──────────────────────────────────────────────────────────────

    async def update_access(self, user_id: uuid.UUID, payload: CustomerAccessUpdate, actor: User) -> CustomerDetail:
        user = await self.db.get(User, user_id)
        if user is None or user.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
        if user.id == actor.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't change your own role or access")
        if user.is_superuser:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="The store owner's access can't be changed here")

        changes: dict = {}
        if payload.role is not None and payload.role != user.role:
            changes["role"] = [user.role, payload.role]
            user.role = payload.role
        if payload.is_active is not None and payload.is_active != user.is_active:
            changes["is_active"] = [user.is_active, payload.is_active]
            user.is_active = payload.is_active
        if changes:
            self.db.add(AuditLog(actor_id=actor.id, action="user.access_changed", entity_type="user", entity_id=str(user.id), changes=changes))
            await self.db.commit()
        return await self.get(user_id)

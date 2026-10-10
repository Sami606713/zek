"""Checkout, order history, cancellation and admin fulfilment.

Checkout runs in one transaction: stock rows and the promo code are locked, prices are
recalculated on the server, items and address are snapshotted, stock is reduced and the
cart is emptied. If any step fails, nothing is written.

Card payments are simulated (marked paid immediately) until Stripe is connected.
"""

import secrets
import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.app.api.v1.models.address import Address
from src.app.api.v1.models.audit_log import AuditLog
from src.app.api.v1.models.base import (
    DeliveryMethod,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    ProductStatus,
    RefundStatus,
    SalesChannel,
)
from src.app.api.v1.models.cart import Cart
from src.app.api.v1.models.catalog import Product, ProductVariant
from src.app.api.v1.models.discount import Discount
from src.app.api.v1.models.order import Order, OrderItem, OrderStatusHistory, Refund
from src.app.api.v1.models.users import User
from src.app.api.v1.schemas.order import (
    AdminOrderRow,
    CancelRequest,
    CheckoutRequest,
    OrderAdminResponse,
    OrderAdminUpdate,
    OrderItemResponse,
    OrderResponse,
    OrderSummary,
    RefundCreate,
    RefundResponse,
    ShippingAddress,
    StatusEvent,
)
from src.app.api.v1.services.cart_service import CartOwner, CartService
from src.app.api.v1.services.pricing_service import PricingService, money

# Forward-only fulfilment. Cancelling is allowed until the parcel leaves.
ALLOWED_TRANSITIONS: dict[OrderStatus, list[OrderStatus]] = {
    OrderStatus.PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    OrderStatus.CONFIRMED: [OrderStatus.PACKED, OrderStatus.CANCELLED],
    OrderStatus.PACKED: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    OrderStatus.SHIPPED: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
    OrderStatus.DELIVERED: [OrderStatus.RETURNED],
    OrderStatus.CANCELLED: [],
    OrderStatus.RETURNED: [],
}
CUSTOMER_CANCELLABLE = {OrderStatus.PENDING, OrderStatus.CONFIRMED}   # before packing
DELIVERY_DAYS = {DeliveryMethod.STANDARD: (3, 5), DeliveryMethod.EXPRESS: (1, 2)}

_LOAD = (
    selectinload(Order.items).selectinload(OrderItem.product),
    selectinload(Order.status_history),
    selectinload(Order.refunds),
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def add_business_days(start: datetime, days: int) -> datetime:
    current = start
    while days > 0:
        current += timedelta(days=1)
        if current.weekday() < 5:
            days -= 1
    return current


def _day_start(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=timezone.utc)


class OrderService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.pricing = PricingService(db)
        self.carts = CartService(db)

    # ── Serialisation ─────────────────────────────────────────────────────────

    @staticmethod
    def _refunded(order: Order) -> Decimal:
        return money(sum((r.amount for r in order.refunds if r.status == RefundStatus.SUCCEEDED), Decimal("0")))

    def _response_fields(self, o: Order) -> dict:
        return dict(
            id=o.id,
            order_number=o.order_number,
            status=o.status,
            payment_status=o.payment_status,
            payment_method=o.payment_method,
            delivery_method=o.delivery_method,
            channel=o.channel,
            email=o.email,
            phone=o.phone,
            shipping_address=ShippingAddress(**o.shipping_address),
            items=[
                OrderItemResponse(
                    id=i.id,
                    product_id=i.product_id,
                    variant_id=i.variant_id,
                    product_slug=i.product.slug if i.product and i.product.deleted_at is None else None,
                    product_name=i.product_name,
                    brand=i.brand,
                    sku=i.sku,
                    color_name=i.color_name,
                    size=i.size,
                    image_url=i.image_url,
                    unit_price=money(i.unit_price),
                    quantity=i.quantity,
                    line_total=money(i.line_total),
                )
                for i in o.items
            ],
            subtotal=money(o.subtotal),
            discount_total=money(o.discount_total),
            discount_code=o.discount_code,
            shipping_total=money(o.shipping_total),
            tax_total=money(o.tax_total),
            total=money(o.total),
            refunded_total=self._refunded(o),
            currency=o.currency,
            card_last4=o.card_last4,
            carrier=o.carrier,
            tracking_number=o.tracking_number,
            estimated_delivery_from=o.estimated_delivery_from,
            estimated_delivery_to=o.estimated_delivery_to,
            paid_at=o.paid_at,
            packed_at=o.packed_at,
            shipped_at=o.shipped_at,
            delivered_at=o.delivered_at,
            cancelled_at=o.cancelled_at,
            cancel_reason=o.cancel_reason,
            customer_note=o.customer_note,
            can_cancel=o.status in CUSTOMER_CANCELLABLE,
            status_history=[
                StatusEvent(from_status=h.from_status, to_status=h.to_status, note=h.note, created_at=h.created_at)
                for h in sorted(o.status_history, key=lambda h: (h.created_at, h.id))
            ],
            created_at=o.created_at,
            updated_at=o.updated_at,
        )

    def to_response(self, o: Order) -> OrderResponse:
        return OrderResponse(**self._response_fields(o))

    def to_admin(self, o: Order) -> OrderAdminResponse:
        return OrderAdminResponse(
            **self._response_fields(o),
            user_id=o.user_id,
            internal_note=o.internal_note,
            stripe_payment_intent_id=o.stripe_payment_intent_id,
            refunds=[
                RefundResponse(id=r.id, amount=money(r.amount), reason=r.reason, status=r.status, created_at=r.created_at)
                for r in sorted(o.refunds, key=lambda r: r.created_at)
            ],
            allowed_next_statuses=ALLOWED_TRANSITIONS[o.status],
        )

    @staticmethod
    def _summary_fields(o: Order) -> dict:
        return dict(
            id=o.id,
            order_number=o.order_number,
            status=o.status,
            payment_status=o.payment_status,
            total=money(o.total),
            currency=o.currency,
            item_count=sum(i.quantity for i in o.items),
            preview_images=[i.image_url for i in o.items if i.image_url][:4],
            created_at=o.created_at,
            estimated_delivery_from=o.estimated_delivery_from,
            estimated_delivery_to=o.estimated_delivery_to,
        )

    # ── Loading ───────────────────────────────────────────────────────────────

    async def _load(self, *where) -> Order | None:
        return await self.db.scalar(select(Order).options(*_LOAD).where(*where).execution_options(populate_existing=True))

    async def _load_or_404(self, *where) -> Order:
        order = await self._load(*where)
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        return order

    async def _new_order_number(self) -> str:
        while True:
            number = f"ZEK-{secrets.randbelow(900_000) + 100_000}"
            if not await self.db.scalar(select(Order.id).where(Order.order_number == number)):
                return number

    def _history(self, order: Order, to_status: OrderStatus, from_status: OrderStatus | None, note: str | None, by: uuid.UUID | None) -> None:
        self.db.add(OrderStatusHistory(order_id=order.id, from_status=from_status, to_status=to_status, note=note, changed_by_id=by))

    def _audit(self, actor_id: uuid.UUID, action: str, order: Order, changes: dict | None) -> None:
        self.db.add(AuditLog(actor_id=actor_id, action=action, entity_type="order", entity_id=order.order_number, changes=changes))

    # ── Checkout ──────────────────────────────────────────────────────────────

    async def checkout(self, owner: CartOwner, payload: CheckoutRequest, user: User | None) -> OrderResponse:
        # Email
        email = (payload.email or (user.email if user else None) or "").lower()
        if not email:
            raise HTTPException(status_code=422, detail="email is required for guest checkout")

        # Address
        if payload.address_id:
            if not user:
                raise HTTPException(status_code=422, detail="Saved addresses need sign-in; send shipping_address instead")
            saved = await self.db.scalar(select(Address).where(Address.id == payload.address_id, Address.user_id == user.id))
            if not saved:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")
            address = ShippingAddress.model_validate(saved, from_attributes=True)
        else:
            address = ShippingAddress(**payload.shipping_address.model_dump(exclude={"label", "is_default"}))

        # Cart
        cart = await self.db.scalar(
            select(Cart).options(selectinload(Cart.items)).where(self.carts._owner_filter(owner))
        )
        if not cart or not cart.items:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Your cart is empty")

        # Lock every variant in a fixed order, so concurrent checkouts cannot oversell or deadlock.
        variant_ids = sorted({i.variant_id for i in cart.items})
        variants = {
            v.id: v
            for v in (
                await self.db.execute(
                    select(ProductVariant)
                    .options(selectinload(ProductVariant.product).selectinload(Product.images))
                    .where(ProductVariant.id.in_(variant_ids))
                    .order_by(ProductVariant.id)
                    .with_for_update(of=ProductVariant)
                )
            ).scalars()
        }

        problems, lines = [], []
        for item in sorted(cart.items, key=lambda i: i.created_at):
            v = variants.get(item.variant_id)
            p = v.product if v else None
            if not v or not v.is_active or not p or p.deleted_at is not None or p.status != ProductStatus.ACTIVE:
                problems.append({"item_id": item.id, "issue": "No longer available"})
            elif item.quantity > v.stock_qty:
                problems.append({"item_id": item.id, "issue": f"Only {v.stock_qty} left" if v.stock_qty else "Sold out", "available": v.stock_qty})
            else:
                lines.append((item, v, p))
        if problems:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"message": "Some items in your cart changed. Review your cart and try again.", "items": problems},
            )

        # Prices, recalculated here and never taken from the client
        subtotal = money(sum(((v.price if v.price is not None else p.price) * item.quantity for item, v, p in lines), Decimal("0")))

        discount: Discount | None = None
        discount_amount = Decimal("0.00")
        if cart.discount_code:
            result = await self.pricing.evaluate_discount(cart.discount_code, subtotal, user.id if user else None)
            if result.error:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={"message": f"Your promo code no longer applies: {result.error}. Remove it or try again.", "items": []},
                )
            # Lock the code and re-check the limit, so two shoppers cannot both take its last use.
            discount = await self.db.scalar(select(Discount).where(Discount.id == result.discount.id).with_for_update())
            if discount.usage_limit is not None and discount.used_count >= discount.usage_limit:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": f"'{discount.code}' has just been used up", "items": []})
            discount_amount = result.amount

        rates = await self.pricing.rates()
        totals = self.pricing.totals(subtotal, discount_amount, rates, express=payload.delivery_method == DeliveryMethod.EXPRESS)
        if payload.expected_total is not None and money(payload.expected_total) != totals.total:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"message": f"The total changed to {totals.total}. Please review your order.", "total": str(totals.total), "items": []},
            )

        # Create the order
        now = _now()
        low, high = DELIVERY_DAYS[payload.delivery_method]
        paid = payload.payment_method == PaymentMethod.CARD
        order = Order(
            id=uuid.uuid4(),
            order_number=await self._new_order_number(),
            user_id=user.id if user else None,
            email=email,
            phone=payload.phone or address.phone,
            status=OrderStatus.CONFIRMED,
            payment_status=PaymentStatus.PAID if paid else PaymentStatus.PENDING,
            payment_method=payload.payment_method,
            delivery_method=payload.delivery_method,
            channel=payload.channel,
            shipping_address=address.model_dump(),
            subtotal=totals.subtotal,
            discount_total=totals.discount,
            shipping_total=totals.shipping,
            tax_total=totals.tax,
            total=totals.total,
            currency="USD",
            discount_id=discount.id if discount else None,
            discount_code=discount.code if discount else None,
            card_last4=payload.card_last4 if paid else None,
            paid_at=now if paid else None,
            estimated_delivery_from=add_business_days(now, low),
            estimated_delivery_to=add_business_days(now, high),
            customer_note=payload.customer_note,
        )
        self.db.add(order)
        await self.db.flush()

        for item, v, p in lines:
            unit = money(v.price if v.price is not None else p.price)
            image = next((i for i in p.images if i.variant_id == v.id), None) or (p.images[0] if p.images else None)
            self.db.add(
                OrderItem(
                    order_id=order.id,
                    product_id=p.id,
                    variant_id=v.id,
                    product_name=p.name,
                    brand=p.brand,
                    sku=v.sku,
                    color_name=v.color_name,
                    size=v.size,
                    image_url=image.url if image else None,
                    unit_price=unit,
                    quantity=item.quantity,
                    line_total=money(unit * item.quantity),
                )
            )
            v.stock_qty -= item.quantity

        if discount:
            discount.used_count += 1
        self._history(order, OrderStatus.CONFIRMED, None, "Payment received" if paid else "Pay on delivery", user.id if user else None)

        if payload.save_address and payload.shipping_address and user:
            exists = await self.db.scalar(select(func.count()).select_from(Address).where(Address.user_id == user.id)) or 0
            self.db.add(
                Address(
                    user_id=user.id,
                    is_default=exists == 0,
                    **payload.shipping_address.model_dump(exclude={"is_default"}),
                )
            )

        for item in list(cart.items):
            await self.db.delete(item)
        cart.discount_code = None

        await self.db.commit()
        return self.to_response(await self._load_or_404(Order.id == order.id))

    # ── Customer ──────────────────────────────────────────────────────────────

    async def list_for_user(
        self, user_id: uuid.UUID, *, skip: int, limit: int, status_filter: OrderStatus | None
    ) -> tuple[list[OrderSummary], int]:
        filters = [Order.user_id == user_id]
        if status_filter:
            filters.append(Order.status == status_filter)
        total = await self.db.scalar(select(func.count()).select_from(Order).where(*filters)) or 0
        result = await self.db.execute(
            select(Order).options(selectinload(Order.items)).where(*filters).order_by(Order.created_at.desc()).offset(skip).limit(limit)
        )
        return [OrderSummary(**self._summary_fields(o)) for o in result.scalars().all()], total

    async def _accessible(self, order_number: str, user: User | None, email: str | None, admin: bool) -> Order:
        order = await self._load(Order.order_number == order_number.upper())
        allowed = order is not None and (
            admin
            or (user is not None and order.user_id == user.id)
            or (order.user_id is None and email is not None and order.email == email.lower())
        )
        if not allowed:
            # Same answer whether the order is missing or belongs to someone else.
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        return order

    async def get_for_customer(self, order_number: str, user: User | None, email: str | None, admin: bool) -> OrderResponse:
        return self.to_response(await self._accessible(order_number, user, email, admin))

    async def cancel_by_customer(self, order_number: str, user: User | None, payload: CancelRequest) -> OrderResponse:
        order = await self._accessible(order_number, user, payload.email, admin=False)
        if order.status not in CUSTOMER_CANCELLABLE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"This order is already {order.status.value} and can no longer be cancelled",
            )
        await self._cancel(order, payload.reason or "Cancelled by customer", by=user.id if user else None)
        await self.db.commit()
        return self.to_response(await self._load_or_404(Order.id == order.id))

    # ── Shared fulfilment logic ───────────────────────────────────────────────

    async def _restock(self, order: Order) -> None:
        ids = sorted({i.variant_id for i in order.items if i.variant_id})
        if not ids:
            return
        variants = {
            v.id: v
            for v in (
                await self.db.execute(select(ProductVariant).where(ProductVariant.id.in_(ids)).order_by(ProductVariant.id).with_for_update())
            ).scalars()
        }
        for item in order.items:
            if item.variant_id in variants:
                variants[item.variant_id].stock_qty += item.quantity

    async def _refund(self, order: Order, amount: Decimal, reason: str | None, by: uuid.UUID | None) -> Refund:
        # Simulated: succeeds immediately. Stripe refunds replace this in the payments step.
        refund = Refund(order_id=order.id, amount=money(amount), reason=reason, status=RefundStatus.SUCCEEDED, created_by_id=by)
        self.db.add(refund)
        order.refunds.append(refund)
        refunded = self._refunded(order)
        order.payment_status = PaymentStatus.REFUNDED if refunded >= money(order.total) else PaymentStatus.PARTIALLY_REFUNDED
        return refund

    async def _cancel(self, order: Order, reason: str, by: uuid.UUID | None) -> None:
        previous = order.status
        order.status = OrderStatus.CANCELLED
        order.cancelled_at = _now()
        order.cancel_reason = reason
        await self._restock(order)
        if order.discount_id:
            d = await self.db.scalar(select(Discount).where(Discount.id == order.discount_id).with_for_update())
            if d and d.used_count > 0:
                d.used_count -= 1   # give the use back
        remaining = money(order.total) - self._refunded(order)
        if order.payment_status in (PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED) and remaining > 0:
            await self._refund(order, remaining, "Order cancelled", by)
        self._history(order, OrderStatus.CANCELLED, previous, reason, by)

    # ── Admin ─────────────────────────────────────────────────────────────────

    async def admin_list(
        self,
        *,
        skip: int,
        limit: int,
        status_filter: OrderStatus | None,
        payment_status: PaymentStatus | None,
        channel: SalesChannel | None,
        date_from: date | None,
        date_to: date | None,
        q: str | None,
    ) -> tuple[list[AdminOrderRow], int]:
        filters = []
        if status_filter:
            filters.append(Order.status == status_filter)
        if payment_status:
            filters.append(Order.payment_status == payment_status)
        if channel:
            filters.append(Order.channel == channel)
        if date_from:
            filters.append(Order.created_at >= _day_start(date_from))
        if date_to:
            filters.append(Order.created_at < _day_start(date_to) + timedelta(days=1))
        if q:
            term = q.strip().lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            like = f"%{term}%"
            item_match = select(OrderItem.id).where(OrderItem.order_id == Order.id, func.lower(OrderItem.product_name).like(like, escape="\\")).exists()
            filters.append(
                func.lower(Order.order_number).like(like, escape="\\")
                | func.lower(Order.email).like(like, escape="\\")
                | func.lower(Order.shipping_address["full_name"].astext).like(like, escape="\\")
                | item_match
            )

        total = await self.db.scalar(select(func.count()).select_from(Order).where(*filters)) or 0
        result = await self.db.execute(
            select(Order).options(selectinload(Order.items)).where(*filters).order_by(Order.created_at.desc()).offset(skip).limit(limit)
        )
        rows = [
            AdminOrderRow(
                **self._summary_fields(o),
                email=o.email,
                customer_name=o.shipping_address.get("full_name", ""),
                channel=o.channel,
                payment_method=o.payment_method,
                delivery_method=o.delivery_method,
            )
            for o in result.scalars().all()
        ]
        return rows, total

    async def admin_get(self, order_id: uuid.UUID) -> OrderAdminResponse:
        return self.to_admin(await self._load_or_404(Order.id == order_id))

    async def admin_update(self, order_id: uuid.UUID, payload: OrderAdminUpdate, actor_id: uuid.UUID) -> OrderAdminResponse:
        order = await self._load_or_404(Order.id == order_id)
        sent = payload.model_fields_set
        changes: dict[str, list] = {}

        for field in ("carrier", "tracking_number", "internal_note"):
            if field in sent and getattr(payload, field) != getattr(order, field):
                changes[field] = [getattr(order, field), getattr(payload, field)]
                setattr(order, field, getattr(payload, field))

        new_from = _day_start(payload.estimated_delivery_from) if payload.estimated_delivery_from else None
        new_to = _day_start(payload.estimated_delivery_to) if payload.estimated_delivery_to else None
        final_from = new_from if "estimated_delivery_from" in sent else order.estimated_delivery_from
        final_to = new_to if "estimated_delivery_to" in sent else order.estimated_delivery_to
        if final_from and final_to and final_to < final_from:
            raise HTTPException(status_code=422, detail="estimated_delivery_to must be on or after estimated_delivery_from")
        for field, value in (("estimated_delivery_from", new_from), ("estimated_delivery_to", new_to)):
            if field in sent and value != getattr(order, field):
                changes[field] = [str(getattr(order, field)), str(value)]
                setattr(order, field, value)

        if "status" in sent and payload.status is not None and payload.status != order.status:
            target, previous = payload.status, order.status
            if target not in ALLOWED_TRANSITIONS[previous]:
                allowed = ", ".join(s.value for s in ALLOWED_TRANSITIONS[previous]) or "none"
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Cannot move an order from {previous.value} to {target.value}. Allowed: {allowed}",
                )
            now = _now()
            if target == OrderStatus.CANCELLED:
                await self._cancel(order, payload.note or "Cancelled by the store", by=actor_id)
            else:
                order.status = target
                if target == OrderStatus.PACKED:
                    order.packed_at = now
                elif target == OrderStatus.SHIPPED:
                    order.shipped_at = now
                elif target == OrderStatus.DELIVERED:
                    order.delivered_at = now
                    if order.payment_method == PaymentMethod.CASH_ON_DELIVERY and order.payment_status == PaymentStatus.PENDING:
                        order.payment_status, order.paid_at = PaymentStatus.PAID, now   # cash collected
                elif target == OrderStatus.RETURNED:
                    await self._restock(order)
                self._history(order, target, previous, payload.note, actor_id)
            changes["status"] = [previous.value, target.value]
        elif "note" in sent and payload.note and "status" not in sent:
            raise HTTPException(status_code=422, detail="note is recorded with a status change; send status too")

        if changes:
            self._audit(actor_id, "order.updated", order, changes)
            await self.db.commit()
        return self.to_admin(await self._load_or_404(Order.id == order.id))

    async def admin_refund(self, order_id: uuid.UUID, payload: RefundCreate, actor_id: uuid.UUID) -> OrderAdminResponse:
        order = await self._load_or_404(Order.id == order_id)
        if order.payment_status not in (PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Nothing to refund: payment is {order.payment_status.value}",
            )
        refundable = money(order.total) - self._refunded(order)
        amount = money(payload.amount) if payload.amount is not None else refundable
        if amount > refundable:
            raise HTTPException(status_code=422, detail=f"Refund is more than the {refundable} left to refund")
        refund = await self._refund(order, amount, payload.reason, actor_id)
        self._audit(actor_id, "order.refunded", order, {"amount": str(refund.amount), "reason": payload.reason})
        await self.db.commit()
        return self.to_admin(await self._load_or_404(Order.id == order.id))

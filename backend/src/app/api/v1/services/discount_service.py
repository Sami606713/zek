"""Promo code CRUD for admins, and public code validation (shared with the cart via PricingService)."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.v1.models.audit_log import AuditLog
from src.app.api.v1.models.base import DiscountType, OrderStatus
from src.app.api.v1.models.discount import Discount
from src.app.api.v1.models.order import Order
from src.app.api.v1.schemas.discount import (
    DiscountCreate,
    DiscountDetail,
    DiscountResponse,
    DiscountStatus,
    DiscountUpdate,
    DiscountValidateRequest,
    DiscountValidateResponse,
)
from src.app.api.v1.services.pricing_service import PricingService, money


def _status(d: Discount, now: datetime) -> DiscountStatus:
    if not d.is_active:
        return DiscountStatus.INACTIVE
    if d.ends_at and d.ends_at <= now:
        return DiscountStatus.EXPIRED
    if d.usage_limit is not None and d.used_count >= d.usage_limit:
        return DiscountStatus.USED_UP
    if d.starts_at and d.starts_at > now:
        return DiscountStatus.SCHEDULED
    return DiscountStatus.ACTIVE


def _jsonable(value):
    if isinstance(value, (Decimal, datetime, uuid.UUID)):
        return str(value)
    return getattr(value, "value", value)


class DiscountService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.pricing = PricingService(db)

    # ── Serialisation ─────────────────────────────────────────────────────────

    def _response(self, d: Discount) -> DiscountResponse:
        return DiscountResponse(
            id=d.id,
            code=d.code,
            description=d.description,
            type=d.type,
            value=money(d.value),
            min_order_amount=money(d.min_order_amount) if d.min_order_amount is not None else None,
            starts_at=d.starts_at,
            ends_at=d.ends_at,
            usage_limit=d.usage_limit,
            per_customer_limit=d.per_customer_limit,
            used_count=d.used_count,
            remaining_uses=max(d.usage_limit - d.used_count, 0) if d.usage_limit is not None else None,
            is_active=d.is_active,
            status=_status(d, datetime.now(timezone.utc)),
            created_at=d.created_at,
            updated_at=d.updated_at,
        )

    async def _detail(self, d: Discount) -> DiscountDetail:
        row = (
            await self.db.execute(
                select(
                    func.count(Order.id),
                    func.coalesce(func.sum(Order.discount_total), 0),
                    func.coalesce(func.sum(Order.total), 0),
                ).where(Order.discount_id == d.id, Order.status != OrderStatus.CANCELLED)
            )
        ).one()
        return DiscountDetail(
            **self._response(d).model_dump(),
            orders_count=row[0],
            total_discounted=money(row[1]),
            revenue=money(row[2]),
        )

    # ── Lookups ───────────────────────────────────────────────────────────────

    async def _get_or_404(self, discount_id: uuid.UUID) -> Discount:
        d = await self.db.get(Discount, discount_id)
        if not d:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discount not found")
        return d

    async def _assert_code_free(self, code: str, exclude_id: uuid.UUID | None = None) -> None:
        q = select(Discount.id).where(Discount.code == code.upper())
        if exclude_id:
            q = q.where(Discount.id != exclude_id)
        if await self.db.scalar(q):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Code '{code.upper()}' already exists")

    async def _times_used(self, d: Discount) -> int:
        orders = await self.db.scalar(select(func.count()).select_from(Order).where(Order.discount_id == d.id)) or 0
        return max(orders, d.used_count)

    def _audit(self, actor_id: uuid.UUID, action: str, d: Discount, changes: dict | None) -> None:
        self.db.add(AuditLog(actor_id=actor_id, action=action, entity_type="discount", entity_id=str(d.id), changes=changes))

    # ── Public ────────────────────────────────────────────────────────────────

    async def validate(self, payload: DiscountValidateRequest, user_id: uuid.UUID | None) -> DiscountValidateResponse:
        result = await self.pricing.evaluate_discount(payload.code, money(payload.subtotal), user_id)
        code = payload.code.strip().upper()
        if result.error:
            return DiscountValidateResponse(valid=False, code=code, message=result.error)
        d = result.discount
        return DiscountValidateResponse(
            valid=True,
            code=d.code,
            description=d.description,
            type=d.type,
            value=money(d.value),
            amount=result.amount,
        )

    # ── Admin reads ───────────────────────────────────────────────────────────

    async def list_discounts(
        self,
        *,
        skip: int = 0,
        limit: int = 20,
        search: str | None = None,
        status_filter: DiscountStatus | None = None,
    ) -> tuple[list[DiscountResponse], int]:
        now = datetime.now(timezone.utc)
        filters = []
        if search:
            term = search.strip().upper().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            filters.append(
                Discount.code.like(f"%{term}%", escape="\\")
                | func.upper(func.coalesce(Discount.description, "")).like(f"%{term}%", escape="\\")
            )

        not_expired = Discount.ends_at.is_(None) | (Discount.ends_at > now)
        not_used_up = Discount.usage_limit.is_(None) | (Discount.used_count < Discount.usage_limit)
        started = Discount.starts_at.is_(None) | (Discount.starts_at <= now)
        if status_filter == DiscountStatus.INACTIVE:
            filters.append(Discount.is_active.is_(False))
        elif status_filter == DiscountStatus.EXPIRED:
            filters += [Discount.is_active.is_(True), Discount.ends_at <= now]
        elif status_filter == DiscountStatus.USED_UP:
            filters += [Discount.is_active.is_(True), not_expired, Discount.usage_limit.is_not(None), Discount.used_count >= Discount.usage_limit]
        elif status_filter == DiscountStatus.SCHEDULED:
            filters += [Discount.is_active.is_(True), not_expired, not_used_up, Discount.starts_at > now]
        elif status_filter == DiscountStatus.ACTIVE:
            filters += [Discount.is_active.is_(True), not_expired, not_used_up, started]

        total = await self.db.scalar(select(func.count()).select_from(Discount).where(*filters)) or 0
        result = await self.db.execute(
            select(Discount).where(*filters).order_by(Discount.created_at.desc()).offset(skip).limit(limit)
        )
        return [self._response(d) for d in result.scalars().all()], total

    async def get(self, discount_id: uuid.UUID) -> DiscountDetail:
        return await self._detail(await self._get_or_404(discount_id))

    # ── Admin writes ──────────────────────────────────────────────────────────

    async def create(self, payload: DiscountCreate, actor_id: uuid.UUID) -> DiscountDetail:
        await self._assert_code_free(payload.code)
        d = Discount(id=uuid.uuid4(), used_count=0, **payload.model_dump())
        self.db.add(d)
        await self.db.flush()
        self._audit(actor_id, "discount.created", d, {"code": [None, d.code], "type": [None, d.type.value], "value": [None, str(d.value)]})
        await self.db.commit()
        await self.db.refresh(d)
        return await self._detail(d)

    async def update(self, discount_id: uuid.UUID, payload: DiscountUpdate, actor_id: uuid.UUID) -> DiscountDetail:
        d = await self._get_or_404(discount_id)
        sent = payload.model_fields_set

        for field in ("code", "type", "value", "is_active"):
            if field in sent and getattr(payload, field) is None:
                raise HTTPException(status_code=422, detail=f"{field} cannot be null")

        if "code" in sent and payload.code != d.code:
            if await self._times_used(d):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This code has already been used, so it cannot be renamed. Create a new code instead.",
                )
            await self._assert_code_free(payload.code, exclude_id=d.id)

        # Check the combined result, not just the fields sent.
        new_type = payload.type if "type" in sent else d.type
        new_value = payload.value if "value" in sent else d.value
        if new_type == DiscountType.PERCENT and new_value > 100:
            raise HTTPException(status_code=422, detail="A percent discount cannot be more than 100")
        starts = payload.starts_at if "starts_at" in sent else d.starts_at
        ends = payload.ends_at if "ends_at" in sent else d.ends_at
        if starts and ends and ends <= starts:
            raise HTTPException(status_code=422, detail="ends_at must be after starts_at")
        new_limit = payload.usage_limit if "usage_limit" in sent else d.usage_limit
        if new_limit is not None and new_limit < d.used_count:
            raise HTTPException(status_code=422, detail=f"usage_limit cannot be below the {d.used_count} uses so far")

        changes: dict[str, list] = {}
        for field in sent:
            new, old = getattr(payload, field), getattr(d, field)
            if new != old:
                changes[field] = [_jsonable(old), _jsonable(new)]
                setattr(d, field, new)

        if changes:
            self._audit(actor_id, "discount.updated", d, changes)
            await self.db.commit()
            await self.db.refresh(d)
        return await self._detail(d)

    async def delete(self, discount_id: uuid.UUID, actor_id: uuid.UUID) -> None:
        d = await self._get_or_404(discount_id)
        if await self._times_used(d):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This code has been used on orders. Deactivate it instead (is_active: false) to keep the history.",
            )
        self._audit(actor_id, "discount.deleted", d, {"code": [d.code, None]})
        await self.db.delete(d)
        await self.db.commit()

"""Promo code endpoints: anyone can check a code; admins create and manage codes."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from src.app.api.v1.schemas.discount import (
    DiscountCreate,
    DiscountDetail,
    DiscountListResponse,
    DiscountStatus,
    DiscountUpdate,
    DiscountValidateRequest,
    DiscountValidateResponse,
)
from src.app.api.v1.services.discount_service import DiscountService
from src.app.deps import AdminUser, DbSession, OptionalUser

router = APIRouter(prefix="/discounts", tags=["Discounts"])


def get_discount_service(db: DbSession) -> DiscountService:
    return DiscountService(db)


DiscountServiceDep = Annotated[DiscountService, Depends(get_discount_service)]

_ADMIN_ERRORS = {
    401: {"description": "Missing, invalid or expired access token"},
    403: {"description": "Admin access required"},
}
_NOT_FOUND = {404: {"description": "Discount not found"}}


# ─────────────────────────────────────────────────────────────────────────────
# Public
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/validate", response_model=DiscountValidateResponse, summary="Check a promo code")
async def validate_discount(
    payload: DiscountValidateRequest, service: DiscountServiceDep, user: OptionalUser
) -> DiscountValidateResponse:
    """Returns whether the code works for this subtotal, how much it takes off, or why it does not apply.

    Always 200, so the answer can be shown inline. Per-customer limits are checked when signed in.
    """
    return await service.validate(payload, user.id if user else None)


# ─────────────────────────────────────────────────────────────────────────────
# Admin
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=DiscountListResponse, summary="List promo codes (admin)", responses=_ADMIN_ERRORS)
async def list_discounts(
    _admin: AdminUser,
    service: DiscountServiceDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, max_length=40, description="Match code or description"),
    status_filter: DiscountStatus | None = Query(None, alias="status"),
) -> DiscountListResponse:
    """Newest first. Each code shows its live status: active, scheduled, expired, used_up or inactive."""
    items, total = await service.list_discounts(skip=skip, limit=limit, search=search, status_filter=status_filter)
    return DiscountListResponse(items=items, total=total, skip=skip, limit=limit)


@router.get(
    "/{discount_id}",
    response_model=DiscountDetail,
    summary="Get a promo code with its results (admin)",
    responses={**_ADMIN_ERRORS, **_NOT_FOUND},
)
async def get_discount(discount_id: uuid.UUID, _admin: AdminUser, service: DiscountServiceDep) -> DiscountDetail:
    """Includes orders placed with the code, money discounted and revenue."""
    return await service.get(discount_id)


@router.post(
    "",
    response_model=DiscountDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a promo code (admin)",
    responses={**_ADMIN_ERRORS, 409: {"description": "Code already exists"}},
)
async def create_discount(payload: DiscountCreate, admin: AdminUser, service: DiscountServiceDep) -> DiscountDetail:
    """Codes are stored in uppercase, so `zek10` and `ZEK10` are the same code."""
    return await service.create(payload, actor_id=admin.id)


@router.patch(
    "/{discount_id}",
    response_model=DiscountDetail,
    summary="Update a promo code (admin)",
    responses={
        **_ADMIN_ERRORS,
        **_NOT_FOUND,
        409: {"description": "Code already exists, or a used code cannot be renamed"},
        422: {"description": "Invalid combination (e.g. percent over 100, limit below uses so far)"},
    },
)
async def update_discount(
    discount_id: uuid.UUID, payload: DiscountUpdate, admin: AdminUser, service: DiscountServiceDep
) -> DiscountDetail:
    """Only the fields sent are changed. Use `is_active: false` to switch a code off."""
    return await service.update(discount_id, payload, actor_id=admin.id)


@router.delete(
    "/{discount_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a promo code (admin)",
    responses={**_ADMIN_ERRORS, **_NOT_FOUND, 409: {"description": "Code was used; deactivate it instead"}},
)
async def delete_discount(discount_id: uuid.UUID, admin: AdminUser, service: DiscountServiceDep) -> None:
    """Only unused codes can be deleted, so order history stays complete."""
    await service.delete(discount_id, actor_id=admin.id)

"""Checkout, the shopper's orders, and admin order management."""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from src.app.api.v1.models.base import OrderStatus, PaymentStatus, SalesChannel
from src.app.api.v1.routes.cart import Owner
from src.app.api.v1.schemas.order import (
    AdminOrderListResponse,
    CancelRequest,
    CheckoutRequest,
    OrderAdminResponse,
    OrderAdminUpdate,
    OrderListResponse,
    OrderResponse,
    RefundCreate,
)
from src.app.api.v1.services.order_service import OrderService
from src.app.deps import AdminUser, CurrentUser, DbSession, OptionalUser, is_admin

router = APIRouter(tags=["Orders"])
admin_router = APIRouter(prefix="/admin/orders", tags=["Admin: Orders"])


def get_order_service(db: DbSession) -> OrderService:
    return OrderService(db)


OrderServiceDep = Annotated[OrderService, Depends(get_order_service)]

_AUTH = {401: {"description": "Missing, invalid or expired access token"}}
_ADMIN = {**_AUTH, 403: {"description": "Admin access required"}}
_NOT_FOUND = {404: {"description": "Order not found"}}


# ─────────────────────────────────────────────────────────────────────────────
# Checkout
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/checkout",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Place an order from the cart",
    responses={
        400: {"description": "Cart is empty"},
        401: {"description": "No access token and no X-Session-Id header"},
        404: {"description": "Saved address not found"},
        409: {"description": "Stock, price or promo code changed; detail lists what to fix"},
    },
)
async def checkout(payload: CheckoutRequest, owner: Owner, user: OptionalUser, service: OrderServiceDep) -> OrderResponse:
    """Turns the cart into an order in one step.

    Prices, shipping, tax and the promo code are recalculated on the server. Stock is reserved,
    the cart is emptied, and the order starts as `confirmed`. Guests use their `X-Session-Id`
    cart and must send `email`.
    """
    return await service.checkout(owner, payload, user)


# ─────────────────────────────────────────────────────────────────────────────
# Shopper
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/orders", response_model=OrderListResponse, summary="My orders", responses=_AUTH)
async def list_my_orders(
    user: CurrentUser,
    service: OrderServiceDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status_filter: OrderStatus | None = Query(None, alias="status"),
) -> OrderListResponse:
    """Newest first."""
    items, total = await service.list_for_user(user.id, skip=skip, limit=limit, status_filter=status_filter)
    return OrderListResponse(items=items, total=total, skip=skip, limit=limit)


@router.get("/orders/{order_number}", response_model=OrderResponse, summary="Track an order", responses=_NOT_FOUND)
async def get_order(
    order_number: str,
    service: OrderServiceDep,
    user: OptionalUser,
    email: str | None = Query(None, max_length=255, description="Guests: the email used at checkout"),
) -> OrderResponse:
    """Signed-in shoppers see their own orders. Guests add `?email=` to look up a guest order."""
    return await service.get_for_customer(order_number, user, email, admin=is_admin(user))


@router.post(
    "/orders/{order_number}/cancel",
    response_model=OrderResponse,
    summary="Cancel an order",
    responses={**_NOT_FOUND, 409: {"description": "Already packed or shipped"}},
)
async def cancel_order(
    order_number: str, payload: CancelRequest, service: OrderServiceDep, user: OptionalUser
) -> OrderResponse:
    """Possible until the order is packed. Stock goes back and card payments are refunded in full."""
    return await service.cancel_by_customer(order_number, user, payload)


# ─────────────────────────────────────────────────────────────────────────────
# Admin
# ─────────────────────────────────────────────────────────────────────────────

@admin_router.get("", response_model=AdminOrderListResponse, summary="List orders (admin)", responses=_ADMIN)
async def admin_list_orders(
    _admin: AdminUser,
    service: OrderServiceDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status_filter: OrderStatus | None = Query(None, alias="status"),
    payment_status: PaymentStatus | None = Query(None),
    channel: SalesChannel | None = Query(None),
    date_from: date | None = Query(None, description="Placed on or after (YYYY-MM-DD)"),
    date_to: date | None = Query(None, description="Placed on or before (YYYY-MM-DD)"),
    q: str | None = Query(None, max_length=100, description="Order number, email, customer name or product"),
) -> AdminOrderListResponse:
    items, total = await service.admin_list(
        skip=skip,
        limit=limit,
        status_filter=status_filter,
        payment_status=payment_status,
        channel=channel,
        date_from=date_from,
        date_to=date_to,
        q=q,
    )
    return AdminOrderListResponse(items=items, total=total, skip=skip, limit=limit)


@admin_router.get(
    "/{order_id}",
    response_model=OrderAdminResponse,
    summary="Get an order (admin)",
    responses={**_ADMIN, **_NOT_FOUND},
)
async def admin_get_order(order_id: uuid.UUID, _admin: AdminUser, service: OrderServiceDep) -> OrderAdminResponse:
    """Includes refunds, internal note and the statuses it can move to next."""
    return await service.admin_get(order_id)


@admin_router.patch(
    "/{order_id}",
    response_model=OrderAdminResponse,
    summary="Update status, tracking or notes (admin)",
    responses={**_ADMIN, **_NOT_FOUND, 409: {"description": "Status change not allowed from the current status"}},
)
async def admin_update_order(
    order_id: uuid.UUID, payload: OrderAdminUpdate, admin: AdminUser, service: OrderServiceDep
) -> OrderAdminResponse:
    """Status moves forward: confirmed → packed → shipped → delivered (→ returned).
    Cancelling restocks items and refunds card payments. Delivered cash orders are marked paid."""
    return await service.admin_update(order_id, payload, actor_id=admin.id)


@admin_router.post(
    "/{order_id}/refunds",
    response_model=OrderAdminResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Refund an order (admin)",
    responses={
        **_ADMIN,
        **_NOT_FOUND,
        409: {"description": "Order is not paid"},
        422: {"description": "Amount is more than what is left to refund"},
    },
)
async def admin_refund_order(
    order_id: uuid.UUID, payload: RefundCreate, admin: AdminUser, service: OrderServiceDep
) -> OrderAdminResponse:
    """Full refund when `amount` is omitted, otherwise partial. Several partial refunds are allowed."""
    return await service.admin_refund(order_id, payload, actor_id=admin.id)

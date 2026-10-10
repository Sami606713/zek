"""Cart endpoints for signed-in shoppers and guests.

Signed-in requests use the cart of the user in the access token. Guests send a random
`X-Session-Id` header (generated once by the client and kept in local storage).
After signing in, call `POST /cart/merge` with the same header to move the guest cart over.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status

from src.app.api.v1.schemas.cart import CartItemAdd, CartItemUpdate, CartResponse, DiscountApply
from src.app.api.v1.services.cart_service import CartOwner, CartService
from src.app.deps import CurrentUser, DbSession, OptionalUser

router = APIRouter(prefix="/cart", tags=["Cart"])

SESSION_ID_PATTERN = r"^[A-Za-z0-9_-]{16,100}$"

SessionHeader = Annotated[
    str | None,
    Header(
        alias="X-Session-Id",
        pattern=SESSION_ID_PATTERN,
        description="Guests only: a random id (16-100 letters, digits, - or _) that identifies the cart",
    ),
]


def get_cart_service(db: DbSession) -> CartService:
    return CartService(db)


CartServiceDep = Annotated[CartService, Depends(get_cart_service)]


def get_cart_owner(user: OptionalUser, session_id: SessionHeader = None) -> CartOwner:
    if user is not None:
        return CartOwner(user_id=user.id)
    if session_id:
        return CartOwner(session_id=session_id)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sign in, or send an X-Session-Id header to use a guest cart",
    )


Owner = Annotated[CartOwner, Depends(get_cart_owner)]

_OWNER_ERRORS = {401: {"description": "No access token and no X-Session-Id header"}}
_ITEM_ERRORS = {
    404: {"description": "Item not in the cart, or product not available"},
    409: {"description": "Not enough stock, or sold out"},
}


@router.get("", response_model=CartResponse, summary="Get the cart", responses=_OWNER_ERRORS)
async def get_cart(owner: Owner, service: CartServiceDep) -> CartResponse:
    """Lines with live prices and stock, plus totals. Lines that can no longer be bought are flagged in `issue`."""
    return await service.get(owner)


@router.post(
    "/items",
    response_model=CartResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add an item",
    responses={**_OWNER_ERRORS, **_ITEM_ERRORS},
)
async def add_item(payload: CartItemAdd, owner: Owner, service: CartServiceDep) -> CartResponse:
    """Adding a variant that is already in the cart increases its quantity."""
    return await service.add_item(owner, payload)


@router.patch(
    "/items/{item_id}",
    response_model=CartResponse,
    summary="Change an item's quantity",
    responses={**_OWNER_ERRORS, **_ITEM_ERRORS},
)
async def update_item(item_id: int, payload: CartItemUpdate, owner: Owner, service: CartServiceDep) -> CartResponse:
    return await service.update_item(owner, item_id, payload)


@router.delete(
    "/items/{item_id}",
    response_model=CartResponse,
    summary="Remove an item",
    responses={**_OWNER_ERRORS, 404: {"description": "Item not in the cart"}},
)
async def remove_item(item_id: int, owner: Owner, service: CartServiceDep) -> CartResponse:
    return await service.remove_item(owner, item_id)


@router.delete("", response_model=CartResponse, summary="Empty the cart", responses=_OWNER_ERRORS)
async def clear_cart(owner: Owner, service: CartServiceDep) -> CartResponse:
    """Removes every item and the promo code."""
    return await service.clear(owner)


@router.post(
    "/discount",
    response_model=CartResponse,
    summary="Apply a promo code",
    responses={**_OWNER_ERRORS, 400: {"description": "Code invalid, expired, used up or below its minimum order"}},
)
async def apply_discount(payload: DiscountApply, owner: Owner, service: CartServiceDep) -> CartResponse:
    """The code is re-checked on every cart read, so it drops off if the cart no longer qualifies."""
    return await service.apply_discount(owner, payload)


@router.delete("/discount", response_model=CartResponse, summary="Remove the promo code", responses=_OWNER_ERRORS)
async def remove_discount(owner: Owner, service: CartServiceDep) -> CartResponse:
    return await service.remove_discount(owner)


@router.post(
    "/merge",
    response_model=CartResponse,
    summary="Move the guest cart into my account",
    responses={401: {"description": "Not signed in"}, 422: {"description": "Missing or invalid X-Session-Id"}},
)
async def merge_cart(
    user: CurrentUser,
    service: CartServiceDep,
    session_id: Annotated[str, Header(alias="X-Session-Id", pattern=SESSION_ID_PATTERN)],
) -> CartResponse:
    """Call right after sign-in. Quantities are combined (capped at stock) and the guest cart is deleted."""
    return await service.merge_guest_cart(user.id, session_id)

"""The signed-in shopper's wishlist."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from src.app.api.v1.schemas.wishlist import WishlistAdd, WishlistIds, WishlistResponse
from src.app.api.v1.services.wishlist_service import WishlistService
from src.app.deps import CurrentUser, DbSession

router = APIRouter(prefix="/me/wishlist", tags=["Wishlist"])


def get_wishlist_service(db: DbSession) -> WishlistService:
    return WishlistService(db)


WishlistServiceDep = Annotated[WishlistService, Depends(get_wishlist_service)]

_AUTH = {401: {"description": "Missing, invalid or expired access token"}}


@router.get("", response_model=WishlistResponse, summary="My wishlist", responses=_AUTH)
async def get_wishlist(user: CurrentUser, service: WishlistServiceDep) -> WishlistResponse:
    """Newest first, with live price and stock. Deleted products drop off; unpublished or sold-out ones are flagged."""
    return await service.list_items(user.id)


@router.get("/ids", response_model=WishlistIds, summary="Saved product ids", responses=_AUTH)
async def get_wishlist_ids(user: CurrentUser, service: WishlistServiceDep) -> WishlistIds:
    """Lightweight list for showing filled hearts on product cards."""
    return WishlistIds(product_ids=await service.ids(user.id))


@router.post(
    "",
    response_model=WishlistResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save a product",
    responses={
        **_AUTH,
        200: {"description": "Already saved; nothing changed"},
        400: {"description": "variant_id does not belong to the product"},
        404: {"description": "Product not found"},
        409: {"description": "Wishlist is full"},
    },
)
async def add_to_wishlist(
    payload: WishlistAdd, user: CurrentUser, service: WishlistServiceDep, response: Response
) -> WishlistResponse:
    """Safe to call twice: saving an already saved product returns 200 instead of 201."""
    wishlist, created = await service.add(user.id, payload)
    if not created:
        response.status_code = status.HTTP_200_OK
    return wishlist


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a product",
    responses={**_AUTH, 404: {"description": "Product is not in the wishlist"}},
)
async def remove_from_wishlist(product_id: uuid.UUID, user: CurrentUser, service: WishlistServiceDep) -> None:
    await service.remove(user.id, product_id)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT, summary="Clear my wishlist", responses=_AUTH)
async def clear_wishlist(user: CurrentUser, service: WishlistServiceDep) -> None:
    await service.clear(user.id)

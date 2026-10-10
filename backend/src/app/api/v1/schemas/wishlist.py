import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from src.app.api.v1.schemas.product import ProductListItem

MAX_WISHLIST_ITEMS = 200


class WishlistAdd(BaseModel):
    product_id: uuid.UUID
    variant_id: uuid.UUID | None = Field(None, description="Optional: remember the colour/size the shopper liked")


class WishlistItem(BaseModel):
    product: ProductListItem
    variant_id: uuid.UUID | None
    is_available: bool = Field(..., description="False when unpublished or sold out")
    added_at: datetime


class WishlistResponse(BaseModel):
    items: list[WishlistItem]
    total: int


class WishlistIds(BaseModel):
    product_ids: list[uuid.UUID] = Field(..., description="Saved product ids, for filling heart icons in lists")

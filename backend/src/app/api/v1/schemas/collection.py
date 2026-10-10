import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator

from src.app.api.v1.schemas.category import Slug
from src.app.api.v1.schemas.product import ProductListItem


class CollectionSort(str, Enum):
    CURATED = "curated"          # the order chosen by the admin
    NEWEST = "newest"
    PRICE_ASC = "price_asc"
    PRICE_DESC = "price_desc"
    RATING = "rating"


# ─────────────────────────────────────────────────────────────────────────────
# Requests
# ─────────────────────────────────────────────────────────────────────────────

class _Window(BaseModel):
    @model_validator(mode="after")
    def _check_window(self):
        starts, ends = getattr(self, "starts_at", None), getattr(self, "ends_at", None)
        if starts and ends and ends <= starts:
            raise ValueError("ends_at must be after starts_at")
        return self


class CollectionCreate(_Window):
    title: str = Field(..., min_length=2, max_length=120)
    slug: Slug | None = Field(None, description="Generated from the title when omitted")
    blurb: str | None = Field(None, max_length=500)
    image_url: HttpUrl | None = Field(None, description="External banner URL. Use the image upload endpoint for Cloudinary.")
    is_published: bool = False
    sort_order: int = Field(0, ge=0, le=10_000)
    starts_at: datetime | None = Field(None, description="Optional: hidden before this time")
    ends_at: datetime | None = Field(None, description="Optional: hidden after this time")
    product_ids: list[uuid.UUID] = Field(default_factory=list, max_length=500, description="Products in display order")

    @field_validator("title")
    @classmethod
    def _strip_title(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Title must be at least 2 characters")
        return value


class CollectionUpdate(_Window):
    """Only the fields sent are changed. Products are managed with the /products endpoints."""

    title: str | None = Field(None, min_length=2, max_length=120)
    slug: Slug | None = None
    blurb: str | None = Field(None, max_length=500)
    image_url: HttpUrl | None = None
    is_published: bool | None = None
    sort_order: int | None = Field(None, ge=0, le=10_000)
    starts_at: datetime | None = None
    ends_at: datetime | None = None

    @field_validator("title")
    @classmethod
    def _strip_title(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None


class CollectionProductsSet(BaseModel):
    product_ids: list[uuid.UUID] = Field(..., max_length=500, description="The full list, in display order. Replaces the current list.")


class CollectionProductAdd(BaseModel):
    product_id: uuid.UUID
    position: int | None = Field(None, ge=0, description="Insert at this position; appended when omitted")


# ─────────────────────────────────────────────────────────────────────────────
# Responses
# ─────────────────────────────────────────────────────────────────────────────

class CollectionCard(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    blurb: str | None
    image_url: str | None
    product_count: int = Field(..., description="Products a shopper can see")
    preview_images: list[str] = Field(default_factory=list, description="Main image of the first few products")
    sort_order: int
    is_published: bool
    is_live: bool = Field(..., description="Published and inside its date window right now")
    starts_at: datetime | None
    ends_at: datetime | None


class CollectionDetail(CollectionCard):
    products: list[ProductListItem]
    created_at: datetime
    updated_at: datetime


class CollectionAdminProduct(BaseModel):
    position: int
    product: ProductListItem


class CollectionAdminDetail(CollectionCard):
    has_hosted_image: bool
    products: list[CollectionAdminProduct] = Field(..., description="Every product in the collection, any status")
    created_at: datetime
    updated_at: datetime


class CollectionListResponse(BaseModel):
    items: list[CollectionCard]
    total: int
    skip: int
    limit: int

import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator

from src.app.api.v1.models.base import ProductStatus
from src.app.api.v1.schemas.category import CategorySummary, Slug

Price = Annotated[Decimal, Field(ge=0, max_digits=10, decimal_places=2)]
HexColor = Annotated[str, Field(pattern=r"^#[0-9a-fA-F]{6}$", description="e.g. #1d1e22")]
Sku = Annotated[str, Field(min_length=2, max_length=64, pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*$")]
ShortText = Annotated[str, Field(min_length=1, max_length=200)]


class ProductSort(str, Enum):
    FEATURED = "featured"
    NEWEST = "newest"
    PRICE_ASC = "price_asc"
    PRICE_DESC = "price_desc"
    RATING = "rating"
    NAME = "name"


# ─────────────────────────────────────────────────────────────────────────────
# Variants
# ─────────────────────────────────────────────────────────────────────────────

class VariantCreate(BaseModel):
    sku: Sku | None = Field(None, description="Generated from the product slug and options when omitted")
    color_name: str | None = Field(None, max_length=50)
    color_hex: HexColor | None = None
    size: str | None = Field(None, max_length=20)
    price: Price | None = Field(None, description="Overrides the product price for this variant")
    stock_qty: int = Field(0, ge=0, le=1_000_000)
    position: int = Field(0, ge=0)
    is_active: bool = True


class VariantUpdate(BaseModel):
    sku: Sku | None = None
    color_name: str | None = Field(None, max_length=50)
    color_hex: HexColor | None = None
    size: str | None = Field(None, max_length=20)
    price: Price | None = None
    position: int | None = Field(None, ge=0)
    is_active: bool | None = None


class StockAdjust(BaseModel):
    """Send exactly one of `set_to` (absolute) or `change_by` (relative, can be negative)."""

    set_to: int | None = Field(None, ge=0, le=1_000_000)
    change_by: int | None = Field(None, ge=-1_000_000, le=1_000_000)
    reason: str | None = Field(None, max_length=200, description="Recorded in the audit log, e.g. 'restock' or 'damaged'")

    @model_validator(mode="after")
    def _one_of(self) -> "StockAdjust":
        if (self.set_to is None) == (self.change_by is None):
            raise ValueError("Send exactly one of set_to or change_by")
        if self.change_by == 0:
            raise ValueError("change_by cannot be 0")
        return self


class VariantResponse(BaseModel):
    id: uuid.UUID
    sku: str
    color_name: str | None
    color_hex: str | None
    size: str | None
    price: Decimal | None
    effective_price: Decimal = Field(..., description="Variant price, or the product price when not overridden")
    stock_qty: int
    in_stock: bool
    position: int
    is_active: bool


# ─────────────────────────────────────────────────────────────────────────────
# Images
# ─────────────────────────────────────────────────────────────────────────────

class ImageFromUrl(BaseModel):
    url: HttpUrl
    alt_text: str | None = Field(None, max_length=200)
    variant_id: uuid.UUID | None = None


class ImageUpdate(BaseModel):
    alt_text: str | None = Field(None, max_length=200)
    variant_id: uuid.UUID | None = None
    position: int | None = Field(None, ge=0)


class ImageOrder(BaseModel):
    image_ids: list[uuid.UUID] = Field(..., min_length=1, description="Every image of the product, in the new order")


class ImageResponse(BaseModel):
    id: uuid.UUID
    url: str
    alt_text: str | None
    width: int | None
    height: int | None
    position: int
    variant_id: uuid.UUID | None
    is_hosted: bool = Field(..., description="True when stored on Cloudinary, false for external URLs")


# ─────────────────────────────────────────────────────────────────────────────
# Products
# ─────────────────────────────────────────────────────────────────────────────

class ProductBase(BaseModel):
    @field_validator("details", "tags", check_fields=False)
    @classmethod
    def _clean_list(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        seen, cleaned = set(), []
        for item in (v.strip() for v in value):
            if item and item.lower() not in seen:
                seen.add(item.lower())
                cleaned.append(item)
        return cleaned


class ProductCreate(ProductBase):
    name: str = Field(..., min_length=2, max_length=200)
    slug: Slug | None = Field(None, description="Generated from the name when omitted")
    brand: str | None = Field(None, max_length=100)
    category_id: uuid.UUID | None = None
    description: str | None = Field(None, max_length=5000)
    details: list[ShortText] = Field(default_factory=list, max_length=30)
    tags: list[Annotated[str, Field(min_length=1, max_length=50)]] = Field(default_factory=list, max_length=30)
    price: Price
    compare_at_price: Price | None = Field(None, description="Original price shown crossed out; must be above price")
    currency: str = Field("USD", pattern=r"^[A-Z]{3}$")
    status: ProductStatus = ProductStatus.DRAFT
    is_featured: bool = False
    low_stock_threshold: int = Field(5, ge=0, le=10_000)
    seo_title: str | None = Field(None, max_length=200)
    seo_description: str | None = Field(None, max_length=320)
    variants: list[VariantCreate] = Field(
        default_factory=list,
        max_length=100,
        description="At least one is created; a default variant is added when this is empty",
    )

    @model_validator(mode="after")
    def _check_prices(self) -> "ProductCreate":
        if self.compare_at_price is not None and self.compare_at_price <= self.price:
            raise ValueError("compare_at_price must be greater than price")
        return self


class ProductUpdate(ProductBase):
    """Only the fields sent are changed. Send `compare_at_price: null` to end a sale."""

    name: str | None = Field(None, min_length=2, max_length=200)
    slug: Slug | None = None
    brand: str | None = Field(None, max_length=100)
    category_id: uuid.UUID | None = None
    description: str | None = Field(None, max_length=5000)
    details: list[ShortText] | None = Field(None, max_length=30)
    tags: list[Annotated[str, Field(min_length=1, max_length=50)]] | None = Field(None, max_length=30)
    price: Price | None = None
    compare_at_price: Price | None = None
    currency: str | None = Field(None, pattern=r"^[A-Z]{3}$")
    status: ProductStatus | None = None
    is_featured: bool | None = None
    low_stock_threshold: int | None = Field(None, ge=0, le=10_000)
    seo_title: str | None = Field(None, max_length=200)
    seo_description: str | None = Field(None, max_length=320)


class ColorOption(BaseModel):
    name: str
    hex: str | None


class ProductListItem(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    brand: str | None
    category: CategorySummary | None
    price: Decimal
    compare_at_price: Decimal | None
    currency: str
    is_on_sale: bool
    is_featured: bool
    rating_avg: float
    review_count: int
    image: ImageResponse | None
    colors: list[ColorOption]
    in_stock: bool
    total_stock: int
    is_low_stock: bool
    status: ProductStatus
    created_at: datetime
    published_at: datetime | None


class ProductDetail(ProductListItem):
    description: str | None
    details: list[str]
    tags: list[str]
    seo_title: str | None
    seo_description: str | None
    images: list[ImageResponse]
    variants: list[VariantResponse]
    updated_at: datetime


class ProductAdminDetail(ProductDetail):
    low_stock_threshold: int
    search_text: str | None
    embedded_at: datetime | None
    deleted_at: datetime | None


class ProductListResponse(BaseModel):
    items: list[ProductListItem]
    total: int
    skip: int
    limit: int

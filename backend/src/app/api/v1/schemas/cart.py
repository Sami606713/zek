import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

MAX_LINE_QUANTITY = 99


# ─────────────────────────────────────────────────────────────────────────────
# Requests
# ─────────────────────────────────────────────────────────────────────────────

class CartItemAdd(BaseModel):
    variant_id: uuid.UUID = Field(..., description="The exact variant (colour/size) to buy")
    quantity: int = Field(1, ge=1, le=MAX_LINE_QUANTITY, description="Added to the quantity already in the cart")


class CartItemUpdate(BaseModel):
    quantity: int = Field(..., ge=1, le=MAX_LINE_QUANTITY, description="The new quantity for this line")


class DiscountApply(BaseModel):
    code: str = Field(..., min_length=1, max_length=40)


# ─────────────────────────────────────────────────────────────────────────────
# Responses
# ─────────────────────────────────────────────────────────────────────────────

class CartLine(BaseModel):
    id: int
    variant_id: uuid.UUID
    product_id: uuid.UUID
    slug: str
    name: str
    brand: str | None
    image_url: str | None
    sku: str
    color_name: str | None
    color_hex: str | None
    size: str | None
    unit_price: Decimal
    compare_at_price: Decimal | None
    quantity: int
    line_total: Decimal
    stock_qty: int
    max_quantity: int = Field(..., description="Highest quantity that can be ordered right now")
    is_available: bool = Field(..., description="False when the product was removed, unpublished or sold out")
    issue: str | None = Field(None, description="Why the line needs attention, e.g. 'Only 2 left'")


class AppliedDiscount(BaseModel):
    code: str
    description: str | None
    amount: Decimal


class CartResponse(BaseModel):
    id: uuid.UUID | None = Field(None, description="Null until the first item is added")
    items: list[CartLine]
    item_count: int = Field(..., description="Total units of available items")
    currency: str = "USD"

    subtotal: Decimal
    discount: AppliedDiscount | None
    discount_code: str | None = Field(None, description="The code entered, even if it no longer applies")
    discount_error: str | None = Field(None, description="Why the entered code does not apply right now")
    shipping: Decimal = Field(..., description="Standard shipping estimate")
    express_shipping: Decimal
    tax: Decimal = Field(..., description="Estimate; final tax is set at checkout")
    total: Decimal
    free_shipping_threshold: Decimal
    remaining_for_free_shipping: Decimal

    has_issues: bool = Field(..., description="True when any line is unavailable or over the stock")
    updated_at: datetime | None

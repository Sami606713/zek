import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field, model_validator

from src.app.api.v1.models.base import (
    DeliveryMethod,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    RefundStatus,
    SalesChannel,
)
from src.app.api.v1.schemas.address import AddressCreate
from src.app.api.v1.schemas.user import PhoneNumber


# ─────────────────────────────────────────────────────────────────────────────
# Checkout
# ─────────────────────────────────────────────────────────────────────────────

class ShippingAddressInput(AddressCreate):
    """Same fields as a saved address. `label` and `is_default` are ignored here."""


class CheckoutRequest(BaseModel):
    email: EmailStr | None = Field(None, description="Required for guests. Signed-in shoppers default to their account email.")
    phone: PhoneNumber | None = None

    address_id: uuid.UUID | None = Field(None, description="Signed-in only: use a saved address")
    shipping_address: ShippingAddressInput | None = Field(None, description="Or send the address inline")
    save_address: bool = Field(False, description="Signed-in only: also save the inline address to the address book")

    delivery_method: DeliveryMethod = DeliveryMethod.STANDARD
    payment_method: PaymentMethod
    card_last4: str | None = Field(
        None,
        pattern=r"^\d{4}$",
        description="Card payments: last 4 digits only, for the receipt. Never send the full card number.",
    )

    expected_total: Decimal | None = Field(
        None,
        ge=0,
        description="The total the shopper saw. If prices changed since, the order is refused with 409.",
    )
    customer_note: str | None = Field(None, max_length=500)
    channel: SalesChannel = SalesChannel.WEB

    @model_validator(mode="after")
    def _check(self) -> "CheckoutRequest":
        if (self.address_id is None) == (self.shipping_address is None):
            raise ValueError("Send exactly one of address_id or shipping_address")
        if self.payment_method == PaymentMethod.CARD and not self.card_last4:
            raise ValueError("card_last4 is required for card payments")
        if self.payment_method == PaymentMethod.CASH_ON_DELIVERY and self.card_last4:
            raise ValueError("card_last4 is only for card payments")
        return self


class CancelRequest(BaseModel):
    reason: str | None = Field(None, max_length=300)
    email: EmailStr | None = Field(None, description="Guests: the email used at checkout")


# ─────────────────────────────────────────────────────────────────────────────
# Responses
# ─────────────────────────────────────────────────────────────────────────────

class ShippingAddress(BaseModel):
    full_name: str
    phone: str | None = None
    line1: str
    line2: str | None = None
    city: str
    region: str
    postal_code: str
    country: str


class OrderItemResponse(BaseModel):
    id: int
    product_id: uuid.UUID | None
    variant_id: uuid.UUID | None
    product_slug: str | None = Field(None, description="Null if the product was deleted since")
    product_name: str
    brand: str | None
    sku: str | None
    color_name: str | None
    size: str | None
    image_url: str | None
    unit_price: Decimal
    quantity: int
    line_total: Decimal


class StatusEvent(BaseModel):
    from_status: OrderStatus | None
    to_status: OrderStatus
    note: str | None
    created_at: datetime


class OrderSummary(BaseModel):
    id: uuid.UUID
    order_number: str
    status: OrderStatus
    payment_status: PaymentStatus
    total: Decimal
    currency: str
    item_count: int
    preview_images: list[str]
    created_at: datetime
    estimated_delivery_from: datetime | None
    estimated_delivery_to: datetime | None


class OrderResponse(BaseModel):
    id: uuid.UUID
    order_number: str
    status: OrderStatus
    payment_status: PaymentStatus
    payment_method: PaymentMethod
    delivery_method: DeliveryMethod
    channel: SalesChannel

    email: str
    phone: str | None
    shipping_address: ShippingAddress
    items: list[OrderItemResponse]

    subtotal: Decimal
    discount_total: Decimal
    discount_code: str | None
    shipping_total: Decimal
    tax_total: Decimal
    total: Decimal
    refunded_total: Decimal
    currency: str
    card_last4: str | None

    carrier: str | None
    tracking_number: str | None
    estimated_delivery_from: datetime | None
    estimated_delivery_to: datetime | None
    paid_at: datetime | None
    packed_at: datetime | None
    shipped_at: datetime | None
    delivered_at: datetime | None
    cancelled_at: datetime | None
    cancel_reason: str | None
    customer_note: str | None

    can_cancel: bool
    status_history: list[StatusEvent]
    created_at: datetime
    updated_at: datetime


class RefundResponse(BaseModel):
    id: uuid.UUID
    amount: Decimal
    reason: str | None
    status: RefundStatus
    created_at: datetime


class OrderAdminResponse(OrderResponse):
    user_id: uuid.UUID | None
    internal_note: str | None
    stripe_payment_intent_id: str | None
    refunds: list[RefundResponse]
    allowed_next_statuses: list[OrderStatus]


class OrderListResponse(BaseModel):
    items: list[OrderSummary]
    total: int
    skip: int
    limit: int


class AdminOrderRow(OrderSummary):
    email: str
    customer_name: str
    channel: SalesChannel
    payment_method: PaymentMethod
    delivery_method: DeliveryMethod


class AdminOrderListResponse(BaseModel):
    items: list[AdminOrderRow]
    total: int
    skip: int
    limit: int


# ─────────────────────────────────────────────────────────────────────────────
# Admin requests
# ─────────────────────────────────────────────────────────────────────────────

class OrderAdminUpdate(BaseModel):
    """Only the fields sent are changed. Status moves forward one step at a time (see allowed_next_statuses)."""

    status: OrderStatus | None = None
    note: str | None = Field(None, max_length=300, description="Shown in the status history")
    carrier: str | None = Field(None, max_length=50)
    tracking_number: str | None = Field(None, max_length=100)
    estimated_delivery_from: date | None = None
    estimated_delivery_to: date | None = None
    internal_note: str | None = Field(None, max_length=2000)


class RefundCreate(BaseModel):
    amount: Decimal | None = Field(None, gt=0, max_digits=10, decimal_places=2, description="Omit to refund everything left")
    reason: str | None = Field(None, max_length=300)

import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, Field, field_validator, model_validator

from src.app.api.v1.models.base import DiscountType

Code = Annotated[str, Field(min_length=3, max_length=40, description="Letters, digits, - and _. Stored in uppercase.")]
Amount = Annotated[Decimal, Field(gt=0, max_digits=10, decimal_places=2)]


def _normalise_code(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip().upper()
    if not value.replace("-", "").replace("_", "").isalnum() or not value.isascii():
        raise ValueError("Code can only contain letters, digits, - and _")
    return value


class DiscountStatus(str, Enum):
    ACTIVE = "active"            # usable right now
    SCHEDULED = "scheduled"      # starts in the future
    EXPIRED = "expired"          # end date passed
    USED_UP = "used_up"          # usage limit reached
    INACTIVE = "inactive"        # switched off by an admin


# ─────────────────────────────────────────────────────────────────────────────
# Public
# ─────────────────────────────────────────────────────────────────────────────

class DiscountValidateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=40)
    subtotal: Decimal = Field(..., ge=0, max_digits=10, decimal_places=2, description="Order subtotal before discount")


class DiscountValidateResponse(BaseModel):
    valid: bool
    code: str
    description: str | None = None
    type: DiscountType | None = None
    value: Decimal | None = None
    amount: Decimal = Field(Decimal("0.00"), description="Discount for this subtotal")
    message: str | None = Field(None, description="Why the code does not apply")


# ─────────────────────────────────────────────────────────────────────────────
# Admin
# ─────────────────────────────────────────────────────────────────────────────

class _Rules(BaseModel):
    @model_validator(mode="after")
    def _check_rules(self):
        type_, value = getattr(self, "type", None), getattr(self, "value", None)
        if type_ == DiscountType.PERCENT and value is not None and value > 100:
            raise ValueError("A percent discount cannot be more than 100")
        starts, ends = getattr(self, "starts_at", None), getattr(self, "ends_at", None)
        if starts and ends and ends <= starts:
            raise ValueError("ends_at must be after starts_at")
        return self


class DiscountCreate(_Rules):
    code: Code
    description: str | None = Field(None, max_length=200)
    type: DiscountType
    value: Amount = Field(..., description="10 means 10% for percent codes, or $10 for fixed codes")
    min_order_amount: Amount | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    usage_limit: int | None = Field(None, ge=1, description="Total uses across all customers; empty = unlimited")
    per_customer_limit: int | None = Field(None, ge=1, description="Uses per signed-in customer; empty = unlimited")
    is_active: bool = True

    @field_validator("code")
    @classmethod
    def _code(cls, value: str) -> str:
        return _normalise_code(value)


class DiscountUpdate(_Rules):
    """Only the fields sent are changed. Send null to clear an optional limit or date."""

    code: Code | None = None
    description: str | None = Field(None, max_length=200)
    type: DiscountType | None = None
    value: Amount | None = None
    min_order_amount: Amount | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    usage_limit: int | None = Field(None, ge=1)
    per_customer_limit: int | None = Field(None, ge=1)
    is_active: bool | None = None

    @field_validator("code")
    @classmethod
    def _code(cls, value: str | None) -> str | None:
        return _normalise_code(value)


class DiscountResponse(BaseModel):
    id: uuid.UUID
    code: str
    description: str | None
    type: DiscountType
    value: Decimal
    min_order_amount: Decimal | None
    starts_at: datetime | None
    ends_at: datetime | None
    usage_limit: int | None
    per_customer_limit: int | None
    used_count: int
    remaining_uses: int | None = Field(None, description="Null when unlimited")
    is_active: bool
    status: DiscountStatus
    created_at: datetime
    updated_at: datetime


class DiscountDetail(DiscountResponse):
    orders_count: int = Field(..., description="Orders placed with this code (not cancelled)")
    total_discounted: Decimal = Field(..., description="Money given away through this code")
    revenue: Decimal = Field(..., description="Order totals paid with this code")


class DiscountListResponse(BaseModel):
    items: list[DiscountResponse]
    total: int
    skip: int
    limit: int

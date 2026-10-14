"""Admin customer views: accounts with their order totals."""

import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from src.app.api.v1.schemas.address import AddressResponse


class CustomerSegment(str, Enum):
    NEW = "new"                # joined in the last 30 days
    REPEAT = "repeat"          # 2 or more orders
    NO_ORDERS = "no_orders"
    ADMINS = "admins"
    LOCKED = "locked"          # too many failed logins
    INACTIVE = "inactive"      # turned off by an admin


class CustomerSort(str, Enum):
    NEWEST = "newest"
    SPENT = "spent"
    ORDERS = "orders"
    LAST_ORDER = "last_order"
    NAME = "name"


class CustomerRow(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    full_name: str | None
    phone_number: str | None
    role: str
    is_active: bool
    is_verified: bool
    is_superuser: bool
    is_locked: bool
    login_attempts: int
    created_at: datetime
    last_login_at: datetime | None
    orders_count: int
    total_spent: Decimal = Field(..., description="Paid order totals minus refunds")
    last_order_at: datetime | None
    location: str | None = Field(None, description="City and country of the default (or first) saved address")


class CustomerSummary(BaseModel):
    customers: int
    new_30d: int
    repeat_rate: float = Field(..., description="Share of buyers with 2+ orders, 0 to 1")
    average_spent: Decimal = Field(..., description="Average total spent per customer who has bought")
    locked: int


class CustomerListResponse(BaseModel):
    items: list[CustomerRow]
    total: int
    skip: int
    limit: int
    summary: CustomerSummary = Field(..., description="For all accounts, ignoring filters")


class CustomerDetail(CustomerRow):
    refunded_total: Decimal
    average_order: Decimal
    addresses: list[AddressResponse]


class CustomerAccessUpdate(BaseModel):
    """Send one or both. Admins can't change their own role or turn themselves off."""

    role: Literal["customer", "admin"] | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def _something(self) -> "CustomerAccessUpdate":
        if self.role is None and self.is_active is None:
            raise ValueError("Send role and/or is_active")
        return self

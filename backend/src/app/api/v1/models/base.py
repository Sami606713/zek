"""Shared column helpers and enums for all models."""

import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, Numeric, func
from sqlalchemy.dialects.postgresql import UUID


def uuid_pk() -> Column:
    return Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)


def created_at_col() -> Column:
    return Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


def updated_at_col() -> Column:
    return Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


def money(nullable: bool = False, default: str | None = None) -> Column:
    """Money amounts are exact decimals (never floats)."""
    kwargs = {"nullable": nullable}
    if default is not None:
        kwargs["server_default"] = default
    return Column(Numeric(10, 2), **kwargs)


def str_enum(enum_cls: type[enum.Enum], **kwargs) -> Enum:
    """Enum stored as VARCHAR + CHECK constraint, so adding a value never needs a Postgres TYPE migration."""
    return Enum(
        enum_cls,
        native_enum=False,
        validate_strings=True,
        length=32,
        values_callable=lambda cls: [m.value for m in cls],
        **kwargs,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────────────────────────────────────

class ProductStatus(str, enum.Enum):
    ACTIVE = "active"
    DRAFT = "draft"
    ARCHIVED = "archived"


class OrderStatus(str, enum.Enum):
    PENDING = "pending"          # created, payment not confirmed yet
    CONFIRMED = "confirmed"
    PACKED = "packed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    RETURNED = "returned"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    PARTIALLY_REFUNDED = "partially_refunded"
    REFUNDED = "refunded"


class PaymentMethod(str, enum.Enum):
    CARD = "card"
    CASH_ON_DELIVERY = "cod"


class DeliveryMethod(str, enum.Enum):
    STANDARD = "standard"
    EXPRESS = "express"


class SalesChannel(str, enum.Enum):
    WEB = "web"
    AGENT = "agent"
    WHATSAPP = "whatsapp"
    VOICE = "voice"


class DiscountType(str, enum.Enum):
    PERCENT = "percent"
    FIXED = "fixed"


class RefundStatus(str, enum.Enum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"



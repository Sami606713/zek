"""Promo codes such as ZEK10."""

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Integer, String
from sqlalchemy.orm import validates

from src.app.database import Base
from src.app.api.v1.models.base import DiscountType, created_at_col, money, str_enum, updated_at_col, uuid_pk


class Discount(Base):
    __tablename__ = "discounts"
    __table_args__ = (
        CheckConstraint("value > 0", name="ck_discounts_value_positive"),
        CheckConstraint("type <> 'percent' OR value <= 100", name="ck_discounts_percent_max_100"),
        CheckConstraint("ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at", name="ck_discounts_valid_window"),
        CheckConstraint("usage_limit IS NULL OR usage_limit > 0", name="ck_discounts_usage_limit_positive"),
    )

    id = uuid_pk()
    code = Column(String(40), unique=True, nullable=False, index=True)    # stored uppercase
    description = Column(String(200), nullable=True)
    type = Column(str_enum(DiscountType, name="discount_type"), nullable=False)
    value = money()                                                        # 10 = 10% or $10
    min_order_amount = money(nullable=True)
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    usage_limit = Column(Integer, nullable=True)                           # null = unlimited
    per_customer_limit = Column(Integer, nullable=True)
    used_count = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = created_at_col()
    updated_at = updated_at_col()

    @validates("code")
    def _uppercase_code(self, _key, value: str) -> str:
        return value.strip().upper()

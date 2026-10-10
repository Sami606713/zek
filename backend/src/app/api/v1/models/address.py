"""Saved customer addresses."""

from sqlalchemy import Boolean, Column, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID

from src.app.database import Base
from src.app.api.v1.models.base import created_at_col, updated_at_col, uuid_pk


class Address(Base):
    __tablename__ = "addresses"
    __table_args__ = (
        # At most one default address per user.
        Index("uq_addresses_one_default_per_user", "user_id", unique=True, postgresql_where=text("is_default")),
    )

    id = uuid_pk()
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    label = Column(String(40), nullable=True)            # "Home", "Work"
    full_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    line1 = Column(String(200), nullable=False)
    line2 = Column(String(200), nullable=True)
    city = Column(String(100), nullable=False)
    region = Column(String(100), nullable=False)          # state / province
    postal_code = Column(String(20), nullable=False)
    country = Column(String(100), nullable=False)
    is_default = Column(Boolean, nullable=False, default=False)

    created_at = created_at_col()
    updated_at = updated_at_col()

"""Editable store settings (shipping rates, tax, support email...) as key/value pairs."""

from sqlalchemy import Column, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID

from src.app.database import Base
from src.app.api.v1.models.base import updated_at_col


class StoreSetting(Base):
    __tablename__ = "store_settings"

    key = Column(String(80), primary_key=True)          # "shipping.free_threshold", "tax.rate"
    value = Column(JSONB, nullable=False)
    description = Column(String(200), nullable=True)
    updated_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    updated_at = updated_at_col()

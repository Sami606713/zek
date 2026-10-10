"""Who changed what in the admin panel, and when."""

from sqlalchemy import Column, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID

from src.app.database import Base
from src.app.api.v1.models.base import created_at_col


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_logs_entity", "entity_type", "entity_id"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(60), nullable=False)          # "order.status_changed", "product.price_updated"
    entity_type = Column(String(40), nullable=False)     # "order", "product", "user", ...
    entity_id = Column(String(64), nullable=True)
    changes = Column(JSONB, nullable=True)               # {"field": [old, new]}
    ip_address = Column(INET, nullable=True)
    user_agent = Column(String(300), nullable=True)

    created_at = created_at_col()

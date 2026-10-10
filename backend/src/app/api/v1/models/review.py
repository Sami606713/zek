"""Product reviews."""

from sqlalchemy import Boolean, CheckConstraint, Column, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.app.database import Base
from src.app.api.v1.models.base import created_at_col, updated_at_col, uuid_pk


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_reviews_rating_range"),
        UniqueConstraint("product_id", "user_id", name="uq_reviews_one_per_user_product"),
    )

    id = uuid_pk()
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    rating = Column(Integer, nullable=False)
    title = Column(String(120), nullable=True)
    body = Column(Text, nullable=True)
    is_verified_purchase = Column(Boolean, nullable=False, default=False)
    is_published = Column(Boolean, nullable=False, default=True)

    created_at = created_at_col()
    updated_at = updated_at_col()

    product = relationship("Product", back_populates="reviews")

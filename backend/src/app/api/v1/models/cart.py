"""Shopping carts. A cart belongs to a signed-in user or, for guests, to a session id."""

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.app.database import Base
from src.app.api.v1.models.base import SalesChannel, created_at_col, str_enum, updated_at_col, uuid_pk


class Cart(Base):
    __tablename__ = "carts"
    __table_args__ = (
        CheckConstraint("user_id IS NOT NULL OR session_id IS NOT NULL", name="ck_carts_has_owner"),
    )

    id = uuid_pk()
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=True)
    session_id = Column(String(100), unique=True, nullable=True)   # guest carts / agent sessions
    discount_code = Column(String(40), nullable=True)
    channel = Column(str_enum(SalesChannel, name="cart_channel"), nullable=False, default=SalesChannel.WEB)

    created_at = created_at_col()
    updated_at = updated_at_col()
    expires_at = Column(DateTime(timezone=True), nullable=True)    # guest carts are cleaned up after this

    items = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan", order_by="CartItem.created_at")


class CartItem(Base):
    __tablename__ = "cart_items"
    __table_args__ = (
        UniqueConstraint("cart_id", "variant_id", name="uq_cart_items_variant"),
        CheckConstraint("quantity > 0", name="ck_cart_items_quantity_positive"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    cart_id = Column(UUID(as_uuid=True), ForeignKey("carts.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)

    created_at = created_at_col()
    updated_at = updated_at_col()

    cart = relationship("Cart", back_populates="items")
    variant = relationship("ProductVariant")

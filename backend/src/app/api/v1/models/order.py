"""Orders, their line items, status history and refunds.

Order items and the shipping address are snapshots: editing or deleting a product
later never changes what a past order shows.
"""

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from src.app.database import Base
from src.app.api.v1.models.base import (
    DeliveryMethod,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    RefundStatus,
    SalesChannel,
    created_at_col,
    money,
    str_enum,
    updated_at_col,
    uuid_pk,
)


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("total >= 0", name="ck_orders_total_non_negative"),
        Index("ix_orders_user_created", "user_id", "created_at"),
        Index("ix_orders_status_created", "status", "created_at"),
    )

    id = uuid_pk()
    order_number = Column(String(20), unique=True, nullable=False, index=True)   # "ZEK-482913"
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    email = Column(String(255), nullable=False, index=True)                      # guest checkout + receipts
    phone = Column(String(20), nullable=True)

    status = Column(str_enum(OrderStatus, name="order_status"), nullable=False, default=OrderStatus.PENDING)
    payment_status = Column(str_enum(PaymentStatus, name="payment_status"), nullable=False, default=PaymentStatus.PENDING)
    payment_method = Column(str_enum(PaymentMethod, name="payment_method"), nullable=False)
    delivery_method = Column(str_enum(DeliveryMethod, name="delivery_method"), nullable=False, default=DeliveryMethod.STANDARD)
    channel = Column(str_enum(SalesChannel, name="order_channel"), nullable=False, default=SalesChannel.WEB, index=True)

    # Snapshot: {name, phone, line1, line2, city, region, postal_code, country}
    shipping_address = Column(JSONB, nullable=False)

    # Totals
    subtotal = money()
    discount_total = money(default="0")
    shipping_total = money(default="0")
    tax_total = money(default="0")
    total = money()
    currency = Column(String(3), nullable=False, default="USD")
    discount_id = Column(UUID(as_uuid=True), ForeignKey("discounts.id", ondelete="SET NULL"), nullable=True)
    discount_code = Column(String(40), nullable=True)

    # Payment
    stripe_payment_intent_id = Column(String(100), unique=True, nullable=True)
    card_last4 = Column(String(4), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)

    # Fulfilment
    carrier = Column(String(50), nullable=True)
    tracking_number = Column(String(100), nullable=True)
    estimated_delivery_from = Column(DateTime(timezone=True), nullable=True)
    estimated_delivery_to = Column(DateTime(timezone=True), nullable=True)
    packed_at = Column(DateTime(timezone=True), nullable=True)
    shipped_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancel_reason = Column(String(300), nullable=True)

    customer_note = Column(Text, nullable=True)
    internal_note = Column(Text, nullable=True)        # admin only

    created_at = created_at_col()
    updated_at = updated_at_col()

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan", order_by="OrderItem.id")
    status_history = relationship(
        "OrderStatusHistory",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderStatusHistory.created_at",
    )
    refunds = relationship("Refund", back_populates="order", cascade="all, delete-orphan")
    discount = relationship("Discount")


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_order_items_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_order_items_price_non_negative"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True)

    # Snapshot at time of purchase
    product_name = Column(String(200), nullable=False)
    brand = Column(String(100), nullable=True)
    sku = Column(String(64), nullable=True)
    color_name = Column(String(50), nullable=True)
    size = Column(String(20), nullable=True)
    image_url = Column(String(500), nullable=True)

    unit_price = money()
    quantity = Column(Integer, nullable=False)
    line_total = money()

    order = relationship("Order", back_populates="items")
    product = relationship("Product")


class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status = Column(str_enum(OrderStatus, name="order_history_from_status"), nullable=True)
    to_status = Column(str_enum(OrderStatus, name="order_history_to_status"), nullable=False)
    note = Column(String(300), nullable=True)
    changed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # null = system/agent

    created_at = created_at_col()

    order = relationship("Order", back_populates="status_history")


class Refund(Base):
    __tablename__ = "refunds"
    __table_args__ = (CheckConstraint("amount > 0", name="ck_refunds_amount_positive"),)

    id = uuid_pk()
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = money()
    reason = Column(String(300), nullable=True)
    status = Column(str_enum(RefundStatus, name="refund_status"), nullable=False, default=RefundStatus.PENDING)
    stripe_refund_id = Column(String(100), unique=True, nullable=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = created_at_col()
    updated_at = updated_at_col()

    order = relationship("Order", back_populates="refunds")

"""Hand-picked product collections (e.g. "Gifts under $50")."""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.app.database import Base
from src.app.api.v1.models.base import created_at_col, updated_at_col, uuid_pk


class Collection(Base):
    __tablename__ = "collections"

    id = uuid_pk()
    slug = Column(String(80), unique=True, nullable=False, index=True)
    title = Column(String(120), nullable=False)
    blurb = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    image_public_id = Column(String(255), nullable=True)          # Cloudinary asset id of the banner
    is_published = Column(Boolean, nullable=False, default=False)
    sort_order = Column(Integer, nullable=False, default=0)
    starts_at = Column(DateTime(timezone=True), nullable=True)   # optional seasonal window
    ends_at = Column(DateTime(timezone=True), nullable=True)

    created_at = created_at_col()
    updated_at = updated_at_col()

    items = relationship(
        "CollectionProduct",
        back_populates="collection",
        cascade="all, delete-orphan",
        order_by="CollectionProduct.position",
    )


class CollectionProduct(Base):
    __tablename__ = "collection_products"
    __table_args__ = (UniqueConstraint("collection_id", "product_id", name="uq_collection_products"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    collection_id = Column(UUID(as_uuid=True), ForeignKey("collections.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(Integer, nullable=False, default=0)

    created_at = created_at_col()

    collection = relationship("Collection", back_populates="items")
    product = relationship("Product")

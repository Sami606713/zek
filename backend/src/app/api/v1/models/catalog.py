"""Catalogue: categories, products, product images and variants."""

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import relationship

from src.app.database import Base
from src.app.api.v1.models.base import (
    ProductStatus,
    created_at_col,
    money,
    str_enum,
    updated_at_col,
    uuid_pk,
)


class Category(Base):
    __tablename__ = "categories"

    id = uuid_pk()
    slug = Column(String(80), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = created_at_col()
    updated_at = updated_at_col()

    parent = relationship("Category", remote_side="Category.id", back_populates="children")
    children = relationship("Category", back_populates="parent")
    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("price >= 0", name="ck_products_price_non_negative"),
        CheckConstraint("compare_at_price IS NULL OR compare_at_price > price", name="ck_products_compare_at_above_price"),
        CheckConstraint("rating_avg >= 0 AND rating_avg <= 5", name="ck_products_rating_range"),
        Index("ix_products_status_category", "status", "category_id"),
    )

    id = uuid_pk()
    slug = Column(String(160), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False, index=True)
    brand = Column(String(100), nullable=True, index=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)

    description = Column(Text, nullable=True)
    details = Column(JSONB, nullable=False, default=list)        # ["35mm film, ISO 25 to 1600", ...]
    tags = Column(ARRAY(String(50)), nullable=False, default=list)

    # Pricing (variants may override price)
    price = money()
    compare_at_price = money(nullable=True)                       # original price when on sale
    currency = Column(String(3), nullable=False, default="USD")

    status = Column(str_enum(ProductStatus, name="product_status"), nullable=False, default=ProductStatus.DRAFT, index=True)
    is_featured = Column(Boolean, nullable=False, default=False)
    low_stock_threshold = Column(Integer, nullable=False, default=5)

    # Denormalised from reviews for fast listing/sorting
    rating_avg = Column(Float, nullable=False, default=0)
    review_count = Column(Integer, nullable=False, default=0)

    # SEO
    seo_title = Column(String(200), nullable=True)
    seo_description = Column(String(320), nullable=True)

    # Agent search: text the embedding was built from, and when (vector column added with pgvector)
    search_text = Column(Text, nullable=True)
    embedded_at = Column(DateTime(timezone=True), nullable=True)

    created_at = created_at_col()
    updated_at = updated_at_col()
    published_at = Column(DateTime(timezone=True), nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)   # soft delete

    category = relationship("Category", back_populates="products")
    images = relationship(
        "ProductImage",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductImage.position",
    )
    variants = relationship(
        "ProductVariant",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductVariant.position",
    )
    reviews = relationship("Review", back_populates="product", cascade="all, delete-orphan")


class ProductImage(Base):
    __tablename__ = "product_images"
    __table_args__ = (UniqueConstraint("public_id", name="uq_product_images_public_id"),)

    id = uuid_pk()
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True)
    url = Column(String(500), nullable=False)
    public_id = Column(String(255), nullable=True)   # Cloudinary asset id; null for external URLs
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    alt_text = Column(String(200), nullable=True)
    position = Column(Integer, nullable=False, default=0)

    created_at = created_at_col()

    product = relationship("Product", back_populates="images")


class ProductVariant(Base):
    """A buyable option of a product (e.g. colour/size). Every product has at least one variant; stock lives here."""

    __tablename__ = "product_variants"
    __table_args__ = (
        UniqueConstraint("product_id", "color_name", "size", name="uq_product_variants_option"),
        CheckConstraint("stock_qty >= 0", name="ck_product_variants_stock_non_negative"),
        CheckConstraint("price IS NULL OR price >= 0", name="ck_product_variants_price_non_negative"),
    )

    id = uuid_pk()
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    sku = Column(String(64), unique=True, nullable=False, index=True)

    color_name = Column(String(50), nullable=True)
    color_hex = Column(String(7), nullable=True)                  # "#1d1e22"
    size = Column(String(20), nullable=True)

    price = money(nullable=True)                                   # overrides product.price when set
    stock_qty = Column(Integer, nullable=False, default=0)
    position = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = created_at_col()
    updated_at = updated_at_col()

    product = relationship("Product", back_populates="variants")

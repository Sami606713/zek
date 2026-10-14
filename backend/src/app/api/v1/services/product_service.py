"""Product CRUD with variants, stock and Cloudinary-hosted images."""

import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import case, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.app.api.v1.models.audit_log import AuditLog
from src.app.api.v1.models.base import ProductStatus
from src.app.api.v1.models.catalog import Category, Product, ProductImage, ProductVariant
from src.app.api.v1.schemas.category import CategorySummary
from src.app.api.v1.schemas.product import (
    ColorOption,
    ImageFromUrl,
    ImageOrder,
    ImageResponse,
    ImageUpdate,
    ProductAdminDetail,
    ProductCreate,
    ProductDetail,
    ProductListItem,
    ProductSort,
    ProductUpdate,
    StockAdjust,
    VariantCreate,
    VariantResponse,
    VariantUpdate,
    InventoryResponse,
    InventoryRow,
    InventorySummary,
    StockLevel,
)
from src.app.api.v1.services import media_service
from src.app.api.v1.services.category_service import slugify

_LOAD = (
    selectinload(Product.category),
    selectinload(Product.images),
    selectinload(Product.variants),
)

_NOT_NULLABLE = {"name", "slug", "price", "currency", "status", "is_featured", "low_stock_threshold", "details", "tags"}


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _jsonable(value):
    if isinstance(value, (uuid.UUID, Decimal, datetime)):
        return str(value)
    if hasattr(value, "value"):  # enums
        return value.value
    return value


class ProductService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Serialisation ─────────────────────────────────────────────────────────

    @staticmethod
    def _image(img: ProductImage) -> ImageResponse:
        return ImageResponse(
            id=img.id,
            url=img.url,
            alt_text=img.alt_text,
            width=img.width,
            height=img.height,
            position=img.position,
            variant_id=img.variant_id,
            is_hosted=img.public_id is not None,
        )

    @staticmethod
    def _variant(v: ProductVariant, product: Product) -> VariantResponse:
        return VariantResponse(
            id=v.id,
            sku=v.sku,
            color_name=v.color_name,
            color_hex=v.color_hex,
            size=v.size,
            price=v.price,
            effective_price=v.price if v.price is not None else product.price,
            stock_qty=v.stock_qty,
            in_stock=v.is_active and v.stock_qty > 0,
            position=v.position,
            is_active=v.is_active,
        )

    def _list_item_fields(self, p: Product) -> dict:
        active = [v for v in p.variants if v.is_active]
        total_stock = sum(v.stock_qty for v in active)
        colors, seen = [], set()
        for v in active:
            if v.color_name and v.color_name not in seen:
                seen.add(v.color_name)
                colors.append(ColorOption(name=v.color_name, hex=v.color_hex))
        return dict(
            id=p.id,
            slug=p.slug,
            name=p.name,
            brand=p.brand,
            category=CategorySummary.model_validate(p.category) if p.category else None,
            price=p.price,
            compare_at_price=p.compare_at_price,
            currency=p.currency,
            is_on_sale=p.compare_at_price is not None and p.compare_at_price > p.price,
            is_featured=p.is_featured,
            rating_avg=p.rating_avg or 0,
            review_count=p.review_count or 0,
            image=self._image(p.images[0]) if p.images else None,
            colors=colors,
            in_stock=total_stock > 0,
            total_stock=total_stock,
            is_low_stock=0 < total_stock <= (p.low_stock_threshold or 0),
            status=p.status,
            created_at=p.created_at,
            published_at=p.published_at,
        )

    def to_list_item(self, p: Product) -> ProductListItem:
        return ProductListItem(**self._list_item_fields(p))

    def to_detail(self, p: Product, admin: bool = False) -> ProductDetail | ProductAdminDetail:
        variants = p.variants if admin else [v for v in p.variants if v.is_active]
        fields = dict(
            **self._list_item_fields(p),
            description=p.description,
            details=p.details or [],
            tags=p.tags or [],
            seo_title=p.seo_title,
            seo_description=p.seo_description,
            images=[self._image(i) for i in p.images],
            variants=[self._variant(v, p) for v in variants],
            updated_at=p.updated_at,
        )
        if admin:
            return ProductAdminDetail(
                **fields,
                low_stock_threshold=p.low_stock_threshold,
                search_text=p.search_text,
                embedded_at=p.embedded_at,
                deleted_at=p.deleted_at,
            )
        return ProductDetail(**fields)

    # ── Lookups ───────────────────────────────────────────────────────────────

    async def _load(self, product_id: uuid.UUID, include_deleted: bool = True) -> Product:
        q = select(Product).options(*_LOAD).where(Product.id == product_id).execution_options(populate_existing=True)
        if not include_deleted:
            q = q.where(Product.deleted_at.is_(None))
        product = await self.db.scalar(q)
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        return product

    async def _editable(self, product_id: uuid.UUID) -> Product:
        product = await self._load(product_id)
        if product.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product is deleted")
        return product

    async def _category_and_descendants(self, slug: str) -> list[uuid.UUID]:
        rows = (await self.db.execute(select(Category.id, Category.parent_id, Category.slug, Category.is_active))).all()
        root = next((r for r in rows if r.slug == slug and r.is_active), None)
        if root is None:
            return []
        ids, frontier = [root.id], [root.id]
        while frontier:
            frontier = [r.id for r in rows if r.parent_id in frontier and r.is_active]
            ids.extend(frontier)
        return ids

    # ── Public reads ──────────────────────────────────────────────────────────

    async def list_products(
        self,
        *,
        skip: int = 0,
        limit: int = 24,
        category: str | None = None,
        q: str | None = None,
        brand: str | None = None,
        min_price: Decimal | None = None,
        max_price: Decimal | None = None,
        min_rating: float | None = None,
        on_sale: bool = False,
        in_stock: bool = False,
        featured: bool = False,
        sort: ProductSort = ProductSort.FEATURED,
        admin: bool = False,
        status_filter: ProductStatus | None = None,
    ) -> tuple[list[ProductListItem], int]:
        filters = [Product.deleted_at.is_(None)]
        if admin:
            if status_filter:
                filters.append(Product.status == status_filter)
        else:
            filters.append(Product.status == ProductStatus.ACTIVE)

        if category:
            ids = await self._category_and_descendants(category)
            if not ids:
                return [], 0
            filters.append(Product.category_id.in_(ids))
        if q:
            term = f"%{_escape_like(q.strip().lower())}%"
            filters.append(
                func.lower(Product.name).like(term, escape="\\")
                | func.lower(func.coalesce(Product.brand, "")).like(term, escape="\\")
                | func.lower(func.coalesce(Product.description, "")).like(term, escape="\\")
                | func.lower(func.array_to_string(Product.tags, " ")).like(term, escape="\\")
            )
        if brand:
            filters.append(func.lower(Product.brand) == brand.strip().lower())
        if min_price is not None:
            filters.append(Product.price >= min_price)
        if max_price is not None:
            filters.append(Product.price <= max_price)
        if min_rating is not None:
            filters.append(Product.rating_avg >= min_rating)
        if on_sale:
            filters.append(Product.compare_at_price.is_not(None) & (Product.compare_at_price > Product.price))
        if featured:
            filters.append(Product.is_featured.is_(True))
        if in_stock:
            filters.append(
                exists().where(
                    ProductVariant.product_id == Product.id,
                    ProductVariant.is_active.is_(True),
                    ProductVariant.stock_qty > 0,
                )
            )

        order = {
            ProductSort.FEATURED: [Product.is_featured.desc(), Product.rating_avg.desc(), Product.created_at.desc()],
            ProductSort.NEWEST: [func.coalesce(Product.published_at, Product.created_at).desc()],
            ProductSort.PRICE_ASC: [Product.price.asc()],
            ProductSort.PRICE_DESC: [Product.price.desc()],
            ProductSort.RATING: [Product.rating_avg.desc(), Product.review_count.desc()],
            ProductSort.NAME: [func.lower(Product.name).asc()],
        }[sort]

        total = await self.db.scalar(select(func.count()).select_from(Product).where(*filters)) or 0
        result = await self.db.execute(
            select(Product).options(*_LOAD).where(*filters).order_by(*order, Product.id).offset(skip).limit(limit)
        )
        return [self.to_list_item(p) for p in result.scalars().all()], total

    async def get_by_slug(self, slug: str) -> ProductDetail:
        product = await self.db.scalar(
            select(Product)
            .options(*_LOAD)
            .where(Product.slug == slug, Product.deleted_at.is_(None), Product.status == ProductStatus.ACTIVE)
        )
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        return self.to_detail(product)

    async def related(self, slug: str, limit: int = 8) -> list[ProductListItem]:
        product = await self.db.scalar(
            select(Product).where(Product.slug == slug, Product.deleted_at.is_(None), Product.status == ProductStatus.ACTIVE)
        )
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

        # Same family first: the product's top-level category and everything under it.
        family: list[uuid.UUID] = []
        if product.category_id:
            root = await self.db.get(Category, product.category_id)
            while root is not None and root.parent_id:
                root = await self.db.get(Category, root.parent_id)
            if root is not None:
                family = await self._category_and_descendants(root.slug) or [product.category_id]

        in_family = Product.category_id.in_(family) if family else None
        order = [func.coalesce(in_family, False).desc()] if in_family is not None else []
        result = await self.db.execute(
            select(Product)
            .options(*_LOAD)
            .where(Product.id != product.id, Product.deleted_at.is_(None), Product.status == ProductStatus.ACTIVE)
            .order_by(*order, (Product.category_id == product.category_id).desc().nulls_last(), Product.rating_avg.desc(), Product.created_at.desc())
            .limit(limit)
        )
        return [self.to_list_item(p) for p in result.scalars().all()]

    async def get_admin(self, product_id: uuid.UUID) -> ProductAdminDetail:
        return self.to_detail(await self._load(product_id), admin=True)

    # ── Helpers for writes ────────────────────────────────────────────────────

    def _audit(self, actor_id: uuid.UUID, action: str, entity_type: str, entity_id: uuid.UUID, changes: dict | None) -> None:
        self.db.add(AuditLog(actor_id=actor_id, action=action, entity_type=entity_type, entity_id=str(entity_id), changes=changes))

    async def _assert_slug_free(self, slug: str, exclude_id: uuid.UUID | None = None) -> None:
        q = select(Product.id).where(Product.slug == slug)
        if exclude_id:
            q = q.where(Product.id != exclude_id)
        if await self.db.scalar(q):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Slug '{slug}' is already used by another product")

    async def _unique_slug(self, name: str) -> str:
        base = slugify(name)[:150] or "product"
        slug, n = base, 2
        while await self.db.scalar(select(Product.id).where(Product.slug == slug)):
            slug, n = f"{base}-{n}", n + 1
        return slug

    async def _assert_category(self, category_id: uuid.UUID) -> None:
        if not await self.db.get(Category, category_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category does not exist")

    async def _unique_sku(self, base: str, taken: set[str]) -> str:
        base = re.sub(r"[^A-Z0-9]+", "-", base.upper()).strip("-")[:56] or "SKU"
        sku, n = base, 2
        while sku in taken or await self.db.scalar(select(ProductVariant.id).where(ProductVariant.sku == sku)):
            sku, n = f"{base}-{n}", n + 1
        taken.add(sku)
        return sku

    async def _assert_sku_free(self, sku: str, exclude_id: uuid.UUID | None = None) -> None:
        q = select(ProductVariant.id).where(func.upper(ProductVariant.sku) == sku.upper())
        if exclude_id:
            q = q.where(ProductVariant.id != exclude_id)
        if await self.db.scalar(q):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"SKU '{sku}' is already in use")

    @staticmethod
    def _option_key(color: str | None, size: str | None) -> tuple[str, str]:
        return ((color or "").strip().lower(), (size or "").strip().lower())

    @staticmethod
    def _search_text(p: Product, category_name: str | None) -> str:
        parts = [p.name, p.brand, category_name, " ".join(p.tags or []), p.description]
        return " | ".join(x for x in parts if x)

    async def _refresh_search_text(self, p: Product) -> None:
        category = await self.db.get(Category, p.category_id) if p.category_id else None
        p.search_text = self._search_text(p, category.name if category else None)
        p.embedded_at = None  # needs re-embedding for semantic search

    async def _new_variant(self, product: Product, data: VariantCreate, taken_skus: set[str]) -> ProductVariant:
        if data.sku:
            if data.sku.upper() in taken_skus:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"SKU '{data.sku}' is used twice")
            await self._assert_sku_free(data.sku)
            sku = data.sku.upper()
            taken_skus.add(sku)
        else:
            option = "-".join(x for x in (data.color_name, data.size) if x) or "default"
            sku = await self._unique_sku(f"{product.slug}-{option}", taken_skus)
        return ProductVariant(
            id=uuid.uuid4(),
            product_id=product.id,
            sku=sku,
            color_name=data.color_name.strip() if data.color_name else None,
            color_hex=data.color_hex.lower() if data.color_hex else None,
            size=data.size.strip() if data.size else None,
            price=data.price,
            stock_qty=data.stock_qty,
            position=data.position,
            is_active=data.is_active,
        )

    # ── Product writes ────────────────────────────────────────────────────────

    async def create(self, payload: ProductCreate, actor_id: uuid.UUID) -> ProductAdminDetail:
        if payload.slug:
            await self._assert_slug_free(payload.slug)
            slug = payload.slug
        else:
            slug = await self._unique_slug(payload.name)
        if payload.category_id:
            await self._assert_category(payload.category_id)

        variants_in = payload.variants or [VariantCreate()]
        keys = [self._option_key(v.color_name, v.size) for v in variants_in]
        if len(set(keys)) != len(keys):
            raise HTTPException(status_code=422, detail="Two variants have the same colour and size")

        now = datetime.now(timezone.utc)
        product = Product(
            id=uuid.uuid4(),
            slug=slug,
            name=payload.name.strip(),
            brand=payload.brand.strip() if payload.brand else None,
            category_id=payload.category_id,
            description=payload.description,
            details=payload.details,
            tags=payload.tags,
            price=payload.price,
            compare_at_price=payload.compare_at_price,
            currency=payload.currency,
            status=payload.status,
            is_featured=payload.is_featured,
            low_stock_threshold=payload.low_stock_threshold,
            seo_title=payload.seo_title,
            seo_description=payload.seo_description,
            published_at=now if payload.status == ProductStatus.ACTIVE else None,
            rating_avg=0,
            review_count=0,
        )
        await self._refresh_search_text(product)
        self.db.add(product)
        await self.db.flush()

        taken: set[str] = set()
        for data in variants_in:
            self.db.add(await self._new_variant(product, data, taken))

        self._audit(actor_id, "product.created", "product", product.id, {"name": [None, product.name], "status": [None, product.status.value]})
        await self.db.commit()
        return await self.get_admin(product.id)

    async def update(self, product_id: uuid.UUID, payload: ProductUpdate, actor_id: uuid.UUID) -> ProductAdminDetail:
        product = await self._editable(product_id)
        sent = payload.model_fields_set

        for field in sent & _NOT_NULLABLE:
            if getattr(payload, field) is None:
                raise HTTPException(status_code=422, detail=f"{field} cannot be null")
        if payload.slug and payload.slug != product.slug:
            await self._assert_slug_free(payload.slug, exclude_id=product.id)
        if "category_id" in sent and payload.category_id is not None:
            await self._assert_category(payload.category_id)

        new_price = payload.price if "price" in sent else product.price
        new_compare = payload.compare_at_price if "compare_at_price" in sent else product.compare_at_price
        if new_compare is not None and new_compare <= new_price:
            raise HTTPException(status_code=422, detail="compare_at_price must be greater than price")

        changes: dict[str, list] = {}
        for field in sent:
            new = getattr(payload, field)
            if isinstance(new, str) and field in ("name", "brand"):
                new = new.strip() or None
            old = getattr(product, field)
            if new != old:
                changes[field] = [_jsonable(old), _jsonable(new)]
                setattr(product, field, new)

        if "status" in changes and product.status == ProductStatus.ACTIVE and product.published_at is None:
            product.published_at = datetime.now(timezone.utc)
        if changes.keys() & {"name", "brand", "description", "tags", "category_id"}:
            await self._refresh_search_text(product)

        if changes:
            self._audit(actor_id, "product.updated", "product", product.id, changes)
            await self.db.commit()
        return await self.get_admin(product.id)

    async def delete(self, product_id: uuid.UUID, actor_id: uuid.UUID) -> None:
        """Soft delete: hidden everywhere, kept for past orders. The slug is freed for reuse."""
        product = await self._editable(product_id)
        old_slug = product.slug
        product.deleted_at = datetime.now(timezone.utc)
        product.status = ProductStatus.ARCHIVED
        product.slug = f"{old_slug[:140]}--deleted-{uuid.uuid4().hex[:8]}"
        self._audit(actor_id, "product.deleted", "product", product.id, {"slug": [old_slug, product.slug]})
        await self.db.commit()

    # ── Variants ──────────────────────────────────────────────────────────────

    async def _variant_of(self, product: Product, variant_id: uuid.UUID) -> ProductVariant:
        variant = next((v for v in product.variants if v.id == variant_id), None)
        if not variant:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found on this product")
        return variant

    async def add_variant(self, product_id: uuid.UUID, payload: VariantCreate, actor_id: uuid.UUID) -> ProductAdminDetail:
        product = await self._editable(product_id)
        key = self._option_key(payload.color_name, payload.size)
        if any(self._option_key(v.color_name, v.size) == key for v in product.variants):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A variant with this colour and size already exists")
        variant = await self._new_variant(product, payload, set())
        self.db.add(variant)
        self._audit(actor_id, "variant.created", "product", product.id, {"sku": [None, variant.sku]})
        await self.db.commit()
        return await self.get_admin(product.id)

    async def update_variant(
        self, product_id: uuid.UUID, variant_id: uuid.UUID, payload: VariantUpdate, actor_id: uuid.UUID
    ) -> ProductAdminDetail:
        product = await self._editable(product_id)
        variant = await self._variant_of(product, variant_id)
        sent = payload.model_fields_set

        if "sku" in sent:
            if payload.sku is None:
                raise HTTPException(status_code=422, detail="sku cannot be null")
            await self._assert_sku_free(payload.sku, exclude_id=variant.id)
        for field in ("position", "is_active"):
            if field in sent and getattr(payload, field) is None:
                raise HTTPException(status_code=422, detail=f"{field} cannot be null")

        new_color = payload.color_name if "color_name" in sent else variant.color_name
        new_size = payload.size if "size" in sent else variant.size
        key = self._option_key(new_color, new_size)
        if any(v.id != variant.id and self._option_key(v.color_name, v.size) == key for v in product.variants):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A variant with this colour and size already exists")

        changes: dict[str, list] = {}
        for field in sent:
            new = getattr(payload, field)
            if field == "sku":
                new = new.upper()
            if field == "color_hex" and new:
                new = new.lower()
            old = getattr(variant, field)
            if new != old:
                changes[field] = [_jsonable(old), _jsonable(new)]
                setattr(variant, field, new)
        if changes:
            self._audit(actor_id, "variant.updated", "product", product.id, {"variant": str(variant.id), **changes})
            await self.db.commit()
        return await self.get_admin(product.id)

    async def delete_variant(self, product_id: uuid.UUID, variant_id: uuid.UUID, actor_id: uuid.UUID) -> ProductAdminDetail:
        product = await self._editable(product_id)
        variant = await self._variant_of(product, variant_id)
        if len(product.variants) == 1:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A product needs at least one variant")
        await self.db.delete(variant)
        self._audit(actor_id, "variant.deleted", "product", product.id, {"sku": [variant.sku, None]})
        await self.db.commit()
        return await self.get_admin(product.id)

    async def adjust_stock(
        self, product_id: uuid.UUID, variant_id: uuid.UUID, payload: StockAdjust, actor_id: uuid.UUID
    ) -> VariantResponse:
        # Row lock so two concurrent adjustments cannot overwrite each other.
        variant = await self.db.scalar(
            select(ProductVariant)
            .where(ProductVariant.id == variant_id, ProductVariant.product_id == product_id)
            .with_for_update()
        )
        if not variant:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found on this product")
        product = await self.db.get(Product, product_id)
        if product is None or product.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product is deleted")

        old = variant.stock_qty
        new = payload.set_to if payload.set_to is not None else old + payload.change_by
        if new < 0:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Not enough stock: {old} available")
        variant.stock_qty = new
        self._audit(
            actor_id,
            "inventory.adjusted",
            "product_variant",
            variant.id,
            {"stock_qty": [old, new], "sku": variant.sku, "reason": payload.reason},
        )
        await self.db.commit()
        await self.db.refresh(variant)
        return self._variant(variant, product)

    # ── Images ────────────────────────────────────────────────────────────────

    def _image_of(self, product: Product, image_id: uuid.UUID) -> ProductImage:
        image = next((i for i in product.images if i.id == image_id), None)
        if not image:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found on this product")
        return image

    def _assert_variant_on(self, product: Product, variant_id: uuid.UUID | None) -> None:
        if variant_id and not any(v.id == variant_id for v in product.variants):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="variant_id does not belong to this product")

    @staticmethod
    def _next_position(product: Product) -> int:
        return max((i.position for i in product.images), default=-1) + 1

    async def upload_image(
        self,
        product_id: uuid.UUID,
        file: UploadFile,
        alt_text: str | None,
        variant_id: uuid.UUID | None,
        actor_id: uuid.UUID,
    ) -> ImageResponse:
        product = await self._editable(product_id)
        self._assert_variant_on(product, variant_id)
        data = await media_service.read_image(file)
        uploaded = await media_service.upload_image(data, folder=f"products/{product.id}")

        image = ProductImage(
            id=uuid.uuid4(),
            product_id=product.id,
            variant_id=variant_id,
            url=uploaded.url,
            public_id=uploaded.public_id,
            width=uploaded.width,
            height=uploaded.height,
            alt_text=alt_text or product.name,
            position=self._next_position(product),
        )
        self.db.add(image)
        self._audit(actor_id, "image.uploaded", "product", product.id, {"public_id": uploaded.public_id})
        try:
            await self.db.commit()
        except Exception:
            # Don't leave an orphaned file on Cloudinary when the database write fails.
            await self.db.rollback()
            await media_service.delete_image(uploaded.public_id)
            raise
        return self._image(image)

    async def add_image_url(self, product_id: uuid.UUID, payload: ImageFromUrl, actor_id: uuid.UUID) -> ImageResponse:
        product = await self._editable(product_id)
        self._assert_variant_on(product, payload.variant_id)
        image = ProductImage(
            id=uuid.uuid4(),
            product_id=product.id,
            variant_id=payload.variant_id,
            url=str(payload.url),
            alt_text=payload.alt_text or product.name,
            position=self._next_position(product),
        )
        self.db.add(image)
        self._audit(actor_id, "image.linked", "product", product.id, {"url": str(payload.url)})
        await self.db.commit()
        return self._image(image)

    async def update_image(
        self, product_id: uuid.UUID, image_id: uuid.UUID, payload: ImageUpdate, actor_id: uuid.UUID
    ) -> ImageResponse:
        product = await self._editable(product_id)
        image = self._image_of(product, image_id)
        sent = payload.model_fields_set
        if "position" in sent and payload.position is None:
            raise HTTPException(status_code=422, detail="position cannot be null")
        if "variant_id" in sent:
            self._assert_variant_on(product, payload.variant_id)
        for field in sent:
            setattr(image, field, getattr(payload, field))
        await self.db.commit()
        return self._image(image)

    async def reorder_images(self, product_id: uuid.UUID, payload: ImageOrder, actor_id: uuid.UUID) -> list[ImageResponse]:
        product = await self._editable(product_id)
        current = {i.id for i in product.images}
        if len(payload.image_ids) != len(set(payload.image_ids)) or set(payload.image_ids) != current:
            raise HTTPException(status_code=422, detail="image_ids must list every image of this product exactly once")
        by_id = {i.id: i for i in product.images}
        for position, image_id in enumerate(payload.image_ids):
            by_id[image_id].position = position
        self._audit(actor_id, "image.reordered", "product", product.id, None)
        await self.db.commit()
        return [self._image(by_id[i]) for i in payload.image_ids]

    async def delete_image(self, product_id: uuid.UUID, image_id: uuid.UUID, actor_id: uuid.UUID) -> None:
        product = await self._editable(product_id)
        image = self._image_of(product, image_id)
        public_id = image.public_id
        await self.db.delete(image)
        # Close the gap so positions stay 0..n-1.
        for position, remaining in enumerate(i for i in product.images if i.id != image_id):
            remaining.position = position
        self._audit(actor_id, "image.deleted", "product", product.id, {"url": image.url})
        await self.db.commit()
        if public_id:
            await media_service.delete_image(public_id)

    # ── Inventory (admin) ────────────────────────────────────────────────────

    async def inventory(
        self,
        *,
        level: StockLevel | None = None,
        q: str | None = None,
        sort: str = "name",
        skip: int = 0,
        limit: int = 50,
    ) -> InventoryResponse:
        """Every variant of every non-archived, non-deleted product, with its stock level."""
        price = func.coalesce(ProductVariant.price, Product.price)
        level_expr = case(
            (ProductVariant.stock_qty == 0, StockLevel.OUT.value),
            (ProductVariant.stock_qty <= Product.low_stock_threshold, StockLevel.LOW.value),
            else_=StockLevel.OK.value,
        )
        image = (
            select(ProductImage.url)
            .where(ProductImage.product_id == Product.id)
            .order_by(ProductImage.position)
            .limit(1)
            .correlate(Product)
            .scalar_subquery()
        )
        scope = [Product.deleted_at.is_(None), Product.status != ProductStatus.ARCHIVED]

        filters = list(scope)
        if level:
            filters.append(level_expr == level.value)
        if q and q.strip():
            like = f"%{q.strip()}%"
            filters.append(
                or_(
                    Product.name.ilike(like),
                    Product.brand.ilike(like),
                    ProductVariant.sku.ilike(like),
                    ProductVariant.color_name.ilike(like),
                    ProductVariant.size.ilike(like),
                )
            )

        base = select(ProductVariant).join(Product, ProductVariant.product_id == Product.id).where(*filters)
        total = await self.db.scalar(select(func.count()).select_from(base.subquery())) or 0

        order = (
            [ProductVariant.stock_qty.asc(), func.lower(Product.name)]
            if sort == "stock"
            else [func.lower(Product.name), ProductVariant.position]
        )
        rows = await self.db.execute(
            select(ProductVariant, Product, price.label("price"), level_expr.label("level"), image.label("image"))
            .join(Product, ProductVariant.product_id == Product.id)
            .where(*filters)
            .order_by(*order)
            .offset(skip)
            .limit(limit)
        )
        items = [
            InventoryRow(
                variant_id=v.id,
                product_id=p.id,
                product_name=p.name,
                product_slug=p.slug,
                product_status=p.status,
                image_url=img,
                sku=v.sku,
                color_name=v.color_name,
                color_hex=v.color_hex,
                size=v.size,
                effective_price=eff,
                stock_qty=v.stock_qty,
                low_stock_threshold=p.low_stock_threshold,
                level=StockLevel(lvl),
                is_active=v.is_active,
            )
            for v, p, eff, lvl, img in rows.all()
        ]

        totals = (
            await self.db.execute(
                select(
                    func.count(ProductVariant.id),
                    func.coalesce(func.sum(ProductVariant.stock_qty), 0),
                    func.coalesce(func.sum(ProductVariant.stock_qty * price), 0),
                    func.count().filter(level_expr == StockLevel.LOW.value),
                    func.count().filter(level_expr == StockLevel.OUT.value),
                )
                .join(Product, ProductVariant.product_id == Product.id)
                .where(*scope)
            )
        ).one()
        summary = InventorySummary(variants=totals[0], units=totals[1], value=totals[2], low=totals[3], out=totals[4])
        return InventoryResponse(items=items, total=total, skip=skip, limit=limit, summary=summary)

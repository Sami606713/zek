"""Collection CRUD: curated, ordered product lists with an optional Cloudinary banner."""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.app.api.v1.models.audit_log import AuditLog
from src.app.api.v1.models.base import ProductStatus
from src.app.api.v1.models.catalog import Product
from src.app.api.v1.models.collection import Collection, CollectionProduct
from src.app.api.v1.schemas.collection import (
    CollectionAdminDetail,
    CollectionAdminProduct,
    CollectionCard,
    CollectionCreate,
    CollectionDetail,
    CollectionProductAdd,
    CollectionProductsSet,
    CollectionSort,
    CollectionUpdate,
)
from src.app.api.v1.services import media_service
from src.app.api.v1.services.category_service import slugify
from src.app.api.v1.services.product_service import _LOAD as PRODUCT_LOAD
from src.app.api.v1.services.product_service import ProductService

_LOAD = (
    selectinload(Collection.items)
    .selectinload(CollectionProduct.product)
    .options(*[opt for opt in PRODUCT_LOAD]),
)

PREVIEW_IMAGES = 3


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _is_visible(product: Product | None) -> bool:
    return product is not None and product.deleted_at is None and product.status == ProductStatus.ACTIVE


def _is_live(c: Collection, now: datetime) -> bool:
    return bool(c.is_published) and (c.starts_at is None or c.starts_at <= now) and (c.ends_at is None or c.ends_at > now)


class CollectionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.products = ProductService(db)

    # ── Serialisation ─────────────────────────────────────────────────────────

    def _card_fields(self, c: Collection, now: datetime) -> dict:
        visible = [i.product for i in c.items if _is_visible(i.product)]
        previews = [p.images[0].url for p in visible if p.images][:PREVIEW_IMAGES]
        return dict(
            id=c.id,
            slug=c.slug,
            title=c.title,
            blurb=c.blurb,
            image_url=c.image_url,
            product_count=len(visible),
            preview_images=previews,
            sort_order=c.sort_order,
            is_published=c.is_published,
            is_live=_is_live(c, now),
            starts_at=c.starts_at,
            ends_at=c.ends_at,
        )

    def _detail(self, c: Collection, sort: CollectionSort) -> CollectionDetail:
        visible = [i.product for i in c.items if _is_visible(i.product)]
        if sort == CollectionSort.NEWEST:
            visible.sort(key=lambda p: p.published_at or p.created_at, reverse=True)
        elif sort == CollectionSort.PRICE_ASC:
            visible.sort(key=lambda p: p.price)
        elif sort == CollectionSort.PRICE_DESC:
            visible.sort(key=lambda p: p.price, reverse=True)
        elif sort == CollectionSort.RATING:
            visible.sort(key=lambda p: (p.rating_avg or 0, p.review_count or 0), reverse=True)
        return CollectionDetail(
            **self._card_fields(c, _now()),
            products=[self.products.to_list_item(p) for p in visible],
            created_at=c.created_at,
            updated_at=c.updated_at,
        )

    def _admin_detail(self, c: Collection) -> CollectionAdminDetail:
        return CollectionAdminDetail(
            **self._card_fields(c, _now()),
            has_hosted_image=c.image_public_id is not None,
            products=[
                CollectionAdminProduct(position=i.position, product=self.products.to_list_item(i.product))
                for i in c.items
                if i.product is not None
            ],
            created_at=c.created_at,
            updated_at=c.updated_at,
        )

    # ── Lookups ───────────────────────────────────────────────────────────────

    async def _load(self, collection_id: uuid.UUID) -> Collection:
        c = await self.db.scalar(
            select(Collection).options(*_LOAD).where(Collection.id == collection_id).execution_options(populate_existing=True)
        )
        if not c:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
        return c

    def _live_filters(self) -> list:
        now = _now()
        return [
            Collection.is_published.is_(True),
            (Collection.starts_at.is_(None)) | (Collection.starts_at <= now),
            (Collection.ends_at.is_(None)) | (Collection.ends_at > now),
        ]

    # ── Public reads ──────────────────────────────────────────────────────────

    async def list_collections(
        self, *, skip: int = 0, limit: int = 20, include_unpublished: bool = False
    ) -> tuple[list[CollectionCard], int]:
        filters = [] if include_unpublished else self._live_filters()
        total = await self.db.scalar(select(func.count()).select_from(Collection).where(*filters)) or 0
        result = await self.db.execute(
            select(Collection)
            .options(*_LOAD)
            .where(*filters)
            .order_by(Collection.sort_order, Collection.title)
            .offset(skip)
            .limit(limit)
        )
        now = _now()
        return [CollectionCard(**self._card_fields(c, now)) for c in result.scalars().all()], total

    async def get_by_slug(self, slug: str, sort: CollectionSort, include_unpublished: bool = False) -> CollectionDetail:
        filters = [Collection.slug == slug] + ([] if include_unpublished else self._live_filters())
        c = await self.db.scalar(select(Collection).options(*_LOAD).where(*filters))
        if not c:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
        return self._detail(c, sort)

    async def get_admin(self, collection_id: uuid.UUID) -> CollectionAdminDetail:
        return self._admin_detail(await self._load(collection_id))

    # ── Helpers for writes ────────────────────────────────────────────────────

    def _audit(self, actor_id: uuid.UUID, action: str, c: Collection, changes: dict | None = None) -> None:
        self.db.add(AuditLog(actor_id=actor_id, action=action, entity_type="collection", entity_id=str(c.id), changes=changes))

    async def _assert_slug_free(self, slug: str, exclude_id: uuid.UUID | None = None) -> None:
        q = select(Collection.id).where(Collection.slug == slug)
        if exclude_id:
            q = q.where(Collection.id != exclude_id)
        if await self.db.scalar(q):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Slug '{slug}' is already used by another collection")

    async def _unique_slug(self, title: str) -> str:
        base = slugify(title) or "collection"
        slug, n = base, 2
        while await self.db.scalar(select(Collection.id).where(Collection.slug == slug)):
            slug, n = f"{base}-{n}", n + 1
        return slug

    async def _assert_products(self, product_ids: list[uuid.UUID]) -> None:
        if len(product_ids) != len(set(product_ids)):
            raise HTTPException(status_code=422, detail="A product appears more than once in product_ids")
        if not product_ids:
            return
        found = set(
            (await self.db.execute(select(Product.id).where(Product.id.in_(product_ids), Product.deleted_at.is_(None)))).scalars()
        )
        missing = [str(pid) for pid in product_ids if pid not in found]
        if missing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown or deleted products: {', '.join(missing)}")

    async def _replace_products(self, collection_id: uuid.UUID, product_ids: list[uuid.UUID]) -> None:
        # Delete first, then insert, so the (collection, product) unique constraint never trips mid-swap.
        await self.db.execute(delete(CollectionProduct).where(CollectionProduct.collection_id == collection_id))
        await self.db.flush()
        self.db.add_all(
            CollectionProduct(collection_id=collection_id, product_id=pid, position=i) for i, pid in enumerate(product_ids)
        )

    # ── Writes (admin) ────────────────────────────────────────────────────────

    async def create(self, payload: CollectionCreate, actor_id: uuid.UUID) -> CollectionAdminDetail:
        if payload.slug:
            await self._assert_slug_free(payload.slug)
            slug = payload.slug
        else:
            slug = await self._unique_slug(payload.title)
        await self._assert_products(payload.product_ids)

        c = Collection(
            id=uuid.uuid4(),
            slug=slug,
            title=payload.title,
            blurb=payload.blurb,
            image_url=str(payload.image_url) if payload.image_url else None,
            is_published=payload.is_published,
            sort_order=payload.sort_order,
            starts_at=payload.starts_at,
            ends_at=payload.ends_at,
        )
        self.db.add(c)
        await self.db.flush()
        await self._replace_products(c.id, payload.product_ids)
        self._audit(actor_id, "collection.created", c, {"title": [None, c.title], "products": len(payload.product_ids)})
        await self.db.commit()
        return await self.get_admin(c.id)

    async def update(self, collection_id: uuid.UUID, payload: CollectionUpdate, actor_id: uuid.UUID) -> CollectionAdminDetail:
        c = await self._load(collection_id)
        sent = payload.model_fields_set
        old_public_id = None

        for field in ("title", "slug", "is_published", "sort_order"):
            if field in sent and getattr(payload, field) is None:
                raise HTTPException(status_code=422, detail=f"{field} cannot be null")
        if payload.slug and payload.slug != c.slug:
            await self._assert_slug_free(payload.slug, exclude_id=c.id)

        starts = payload.starts_at if "starts_at" in sent else c.starts_at
        ends = payload.ends_at if "ends_at" in sent else c.ends_at
        if starts and ends and ends <= starts:
            raise HTTPException(status_code=422, detail="ends_at must be after starts_at")

        changes: dict[str, list] = {}
        for field in sent:
            new = getattr(payload, field)
            if field == "image_url":
                new = str(new) if new else None
                if new != c.image_url and c.image_public_id:
                    old_public_id, c.image_public_id = c.image_public_id, None  # replaced by an external URL
            old = getattr(c, field)
            if new != old:
                changes[field] = [str(old) if old is not None else None, str(new) if new is not None else None]
                setattr(c, field, new)

        if changes:
            self._audit(actor_id, "collection.updated", c, changes)
            await self.db.commit()
            if old_public_id:
                await media_service.delete_image(old_public_id)
        return await self.get_admin(c.id)

    async def delete(self, collection_id: uuid.UUID, actor_id: uuid.UUID) -> None:
        c = await self._load(collection_id)
        public_id = c.image_public_id
        self._audit(actor_id, "collection.deleted", c, {"title": [c.title, None], "slug": [c.slug, None]})
        await self.db.delete(c)
        await self.db.commit()
        if public_id:
            await media_service.delete_image(public_id)

    # ── Products in a collection ──────────────────────────────────────────────

    async def set_products(self, collection_id: uuid.UUID, payload: CollectionProductsSet, actor_id: uuid.UUID) -> CollectionAdminDetail:
        c = await self._load(collection_id)
        await self._assert_products(payload.product_ids)
        before = [str(i.product_id) for i in c.items]
        await self._replace_products(c.id, payload.product_ids)
        self._audit(actor_id, "collection.products_set", c, {"product_ids": [before, [str(p) for p in payload.product_ids]]})
        await self.db.commit()
        return await self.get_admin(c.id)

    async def add_product(self, collection_id: uuid.UUID, payload: CollectionProductAdd, actor_id: uuid.UUID) -> CollectionAdminDetail:
        c = await self._load(collection_id)
        if any(i.product_id == payload.product_id for i in c.items):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product is already in this collection")
        await self._assert_products([payload.product_id])

        ordered = [i.product_id for i in c.items]
        position = len(ordered) if payload.position is None else min(payload.position, len(ordered))
        ordered.insert(position, payload.product_id)
        await self._replace_products(c.id, ordered)
        self._audit(actor_id, "collection.product_added", c, {"product_id": str(payload.product_id), "position": position})
        await self.db.commit()
        return await self.get_admin(c.id)

    async def remove_product(self, collection_id: uuid.UUID, product_id: uuid.UUID, actor_id: uuid.UUID) -> CollectionAdminDetail:
        c = await self._load(collection_id)
        ordered = [i.product_id for i in c.items]
        if product_id not in ordered:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product is not in this collection")
        ordered.remove(product_id)
        await self._replace_products(c.id, ordered)
        self._audit(actor_id, "collection.product_removed", c, {"product_id": str(product_id)})
        await self.db.commit()
        return await self.get_admin(c.id)

    # ── Banner image (Cloudinary) ─────────────────────────────────────────────

    async def upload_image(self, collection_id: uuid.UUID, file: UploadFile, actor_id: uuid.UUID) -> CollectionAdminDetail:
        c = await self._load(collection_id)
        data = await media_service.read_image(file)
        uploaded = await media_service.upload_image(data, folder=f"collections/{c.id}")

        old_public_id = c.image_public_id
        c.image_url, c.image_public_id = uploaded.url, uploaded.public_id
        self._audit(actor_id, "collection.image_uploaded", c, {"public_id": uploaded.public_id})
        try:
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            await media_service.delete_image(uploaded.public_id)
            raise
        if old_public_id:
            await media_service.delete_image(old_public_id)
        return await self.get_admin(c.id)

    async def delete_image(self, collection_id: uuid.UUID, actor_id: uuid.UUID) -> CollectionAdminDetail:
        c = await self._load(collection_id)
        if not c.image_url:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection has no banner image")
        public_id = c.image_public_id
        c.image_url, c.image_public_id = None, None
        self._audit(actor_id, "collection.image_deleted", c, None)
        await self.db.commit()
        if public_id:
            await media_service.delete_image(public_id)
        return await self.get_admin(c.id)

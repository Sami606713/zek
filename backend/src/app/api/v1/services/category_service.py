"""Category CRUD: listing, tree, lookup, create, update and delete."""

import re
import unicodedata
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.v1.models.audit_log import AuditLog
from src.app.api.v1.models.catalog import Category, Product
from src.app.api.v1.schemas.category import (
    CategoryCreate,
    CategoryDetail,
    CategoryResponse,
    CategorySummary,
    CategoryTreeNode,
    CategoryUpdate,
)


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return value[:80].strip("-")


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class CategoryService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _product_counts(self, category_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
        if not category_ids:
            return {}
        rows = await self.db.execute(
            select(Product.category_id, func.count())
            .where(Product.category_id.in_(category_ids), Product.deleted_at.is_(None))
            .group_by(Product.category_id)
        )
        return dict(rows.all())

    async def _to_responses(self, categories: list[Category]) -> list[CategoryResponse]:
        counts = await self._product_counts([c.id for c in categories])
        return [
            CategoryResponse.model_validate(c).model_copy(update={"product_count": counts.get(c.id, 0)})
            for c in categories
        ]

    async def _get_or_404(self, category_id: uuid.UUID) -> Category:
        category = await self.db.get(Category, category_id)
        if not category:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
        return category

    async def _assert_slug_free(self, slug: str, exclude_id: uuid.UUID | None = None) -> None:
        q = select(Category.id).where(Category.slug == slug)
        if exclude_id:
            q = q.where(Category.id != exclude_id)
        if await self.db.scalar(q):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Slug '{slug}' is already used by another category")

    async def _unique_slug_from(self, name: str) -> str:
        base = slugify(name) or "category"
        slug, n = base, 2
        while await self.db.scalar(select(Category.id).where(Category.slug == slug)):
            slug = f"{base}-{n}"
            n += 1
        return slug

    async def _assert_valid_parent(self, parent_id: uuid.UUID, category_id: uuid.UUID | None = None) -> None:
        if category_id and parent_id == category_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A category cannot be its own parent")
        parent = await self.db.get(Category, parent_id)
        if not parent:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent category does not exist")
        # Walk up from the new parent; reaching this category would create a loop.
        seen: set[uuid.UUID] = set()
        current = parent
        while category_id and current is not None and current.id not in seen:
            if current.id == category_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A category cannot be moved under its own subcategory")
            seen.add(current.id)
            current = await self.db.get(Category, current.parent_id) if current.parent_id else None

    def _audit(self, actor_id: uuid.UUID, action: str, category: Category, changes: dict | None = None) -> None:
        self.db.add(
            AuditLog(
                actor_id=actor_id,
                action=action,
                entity_type="category",
                entity_id=str(category.id),
                changes=changes,
            )
        )

    # ── Read ──────────────────────────────────────────────────────────────────

    async def list_categories(
        self,
        *,
        skip: int = 0,
        limit: int = 50,
        search: str | None = None,
        parent_id: uuid.UUID | None = None,
        top_level: bool = False,
        include_inactive: bool = False,
    ) -> tuple[list[CategoryResponse], int]:
        filters = []
        if not include_inactive:
            filters.append(Category.is_active.is_(True))
        if search:
            term = f"%{_escape_like(search.strip().lower())}%"
            filters.append(func.lower(Category.name).like(term, escape="\\") | Category.slug.like(term, escape="\\"))
        if parent_id:
            filters.append(Category.parent_id == parent_id)
        elif top_level:
            filters.append(Category.parent_id.is_(None))

        total = await self.db.scalar(select(func.count()).select_from(Category).where(*filters)) or 0
        result = await self.db.execute(
            select(Category).where(*filters).order_by(Category.sort_order, Category.name).offset(skip).limit(limit)
        )
        return await self._to_responses(list(result.scalars().all())), total

    async def tree(self, include_inactive: bool = False) -> list[CategoryTreeNode]:
        q = select(Category).order_by(Category.sort_order, Category.name)
        if not include_inactive:
            q = q.where(Category.is_active.is_(True))
        categories = list((await self.db.execute(q)).scalars().all())
        counts = await self._product_counts([c.id for c in categories])

        nodes = {
            c.id: CategoryTreeNode(
                id=c.id,
                slug=c.slug,
                name=c.name,
                image_url=c.image_url,
                sort_order=c.sort_order,
                product_count=counts.get(c.id, 0),
            )
            for c in categories
        }
        roots: list[CategoryTreeNode] = []
        for c in categories:
            parent = nodes.get(c.parent_id) if c.parent_id else None
            # Children of a hidden parent are hidden too (they are not reachable from the tree).
            if c.parent_id is None:
                roots.append(nodes[c.id])
            elif parent is not None:
                parent.children.append(nodes[c.id])
        return roots

    async def get_by_slug(self, slug: str, include_inactive: bool = False) -> CategoryDetail:
        category = await self.db.scalar(select(Category).where(Category.slug == slug))
        if not category or (not category.is_active and not include_inactive):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
        return await self._detail(category, include_inactive)

    async def get_by_id(self, category_id: uuid.UUID) -> CategoryDetail:
        return await self._detail(await self._get_or_404(category_id), include_inactive=True)

    async def _detail(self, category: Category, include_inactive: bool) -> CategoryDetail:
        children_q = select(Category).where(Category.parent_id == category.id).order_by(Category.sort_order, Category.name)
        if not include_inactive:
            children_q = children_q.where(Category.is_active.is_(True))
        children = list((await self.db.execute(children_q)).scalars().all())
        parent = await self.db.get(Category, category.parent_id) if category.parent_id else None
        counts = await self._product_counts([category.id])

        return CategoryDetail(
            **CategoryResponse.model_validate(category).model_dump(exclude={"product_count"}),
            product_count=counts.get(category.id, 0),
            parent=CategorySummary.model_validate(parent) if parent and (parent.is_active or include_inactive) else None,
            children=[CategorySummary.model_validate(c) for c in children],
        )

    # ── Write (admin) ─────────────────────────────────────────────────────────

    async def create(self, payload: CategoryCreate, actor_id: uuid.UUID) -> CategoryDetail:
        if payload.slug:
            await self._assert_slug_free(payload.slug)
            slug = payload.slug
        else:
            slug = await self._unique_slug_from(payload.name)
        if payload.parent_id:
            await self._assert_valid_parent(payload.parent_id)

        category = Category(
            id=uuid.uuid4(),
            slug=slug,
            name=payload.name,
            description=payload.description,
            image_url=payload.image_url,
            parent_id=payload.parent_id,
            sort_order=payload.sort_order,
            is_active=payload.is_active,
        )
        self.db.add(category)
        await self.db.flush()
        self._audit(actor_id, "category.created", category, {"name": [None, category.name], "slug": [None, slug]})
        await self.db.commit()
        await self.db.refresh(category)
        return await self._detail(category, include_inactive=True)

    async def update(self, category_id: uuid.UUID, payload: CategoryUpdate, actor_id: uuid.UUID) -> CategoryDetail:
        category = await self._get_or_404(category_id)
        sent = payload.model_fields_set

        if "slug" in sent and payload.slug is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Slug cannot be empty")
        if "name" in sent and payload.name is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Name cannot be empty")
        if payload.slug and payload.slug != category.slug:
            await self._assert_slug_free(payload.slug, exclude_id=category.id)
        if "parent_id" in sent and payload.parent_id is not None:
            await self._assert_valid_parent(payload.parent_id, category_id=category.id)

        changes: dict[str, list] = {}
        for field in ("name", "slug", "description", "image_url", "parent_id", "sort_order", "is_active"):
            if field not in sent:
                continue
            new = getattr(payload, field)
            if field in ("sort_order", "is_active") and new is None:
                continue
            old = getattr(category, field)
            if new != old:
                changes[field] = [str(old) if isinstance(old, uuid.UUID) else old, str(new) if isinstance(new, uuid.UUID) else new]
                setattr(category, field, new)

        if changes:
            self._audit(actor_id, "category.updated", category, changes)
            await self.db.commit()
            await self.db.refresh(category)
        return await self._detail(category, include_inactive=True)

    async def delete(self, category_id: uuid.UUID, actor_id: uuid.UUID) -> None:
        category = await self._get_or_404(category_id)

        product_count = (await self._product_counts([category.id])).get(category.id, 0)
        if product_count:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Category still has {product_count} product(s). Move them to another category first.",
            )
        if await self.db.scalar(select(Category.id).where(Category.parent_id == category.id).limit(1)):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Category has subcategories. Move or delete them first.",
            )

        self._audit(actor_id, "category.deleted", category, {"name": [category.name, None], "slug": [category.slug, None]})
        await self.db.delete(category)
        await self.db.commit()

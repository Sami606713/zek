"""Category endpoints. Anyone can browse active categories; admins manage them."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from src.app.api.v1.schemas.category import (
    CategoryCreate,
    CategoryDetail,
    CategoryListResponse,
    CategoryTreeNode,
    CategoryUpdate,
)
from src.app.api.v1.services.category_service import CategoryService
from src.app.deps import AdminUser, DbSession, OptionalUser, is_admin

router = APIRouter(prefix="/categories", tags=["Categories"])


def get_category_service(db: DbSession) -> CategoryService:
    return CategoryService(db)


CategoryServiceDep = Annotated[CategoryService, Depends(get_category_service)]

_ADMIN_ERRORS = {
    401: {"description": "Missing, invalid or expired access token"},
    403: {"description": "Admin access required"},
}
_NOT_FOUND = {404: {"description": "Category not found"}}

_INCLUDE_INACTIVE = Query(False, description="Admins only: also return hidden categories. Ignored for everyone else.")


# ─────────────────────────────────────────────────────────────────────────────
# Public
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=CategoryListResponse, summary="List categories")
async def list_categories(
    service: CategoryServiceDep,
    user: OptionalUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: str | None = Query(None, max_length=100, description="Match name or slug"),
    parent_id: uuid.UUID | None = Query(None, description="Only subcategories of this category"),
    top_level: bool = Query(False, description="Only categories without a parent"),
    include_inactive: bool = _INCLUDE_INACTIVE,
) -> CategoryListResponse:
    """Flat, paginated list ordered by `sort_order`, then name. Each item includes its product count."""
    items, total = await service.list_categories(
        skip=skip,
        limit=limit,
        search=search,
        parent_id=parent_id,
        top_level=top_level,
        include_inactive=include_inactive and is_admin(user),
    )
    return CategoryListResponse(items=items, total=total, skip=skip, limit=limit)


@router.get("/tree", response_model=list[CategoryTreeNode], summary="Get the category tree")
async def category_tree(
    service: CategoryServiceDep,
    user: OptionalUser,
    include_inactive: bool = _INCLUDE_INACTIVE,
) -> list[CategoryTreeNode]:
    """Top-level categories with their subcategories nested inside, for menus and filters."""
    return await service.tree(include_inactive=include_inactive and is_admin(user))


@router.get("/{slug}", response_model=CategoryDetail, summary="Get a category by slug", responses=_NOT_FOUND)
async def get_category(slug: str, service: CategoryServiceDep, user: OptionalUser) -> CategoryDetail:
    """Includes the parent and direct subcategories. Hidden categories are only visible to admins."""
    return await service.get_by_slug(slug, include_inactive=is_admin(user))


# ─────────────────────────────────────────────────────────────────────────────
# Admin
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/id/{category_id}",
    response_model=CategoryDetail,
    summary="Get a category by id (admin)",
    responses={**_ADMIN_ERRORS, **_NOT_FOUND},
)
async def get_category_by_id(category_id: uuid.UUID, _admin: AdminUser, service: CategoryServiceDep) -> CategoryDetail:
    return await service.get_by_id(category_id)


@router.post(
    "",
    response_model=CategoryDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a category (admin)",
    responses={
        **_ADMIN_ERRORS,
        400: {"description": "Parent category does not exist"},
        409: {"description": "Slug already in use"},
    },
)
async def create_category(payload: CategoryCreate, admin: AdminUser, service: CategoryServiceDep) -> CategoryDetail:
    """The slug is generated from the name when not given (e.g. "Home Office" → `home-office`)."""
    return await service.create(payload, actor_id=admin.id)


@router.patch(
    "/{category_id}",
    response_model=CategoryDetail,
    summary="Update a category (admin)",
    responses={
        **_ADMIN_ERRORS,
        **_NOT_FOUND,
        400: {"description": "Invalid parent (missing, itself, or one of its subcategories)"},
        409: {"description": "Slug already in use"},
    },
)
async def update_category(
    category_id: uuid.UUID,
    payload: CategoryUpdate,
    admin: AdminUser,
    service: CategoryServiceDep,
) -> CategoryDetail:
    """Only the fields sent are changed. Every change is recorded in the audit log."""
    return await service.update(category_id, payload, actor_id=admin.id)


@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a category (admin)",
    responses={**_ADMIN_ERRORS, **_NOT_FOUND, 409: {"description": "Category still has products or subcategories"}},
)
async def delete_category(category_id: uuid.UUID, admin: AdminUser, service: CategoryServiceDep) -> None:
    """Refused while products or subcategories still point to it, so nothing is orphaned by accident."""
    await service.delete(category_id, actor_id=admin.id)

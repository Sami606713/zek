"""Collection endpoints. Anyone can browse live collections; admins curate them."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, UploadFile, status

from src.app.api.v1.schemas.collection import (
    CollectionAdminDetail,
    CollectionCreate,
    CollectionDetail,
    CollectionListResponse,
    CollectionProductAdd,
    CollectionProductsSet,
    CollectionSort,
    CollectionUpdate,
)
from src.app.api.v1.services.collection_service import CollectionService
from src.app.deps import AdminUser, DbSession, OptionalUser, is_admin

router = APIRouter(prefix="/collections", tags=["Collections"])


def get_collection_service(db: DbSession) -> CollectionService:
    return CollectionService(db)


CollectionServiceDep = Annotated[CollectionService, Depends(get_collection_service)]

_ADMIN_ERRORS = {
    401: {"description": "Missing, invalid or expired access token"},
    403: {"description": "Admin access required"},
}
_NOT_FOUND = {404: {"description": "Collection not found"}}


# ─────────────────────────────────────────────────────────────────────────────
# Public
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=CollectionListResponse, summary="List collections")
async def list_collections(
    service: CollectionServiceDep,
    user: OptionalUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    include_unpublished: bool = Query(False, description="Admins only: include drafts and expired collections"),
) -> CollectionListResponse:
    """Live collections (published and inside their date window), with product count and preview images."""
    items, total = await service.list_collections(
        skip=skip, limit=limit, include_unpublished=include_unpublished and is_admin(user)
    )
    return CollectionListResponse(items=items, total=total, skip=skip, limit=limit)


@router.get("/{slug}", response_model=CollectionDetail, summary="Get a collection with its products", responses=_NOT_FOUND)
async def get_collection(
    slug: str,
    service: CollectionServiceDep,
    user: OptionalUser,
    sort: CollectionSort = Query(CollectionSort.CURATED, description="`curated` keeps the admin's order"),
) -> CollectionDetail:
    """Only active products are listed. Unpublished collections are visible to admins only."""
    return await service.get_by_slug(slug, sort, include_unpublished=is_admin(user))


# ─────────────────────────────────────────────────────────────────────────────
# Admin
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/id/{collection_id}",
    response_model=CollectionAdminDetail,
    summary="Get a collection by id (admin)",
    responses={**_ADMIN_ERRORS, **_NOT_FOUND},
)
async def get_collection_admin(
    collection_id: uuid.UUID, _admin: AdminUser, service: CollectionServiceDep
) -> CollectionAdminDetail:
    """Every product with its position, including drafts, for the curation screen."""
    return await service.get_admin(collection_id)


@router.post(
    "",
    response_model=CollectionAdminDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a collection (admin)",
    responses={**_ADMIN_ERRORS, 400: {"description": "Unknown or deleted products"}, 409: {"description": "Slug already in use"}},
)
async def create_collection(
    payload: CollectionCreate, admin: AdminUser, service: CollectionServiceDep
) -> CollectionAdminDetail:
    """Created unpublished by default. `product_ids` sets the products and their order in one go."""
    return await service.create(payload, actor_id=admin.id)


@router.patch(
    "/{collection_id}",
    response_model=CollectionAdminDetail,
    summary="Update a collection (admin)",
    responses={**_ADMIN_ERRORS, **_NOT_FOUND, 409: {"description": "Slug already in use"}},
)
async def update_collection(
    collection_id: uuid.UUID, payload: CollectionUpdate, admin: AdminUser, service: CollectionServiceDep
) -> CollectionAdminDetail:
    """Only the fields sent are changed. Send `ends_at: null` to remove an end date."""
    return await service.update(collection_id, payload, actor_id=admin.id)


@router.delete(
    "/{collection_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a collection (admin)",
    responses={**_ADMIN_ERRORS, **_NOT_FOUND},
)
async def delete_collection(collection_id: uuid.UUID, admin: AdminUser, service: CollectionServiceDep) -> None:
    """Removes the collection and its banner. The products themselves are not touched."""
    await service.delete(collection_id, actor_id=admin.id)


@router.put(
    "/{collection_id}/products",
    response_model=CollectionAdminDetail,
    summary="Set the products and their order (admin)",
    responses={**_ADMIN_ERRORS, **_NOT_FOUND, 400: {"description": "Unknown or deleted products"}, 422: {"description": "Duplicates"}},
)
async def set_collection_products(
    collection_id: uuid.UUID, payload: CollectionProductsSet, admin: AdminUser, service: CollectionServiceDep
) -> CollectionAdminDetail:
    """Replaces the whole list. Used for drag-and-drop reordering."""
    return await service.set_products(collection_id, payload, actor_id=admin.id)


@router.post(
    "/{collection_id}/products",
    response_model=CollectionAdminDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Add one product (admin)",
    responses={**_ADMIN_ERRORS, **_NOT_FOUND, 400: {"description": "Unknown or deleted product"}, 409: {"description": "Already in the collection"}},
)
async def add_collection_product(
    collection_id: uuid.UUID, payload: CollectionProductAdd, admin: AdminUser, service: CollectionServiceDep
) -> CollectionAdminDetail:
    return await service.add_product(collection_id, payload, actor_id=admin.id)


@router.delete(
    "/{collection_id}/products/{product_id}",
    response_model=CollectionAdminDetail,
    summary="Remove one product (admin)",
    responses={**_ADMIN_ERRORS, 404: {"description": "Collection not found, or product not in it"}},
)
async def remove_collection_product(
    collection_id: uuid.UUID, product_id: uuid.UUID, admin: AdminUser, service: CollectionServiceDep
) -> CollectionAdminDetail:
    return await service.remove_product(collection_id, product_id, actor_id=admin.id)


@router.post(
    "/{collection_id}/image",
    response_model=CollectionAdminDetail,
    summary="Upload the banner image (admin)",
    responses={
        **_ADMIN_ERRORS,
        **_NOT_FOUND,
        413: {"description": "File too large"},
        415: {"description": "Not a JPEG, PNG, WebP, AVIF or GIF image"},
        502: {"description": "Cloudinary upload failed"},
        503: {"description": "Cloudinary is not configured"},
    },
)
async def upload_collection_image(
    collection_id: uuid.UUID,
    admin: AdminUser,
    service: CollectionServiceDep,
    file: UploadFile = File(..., description="JPEG, PNG, WebP, AVIF or GIF"),
) -> CollectionAdminDetail:
    """Stored on Cloudinary. Replaces the current banner and deletes the old file."""
    return await service.upload_image(collection_id, file, actor_id=admin.id)


@router.delete(
    "/{collection_id}/image",
    response_model=CollectionAdminDetail,
    summary="Remove the banner image (admin)",
    responses={**_ADMIN_ERRORS, 404: {"description": "Collection not found or has no banner"}},
)
async def delete_collection_image(
    collection_id: uuid.UUID, admin: AdminUser, service: CollectionServiceDep
) -> CollectionAdminDetail:
    return await service.delete_image(collection_id, actor_id=admin.id)

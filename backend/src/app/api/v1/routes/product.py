"""Product endpoints. Anyone can browse active products; admins manage products, variants, stock and images."""

import uuid
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status

from src.app.api.v1.models.base import ProductStatus
from src.app.api.v1.schemas.product import (
    ImageFromUrl,
    ImageOrder,
    ImageResponse,
    ImageUpdate,
    ProductAdminDetail,
    ProductCreate,
    ProductDetail,
    ProductListItem,
    ProductListResponse,
    ProductSort,
    ProductUpdate,
    StockAdjust,
    VariantCreate,
    VariantResponse,
    VariantUpdate,
)
from src.app.api.v1.services.product_service import ProductService
from src.app.deps import AdminUser, DbSession, OptionalUser, is_admin

router = APIRouter(prefix="/products", tags=["Products"])


def get_product_service(db: DbSession) -> ProductService:
    return ProductService(db)


ProductServiceDep = Annotated[ProductService, Depends(get_product_service)]

_ADMIN_ERRORS = {
    401: {"description": "Missing, invalid or expired access token"},
    403: {"description": "Admin access required"},
}
_NOT_FOUND = {404: {"description": "Product not found"}}
_DELETED = {409: {"description": "Product is deleted"}}


# ─────────────────────────────────────────────────────────────────────────────
# Public
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=ProductListResponse, summary="List products")
async def list_products(
    service: ProductServiceDep,
    user: OptionalUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(24, ge=1, le=100),
    category: str | None = Query(None, max_length=80, description="Category slug; includes its subcategories"),
    q: str | None = Query(None, max_length=100, description="Search name, brand, description and tags"),
    brand: str | None = Query(None, max_length=100),
    min_price: Decimal | None = Query(None, ge=0),
    max_price: Decimal | None = Query(None, ge=0),
    min_rating: float | None = Query(None, ge=0, le=5),
    on_sale: bool = Query(False),
    in_stock: bool = Query(False),
    featured: bool = Query(False),
    sort: ProductSort = Query(ProductSort.FEATURED),
    include_unpublished: bool = Query(False, description="Admins only: include drafts and archived products"),
    status_filter: ProductStatus | None = Query(None, alias="status", description="Admins only, with include_unpublished"),
) -> ProductListResponse:
    admin_view = include_unpublished and is_admin(user)
    items, total = await service.list_products(
        skip=skip,
        limit=limit,
        category=category,
        q=q,
        brand=brand,
        min_price=min_price,
        max_price=max_price,
        min_rating=min_rating,
        on_sale=on_sale,
        in_stock=in_stock,
        featured=featured,
        sort=sort,
        admin=admin_view,
        status_filter=status_filter if admin_view else None,
    )
    return ProductListResponse(items=items, total=total, skip=skip, limit=limit)


@router.get("/{slug}", response_model=ProductDetail, summary="Get a product by slug", responses=_NOT_FOUND)
async def get_product(slug: str, service: ProductServiceDep) -> ProductDetail:
    """Full product page data: images, active variants with stock, category."""
    return await service.get_by_slug(slug)


@router.get("/{slug}/related", response_model=list[ProductListItem], summary="Related products", responses=_NOT_FOUND)
async def related_products(
    slug: str,
    service: ProductServiceDep,
    limit: int = Query(8, ge=1, le=24),
) -> list[ProductListItem]:
    """Same category first, then the best-rated products from the rest of the store."""
    return await service.related(slug, limit=limit)


# ─────────────────────────────────────────────────────────────────────────────
# Admin: products
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/id/{product_id}",
    response_model=ProductAdminDetail,
    summary="Get a product by id (admin)",
    responses={**_ADMIN_ERRORS, **_NOT_FOUND},
)
async def get_product_admin(product_id: uuid.UUID, _admin: AdminUser, service: ProductServiceDep) -> ProductAdminDetail:
    """Any status, including deleted, with all variants and internal fields."""
    return await service.get_admin(product_id)


@router.post(
    "",
    response_model=ProductAdminDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a product (admin)",
    responses={**_ADMIN_ERRORS, 400: {"description": "Category does not exist"}, 409: {"description": "Slug or SKU already in use"}},
)
async def create_product(payload: ProductCreate, admin: AdminUser, service: ProductServiceDep) -> ProductAdminDetail:
    """Created as a draft unless `status` says otherwise. A default variant is added when none are sent."""
    return await service.create(payload, actor_id=admin.id)


@router.patch(
    "/{product_id}",
    response_model=ProductAdminDetail,
    summary="Update a product (admin)",
    responses={**_ADMIN_ERRORS, **_NOT_FOUND, **_DELETED, 400: {"description": "Category does not exist"}},
)
async def update_product(
    product_id: uuid.UUID, payload: ProductUpdate, admin: AdminUser, service: ProductServiceDep
) -> ProductAdminDetail:
    """Only the fields sent are changed. Setting `status` to `active` publishes the product."""
    return await service.update(product_id, payload, actor_id=admin.id)


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a product (admin)",
    responses={**_ADMIN_ERRORS, **_NOT_FOUND, **_DELETED},
)
async def delete_product(product_id: uuid.UUID, admin: AdminUser, service: ProductServiceDep) -> None:
    """Soft delete: hidden from the store but kept so past orders still show it."""
    await service.delete(product_id, actor_id=admin.id)


# ─────────────────────────────────────────────────────────────────────────────
# Admin: variants and stock
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/{product_id}/variants",
    response_model=ProductAdminDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Add a variant (admin)",
    responses={**_ADMIN_ERRORS, **_NOT_FOUND, 409: {"description": "Same colour/size or SKU already exists"}},
)
async def add_variant(
    product_id: uuid.UUID, payload: VariantCreate, admin: AdminUser, service: ProductServiceDep
) -> ProductAdminDetail:
    return await service.add_variant(product_id, payload, actor_id=admin.id)


@router.patch(
    "/{product_id}/variants/{variant_id}",
    response_model=ProductAdminDetail,
    summary="Update a variant (admin)",
    responses={**_ADMIN_ERRORS, 404: {"description": "Product or variant not found"}, 409: {"description": "Conflict"}},
)
async def update_variant(
    product_id: uuid.UUID,
    variant_id: uuid.UUID,
    payload: VariantUpdate,
    admin: AdminUser,
    service: ProductServiceDep,
) -> ProductAdminDetail:
    """Stock is changed with the stock endpoint, so every change is audited."""
    return await service.update_variant(product_id, variant_id, payload, actor_id=admin.id)


@router.delete(
    "/{product_id}/variants/{variant_id}",
    response_model=ProductAdminDetail,
    summary="Delete a variant (admin)",
    responses={**_ADMIN_ERRORS, 404: {"description": "Product or variant not found"}, 409: {"description": "Last variant"}},
)
async def delete_variant(
    product_id: uuid.UUID, variant_id: uuid.UUID, admin: AdminUser, service: ProductServiceDep
) -> ProductAdminDetail:
    return await service.delete_variant(product_id, variant_id, actor_id=admin.id)


@router.patch(
    "/{product_id}/variants/{variant_id}/stock",
    response_model=VariantResponse,
    summary="Set or adjust stock (admin)",
    responses={**_ADMIN_ERRORS, 404: {"description": "Product or variant not found"}, 409: {"description": "Stock would go below zero"}},
)
async def adjust_stock(
    product_id: uuid.UUID,
    variant_id: uuid.UUID,
    payload: StockAdjust,
    admin: AdminUser,
    service: ProductServiceDep,
) -> VariantResponse:
    """`{"set_to": 20}` sets an exact count; `{"change_by": -2}` adjusts it. Safe under concurrent edits."""
    return await service.adjust_stock(product_id, variant_id, payload, actor_id=admin.id)


# ─────────────────────────────────────────────────────────────────────────────
# Admin: images (stored on Cloudinary)
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/{product_id}/images",
    response_model=ImageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload an image (admin)",
    responses={
        **_ADMIN_ERRORS,
        **_NOT_FOUND,
        413: {"description": "File too large"},
        415: {"description": "Not a JPEG, PNG, WebP, AVIF or GIF image"},
        502: {"description": "Cloudinary upload failed"},
        503: {"description": "Cloudinary is not configured"},
    },
)
async def upload_image(
    product_id: uuid.UUID,
    admin: AdminUser,
    service: ProductServiceDep,
    file: UploadFile = File(..., description="JPEG, PNG, WebP, AVIF or GIF"),
    alt_text: str | None = Form(None, max_length=200),
    variant_id: uuid.UUID | None = Form(None, description="Show this image when this variant is selected"),
) -> ImageResponse:
    """Multipart upload. The file is checked by its content, stored on Cloudinary and added as the last image."""
    return await service.upload_image(product_id, file, alt_text, variant_id, actor_id=admin.id)


@router.post(
    "/{product_id}/images/url",
    response_model=ImageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add an image by URL (admin)",
    responses={**_ADMIN_ERRORS, **_NOT_FOUND},
)
async def add_image_url(
    product_id: uuid.UUID, payload: ImageFromUrl, admin: AdminUser, service: ProductServiceDep
) -> ImageResponse:
    """Links an image already hosted elsewhere (e.g. for seeding). Nothing is uploaded."""
    return await service.add_image_url(product_id, payload, actor_id=admin.id)


@router.put(
    "/{product_id}/images/order",
    response_model=list[ImageResponse],
    summary="Reorder images (admin)",
    responses={**_ADMIN_ERRORS, **_NOT_FOUND, 422: {"description": "List does not match the product's images"}},
)
async def reorder_images(
    product_id: uuid.UUID, payload: ImageOrder, admin: AdminUser, service: ProductServiceDep
) -> list[ImageResponse]:
    """The first image becomes the main product image."""
    return await service.reorder_images(product_id, payload, actor_id=admin.id)


@router.patch(
    "/{product_id}/images/{image_id}",
    response_model=ImageResponse,
    summary="Update image details (admin)",
    responses={**_ADMIN_ERRORS, 404: {"description": "Product or image not found"}},
)
async def update_image(
    product_id: uuid.UUID,
    image_id: uuid.UUID,
    payload: ImageUpdate,
    admin: AdminUser,
    service: ProductServiceDep,
) -> ImageResponse:
    return await service.update_image(product_id, image_id, payload, actor_id=admin.id)


@router.delete(
    "/{product_id}/images/{image_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an image (admin)",
    responses={**_ADMIN_ERRORS, 404: {"description": "Product or image not found"}},
)
async def delete_image(product_id: uuid.UUID, image_id: uuid.UUID, admin: AdminUser, service: ProductServiceDep) -> None:
    """Removes the image from the product and deletes the file from Cloudinary."""
    await service.delete_image(product_id, image_id, actor_id=admin.id)

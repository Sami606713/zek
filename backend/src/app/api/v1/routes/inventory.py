"""Admin inventory: stock for every variant, to find what needs restocking."""

from typing import Literal

from fastapi import APIRouter, Query

from src.app.api.v1.routes.product import ProductServiceDep
from src.app.api.v1.schemas.product import InventoryResponse, StockLevel
from src.app.deps import AdminUser

router = APIRouter(prefix="/admin/inventory", tags=["Admin: Inventory"])


@router.get(
    "",
    response_model=InventoryResponse,
    summary="Stock by variant (admin)",
    responses={401: {"description": "Missing, invalid or expired access token"}, 403: {"description": "Admin access required"}},
)
async def list_inventory(
    _admin: AdminUser,
    service: ProductServiceDep,
    level: StockLevel | None = Query(None, description="out = 0 left, low = at or under the product's alert level"),
    q: str | None = Query(None, max_length=100, description="Product name, brand, SKU, color or size"),
    sort: Literal["name", "stock"] = Query("name", description="name, or stock (lowest first)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> InventoryResponse:
    """Variants of active and draft products. Change stock with `PATCH /products/{id}/variants/{id}/stock`."""
    return await service.inventory(level=level, q=q, sort=sort, skip=skip, limit=limit)

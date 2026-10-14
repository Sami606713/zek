"""Admin customers: accounts with their order totals, and role / access control."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from src.app.api.v1.schemas.customer import (
    CustomerAccessUpdate,
    CustomerDetail,
    CustomerListResponse,
    CustomerSegment,
    CustomerSort,
)
from src.app.api.v1.services.customer_service import CustomerService
from src.app.deps import AdminUser, DbSession

router = APIRouter(prefix="/admin/customers", tags=["Admin: Customers"])


def get_customer_service(db: DbSession) -> CustomerService:
    return CustomerService(db)


CustomerServiceDep = Annotated[CustomerService, Depends(get_customer_service)]

_ADMIN_ERRORS = {
    401: {"description": "Missing, invalid or expired access token"},
    403: {"description": "Admin access required"},
}


@router.get("", response_model=CustomerListResponse, summary="List customers with order totals (admin)", responses=_ADMIN_ERRORS)
async def list_customers(
    _admin: AdminUser,
    service: CustomerServiceDep,
    search: str | None = Query(None, max_length=100, description="Name, email, username or phone"),
    segment: CustomerSegment | None = Query(None),
    sort: CustomerSort = Query(CustomerSort.NEWEST),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> CustomerListResponse:
    return await service.list(search=search, segment=segment, sort=sort, skip=skip, limit=limit)


@router.get(
    "/{user_id}",
    response_model=CustomerDetail,
    summary="Get a customer with totals and addresses (admin)",
    responses={**_ADMIN_ERRORS, 404: {"description": "Customer not found"}},
)
async def get_customer(user_id: uuid.UUID, _admin: AdminUser, service: CustomerServiceDep) -> CustomerDetail:
    return await service.get(user_id)


@router.patch(
    "/{user_id}/access",
    response_model=CustomerDetail,
    summary="Change role or turn an account on/off (admin)",
    responses={
        **_ADMIN_ERRORS,
        400: {"description": "Admins can't change their own access"},
        404: {"description": "Customer not found"},
    },
)
async def update_access(
    user_id: uuid.UUID, payload: CustomerAccessUpdate, admin: AdminUser, service: CustomerServiceDep
) -> CustomerDetail:
    """Turning an account off blocks sign-in and every existing token at once. The change is audit-logged."""
    return await service.update_access(user_id, payload, actor=admin)

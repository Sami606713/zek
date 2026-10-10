"""Saved addresses of the signed-in user (address book used at checkout)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status

from src.app.api.v1.models.address import Address
from src.app.api.v1.schemas.address import AddressCreate, AddressResponse, AddressUpdate
from src.app.api.v1.services.address_service import AddressService
from src.app.deps import CurrentUser, DbSession

router = APIRouter(prefix="/me/addresses", tags=["Addresses"])


def get_address_service(db: DbSession) -> AddressService:
    return AddressService(db)


AddressServiceDep = Annotated[AddressService, Depends(get_address_service)]

_AUTH = {401: {"description": "Missing, invalid or expired access token"}}
_NOT_FOUND = {404: {"description": "Address not found"}}


@router.get("", response_model=list[AddressResponse], summary="List my addresses", responses=_AUTH)
async def list_addresses(user: CurrentUser, service: AddressServiceDep) -> list[Address]:
    """The default address comes first, then the most recently updated."""
    return await service.list_addresses(user.id)


@router.post(
    "",
    response_model=AddressResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add an address",
    responses={**_AUTH, 409: {"description": "Address limit reached"}},
)
async def create_address(payload: AddressCreate, user: CurrentUser, service: AddressServiceDep) -> Address:
    """The first address is always the default. Send `is_default: true` to make a new one the default."""
    return await service.create(user.id, payload)


@router.get("/{address_id}", response_model=AddressResponse, summary="Get an address", responses={**_AUTH, **_NOT_FOUND})
async def get_address(address_id: uuid.UUID, user: CurrentUser, service: AddressServiceDep) -> Address:
    return await service.get(user.id, address_id)


@router.patch(
    "/{address_id}",
    response_model=AddressResponse,
    summary="Update an address",
    responses={**_AUTH, **_NOT_FOUND, 422: {"description": "Invalid fields, or trying to unset the default"}},
)
async def update_address(
    address_id: uuid.UUID, payload: AddressUpdate, user: CurrentUser, service: AddressServiceDep
) -> Address:
    """Only the fields sent are changed."""
    return await service.update(user.id, address_id, payload)


@router.post(
    "/{address_id}/default",
    response_model=AddressResponse,
    summary="Make an address the default",
    responses={**_AUTH, **_NOT_FOUND},
)
async def set_default_address(address_id: uuid.UUID, user: CurrentUser, service: AddressServiceDep) -> Address:
    return await service.set_default(user.id, address_id)


@router.delete(
    "/{address_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an address",
    responses={**_AUTH, **_NOT_FOUND},
)
async def delete_address(address_id: uuid.UUID, user: CurrentUser, service: AddressServiceDep) -> None:
    """Deleting the default promotes your most recently used remaining address."""
    await service.delete(user.id, address_id)

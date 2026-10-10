"""Saved addresses for the signed-in user. Each user has at most one default address."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.v1.models.address import Address
from src.app.api.v1.schemas.address import MAX_ADDRESSES_PER_USER, AddressCreate, AddressUpdate

_REQUIRED = {"full_name", "line1", "city", "region", "postal_code", "country"}


class AddressService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _get_own(self, user_id: uuid.UUID, address_id: uuid.UUID) -> Address:
        # Another user's address is reported as "not found", never "forbidden".
        address = await self.db.scalar(select(Address).where(Address.id == address_id, Address.user_id == user_id))
        if not address:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")
        return address

    async def _clear_default(self, user_id: uuid.UUID, except_id: uuid.UUID | None = None) -> None:
        # Unset first and flush, so the one-default-per-user index never sees two defaults.
        q = update(Address).where(Address.user_id == user_id, Address.is_default.is_(True))
        if except_id:
            q = q.where(Address.id != except_id)
        await self.db.execute(q.values(is_default=False).execution_options(synchronize_session="fetch"))
        await self.db.flush()

    # ── Reads ─────────────────────────────────────────────────────────────────

    async def list_addresses(self, user_id: uuid.UUID) -> list[Address]:
        result = await self.db.execute(
            select(Address)
            .where(Address.user_id == user_id)
            .order_by(Address.is_default.desc(), Address.updated_at.desc())
        )
        return list(result.scalars().all())

    async def get(self, user_id: uuid.UUID, address_id: uuid.UUID) -> Address:
        return await self._get_own(user_id, address_id)

    async def get_default(self, user_id: uuid.UUID) -> Address | None:
        return await self.db.scalar(select(Address).where(Address.user_id == user_id, Address.is_default.is_(True)))

    # ── Writes ────────────────────────────────────────────────────────────────

    async def create(self, user_id: uuid.UUID, payload: AddressCreate) -> Address:
        count = await self.db.scalar(select(func.count()).select_from(Address).where(Address.user_id == user_id)) or 0
        if count >= MAX_ADDRESSES_PER_USER:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"You can save up to {MAX_ADDRESSES_PER_USER} addresses. Delete one to add another.",
            )

        make_default = payload.is_default or count == 0
        if make_default:
            await self._clear_default(user_id)

        address = Address(id=uuid.uuid4(), user_id=user_id, **payload.model_dump(exclude={"is_default"}), is_default=make_default)
        self.db.add(address)
        await self.db.commit()
        await self.db.refresh(address)
        return address

    async def update(self, user_id: uuid.UUID, address_id: uuid.UUID, payload: AddressUpdate) -> Address:
        address = await self._get_own(user_id, address_id)
        sent = payload.model_fields_set

        for field in sent & _REQUIRED:
            if getattr(payload, field) is None:
                raise HTTPException(status_code=422, detail=f"{field} cannot be empty")

        if "is_default" in sent:
            if payload.is_default:
                await self._clear_default(user_id, except_id=address.id)
                address.is_default = True
            elif address.is_default:
                raise HTTPException(
                    status_code=422,
                    detail="Choose another default address instead of unsetting this one",
                )

        for field in sent - {"is_default"}:
            setattr(address, field, getattr(payload, field))

        await self.db.commit()
        await self.db.refresh(address)
        return address

    async def set_default(self, user_id: uuid.UUID, address_id: uuid.UUID) -> Address:
        address = await self._get_own(user_id, address_id)
        if not address.is_default:
            await self._clear_default(user_id, except_id=address.id)
            address.is_default = True
            await self.db.commit()
            await self.db.refresh(address)
        return address

    async def delete(self, user_id: uuid.UUID, address_id: uuid.UUID) -> None:
        address = await self._get_own(user_id, address_id)
        was_default = address.is_default
        await self.db.delete(address)
        await self.db.flush()

        if was_default:
            # Promote the most recently used remaining address so checkout always has a default.
            replacement = await self.db.scalar(
                select(Address).where(Address.user_id == user_id).order_by(Address.updated_at.desc()).limit(1)
            )
            if replacement:
                replacement.is_default = True
        await self.db.commit()

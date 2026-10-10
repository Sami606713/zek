"""The signed-in shopper's wishlist (saved products)."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.app.api.v1.models.base import ProductStatus
from src.app.api.v1.models.catalog import Product, ProductVariant
from src.app.api.v1.models.wishlist import WishlistItem as WishlistRow
from src.app.api.v1.schemas.wishlist import MAX_WISHLIST_ITEMS, WishlistAdd, WishlistItem, WishlistResponse
from src.app.api.v1.services.product_service import _LOAD as PRODUCT_LOAD
from src.app.api.v1.services.product_service import ProductService


class WishlistService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.products = ProductService(db)

    async def list_items(self, user_id: uuid.UUID) -> WishlistResponse:
        rows = (
            await self.db.execute(
                select(WishlistRow)
                .options(selectinload(WishlistRow.product).options(*PRODUCT_LOAD))
                .where(WishlistRow.user_id == user_id)
                .order_by(WishlistRow.created_at.desc())
            )
        ).scalars().all()

        items = []
        for row in rows:
            p = row.product
            if p is None or p.deleted_at is not None:
                continue  # deleted products quietly drop off
            card = self.products.to_list_item(p)
            items.append(
                WishlistItem(
                    product=card,
                    variant_id=row.variant_id,
                    is_available=p.status == ProductStatus.ACTIVE and card.in_stock,
                    added_at=row.created_at,
                )
            )
        return WishlistResponse(items=items, total=len(items))

    async def ids(self, user_id: uuid.UUID) -> list[uuid.UUID]:
        result = await self.db.execute(
            select(WishlistRow.product_id)
            .join(Product, Product.id == WishlistRow.product_id)
            .where(WishlistRow.user_id == user_id, Product.deleted_at.is_(None))
            .order_by(WishlistRow.created_at.desc())
        )
        return list(result.scalars().all())

    async def add(self, user_id: uuid.UUID, payload: WishlistAdd) -> tuple[WishlistResponse, bool]:
        """Returns the wishlist and whether the product was newly added (adding twice is harmless)."""
        product = await self.db.scalar(
            select(Product).where(
                Product.id == payload.product_id,
                Product.deleted_at.is_(None),
                Product.status == ProductStatus.ACTIVE,
            )
        )
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        if payload.variant_id:
            ok = await self.db.scalar(
                select(ProductVariant.id).where(ProductVariant.id == payload.variant_id, ProductVariant.product_id == product.id)
            )
            if not ok:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="variant_id does not belong to this product")

        existing = await self.db.scalar(
            select(WishlistRow).where(WishlistRow.user_id == user_id, WishlistRow.product_id == product.id)
        )
        if existing:
            if payload.variant_id and existing.variant_id != payload.variant_id:
                existing.variant_id = payload.variant_id
                await self.db.commit()
            return await self.list_items(user_id), False

        count = await self.db.scalar(select(func.count()).select_from(WishlistRow).where(WishlistRow.user_id == user_id)) or 0
        if count >= MAX_WISHLIST_ITEMS:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Your wishlist is full ({MAX_WISHLIST_ITEMS} items). Remove something to add more.",
            )

        self.db.add(WishlistRow(user_id=user_id, product_id=product.id, variant_id=payload.variant_id))
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()   # added by a parallel request: same end result
            return await self.list_items(user_id), False
        return await self.list_items(user_id), True

    async def remove(self, user_id: uuid.UUID, product_id: uuid.UUID) -> None:
        result = await self.db.execute(
            delete(WishlistRow).where(WishlistRow.user_id == user_id, WishlistRow.product_id == product_id)
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product is not in your wishlist")
        await self.db.commit()

    async def clear(self, user_id: uuid.UUID) -> None:
        await self.db.execute(delete(WishlistRow).where(WishlistRow.user_id == user_id))
        await self.db.commit()

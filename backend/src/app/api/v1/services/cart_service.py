"""Cart CRUD for signed-in users and guests, with totals priced on the server."""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import set_committed_value

from src.app.api.v1.models.base import ProductStatus
from src.app.api.v1.models.cart import Cart, CartItem
from src.app.api.v1.models.catalog import Product, ProductVariant
from src.app.api.v1.schemas.cart import (
    MAX_LINE_QUANTITY,
    AppliedDiscount,
    CartItemAdd,
    CartItemUpdate,
    CartLine,
    CartResponse,
    DiscountApply,
)
from src.app.api.v1.services.pricing_service import PricingService, money

GUEST_CART_DAYS = 30

_LOAD = (
    selectinload(Cart.items)
    .selectinload(CartItem.variant)
    .selectinload(ProductVariant.product)
    .selectinload(Product.images),
)


@dataclass(frozen=True)
class CartOwner:
    """Exactly one is set: the signed-in user, or the guest's session id."""

    user_id: uuid.UUID | None = None
    session_id: str | None = None


def _sellable(variant: ProductVariant | None) -> bool:
    return (
        variant is not None
        and variant.is_active
        and variant.product is not None
        and variant.product.deleted_at is None
        and variant.product.status == ProductStatus.ACTIVE
    )


class CartService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.pricing = PricingService(db)

    # ── Loading ───────────────────────────────────────────────────────────────

    def _owner_filter(self, owner: CartOwner):
        return Cart.user_id == owner.user_id if owner.user_id else Cart.session_id == owner.session_id

    async def _find(self, owner: CartOwner) -> Cart | None:
        return await self.db.scalar(
            select(Cart).options(*_LOAD).where(self._owner_filter(owner)).execution_options(populate_existing=True)
        )

    async def _get_or_create(self, owner: CartOwner) -> Cart:
        cart = await self._find(owner)
        if cart:
            return cart
        cart = Cart(id=uuid.uuid4(), user_id=owner.user_id, session_id=owner.session_id if not owner.user_id else None)
        set_committed_value(cart, "items", [])  # a new cart has no items; avoid an async lazy load
        self.db.add(cart)
        try:
            await self.db.flush()
        except IntegrityError:
            # Another request created it at the same moment: use that one.
            await self.db.rollback()
            cart = await self._find(owner)
            if cart is None:
                raise
        return cart

    def _touch(self, cart: Cart, owner: CartOwner) -> None:
        cart.updated_at = datetime.now(timezone.utc)
        if owner.user_id is None:
            cart.expires_at = datetime.now(timezone.utc) + timedelta(days=GUEST_CART_DAYS)

    async def _variant(self, variant_id: uuid.UUID) -> ProductVariant:
        variant = await self.db.scalar(
            select(ProductVariant).options(selectinload(ProductVariant.product)).where(ProductVariant.id == variant_id)
        )
        if not _sellable(variant):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This product is not available")
        return variant

    @staticmethod
    def _max_quantity(variant: ProductVariant) -> int:
        return min(variant.stock_qty, MAX_LINE_QUANTITY) if _sellable(variant) else 0

    def _assert_quantity(self, variant: ProductVariant, quantity: int) -> None:
        limit = self._max_quantity(variant)
        if limit == 0:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This item is sold out")
        if quantity > limit:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Only {limit} available" if limit < MAX_LINE_QUANTITY else f"You can order at most {limit} of one item",
            )

    # ── Response ──────────────────────────────────────────────────────────────

    def _line(self, item: CartItem) -> tuple[CartLine, int]:
        """The line for the response, and how many units of it count towards the total."""
        v = item.variant
        p = v.product
        unit_price = v.price if v.price is not None else p.price
        image = next((i for i in p.images if i.variant_id == v.id), None) or (p.images[0] if p.images else None)

        sellable = _sellable(v)
        limit = self._max_quantity(v)
        if not sellable:
            issue = "No longer available"
        elif limit == 0:
            issue = "Sold out"
        elif item.quantity > limit:
            issue = f"Only {limit} left"
        else:
            issue = None
        counted = min(item.quantity, limit) if sellable else 0

        line = CartLine(
            id=item.id,
            variant_id=v.id,
            product_id=p.id,
            slug=p.slug,
            name=p.name,
            brand=p.brand,
            image_url=image.url if image else None,
            sku=v.sku,
            color_name=v.color_name,
            color_hex=v.color_hex,
            size=v.size,
            unit_price=money(unit_price),
            compare_at_price=money(p.compare_at_price) if p.compare_at_price else None,
            quantity=item.quantity,
            line_total=money(unit_price * counted),
            stock_qty=v.stock_qty,
            max_quantity=limit,
            is_available=sellable and limit > 0,
            issue=issue,
        )
        return line, counted

    async def build_response(self, cart: Cart | None, owner: CartOwner) -> CartResponse:
        rates = await self.pricing.rates()
        lines, units = [], 0
        for item in sorted(cart.items, key=lambda i: i.created_at) if cart else []:
            line, counted = self._line(item)
            lines.append(line)
            units += counted

        subtotal = sum((l.line_total for l in lines), Decimal("0.00"))
        code = cart.discount_code if cart else None
        result = await self.pricing.evaluate_discount(code, subtotal, owner.user_id) if code and subtotal > 0 else None
        if code and subtotal == 0:
            discount_error = "Add items to use this code"
        else:
            discount_error = result.error if result else None
        discount_amount = result.amount if result and result.discount else Decimal("0.00")
        totals = self.pricing.totals(subtotal, discount_amount, rates, has_items=units > 0)

        return CartResponse(
            id=cart.id if cart else None,
            items=lines,
            item_count=units,
            subtotal=totals.subtotal,
            discount=AppliedDiscount(code=result.discount.code, description=result.discount.description, amount=totals.discount)
            if result and result.discount
            else None,
            discount_code=code,
            discount_error=discount_error,
            shipping=totals.shipping,
            express_shipping=rates.express_shipping,
            tax=totals.tax,
            total=totals.total,
            free_shipping_threshold=rates.free_shipping_threshold,
            remaining_for_free_shipping=totals.remaining_for_free_shipping,
            has_issues=any(l.issue for l in lines),
            updated_at=cart.updated_at if cart else None,
        )

    async def _respond(self, owner: CartOwner) -> CartResponse:
        return await self.build_response(await self._find(owner), owner)

    # ── Reads ─────────────────────────────────────────────────────────────────

    async def get(self, owner: CartOwner) -> CartResponse:
        return await self._respond(owner)

    # ── Items ─────────────────────────────────────────────────────────────────

    async def add_item(self, owner: CartOwner, payload: CartItemAdd) -> CartResponse:
        variant = await self._variant(payload.variant_id)
        cart = await self._get_or_create(owner)
        existing = next((i for i in cart.items if i.variant_id == variant.id), None)
        new_quantity = (existing.quantity if existing else 0) + payload.quantity
        self._assert_quantity(variant, new_quantity)

        if existing:
            existing.quantity = new_quantity
        else:
            self.db.add(CartItem(cart_id=cart.id, variant_id=variant.id, quantity=payload.quantity))
        self._touch(cart, owner)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The cart changed at the same time. Please try again.")
        return await self._respond(owner)

    async def _item(self, owner: CartOwner, item_id: int) -> tuple[Cart, CartItem]:
        cart = await self._find(owner)
        item = next((i for i in cart.items if i.id == item_id), None) if cart else None
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found in your cart")
        return cart, item

    async def update_item(self, owner: CartOwner, item_id: int, payload: CartItemUpdate) -> CartResponse:
        cart, item = await self._item(owner, item_id)
        self._assert_quantity(item.variant, payload.quantity)
        item.quantity = payload.quantity
        self._touch(cart, owner)
        await self.db.commit()
        return await self._respond(owner)

    async def remove_item(self, owner: CartOwner, item_id: int) -> CartResponse:
        cart, item = await self._item(owner, item_id)
        await self.db.delete(item)
        self._touch(cart, owner)
        await self.db.commit()
        return await self._respond(owner)

    async def clear(self, owner: CartOwner) -> CartResponse:
        cart = await self._find(owner)
        if cart:
            for item in list(cart.items):
                await self.db.delete(item)
            cart.discount_code = None
            self._touch(cart, owner)
            await self.db.commit()
        return await self._respond(owner)

    # ── Discount ──────────────────────────────────────────────────────────────

    async def apply_discount(self, owner: CartOwner, payload: DiscountApply) -> CartResponse:
        current = await self.build_response(await self._find(owner), owner)
        if current.item_count == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Add items to your cart before using a code")
        result = await self.pricing.evaluate_discount(payload.code, current.subtotal, owner.user_id)
        if result.error:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result.error)

        cart = await self._get_or_create(owner)
        cart.discount_code = result.discount.code
        self._touch(cart, owner)
        await self.db.commit()
        return await self._respond(owner)

    async def remove_discount(self, owner: CartOwner) -> CartResponse:
        cart = await self._find(owner)
        if cart and cart.discount_code:
            cart.discount_code = None
            self._touch(cart, owner)
            await self.db.commit()
        return await self._respond(owner)

    # ── Merge guest cart after sign-in ────────────────────────────────────────

    async def merge_guest_cart(self, user_id: uuid.UUID, session_id: str) -> CartResponse:
        user_owner = CartOwner(user_id=user_id)
        guest = await self._find(CartOwner(session_id=session_id))
        if guest is None or not guest.items:
            if guest is not None:
                await self.db.delete(guest)
                await self.db.commit()
            return await self._respond(user_owner)

        cart = await self._get_or_create(user_owner)
        by_variant = {i.variant_id: i for i in cart.items}
        for g in guest.items:
            limit = self._max_quantity(g.variant)
            if limit == 0:
                continue  # drop lines that can no longer be bought
            if g.variant_id in by_variant:
                mine = by_variant[g.variant_id]
                mine.quantity = min(mine.quantity + g.quantity, limit)
            else:
                self.db.add(CartItem(cart_id=cart.id, variant_id=g.variant_id, quantity=min(g.quantity, limit)))
        if not cart.discount_code and guest.discount_code:
            cart.discount_code = guest.discount_code

        await self.db.delete(guest)
        self._touch(cart, user_owner)
        await self.db.commit()
        return await self._respond(user_owner)

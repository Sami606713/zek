"""Server-side pricing shared by cart and checkout: store rates, discount validation and totals.

Rates come from the `store_settings` table (editable in the admin panel) and fall back to
the defaults below, which match the storefront.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.v1.models.base import DiscountType, OrderStatus
from src.app.api.v1.models.discount import Discount
from src.app.api.v1.models.order import Order
from src.app.api.v1.models.store_setting import StoreSetting

CENT = Decimal("0.01")

DEFAULT_RATES = {
    "shipping.free_threshold": "50.00",
    "shipping.flat_rate": "5.99",
    "shipping.express_rate": "14.99",
    "tax.rate": "0.08",
}


def money(value: Decimal | int | float | str) -> Decimal:
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class StoreRates:
    free_shipping_threshold: Decimal
    flat_shipping: Decimal
    express_shipping: Decimal
    tax_rate: Decimal


@dataclass(frozen=True)
class DiscountResult:
    discount: Discount | None
    amount: Decimal
    error: str | None


@dataclass(frozen=True)
class Totals:
    subtotal: Decimal
    discount: Decimal
    shipping: Decimal
    tax: Decimal
    total: Decimal
    remaining_for_free_shipping: Decimal


class PricingService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def rates(self) -> StoreRates:
        rows = dict((await self.db.execute(select(StoreSetting.key, StoreSetting.value).where(StoreSetting.key.in_(DEFAULT_RATES)))).all())

        def get(key: str) -> Decimal:
            try:
                return Decimal(str(rows.get(key, DEFAULT_RATES[key])))
            except Exception:
                return Decimal(DEFAULT_RATES[key])

        return StoreRates(
            free_shipping_threshold=money(get("shipping.free_threshold")),
            flat_shipping=money(get("shipping.flat_rate")),
            express_shipping=money(get("shipping.express_rate")),
            tax_rate=get("tax.rate"),
        )

    async def find_discount(self, code: str) -> Discount | None:
        return await self.db.scalar(select(Discount).where(Discount.code == code.strip().upper()))

    async def evaluate_discount(
        self, code: str | None, subtotal: Decimal, user_id: uuid.UUID | None
    ) -> DiscountResult:
        """Check a code against the current order. Never raises: problems come back as `error`."""
        if not code:
            return DiscountResult(None, Decimal("0.00"), None)
        d = await self.find_discount(code)
        now = datetime.now(timezone.utc)

        if d is None or not d.is_active:
            return DiscountResult(None, Decimal("0.00"), f"'{code.upper()}' is not a valid code")
        if d.starts_at and d.starts_at > now:
            return DiscountResult(None, Decimal("0.00"), f"'{d.code}' is not active yet")
        if d.ends_at and d.ends_at <= now:
            return DiscountResult(None, Decimal("0.00"), f"'{d.code}' has expired")
        if d.usage_limit is not None and d.used_count >= d.usage_limit:
            return DiscountResult(None, Decimal("0.00"), f"'{d.code}' has reached its usage limit")
        if d.min_order_amount is not None and subtotal < d.min_order_amount:
            short = money(d.min_order_amount - subtotal)
            return DiscountResult(None, Decimal("0.00"), f"Add {short} more to use '{d.code}' (minimum order {money(d.min_order_amount)})")
        if d.per_customer_limit is not None and user_id is not None:
            used = await self.db.scalar(
                select(func.count())
                .select_from(Order)
                .where(Order.user_id == user_id, Order.discount_id == d.id, Order.status != OrderStatus.CANCELLED)
            )
            if (used or 0) >= d.per_customer_limit:
                return DiscountResult(None, Decimal("0.00"), f"You have already used '{d.code}'")

        if d.type == DiscountType.PERCENT:
            amount = money(subtotal * Decimal(d.value) / Decimal(100))
        else:
            amount = money(d.value)
        return DiscountResult(d, min(amount, subtotal), None)

    @staticmethod
    def totals(subtotal: Decimal, discount: Decimal, rates: StoreRates, express: bool = False, has_items: bool = True) -> Totals:
        subtotal, discount = money(subtotal), money(discount)
        after_discount = max(subtotal - discount, Decimal("0.00"))
        if not has_items:
            shipping = Decimal("0.00")
        elif express:
            shipping = rates.express_shipping
        else:
            shipping = Decimal("0.00") if after_discount >= rates.free_shipping_threshold else rates.flat_shipping
        tax = money(after_discount * rates.tax_rate)
        return Totals(
            subtotal=subtotal,
            discount=discount,
            shipping=shipping,
            tax=tax,
            total=money(after_discount + shipping + tax),
            remaining_for_free_shipping=money(max(rates.free_shipping_threshold - after_discount, Decimal("0"))) if has_items else rates.free_shipping_threshold,
        )

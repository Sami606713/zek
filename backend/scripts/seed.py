"""
seed.py — Fill the database with demo data for the storefront and admin panel.

Seeds (all safe to run again: existing records are matched and skipped):
  - Users: 1 admin + 3 customers, with saved addresses
  - Catalogue from seed_data/catalog.json (same as the frontend mock):
    5 categories, 16 products (variants, stock, images), 4 collections
  - Promo codes (ZEK10, WELCOME5, BIG20, an expired and a scheduled one)
  - Store settings (shipping and tax rates)
  - Orders in every status and channel, with status history and refunds
  - Reviews, wishlists, a saved cart

Usage (from the backend folder):
  python scripts/seed.py              add whatever is missing
  python scripts/seed.py --fresh      ⚠️ wipe ALL store data first, then seed (asks to confirm)
  python scripts/seed.py --fresh --yes

Logins:
  admin@zek.shop     / Admin@1234
  amna@example.com   / Customer@1234   (also bilal@ and sara@)
"""

import asyncio
import json
import os
import sys
import uuid
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import bcrypt  # noqa: E402
from sqlalchemy import select, text  # noqa: E402

import src.app.api.v1.models  # noqa: E402,F401  (registers every table)
from src.app.api.v1.models import (  # noqa: E402
    Address,
    Cart,
    CartItem,
    Category,
    Collection,
    CollectionProduct,
    Discount,
    Order,
    OrderItem,
    OrderStatusHistory,
    Product,
    ProductImage,
    ProductVariant,
    Refund,
    Review,
    StoreSetting,
    User,
    WishlistItem,
)
from src.app.api.v1.models.base import (  # noqa: E402
    DeliveryMethod,
    DiscountType,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    ProductStatus,
    RefundStatus,
    SalesChannel,
)
from src.app.api.v1.services.pricing_service import DEFAULT_RATES, PricingService, StoreRates, money  # noqa: E402
from src.app.database import AsyncSessionLocal, engine  # noqa: E402

DATA = json.loads((Path(__file__).parent / "seed_data" / "catalog.json").read_text())
NOW = datetime.now(timezone.utc)

ADMIN_PASSWORD = "Admin@1234"
CUSTOMER_PASSWORD = "Customer@1234"

USERS = [
    {"username": "admin", "email": "admin@zek.shop", "full_name": "ZEK Admin", "role": "admin", "is_superuser": True, "password": ADMIN_PASSWORD},
    {"username": "amna", "email": "amna@example.com", "full_name": "Amna Rauf", "phone_number": "+13128471928", "password": CUSTOMER_PASSWORD},
    {"username": "bilal", "email": "bilal@example.com", "full_name": "Bilal Khan", "phone_number": "+923001234567", "password": CUSTOMER_PASSWORD},
    {"username": "sara", "email": "sara@example.com", "full_name": "Sara Malik", "phone_number": "+447700900123", "password": CUSTOMER_PASSWORD},
]

ADDRESSES = {
    "amna@example.com": [
        {"label": "Home", "full_name": "Amna Rauf", "phone": "+1 312 847 1928", "line1": "221 Clark Street", "line2": "Apt 4B", "city": "Chicago", "region": "IL", "postal_code": "60601", "country": "United States", "is_default": True},
        {"label": "Work", "full_name": "Amna Rauf", "line1": "1 Market Street", "line2": "Floor 12", "city": "Chicago", "region": "IL", "postal_code": "60606", "country": "United States", "is_default": False},
    ],
    "bilal@example.com": [
        {"label": "Home", "full_name": "Bilal Khan", "phone": "+92 300 1234567", "line1": "House 14, Street 7", "city": "Lahore", "region": "Punjab", "postal_code": "54000", "country": "Pakistan", "is_default": True},
    ],
    "sara@example.com": [
        {"label": "Flat", "full_name": "Sara Malik", "line1": "48 Camden High Street", "city": "London", "region": "Greater London", "postal_code": "NW1 0LT", "country": "United Kingdom", "is_default": True},
    ],
}

DISCOUNTS = [
    {"code": "ZEK10", "description": "10% off your order", "type": DiscountType.PERCENT, "value": "10"},
    {"code": "WELCOME5", "description": "$5 off your first order over $25", "type": DiscountType.FIXED, "value": "5", "min_order_amount": "25", "per_customer_limit": 1},
    {"code": "BIG20", "description": "$20 off orders over $150", "type": DiscountType.FIXED, "value": "20", "min_order_amount": "150", "usage_limit": 100},
    {"code": "SUMMER25", "description": "Summer sale (ended)", "type": DiscountType.PERCENT, "value": "25", "starts_at": NOW - timedelta(days=90), "ends_at": NOW - timedelta(days=10)},
    {"code": "WINTER15", "description": "Winter sale (starts soon)", "type": DiscountType.PERCENT, "value": "15", "starts_at": NOW + timedelta(days=20)},
]

SETTINGS = {
    **{k: v for k, v in DEFAULT_RATES.items()},
    "store.name": "ZEK",
    "store.support_email": "help@zek.shop",
    "store.currency": "USD",
}

# (order number, customer email or None for guest, days ago, status, payment, delivery, channel, [(product slug, colour, qty)], promo)
ORDERS = [
    ("ZEK-482913", "amna@example.com", 0.2, OrderStatus.CONFIRMED, PaymentMethod.CARD, DeliveryMethod.STANDARD, SalesChannel.WEB, [("vela-35", "Black", 1), ("daily-mug", None, 2)], "ZEK10"),
    ("ZEK-377104", "bilal@example.com", 0.6, OrderStatus.PACKED, PaymentMethod.CASH_ON_DELIVERY, DeliveryMethod.EXPRESS, SalesChannel.WHATSAPP, [("folio-reader", None, 1)], None),
    ("ZEK-260558", "amna@example.com", 3, OrderStatus.SHIPPED, PaymentMethod.CARD, DeliveryMethod.STANDARD, SalesChannel.AGENT, [("flat-keys", "Graphite", 1), ("glide-mouse", None, 1), ("studio-notebooks", None, 1)], None),
    ("ZEK-193846", "sara@example.com", 13, OrderStatus.DELIVERED, PaymentMethod.CARD, DeliveryMethod.STANDARD, SalesChannel.WEB, [("aria-turntable", "Walnut", 1)], "BIG20"),
    ("ZEK-118420", "amna@example.com", 20, OrderStatus.CANCELLED, PaymentMethod.CARD, DeliveryMethod.STANDARD, SalesChannel.WEB, [("tea-press", None, 1), ("origin-beans", None, 1)], None),
    ("ZEK-605217", None, 6, OrderStatus.DELIVERED, PaymentMethod.CASH_ON_DELIVERY, DeliveryMethod.STANDARD, SalesChannel.VOICE, [("origin-beans", None, 2)], None),
    ("ZEK-731960", "bilal@example.com", 9, OrderStatus.RETURNED, PaymentMethod.CARD, DeliveryMethod.EXPRESS, SalesChannel.WEB, [("satin-heels", None, 1)], None),
    ("ZEK-840331", "sara@example.com", 1, OrderStatus.CONFIRMED, PaymentMethod.CARD, DeliveryMethod.STANDARD, SalesChannel.AGENT, [("nova-phone", "Silver", 1)], "ZEK10"),
]
GUEST = {"email": "guest.shopper@example.com", "address": {"full_name": "Hina Aslam", "phone": "+1 415 555 0142", "line1": "77 Valencia Street", "city": "San Francisco", "region": "CA", "postal_code": "94103", "country": "United States"}}

REVIEWS = [
    ("vela-35", "amna@example.com", 5, "Perfect first film camera", "Light, simple and the meter is spot on. My first roll came out great."),
    ("vela-35", "sara@example.com", 4, "Lovely build", "Feels solid. Took a few rolls to get used to manual focus."),
    ("aria-turntable", "sara@example.com", 5, "Sounds warm", "Plugged straight into my speakers thanks to the built-in preamp."),
    ("flat-keys", "amna@example.com", 4, "Quiet and slim", "Great for late calls. Switching between laptop and tablet is instant."),
    ("origin-beans", "bilal@example.com", 5, "Best beans I have tried", "Chocolatey and smooth. Ordering again."),
]

WISHLISTS = {"amna@example.com": ["aria-turntable", "parlor-guitar", "satin-heels"], "bilal@example.com": ["nova-phone"]}
CART = ("bilal@example.com", [("tea-press", None, 1), ("daily-mug", None, 2)], "WELCOME5")


def log(msg: str) -> None:
    print(msg, flush=True)


def slug_of(frontend_id: str) -> str:
    return frontend_id[2:] if frontend_id.startswith("p-") else frontend_id


def day(iso_date: str) -> datetime:
    return datetime.combine(datetime.fromisoformat(iso_date).date(), time(9, 0), tzinfo=timezone.utc)


def business_days(start: datetime, days: int) -> datetime:
    current = start
    while days > 0:
        current += timedelta(days=1)
        if current.weekday() < 5:
            days -= 1
    return current


# ─────────────────────────────────────────────────────────────────────────────
# Sections
# ─────────────────────────────────────────────────────────────────────────────

async def seed_users(s) -> dict[str, User]:
    users = {}
    for u in USERS:
        existing = await s.scalar(select(User).where(User.email == u["email"]))
        if existing:
            users[u["email"]] = existing
            continue
        user = User(
            id=uuid.uuid4(),
            username=u["username"],
            email=u["email"],
            full_name=u["full_name"],
            phone_number=u.get("phone_number"),
            password_hash=bcrypt.hashpw(u["password"].encode(), bcrypt.gensalt()).decode(),
            role=u.get("role", "customer"),
            is_superuser=u.get("is_superuser", False),
            is_active=True,
            is_verified=True,
            password_changed_at=NOW,
        )
        s.add(user)
        users[u["email"]] = user
    await s.flush()

    for email, addresses in ADDRESSES.items():
        user = users[email]
        if await s.scalar(select(Address.id).where(Address.user_id == user.id).limit(1)):
            continue
        for a in addresses:
            s.add(Address(user_id=user.id, **a))
    log(f"  users        {len(users)} (admin + {len(users) - 1} customers), addresses for {len(ADDRESSES)}")
    return users


async def seed_catalogue(s) -> tuple[dict[str, Product], dict[tuple[str, str | None], ProductVariant]]:
    categories = {}
    for i, c in enumerate(DATA["categories"]):
        cat = await s.scalar(select(Category).where(Category.slug == c["slug"]))
        if not cat:
            cat = Category(id=uuid.uuid4(), slug=c["slug"], name=c["name"], description=c["blurb"], image_url=c["image"], sort_order=i, is_active=True)
            s.add(cat)
        categories[c["slug"]] = cat
    await s.flush()

    featured = set(DATA["featured_product_ids"])
    products, variants = {}, {}
    for p in DATA["products"]:
        slug = slug_of(p["id"])
        product = await s.scalar(select(Product).where(Product.slug == slug))
        if not product:
            added = day(p["addedOn"])
            cat = categories[p["category"]]
            tags = sorted({p["category"], *(t.lower() for t in ([p["tag"]] if p.get("tag") else []))})
            product = Product(
                id=uuid.uuid4(),
                slug=slug,
                name=p["name"],
                brand=p["brand"],
                category_id=cat.id,
                description=p["description"],
                details=p["details"],
                tags=tags,
                price=Decimal(str(p["price"])),
                compare_at_price=Decimal(str(p["compareAt"])) if p.get("compareAt") else None,
                currency="USD",
                status=ProductStatus.ACTIVE,
                is_featured=p["id"] in featured,
                low_stock_threshold=5,
                rating_avg=p["rating"],
                review_count=p["reviews"],
                search_text=" | ".join(x for x in [p["name"], p["brand"], cat.name, " ".join(tags), p["description"]] if x),
                created_at=added,
                published_at=added,
            )
            s.add(product)
            await s.flush()

            # Stock is split across colours; the first colour gets any remainder.
            colors = p.get("colors") or [None]
            share, rest = divmod(p["stock"], len(colors))
            for i, color in enumerate(colors):
                option = color["name"] if color else "default"
                s.add(
                    ProductVariant(
                        id=uuid.uuid4(),
                        product_id=product.id,
                        sku=f"{slug}-{option}".upper(),
                        color_name=color["name"] if color else None,
                        color_hex=color["hex"] if color else None,
                        stock_qty=share + (rest if i == 0 else 0),
                        position=i,
                        is_active=True,
                    )
                )
            for i, url in enumerate(p["gallery"]):
                s.add(ProductImage(id=uuid.uuid4(), product_id=product.id, url=url, alt_text=p["name"], position=i))
            await s.flush()
        products[slug] = product

    for v in (await s.execute(select(ProductVariant).where(ProductVariant.product_id.in_([p.id for p in products.values()])))).scalars():
        slug = next(k for k, p in products.items() if p.id == v.product_id)
        variants[(slug, v.color_name)] = v

    for i, c in enumerate(DATA["collections"]):
        if await s.scalar(select(Collection.id).where(Collection.slug == c["slug"])):
            continue
        col = Collection(id=uuid.uuid4(), slug=c["slug"], title=c["title"], blurb=c["blurb"], image_url=c["image"], is_published=True, sort_order=i)
        s.add(col)
        await s.flush()
        for pos, pid in enumerate(c["productIds"]):
            s.add(CollectionProduct(collection_id=col.id, product_id=products[slug_of(pid)].id, position=pos))
    log(f"  catalogue    {len(categories)} categories, {len(products)} products, {len(variants)} variants, {len(DATA['collections'])} collections")
    return products, variants


async def seed_discounts(s) -> dict[str, Discount]:
    codes = {}
    for d in DISCOUNTS:
        existing = await s.scalar(select(Discount).where(Discount.code == d["code"]))
        if not existing:
            existing = Discount(
                id=uuid.uuid4(),
                used_count=0,
                **{**d, "value": Decimal(d["value"]), "min_order_amount": Decimal(d["min_order_amount"]) if d.get("min_order_amount") else None},
            )
            s.add(existing)
        codes[d["code"]] = existing
    for key, value in SETTINGS.items():
        if not await s.get(StoreSetting, key):
            s.add(StoreSetting(key=key, value=value))
    await s.flush()
    log(f"  promo codes  {', '.join(codes)}; store settings {len(SETTINGS)}")
    return codes


async def seed_orders(s, users, products, variants, codes) -> dict[str, Order]:
    rates = StoreRates(
        free_shipping_threshold=money(DEFAULT_RATES["shipping.free_threshold"]),
        flat_shipping=money(DEFAULT_RATES["shipping.flat_rate"]),
        express_shipping=money(DEFAULT_RATES["shipping.express_rate"]),
        tax_rate=Decimal(DEFAULT_RATES["tax.rate"]),
    )
    admin = users["admin@zek.shop"]
    orders = {}
    for number, email, days_ago, status, pay, delivery, channel, lines, promo in ORDERS:
        existing = await s.scalar(select(Order).where(Order.order_number == number))
        if existing:
            orders[number] = existing
            continue

        placed = NOW - timedelta(days=days_ago)
        user = users.get(email) if email else None
        if user:
            a = next(x for x in ADDRESSES[email] if x["is_default"])
            address = {k: a.get(k) for k in ("full_name", "phone", "line1", "line2", "city", "region", "postal_code", "country")}
        else:
            address = {**{"line2": None}, **GUEST["address"]}

        items, subtotal = [], Decimal("0")
        for slug, color, qty in lines:
            p, v = products[slug], variants[(slug, color)]
            unit = money(v.price if v.price is not None else p.price)
            subtotal += unit * qty
            items.append((p, v, unit, qty))
        subtotal = money(subtotal)

        discount = codes.get(promo) if promo else None
        discount_amount = Decimal("0")
        if discount:
            discount_amount = money(subtotal * discount.value / 100) if discount.type == DiscountType.PERCENT else min(money(discount.value), subtotal)
        totals = PricingService.totals(subtotal, discount_amount, rates, express=delivery == DeliveryMethod.EXPRESS)

        low, high = (1, 2) if delivery == DeliveryMethod.EXPRESS else (3, 5)
        paid_now = pay == PaymentMethod.CARD
        order = Order(
            id=uuid.uuid4(),
            order_number=number,
            user_id=user.id if user else None,
            email=email or GUEST["email"],
            phone=address.get("phone"),
            status=status,
            payment_status=PaymentStatus.PAID if paid_now else PaymentStatus.PENDING,
            payment_method=pay,
            delivery_method=delivery,
            channel=channel,
            shipping_address=address,
            subtotal=totals.subtotal,
            discount_total=totals.discount,
            shipping_total=totals.shipping,
            tax_total=totals.tax,
            total=totals.total,
            currency="USD",
            discount_id=discount.id if discount else None,
            discount_code=discount.code if discount else None,
            card_last4="4242" if paid_now else None,
            paid_at=placed if paid_now else None,
            estimated_delivery_from=business_days(placed, low),
            estimated_delivery_to=business_days(placed, high),
            created_at=placed,
            updated_at=placed,
        )
        s.add(order)
        await s.flush()
        if discount:
            discount.used_count += 1

        for p, v, unit, qty in items:
            image = await s.scalar(select(ProductImage.url).where(ProductImage.product_id == p.id).order_by(ProductImage.position).limit(1))
            s.add(OrderItem(order_id=order.id, product_id=p.id, variant_id=v.id, product_name=p.name, brand=p.brand, sku=v.sku,
                            color_name=v.color_name, size=v.size, image_url=image, unit_price=unit, quantity=qty, line_total=money(unit * qty)))

        # Walk the order through its history with realistic timestamps.
        def event(to, frm, at, note=None, by=None):
            s.add(OrderStatusHistory(order_id=order.id, from_status=frm, to_status=to, note=note, changed_by_id=by, created_at=at))

        event(OrderStatus.CONFIRMED, None, placed, "Payment received" if paid_now else "Pay on delivery", user.id if user else None)
        path = {
            OrderStatus.CONFIRMED: [],
            OrderStatus.PACKED: [OrderStatus.PACKED],
            OrderStatus.SHIPPED: [OrderStatus.PACKED, OrderStatus.SHIPPED],
            OrderStatus.DELIVERED: [OrderStatus.PACKED, OrderStatus.SHIPPED, OrderStatus.DELIVERED],
            OrderStatus.RETURNED: [OrderStatus.PACKED, OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.RETURNED],
            OrderStatus.CANCELLED: [OrderStatus.CANCELLED],
        }[status]
        previous, at = OrderStatus.CONFIRMED, placed
        for step in path:
            at = at + timedelta(hours=6 if step == OrderStatus.PACKED else 20)
            if step == OrderStatus.PACKED:
                order.packed_at = at
            elif step == OrderStatus.SHIPPED:
                order.shipped_at, order.carrier, order.tracking_number = at, "UPS", f"1Z999AA1{number[-6:]}0"
            elif step == OrderStatus.DELIVERED:
                order.delivered_at = at
                if pay == PaymentMethod.CASH_ON_DELIVERY:
                    order.payment_status, order.paid_at = PaymentStatus.PAID, at
            elif step == OrderStatus.CANCELLED:
                order.cancelled_at, order.cancel_reason = at, "Changed my mind"
            note = {OrderStatus.CANCELLED: "Changed my mind", OrderStatus.RETURNED: "Wrong size, returned unworn"}.get(step)
            event(step, previous, at, note, admin.id if step != OrderStatus.CANCELLED else (user.id if user else None))
            previous = step

        if status in (OrderStatus.CANCELLED, OrderStatus.RETURNED) and order.payment_status == PaymentStatus.PAID:
            s.add(Refund(order_id=order.id, amount=order.total, reason="Order cancelled" if status == OrderStatus.CANCELLED else "Returned item",
                         status=RefundStatus.SUCCEEDED, created_by_id=admin.id, created_at=at))
            order.payment_status = PaymentStatus.REFUNDED
            if discount and status == OrderStatus.CANCELLED:
                discount.used_count -= 1
        orders[number] = order
    await s.flush()
    log(f"  orders       {len(orders)} (every status; web, agent, WhatsApp and voice; 1 guest)")
    return orders


async def seed_customer_extras(s, users, products, variants) -> None:
    for slug, email, rating, title, body in REVIEWS:
        user, product = users[email], products[slug]
        if await s.scalar(select(Review.id).where(Review.product_id == product.id, Review.user_id == user.id)):
            continue
        s.add(Review(product_id=product.id, user_id=user.id, rating=rating, title=title, body=body, is_verified_purchase=True, is_published=True))

    for email, slugs in WISHLISTS.items():
        for slug in slugs:
            if not await s.scalar(select(WishlistItem.id).where(WishlistItem.user_id == users[email].id, WishlistItem.product_id == products[slug].id)):
                s.add(WishlistItem(user_id=users[email].id, product_id=products[slug].id))

    email, lines, promo = CART
    user = users[email]
    if not await s.scalar(select(Cart.id).where(Cart.user_id == user.id)):
        cart = Cart(id=uuid.uuid4(), user_id=user.id, discount_code=promo)
        s.add(cart)
        await s.flush()
        for slug, color, qty in lines:
            s.add(CartItem(cart_id=cart.id, variant_id=variants[(slug, color)].id, quantity=qty))
    await s.flush()
    log(f"  shoppers     {len(REVIEWS)} reviews, wishlists for {len(WISHLISTS)}, 1 saved cart ({email})")


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

async def wipe() -> None:
    """Empty every app table (keeps the schema and alembic_version)."""
    from src.app.database import Base

    tables = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    log("🗑️  Wiped all store data")


async def main(fresh: bool = False) -> None:
    if fresh:
        await wipe()
    log("🌱 Seeding demo data...")
    async with AsyncSessionLocal() as s:
        users = await seed_users(s)
        products, variants = await seed_catalogue(s)
        codes = await seed_discounts(s)
        await seed_orders(s, users, products, variants, codes)
        await seed_customer_extras(s, users, products, variants)
        await s.commit()
    await engine.dispose()
    log("🎉 Seed complete.\n")
    log(f"   Admin:     admin@zek.shop    / {ADMIN_PASSWORD}")
    log(f"   Customers: amna@example.com  / {CUSTOMER_PASSWORD}   (also bilal@example.com, sara@example.com)")
    log("   Guest order lookup: ZEK-605217 with email guest.shopper@example.com")


def confirm_fresh() -> bool:
    if "--yes" in sys.argv:
        return True
    answer = input("⚠️  --fresh deletes ALL users, products, orders and other data first.\nType 'yes' to continue: ")
    return answer.strip().lower() == "yes"


if __name__ == "__main__":
    fresh = "--fresh" in sys.argv
    if fresh and not confirm_fresh():
        print("Aborted.")
        sys.exit(0)
    asyncio.run(main(fresh=fresh))

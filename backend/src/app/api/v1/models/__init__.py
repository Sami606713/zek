"""Import every model so they register on Base.metadata (needed by Alembic autogenerate)."""

from src.app.api.v1.models.users import User
from src.app.api.v1.models.address import Address
from src.app.api.v1.models.catalog import Category, Product, ProductImage, ProductVariant
from src.app.api.v1.models.collection import Collection, CollectionProduct
from src.app.api.v1.models.cart import Cart, CartItem
from src.app.api.v1.models.wishlist import WishlistItem
from src.app.api.v1.models.discount import Discount
from src.app.api.v1.models.order import Order, OrderItem, OrderStatusHistory, Refund
from src.app.api.v1.models.review import Review
from src.app.api.v1.models.conversation import Conversation, Message
from src.app.api.v1.models.audit_log import AuditLog
from src.app.api.v1.models.store_setting import StoreSetting

__all__ = [
    "Address",
    "AuditLog",
    "Cart",
    "CartItem",
    "Category",
    "Collection",
    "CollectionProduct",
    "Conversation",
    "Discount",
    "Message",
    "Order",
    "OrderItem",
    "OrderStatusHistory",
    "Product",
    "ProductImage",
    "ProductVariant",
    "Refund",
    "Review",
    "StoreSetting",
    "User",
    "WishlistItem",
]

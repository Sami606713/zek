"""Aggregates every v1 router under the /api/v1 prefix."""

from fastapi import APIRouter

from src.app.api.v1.routes.address import router as address_router
from src.app.api.v1.routes.cart import router as cart_router
from src.app.api.v1.routes.category import router as category_router
from src.app.api.v1.routes.collection import router as collection_router
from src.app.api.v1.routes.discount import router as discount_router
from src.app.api.v1.routes.order import admin_router as admin_order_router
from src.app.api.v1.routes.order import router as order_router
from src.app.api.v1.routes.product import router as product_router
from src.app.api.v1.routes.user import router as user_router
from src.app.api.v1.routes.wishlist import router as wishlist_router
from src.app.api.v1.webhook.whatsapp import router as whatsapp_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(user_router)
api_router.include_router(category_router)
api_router.include_router(product_router)
api_router.include_router(collection_router)
api_router.include_router(cart_router)
api_router.include_router(address_router)
api_router.include_router(discount_router)
api_router.include_router(order_router)
api_router.include_router(admin_order_router)
api_router.include_router(wishlist_router)
api_router.include_router(whatsapp_router)

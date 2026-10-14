"""Admin dashboard figures."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class PeriodTotals(BaseModel):
    revenue: Decimal = Field(..., description="Order totals minus refunds, excluding cancelled orders")
    orders: int = Field(..., description="Orders placed, excluding cancelled")
    average_order: Decimal
    agent_revenue: Decimal = Field(..., description="Revenue from agent chat, WhatsApp and voice")
    new_customers: int


class DayPoint(BaseModel):
    date: date
    revenue: Decimal
    orders: int
    web: Decimal
    agent: Decimal
    whatsapp: Decimal
    voice: Decimal


class CategorySales(BaseModel):
    category: str
    revenue: Decimal = Field(..., description="Item sales before order discounts")


class TopProduct(BaseModel):
    product_id: str | None
    name: str
    image_url: str | None
    units: int
    revenue: Decimal


class Attention(BaseModel):
    to_pack: int = Field(..., description="Confirmed orders not packed yet")
    to_ship: int = Field(..., description="Packed orders not shipped yet")
    low_stock: int = Field(..., description="Variants low or out of stock")
    cod_unpaid: int = Field(..., description="Cash on delivery orders not paid yet")
    awaiting_payment: int = Field(..., description="Orders still pending payment")


class DashboardStats(BaseModel):
    days: int
    timezone: str
    current: PeriodTotals
    previous: PeriodTotals = Field(..., description="The same number of days just before")
    series: list[DayPoint]
    categories: list[CategorySales]
    top_products: list[TopProduct]
    attention: Attention

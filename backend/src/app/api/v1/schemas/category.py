import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, field_validator

Slug = Annotated[
    str,
    Field(min_length=2, max_length=80, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", description="Lowercase words joined by dashes, e.g. home-office"),
]


# ─────────────────────────────────────────────────────────────────────────────
# Requests
# ─────────────────────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: Slug | None = Field(None, description="Generated from the name when omitted")
    description: str | None = Field(None, max_length=2000)
    image_url: str | None = Field(None, max_length=500)
    parent_id: uuid.UUID | None = None
    sort_order: int = Field(0, ge=0, le=10_000)
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Name must be at least 2 characters")
        return value


class CategoryUpdate(BaseModel):
    """Only the fields sent are changed. Send `parent_id: null` to move a category to the top level."""

    name: str | None = Field(None, min_length=2, max_length=100)
    slug: Slug | None = None
    description: str | None = Field(None, max_length=2000)
    image_url: str | None = Field(None, max_length=500)
    parent_id: uuid.UUID | None = None
    sort_order: int | None = Field(None, ge=0, le=10_000)
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None


# ─────────────────────────────────────────────────────────────────────────────
# Responses
# ─────────────────────────────────────────────────────────────────────────────

class CategorySummary(BaseModel):
    id: uuid.UUID
    slug: str
    name: str

    model_config = {"from_attributes": True}


class CategoryResponse(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    description: str | None
    image_url: str | None
    parent_id: uuid.UUID | None
    sort_order: int
    is_active: bool
    product_count: int = Field(0, description="Products in this category that are not deleted")
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CategoryDetail(CategoryResponse):
    parent: CategorySummary | None = None
    children: list[CategorySummary] = []


class CategoryTreeNode(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    image_url: str | None
    sort_order: int
    product_count: int = 0
    children: list["CategoryTreeNode"] = []


class CategoryListResponse(BaseModel):
    items: list[CategoryResponse]
    total: int
    skip: int
    limit: int

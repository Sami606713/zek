import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, field_validator

from src.app.api.v1.schemas.user import PhoneNumber

MAX_ADDRESSES_PER_USER = 20

Line = Annotated[str, Field(min_length=1, max_length=200)]
Short = Annotated[str, Field(min_length=1, max_length=100)]
Postal = Annotated[str, Field(min_length=2, max_length=20, pattern=r"^[A-Za-z0-9][A-Za-z0-9 -]*$")]

_TRIMMED = ("label", "full_name", "line1", "line2", "city", "region", "postal_code", "country")


class _Trim(BaseModel):
    @field_validator(*_TRIMMED, mode="before", check_fields=False)
    @classmethod
    def _trim(cls, value):
        if isinstance(value, str):
            value = " ".join(value.split())  # trim and collapse inner whitespace
            return value or None
        return value


class AddressCreate(_Trim):
    label: str | None = Field(None, max_length=40, description='e.g. "Home" or "Work"')
    full_name: Short
    phone: PhoneNumber | None = None
    line1: Line = Field(..., description="Street and house number")
    line2: str | None = Field(None, max_length=200, description="Apartment, suite, etc.")
    city: Short
    region: Short = Field(..., description="State, province or region")
    postal_code: Postal
    country: Short
    is_default: bool = Field(False, description="Your first address always becomes the default")


class AddressUpdate(_Trim):
    """Only the fields sent are changed. To change the default, use the /default endpoint or send `is_default: true`."""

    label: str | None = Field(None, max_length=40)
    full_name: Short | None = None
    phone: PhoneNumber | None = None
    line1: Line | None = None
    line2: str | None = Field(None, max_length=200)
    city: Short | None = None
    region: Short | None = None
    postal_code: Postal | None = None
    country: Short | None = None
    is_default: bool | None = None


class AddressResponse(BaseModel):
    id: uuid.UUID
    label: str | None
    full_name: str
    phone: str | None
    line1: str
    line2: str | None
    city: str
    region: str
    postal_code: str
    country: str
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

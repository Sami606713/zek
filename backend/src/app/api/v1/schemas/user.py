import uuid
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, EmailStr, Field


def _bcrypt_safe(value: str) -> str:
    # bcrypt only hashes the first 72 bytes and raises beyond that.
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Password must be at most 72 bytes")
    return value


Password = Annotated[str, Field(min_length=8, max_length=72), AfterValidator(_bcrypt_safe)]
Username = Annotated[
    str,
    Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_.-]+$", description="Letters, numbers, dot, dash, underscore"),
]
PhoneNumber = Annotated[str, Field(min_length=7, max_length=20, pattern=r"^\+?[0-9 ()-]{7,20}$")]


# ─────────────────────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    username: Username
    email: EmailStr
    password: Password
    full_name: str | None = Field(None, max_length=100)
    phone_number: PhoneNumber | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Access token lifetime in seconds")


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenRefreshResponse(Token):
    pass


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: Password


class ChangePassword(BaseModel):
    current_password: str
    new_password: Password


# ─────────────────────────────────────────────────────────────────────────────
# User CRUD
# ─────────────────────────────────────────────────────────────────────────────

class UserUpdate(BaseModel):
    username: Username | None = None
    full_name: str | None = Field(None, max_length=100)
    phone_number: PhoneNumber | None = None


# ─────────────────────────────────────────────────────────────────────────────
# Responses
# ─────────────────────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    full_name: str | None
    phone_number: str | None
    role: str
    is_active: bool
    is_verified: bool
    is_superuser: bool
    login_attempts: int
    is_locked: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    items: list[UserResponse]
    total: int
    skip: int
    limit: int


class MessageResponse(BaseModel):
    message: str

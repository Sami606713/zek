"""JWT helpers for access, refresh and password-reset tokens.

Every token carries a ``pwd`` claim: the user's ``password_changed_at`` timestamp.
Changing or resetting the password moves that timestamp, which invalidates all
tokens issued before it (including the reset token itself, so it is single use).
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

import jwt
from fastapi import HTTPException, status

from src.app.config import settings

TokenType = Literal["access", "refresh", "reset"]


_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


def password_fingerprint(password_changed_at: datetime | None) -> int:
    """Microseconds since epoch, exact (no float rounding), so two changes in the same second still differ."""
    if password_changed_at is None:
        return 0
    if password_changed_at.tzinfo is None:
        password_changed_at = password_changed_at.replace(tzinfo=timezone.utc)
    return (password_changed_at - _EPOCH) // timedelta(microseconds=1)


def _encode(
    user_id: uuid.UUID,
    token_type: TokenType,
    expires_in: timedelta,
    password_changed_at: datetime | None,
    extra: dict | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": token_type,
        "pwd": password_fingerprint(password_changed_at),
        "iat": now,
        "exp": now + expires_in,
        "jti": uuid.uuid4().hex,
        **(extra or {}),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(user_id: uuid.UUID, role: str, password_changed_at: datetime | None) -> str:
    return _encode(
        user_id,
        "access",
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        password_changed_at,
        extra={"role": role},
    )


def create_refresh_token(user_id: uuid.UUID, password_changed_at: datetime | None) -> str:
    return _encode(
        user_id,
        "refresh",
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        password_changed_at,
    )


def create_reset_token(user_id: uuid.UUID, password_changed_at: datetime | None) -> str:
    return _encode(
        user_id,
        "reset",
        timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES),
        password_changed_at,
    )


def decode_token(token: str, expected_type: TokenType) -> dict:
    """Decode and validate a token. Raises 401 for anything invalid, expired or of the wrong type."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"require": ["sub", "type", "exp", "iat"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if payload.get("type") != expected_type:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    try:
        payload["sub"] = uuid.UUID(payload["sub"])
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

    return payload

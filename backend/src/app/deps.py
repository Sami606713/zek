"""Shared FastAPI dependencies: database session, user service, current user and role guards."""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.v1.models.users import User
from src.app.api.v1.services.user_services import UserService
from src.app.api.v1.utils.security import decode_token, password_fingerprint
from src.app.database import get_db

DbSession = Annotated[AsyncSession, Depends(get_db)]

_bearer = HTTPBearer(auto_error=False, description="Access token from /api/v1/users/login")


def get_user_service(db: DbSession) -> UserService:
    return UserService(db)


UserServiceDep = Annotated[UserService, Depends(get_user_service)]


async def get_current_user(
    service: UserServiceDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    payload = decode_token(credentials.credentials, expected_type="access")
    user = await service.get_by_id(payload["sub"])

    if user is None or user.deleted_at is not None:
        raise unauthorized
    # Tokens issued before the last password change are no longer valid.
    if payload.get("pwd") != password_fingerprint(user.password_changed_at):
        raise unauthorized
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")
    if user.is_locked:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is locked")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def require_admin(user: CurrentUser) -> User:
    if user.role != "admin" and not user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


AdminUser = Annotated[User, Depends(require_admin)]


async def get_optional_user(
    service: UserServiceDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User | None:
    """The signed-in user if a valid token was sent, otherwise None. Never raises."""
    if credentials is None:
        return None
    try:
        return await get_current_user(service, credentials)
    except HTTPException:
        return None


OptionalUser = Annotated[User | None, Depends(get_optional_user)]


def is_admin(user: User | None) -> bool:
    return user is not None and (user.role == "admin" or user.is_superuser)

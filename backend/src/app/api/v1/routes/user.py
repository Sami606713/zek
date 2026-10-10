"""User endpoints: authentication, the signed-in user's profile, and admin user management."""

import logging
import uuid

from fastapi import APIRouter, HTTPException, Query, status

from src.app.api.v1.models.users import User
from src.app.api.v1.schemas.user import (
    ChangePassword,
    MessageResponse,
    PasswordResetConfirm,
    PasswordResetRequest,
    RefreshTokenRequest,
    Token,
    TokenRefreshResponse,
    UserListResponse,
    UserLogin,
    UserRegister,
    UserResponse,
    UserUpdate,
)
from src.app.api.v1.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    password_fingerprint,
)
from src.app.config import settings
from src.app.deps import AdminUser, CurrentUser, UserServiceDep

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["Users"])

_AUTH_ERRORS = {
    401: {"description": "Missing, invalid or expired access token"},
    403: {"description": "Account locked or deactivated"},
}
_ADMIN_ERRORS = {**_AUTH_ERRORS, 403: {"description": "Admin access required"}}
_NOT_FOUND = {404: {"description": "User not found"}}


def _issue_tokens(user: User) -> Token:
    return Token(
        access_token=create_access_token(user.id, user.role, user.password_changed_at),
        refresh_token=create_refresh_token(user.id, user.password_changed_at),
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an account",
    responses={409: {"description": "Email, username or phone number already in use"}},
)
async def register(payload: UserRegister, service: UserServiceDep) -> User:
    return await service.register(payload)


@router.post(
    "/login",
    response_model=Token,
    summary="Sign in with email and password",
    responses={
        401: {"description": "Invalid credentials"},
        403: {"description": "Account locked or deactivated"},
    },
)
async def login(payload: UserLogin, service: UserServiceDep) -> Token:
    """Returns a short-lived access token and a longer-lived refresh token.

    Five wrong passwords in a row lock the account for 30 minutes.
    """
    user = await service.login(payload.email, payload.password)
    return _issue_tokens(user)


@router.post(
    "/refresh-token",
    response_model=TokenRefreshResponse,
    summary="Exchange a refresh token for new tokens",
    responses={401: {"description": "Invalid or expired refresh token"}, 403: {"description": "Account locked or deactivated"}},
)
async def refresh_token(payload: RefreshTokenRequest, service: UserServiceDep) -> TokenRefreshResponse:
    claims = decode_token(payload.refresh_token, expected_type="refresh")
    user = await service.get_by_id(claims["sub"])

    if (
        user is None
        or user.deleted_at is not None
        or claims.get("pwd") != password_fingerprint(user.password_changed_at)
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    if not user.is_active or user.is_locked:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is locked or deactivated")

    return TokenRefreshResponse(**_issue_tokens(user).model_dump())


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Request a password reset email",
)
async def forgot_password(payload: PasswordResetRequest, service: UserServiceDep) -> MessageResponse:
    """Always returns the same response, so it cannot be used to discover registered emails."""
    token = await service.request_password_reset(payload.email)
    if token:
        # TODO: send the reset link by email once the notification service exists.
        logger.info("Password reset requested for %s", payload.email)
    return MessageResponse(message="If an account exists for that email, a reset link has been sent.")


@router.post(
    "/reset-password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Set a new password using a reset token",
    responses={400: {"description": "Invalid or expired reset token"}},
)
async def reset_password(payload: PasswordResetConfirm, service: UserServiceDep) -> None:
    await service.confirm_password_reset(payload.token, payload.new_password)


# ─────────────────────────────────────────────────────────────────────────────
# Signed-in user
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse, summary="Get my profile", responses=_AUTH_ERRORS)
async def get_me(user: CurrentUser) -> User:
    return user


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Update my profile",
    responses={**_AUTH_ERRORS, 409: {"description": "Username or phone number already in use"}},
)
async def update_me(payload: UserUpdate, user: CurrentUser, service: UserServiceDep) -> User:
    return await service.update(user.id, payload)


@router.post(
    "/me/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Change my password",
    responses={**_AUTH_ERRORS, 400: {"description": "New password is the same as the current one"}},
)
async def change_password(payload: ChangePassword, user: CurrentUser, service: UserServiceDep) -> None:
    """Signs out every other session: tokens issued before the change stop working."""
    await service.change_password(user, payload.current_password, payload.new_password)


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete my account",
    responses=_AUTH_ERRORS,
)
async def delete_me(user: CurrentUser, service: UserServiceDep) -> None:
    """Soft-deletes the signed-in account. Past orders are kept for tax and warranty records."""
    await service.soft_delete(user.id)


# ─────────────────────────────────────────────────────────────────────────────
# Admin: user management
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=UserListResponse, summary="List users (admin)", responses=_ADMIN_ERRORS)
async def list_users(
    _admin: AdminUser,
    service: UserServiceDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, max_length=100, description="Match email, username or full name"),
) -> UserListResponse:
    users, total = await service.get_all(skip=skip, limit=limit, search=search)
    return UserListResponse(
        items=[UserResponse.model_validate(u) for u in users],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get a user (admin)",
    responses={**_ADMIN_ERRORS, **_NOT_FOUND},
)
async def get_user(user_id: uuid.UUID, _admin: AdminUser, service: UserServiceDep) -> User:
    user = await service.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update a user (admin)",
    responses={**_ADMIN_ERRORS, **_NOT_FOUND, 409: {"description": "Username or phone number already in use"}},
)
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    _admin: AdminUser,
    service: UserServiceDep,
) -> User:
    return await service.update(user_id, payload)


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a user (admin)",
    responses={**_ADMIN_ERRORS, **_NOT_FOUND, 409: {"description": "User already deleted"}},
)
async def delete_user(user_id: uuid.UUID, admin: AdminUser, service: UserServiceDep) -> None:
    """Soft delete: the account is deactivated and hidden, but its data is kept."""
    if user_id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot delete your own account")
    await service.soft_delete(user_id)


@router.post(
    "/{user_id}/unlock",
    response_model=UserResponse,
    summary="Unlock a locked account (admin)",
    responses={**_ADMIN_ERRORS, **_NOT_FOUND},
)
async def unlock_user(user_id: uuid.UUID, _admin: AdminUser, service: UserServiceDep) -> User:
    return await service.unlock(user_id)

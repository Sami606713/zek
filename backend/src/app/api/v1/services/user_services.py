import uuid
from datetime import datetime, timezone, timedelta

import bcrypt
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.v1.models.users import User
from src.app.api.v1.schemas.user import UserRegister, UserUpdate
from src.app.api.v1.utils.security import create_reset_token, decode_token, password_fingerprint

MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 30

# Compared against when the email is unknown, so a failed login takes the same time either way.
_DUMMY_HASH = bcrypt.hashpw(b"zek-timing-guard", bcrypt.gensalt()).decode()


class UserService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Password helpers ──────────────────────────────────────────────────────

    @staticmethod
    def hash_password(plain: str) -> str:
        return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

    @staticmethod
    def verify_password(plain: str, hashed: str) -> bool:
        try:
            return bcrypt.checkpw(plain.encode(), hashed.encode())
        except ValueError:
            # Malformed hash in the database: treat as a failed check instead of a 500.
            return False

    # ── Lookup helpers ────────────────────────────────────────────────────────

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(select(User).where(func.lower(User.email) == email.lower()))
        return result.scalar_one_or_none()

    async def _get_or_404(self, user_id: uuid.UUID) -> User:
        user = await self.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return user

    async def _assert_email_free(self, email: str, exclude_id: uuid.UUID | None = None) -> None:
        q = select(User).where(func.lower(User.email) == email.lower())
        if exclude_id:
            q = q.where(User.id != exclude_id)
        if (await self.db.execute(q)).scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    async def _assert_username_free(self, username: str, exclude_id: uuid.UUID | None = None) -> None:
        q = select(User).where(User.username == username)
        if exclude_id:
            q = q.where(User.id != exclude_id)
        if (await self.db.execute(q)).scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")

    async def _assert_phone_free(self, phone_number: str, exclude_id: uuid.UUID | None = None) -> None:
        q = select(User).where(User.phone_number == phone_number)
        if exclude_id:
            q = q.where(User.id != exclude_id)
        if (await self.db.execute(q)).scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Phone number already registered")

    # ── Auth ──────────────────────────────────────────────────────────────────

    async def register(self, payload: UserRegister) -> User:
        await self._assert_email_free(payload.email)
        await self._assert_username_free(payload.username)
        if payload.phone_number:
            await self._assert_phone_free(payload.phone_number)

        user = User(
            id=uuid.uuid4(),
            username=payload.username,
            email=payload.email.lower(),
            password_hash=self.hash_password(payload.password),
            full_name=payload.full_name,
            phone_number=payload.phone_number,
            password_changed_at=datetime.now(timezone.utc),
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def login(self, email: str, password: str) -> User:
        user = await self.get_by_email(email)
        now = datetime.now(timezone.utc)

        if not user or user.deleted_at is not None:
            self.verify_password(password, _DUMMY_HASH)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

        if user.is_locked:
            # Automatic lockouts expire; a lock without an end date was set by an admin.
            if user.locked_until is not None and user.locked_until <= now:
                user.is_locked = False
                user.locked_until = None
                user.login_attempts = 0
            else:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is locked. Try again later or contact support")

        if not self.verify_password(password, user.password_hash):
            user.login_attempts += 1
            if user.login_attempts >= MAX_LOGIN_ATTEMPTS:
                user.is_locked = True
                user.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
            await self.db.commit()
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        # Successful login — reset attempts
        user.login_attempts = 0
        user.last_login_at = now
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def change_password(self, user: User, current_password: str, new_password: str) -> None:
        if not self.verify_password(current_password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")

        if self.verify_password(new_password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be different from the current one")

        user.password_hash = self.hash_password(new_password)
        user.password_changed_at = datetime.now(timezone.utc)
        await self.db.commit()

    async def request_password_reset(self, email: str) -> str | None:
        """Return a short-lived reset token, or None if no active account uses this email."""
        user = await self.get_by_email(email)
        if not user or not user.is_active or user.deleted_at is not None:
            return None  # caller must not reveal whether the email exists
        return create_reset_token(user.id, user.password_changed_at)

    async def confirm_password_reset(self, token: str, new_password: str) -> None:
        invalid = HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
        try:
            payload = decode_token(token, expected_type="reset")
        except HTTPException:
            raise invalid

        user = await self.get_by_id(payload["sub"])
        # The token is bound to the current password, so it stops working once used.
        if not user or user.deleted_at is not None or payload.get("pwd") != password_fingerprint(user.password_changed_at):
            raise invalid

        user.password_hash = self.hash_password(new_password)
        user.password_changed_at = datetime.now(timezone.utc)
        user.login_attempts = 0
        user.is_locked = False
        user.locked_until = None
        await self.db.commit()

    # ── Profile ───────────────────────────────────────────────────────────────

    async def get_all(self, skip: int = 0, limit: int = 20, search: str | None = None) -> tuple[list[User], int]:
        """Active (not deleted) users, newest first, plus the total count for pagination."""
        filters = [User.deleted_at.is_(None)]
        if search:
            escaped = search.strip().lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            term = f"%{escaped}%"
            filters.append(
                func.lower(User.email).like(term, escape="\\")
                | func.lower(User.username).like(term, escape="\\")
                | func.lower(func.coalesce(User.full_name, "")).like(term, escape="\\")
            )

        total = await self.db.scalar(select(func.count()).select_from(User).where(*filters))
        result = await self.db.execute(
            select(User).where(*filters).order_by(User.created_at.desc()).offset(skip).limit(limit)
        )
        return list(result.scalars().all()), total or 0

    async def update(self, user_id: uuid.UUID, payload: UserUpdate) -> User:
        user = await self._get_or_404(user_id)

        if payload.username is not None:
            await self._assert_username_free(payload.username, exclude_id=user_id)
            user.username = payload.username
        if payload.full_name is not None:
            user.full_name = payload.full_name
        if payload.phone_number is not None:
            await self._assert_phone_free(payload.phone_number, exclude_id=user_id)
            user.phone_number = payload.phone_number

        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def soft_delete(self, user_id: uuid.UUID) -> None:
        user = await self._get_or_404(user_id)
        if user.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already deleted")
        user.deleted_at = datetime.now(timezone.utc)
        user.is_active = False
        await self.db.commit()

    async def unlock(self, user_id: uuid.UUID) -> User:
        user = await self._get_or_404(user_id)
        user.login_attempts = 0
        user.is_locked = False
        user.locked_until = None
        await self.db.commit()
        await self.db.refresh(user)
        return user

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from src.app.config import settings


# Async engine using the URI from .env
engine = create_async_engine(
    settings.POSTGRES_URI_CUSTOM,
    echo=False,        # set True to log all SQL queries (useful during dev)
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # verify connection health before use
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

# Declarative base — all models inherit from this
class Base(DeclarativeBase):
    pass


# Dependency — use this in FastAPI route handlers
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

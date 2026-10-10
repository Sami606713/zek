"""
reset_db.py — ⚠️  DESTRUCTIVE: Drop all tables and re-run migrations from scratch.

USE ONLY IN DEVELOPMENT. Never run this against production.

Usage:
  python scripts/reset_db.py
  python scripts/reset_db.py --yes    # skip confirmation prompt
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

from src.app.config import settings
from src.app.database import Base

# Import all models so Base.metadata knows about them
import src.app.api.v1.models  # noqa: F401


async def reset():
    engine = create_async_engine(settings.POSTGRES_URI_CUSTOM, echo=False)

    async with engine.begin() as conn:
        print("🗑️  Dropping all tables...")
        await conn.run_sync(Base.metadata.drop_all)
        print("🏗️  Recreating all tables...")
        await conn.run_sync(Base.metadata.create_all)

    await engine.dispose()
    print("✅ Database reset complete.")


def confirm():
    if "--yes" in sys.argv:
        return True
    answer = input(
        "⚠️  This will DROP and RECREATE all tables. "
        "All data will be lost.\nType 'yes' to continue: "
    )
    return answer.strip().lower() == "yes"


if __name__ == "__main__":
    if not confirm():
        print("Aborted.")
        sys.exit(0)
    asyncio.run(reset())

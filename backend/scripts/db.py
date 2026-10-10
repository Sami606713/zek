"""
db.py — Single entry point for all database management commands.

Usage:
  python scripts/db.py migrate              # apply all pending migrations
  python scripts/db.py migrate "message"    # generate a new migration
  python scripts/db.py seed                 # seed demo data (see scripts/seed.py)
  python scripts/db.py seed --fresh --yes   # wipe all data, then seed
  python scripts/db.py reset                # ⚠️  drop + recreate all tables
  python scripts/db.py reset --yes          # reset without confirmation prompt
"""

import asyncio
import os
import sys

# ── Path setup ────────────────────────────────────────────────────────────────
# Ensure we can import from src/ regardless of where this is called from
ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, os.path.abspath(ROOT))

from sqlalchemy.ext.asyncio import create_async_engine

from src.app.config import settings
from src.app.database import Base
import src.app.api.v1.models  # noqa: F401 — registers every model on Base


# ─────────────────────────────────────────────────────────────────────────────
# MIGRATE
# ─────────────────────────────────────────────────────────────────────────────

def cmd_migrate(message: str = None):
    """Run alembic upgrade head, or generate a new migration if message given."""
    import subprocess

    os.chdir(os.path.abspath(ROOT))  # alembic must run from backend root

    if message:
        print(f"🔧 Generating new migration: '{message}'")
        result = subprocess.run(
            ["alembic", "revision", "--autogenerate", "-m", message]
        )
    else:
        print("🚀 Applying all pending migrations...")
        result = subprocess.run(["alembic", "upgrade", "head"])

    if result.returncode == 0:
        print("✅ Done.")
    else:
        print("❌ Migration failed.")
        sys.exit(result.returncode)


# ─────────────────────────────────────────────────────────────────────────────
# SEED
# ─────────────────────────────────────────────────────────────────────────────

def cmd_seed(fresh: bool = False):
    """Seed demo data. All the data lives in scripts/seed.py."""
    sys.path.insert(0, os.path.dirname(__file__))
    from seed import main as seed_main

    asyncio.run(seed_main(fresh=fresh))


# ─────────────────────────────────────────────────────────────────────────────
# RESET
# ─────────────────────────────────────────────────────────────────────────────

async def _reset():
    engine = create_async_engine(settings.POSTGRES_URI_CUSTOM, echo=False)
    async with engine.begin() as conn:
        print("🗑️  Dropping all tables...")
        await conn.run_sync(Base.metadata.drop_all)
        print("🏗️  Recreating all tables...")
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("✅ Database reset complete.")


def cmd_reset(skip_confirm: bool = False):
    if not skip_confirm:
        answer = input(
            "⚠️  This will DROP and RECREATE all tables. All data will be lost.\n"
            "Type 'yes' to continue: "
        )
        if answer.strip().lower() != "yes":
            print("Aborted.")
            sys.exit(0)
    asyncio.run(_reset())


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

USAGE = """
Usage:
  python scripts/db.py migrate              apply all pending migrations
  python scripts/db.py migrate "message"    generate a new migration
  python scripts/db.py seed                 seed demo data
  python scripts/db.py seed --fresh --yes   wipe all data, then seed
  python scripts/db.py reset                drop + recreate all tables
  python scripts/db.py reset --yes          reset without confirmation
"""

if __name__ == "__main__":
    args = sys.argv[1:]

    if not args:
        print(USAGE)
        sys.exit(1)

    command = args[0]

    if command == "migrate":
        message = args[1] if len(args) > 1 else None
        cmd_migrate(message)

    elif command == "seed":
        fresh = "--fresh" in args
        if fresh and "--yes" not in args:
            if input("⚠️  --fresh deletes ALL data first. Type 'yes' to continue: ").strip().lower() != "yes":
                print("Aborted.")
                sys.exit(0)
        cmd_seed(fresh=fresh)

    elif command == "reset":
        cmd_reset(skip_confirm="--yes" in args)

    else:
        print(f"❌ Unknown command: '{command}'\n{USAGE}")
        sys.exit(1)

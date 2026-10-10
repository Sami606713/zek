#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# migrate.sh — Run Alembic migrations
#
# Usage:
#   ./scripts/migrate.sh            → apply all pending migrations
#   ./scripts/migrate.sh "message"  → generate a new migration
# ─────────────────────────────────────────────────────────────

set -e

cd "$(dirname "$0")/.."   # always run from backend root

if [ -n "$1" ]; then
    echo "🔧 Generating new migration: $1"
    alembic revision --autogenerate -m "$1"
else
    echo "🚀 Applying all pending migrations..."
    alembic upgrade head
    echo "✅ Migrations applied."
fi

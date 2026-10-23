"""Postgres checkpointer: LangGraph saves every chat thread (messages, tool calls,
state) in the app database instead of the local .langgraph_api files.

Wired up in langgraph.json -> "checkpointer". The tables (checkpoints,
checkpoint_blobs, checkpoint_writes, checkpoint_migrations) are created by
`setup()` here, or ahead of time with `python scripts/db.py store`.
"""

import contextlib
import logging
import os

from dotenv import load_dotenv
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

logger = logging.getLogger(__name__)

load_dotenv()


def _psycopg_uri(uri: str | None) -> str:
    """psycopg wants a plain postgresql:// URI, not the SQLAlchemy driver form."""
    if not uri:
        raise ValueError("POSTGRES_URI_CUSTOM is not set")
    for prefix in ("postgresql+asyncpg://", "postgresql+psycopg://", "postgresql+psycopg2://"):
        if uri.startswith(prefix):
            return uri.replace(prefix, "postgresql://", 1)
    return uri


@contextlib.asynccontextmanager
async def generate_checkpointer():
    """Yield an AsyncPostgresSaver, open for as long as the LangGraph server runs."""
    async with AsyncPostgresSaver.from_conn_string(_psycopg_uri(os.getenv("POSTGRES_URI_CUSTOM"))) as saver:
        await saver.setup()  # creates or migrates the checkpoint tables; safe to run every start
        logger.info("Chat threads are saved in Postgres (checkpoint tables)")
        yield saver

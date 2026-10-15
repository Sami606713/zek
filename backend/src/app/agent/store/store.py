import logging
import contextlib
import os
import traceback
from typing import cast

from dotenv import load_dotenv
from langgraph.store.base import IndexConfig
from langgraph.store.postgres import PostgresStore
from langgraph.store.postgres.aio import AsyncPostgresStore
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

load_dotenv()

DB_URI = os.getenv("POSTGRES_URI_CUSTOM")

embeddings = SentenceTransformer(
    "nomic-ai/nomic-embed-text-v1.5",
    trust_remote_code=True,
)


def _get_clean_uri(uri: str | None) -> str | None:
    """Strip SQLAlchemy driver prefix from URI for psycopg3 compatibility."""
    if not uri:
        return uri

    for prefix in (
        "postgresql+asyncpg://",
        "postgresql+psycopg://",
        "postgresql+psycopg2://",
    ):
        if uri.startswith(prefix):
            return uri.replace(prefix, "postgresql://", 1)

    return uri


def embed_sync(texts: list[str]) -> list[list[float]]:
    import numpy as np

    arr = embeddings.encode(texts)
    return arr.tolist() if isinstance(arr, np.ndarray) else cast(list[list[float]], arr)


# -------------------------
# Sync Store
# -------------------------

@contextlib.contextmanager
def generate_sync_store():
    """Yield a synchronous LangGraph PostgresStore."""
    uri = _get_clean_uri(DB_URI)

    if not uri:
        raise ValueError("POSTGRES_URI_CUSTOM is not set")

    try:
        with PostgresStore.from_conn_string(
            uri,
            index=IndexConfig(
                dims=768,
                embed=embed_sync,
                fields=["text"],
            ),
        ) as store:
            store.setup()
            yield store

    except Exception as e:
        logger.error("Sync store error: %s: %s", type(e).__name__, e)
        traceback.print_exc()
        raise


# -------------------------
# Async Store
# -------------------------

@contextlib.asynccontextmanager
async def generate_store():
    """Yield an asynchronous LangGraph AsyncPostgresStore."""
    uri = _get_clean_uri(DB_URI)

    if not uri:
        raise ValueError("POSTGRES_URI_CUSTOM is not set")

    try:
        async with AsyncPostgresStore.from_conn_string(
            uri,
            index=IndexConfig(
                dims=768,
                embed=embed_sync,
                fields=["text"],
            ),
        ) as store:
            await store.setup()
            yield store

    except Exception as e:
        logger.error("Async store error: %s: %s", type(e).__name__, e)
        traceback.print_exc()
        raise
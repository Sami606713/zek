"""Adds the ZEK MCP tools to every agent run.

MCP tools are scoped to the caller: they are cached per identity (a hash of the
user's JWT from ``ZekContext.token``, or ``"guest"``) and never stored on the
middleware instance, which is shared by every thread and user. That keeps one
shopper's tools (and, once the connection carries their token, their access)
from ever being used for another shopper.
"""

import asyncio
import hashlib
import logging
import os
import time
from typing import Any, Awaitable, Callable

from langchain.agents.middleware import AgentMiddleware, ModelRequest, ModelResponse
from langchain.messages import ToolMessage
from langchain.tools.tool_node import ToolCallRequest
from langgraph.types import Command

logger = logging.getLogger("zek.agent.mcp")

MCP_URL = os.getenv("ZEK_MCP_URL", "http://127.0.0.1:2024/mcp")
TOOLS_TTL_SECONDS = 120  # refresh the tool list at most every 2 minutes per identity
MAX_CACHED_IDENTITIES = 256


def _token_of(runtime: Any) -> str:
    """The shopper's JWT from the run context, or "" for guests."""
    context = getattr(runtime, "context", None)
    return (getattr(context, "token", "") or "") if context is not None else ""


def _identity_key(token: str) -> str:
    # Hash so raw tokens are never kept as dict keys or written to logs.
    return hashlib.sha256(token.encode()).hexdigest() if token else "guest"


class ZekAuthMiddleware(AgentMiddleware):
    def __init__(self) -> None:
        super().__init__()
        # identity key -> (fetched_at, tools). Only ever read with the caller's own key.
        self._tools_by_identity: dict[str, tuple[float, list[Any]]] = {}

    # ── Tool loading ────────────────────────────────────────────────────────

    async def _load_tools(self, token: str) -> list[Any]:
        """The caller's MCP tools, connected with their own token.

        /mcp only accepts a valid access token, so guests (no token) and expired
        tokens get no MCP tools. The run still works with the agent's own tools
        (e.g. search_products) instead of failing with a 401.
        """
        if not token:
            return []

        from fastmcp.client.transports import StreamableHttpTransport
        from langchain.mcp import MCPAdapter

        transport = StreamableHttpTransport(MCP_URL, headers={"Authorization": f"Bearer {token}"})
        try:
            async with MCPAdapter(transport) as adapter:
                return await adapter.list_tools()
        except Exception:
            logger.warning("MCP tools unavailable for this user (token rejected or server down)")
            return []

    def _cached(self, key: str) -> list[Any] | None:
        entry = self._tools_by_identity.get(key)
        if entry and time.monotonic() - entry[0] < TOOLS_TTL_SECONDS:
            return entry[1]
        return None

    def _store(self, key: str, tools: list[Any]) -> None:
        now = time.monotonic()
        # Drop expired entries, then the oldest ones if we're still over the cap.
        self._tools_by_identity = {
            k: v for k, v in self._tools_by_identity.items() if now - v[0] < TOOLS_TTL_SECONDS
        }
        while len(self._tools_by_identity) >= MAX_CACHED_IDENTITIES:
            oldest = min(self._tools_by_identity, key=lambda k: self._tools_by_identity[k][0])
            del self._tools_by_identity[oldest]
        self._tools_by_identity[key] = (now, tools)

    async def _tools_for(self, runtime: Any) -> list[Any]:
        token = _token_of(runtime)
        key = _identity_key(token)
        if (tools := self._cached(key)) is not None:
            return tools
        # No lock: the sync path runs on its own event loop, and a duplicate
        # fetch on a cold cache is harmless.
        tools = await self._load_tools(token)
        self._store(key, tools)
        logger.debug("Loaded %d MCP tools for %s", len(tools), "user" if token else "guest")
        return tools

    @staticmethod
    def _find(tools: list[Any], name: str) -> Any | None:
        return next((t for t in tools if t.name == name), None)

    # ── Model calls: offer the caller's MCP tools to the model ──────────────

    async def awrap_model_call(
        self,
        request: ModelRequest,
        handler: Callable[[ModelRequest], Awaitable[ModelResponse]],
    ) -> ModelResponse:
        tools = await self._tools_for(request.runtime)
        return await handler(request.override(tools=[*request.tools, *tools]))

    def wrap_model_call(
        self,
        request: ModelRequest,
        handler: Callable[[ModelRequest], ModelResponse],
    ) -> ModelResponse:
        tools = asyncio.run(self._tools_for(request.runtime))
        return handler(request.override(tools=[*request.tools, *tools]))

    # ── Tool calls: run MCP tools from the same caller's tool set ───────────

    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Awaitable[ToolMessage | Command]],
    ) -> ToolMessage | Command:
        tool = self._find(await self._tools_for(request.runtime), request.tool_call["name"])
        return await handler(request.override(tool=tool) if tool else request)

    def wrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], ToolMessage | Command],
    ) -> ToolMessage | Command:
        tool = self._find(asyncio.run(self._tools_for(request.runtime)), request.tool_call["name"])
        return handler(request.override(tool=tool) if tool else request)

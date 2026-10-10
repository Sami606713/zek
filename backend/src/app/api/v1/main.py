"""ZEK API entry point.

Serves the REST API under /api/v1 and the same endpoints as MCP tools at /mcp.
Run from the backend folder:  python -m src.app.api.v1.main
"""

from dotenv import load_dotenv

load_dotenv()  # other modules (agent, webhooks) read os.environ directly

import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastmcp import FastMCP
from fastmcp.server.providers.openapi import MCPType, RouteMap

from src.app.api.v1.routes import api_router
from src.app.config import settings
from src.app.database import engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("zek.api")


# ─────────────────────────────────────────────────────────────────────────────
# App
# ─────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # The MCP session manager must run for the lifetime of the app.
    async with mcp_app.lifespan(app):
        logger.info("%s %s started", settings.APP_NAME, settings.APP_VERSION)
        yield
    await engine.dispose()
    logger.info("%s stopped", settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API for the ZEK agentic store: auth, users, catalogue, orders and the shopping agent.",
    version=settings.APP_VERSION,
    lifespan=lifespan,
)


# ─────────────────────────────────────────────────────────────────────────────
# Middleware (registered inner → outer; CORS is outermost so every response,
# including 429s and 500s, carries CORS headers)
# ─────────────────────────────────────────────────────────────────────────────

@app.middleware("http")
async def catch_unhandled_errors(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# In-memory sliding window per client IP. Fine for a single process; use Redis when scaling out.
_request_log: dict[str, deque[float]] = defaultdict(deque)
_RATE_LIMIT_EXEMPT = {"/health", "/docs", "/redoc", "/openapi.json"}


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    if request.method == "OPTIONS" or request.url.path in _RATE_LIMIT_EXEMPT:
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    window = _request_log[client_ip]
    while window and now - window[0] >= settings.RATE_LIMIT_WINDOW_SECONDS:
        window.popleft()

    if len(window) >= settings.RATE_LIMIT_REQUESTS:
        retry_after = int(settings.RATE_LIMIT_WINDOW_SECONDS - (now - window[0])) + 1
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Please try again later."},
            headers={"Retry-After": str(retry_after)},
        )

    window.append(now)
    return await call_next(request)


@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Process-Time-Ms"] = f"{(time.perf_counter() - started) * 1000:.1f}"
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # explicit origins: "*" is not allowed with credentials
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time-Ms", "Retry-After"],
)


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

app.include_router(api_router)


@app.get("/health", tags=["System"], summary="Liveness check")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "version": settings.APP_VERSION}


# ─────────────────────────────────────────────────────────────────────────────
# MCP: expose the API as tools for the agent, at /mcp.
# Account and admin endpoints are excluded so the agent can never call them.
# ─────────────────────────────────────────────────────────────────────────────

mcp = FastMCP.from_fastapi(
    app=app,
    name="ZEK MCP",
    route_maps=[
        RouteMap(tags={"Users"}, mcp_type=MCPType.EXCLUDE),
        RouteMap(tags={"System"}, mcp_type=MCPType.EXCLUDE),
        # Cart and order tools for the agent are decided in the agent step.
        RouteMap(tags={"Cart"}, mcp_type=MCPType.EXCLUDE),
        RouteMap(tags={"Orders"}, mcp_type=MCPType.EXCLUDE),
        RouteMap(tags={"Admin: Orders"}, mcp_type=MCPType.EXCLUDE),
        RouteMap(tags={"Addresses"}, mcp_type=MCPType.EXCLUDE),  # personal data
        RouteMap(tags={"Wishlist"}, mcp_type=MCPType.EXCLUDE),   # personal data
        # The agent may check a promo code for a shopper, but never manage codes.
        RouteMap(methods=["POST"], pattern=r"^/api/v1/discounts/validate$", mcp_type=MCPType.TOOL),
        RouteMap(tags={"Discounts"}, mcp_type=MCPType.EXCLUDE),
        # The agent may read the catalogue but never change it, and never sees admin-only lookups.
        RouteMap(methods=["POST", "PUT", "PATCH", "DELETE"], tags={"Categories"}, mcp_type=MCPType.EXCLUDE),
        RouteMap(methods=["POST", "PUT", "PATCH", "DELETE"], tags={"Products"}, mcp_type=MCPType.EXCLUDE),
        RouteMap(methods=["POST", "PUT", "PATCH", "DELETE"], tags={"Collections"}, mcp_type=MCPType.EXCLUDE),
        RouteMap(pattern=r"^/api/v1/(categories|products|collections)/id/", mcp_type=MCPType.EXCLUDE),
        RouteMap(mcp_type=MCPType.TOOL),
    ],
)
mcp_app = mcp.http_app(path="/mcp")

# Add only the exact /mcp route (not a catch-all mount), so hosts that embed this app,
# like `langgraph dev` via langgraph.json "http.app", keep their own routes working.
app.router.routes.extend(mcp_app.routes)

# Kept for anything that still imports the old name.
combined_app = app


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

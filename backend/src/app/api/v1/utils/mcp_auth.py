"""Bearer-token authentication for the /mcp endpoint.

`ZekTokenVerifier` accepts exactly the tokens the REST API accepts (see
`src.app.deps.get_current_user`): a valid, unexpired *access* token whose user
exists, isn't deleted, is active, isn't locked, and hasn't changed their password
since the token was issued. Anything else is rejected with 401 before a tool runs.
"""

import httpx2
from fastapi import HTTPException
from fastmcp.server.auth import AccessToken, TokenVerifier
from fastmcp.server.dependencies import get_access_token
from starlette.types import ASGIApp

from src.app.api.v1.services.user_services import UserService
from src.app.api.v1.utils.security import decode_token, password_fingerprint
from src.app.database import AsyncSessionLocal


class ZekTokenVerifier(TokenVerifier):
    async def verify_token(self, token: str) -> AccessToken | None:
        try:
            payload = decode_token(token, expected_type="access")
        except HTTPException:
            return None  # bad signature, expired, wrong type or malformed

        async with AsyncSessionLocal() as db:
            user = await UserService(db).get_by_id(payload["sub"])

        if user is None or user.deleted_at is not None:
            return None
        # Tokens issued before the last password change are no longer valid.
        if payload.get("pwd") != password_fingerprint(user.password_changed_at):
            return None
        if not user.is_active or user.is_locked:
            return None

        user_id = str(user.id)
        return AccessToken(
            token=token,
            client_id=user_id,
            subject=user_id,
            scopes=[],
            expires_at=int(payload["exp"]),
            claims={
                "sub": user_id,
                "role": user.role,
                "is_superuser": bool(user.is_superuser),
                "email": user.email,
            },
        )


def with_auth_middleware(app: ASGIApp, middleware: list) -> ASGIApp:
    """Wrap one ASGI app in the auth provider's middleware stack.

    FastMCP normally installs this middleware on its own Starlette app. ZEK copies
    only the /mcp route into the FastAPI app (so `langgraph dev` keeps its routes),
    which would drop that middleware, so it is applied to the route itself instead.
    """
    for cls, args, kwargs in reversed(middleware):
        app = cls(app, *args, **kwargs)
    return app


async def forward_access_token(request: httpx2.Request) -> None:
    """Send the MCP caller's own access token with each tool's API request.

    FastMCP drops `Authorization` when it turns a tool call into an API request,
    so without this every tool would reach the API anonymously. The token was
    already verified by ZekTokenVerifier for this /mcp request.
    """
    access_token = get_access_token()
    if access_token is not None:
        request.headers["Authorization"] = f"Bearer {access_token.token}"

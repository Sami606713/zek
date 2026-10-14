"""Admin dashboard figures."""

from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, HTTPException, Query, status

from src.app.api.v1.schemas.stats import DashboardStats
from src.app.api.v1.services.stats_service import StatsService
from src.app.deps import AdminUser, DbSession

router = APIRouter(prefix="/admin/stats", tags=["Admin: Dashboard"])


@router.get(
    "",
    response_model=DashboardStats,
    summary="Dashboard figures (admin)",
    responses={
        401: {"description": "Missing, invalid or expired access token"},
        403: {"description": "Admin access required"},
        422: {"description": "Unknown time zone, or days not 7, 30 or 90"},
    },
)
async def dashboard_stats(
    _admin: AdminUser,
    db: DbSession,
    days: int = Query(30, description="7, 30 or 90. Compared with the same number of days just before"),
    tz: str = Query("UTC", max_length=64, description="IANA time zone for the daily chart, e.g. Asia/Karachi"),
) -> DashboardStats:
    if days not in (7, 30, 90):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="days must be 7, 30 or 90")
    try:
        ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Unknown time zone: {tz}")
    return await StatsService(db).dashboard(days, tz)

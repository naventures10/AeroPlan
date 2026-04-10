"""
Daylight Tables Router — Query sunrise/sunset and twilight data from the database.
"""

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.daylight import DaylightResponse

router = APIRouter(prefix="/api", tags=["Daylight"])


@router.get("/daylight/{icao_code}", response_model=DaylightResponse)
async def get_daylight(
    icao_code: str,
    month: int | None = Query(
        None, ge=1, le=12, description="Filter by month (1-12). Defaults to current month."
    ),
    date_str: str | None = Query(
        None, alias="date", description="Filter by specific date (YYYY-MM-DD)"
    ),
    db: AsyncSession = Depends(get_db),
) -> DaylightResponse:
    """
    Returns daylight/twilight data for a given airport.

    - No params → returns all records for the current month.
    - `?month=3` → returns all days in March.
    - `?date=2026-03-18` → returns a single day.
    """
    icao = icao_code.upper()

    # Determine filter
    if date_str:
        try:
            target_date = date.fromisoformat(date_str)
        except ValueError:
            raise HTTPException(
                status_code=400, detail=f"Invalid date format: {date_str}. Use YYYY-MM-DD."
            ) from None

        query = text("""
            SELECT airport_icao, airport_name, date, twilight_from, sunrise, sunset, twilight_to
            FROM daylight_times
            WHERE airport_icao = :icao AND date = :target_date
            ORDER BY date;
        """)
        params: dict = {"icao": icao, "target_date": target_date}
    else:
        target_month = month if month else datetime.now().month
        query = text("""
            SELECT airport_icao, airport_name, date, twilight_from, sunrise, sunset, twilight_to
            FROM daylight_times
            WHERE airport_icao = :icao AND EXTRACT(MONTH FROM date) = :target_month
            ORDER BY date;
        """)
        params = {"icao": icao, "target_month": target_month}

    result = await db.execute(query, params)
    rows = result.fetchall()

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No daylight data found for {icao}",
        )

    return DaylightResponse(
        airport_icao=rows[0].airport_icao,
        airport_name=rows[0].airport_name,
        records=[
            {
                "date": r.date.isoformat(),
                "twilight_from": r.twilight_from.strftime("%H:%M") if r.twilight_from else None,
                "sunrise": r.sunrise.strftime("%H:%M") if r.sunrise else None,
                "sunset": r.sunset.strftime("%H:%M") if r.sunset else None,
                "twilight_to": r.twilight_to.strftime("%H:%M") if r.twilight_to else None,
            }
            for r in rows
        ],
    )

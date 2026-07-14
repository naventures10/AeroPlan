from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.system import SystemAiracResponse

router = APIRouter(prefix="/system", tags=["System"])


@router.get("/airac", response_model=SystemAiracResponse)
async def get_system_airac(db: AsyncSession = Depends(get_db)) -> SystemAiracResponse:
    """
    Fetch the currently active AIRAC cycle information from the database.
    """
    query = text("""
        SELECT value
        FROM system_metadata
        WHERE key = 'active_airac_cycle'
        LIMIT 1;
    """)
    try:
        result = await db.execute(query)
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="AIRAC cycle information not found")

        raw_cycle = row[0]
        import re
        from datetime import datetime, timedelta

        # Matches e.g. "Effective Date: 09 JUL 2026"
        match = re.search(
            r"Effective Date:\s*(\d{1,2}\s+[a-zA-Z]{3}\s+\d{4})", raw_cycle, re.IGNORECASE
        )
        if not match:
            # Fallback if parsing fails
            return SystemAiracResponse(effective_date="N/A", next_date="N/A")

        date_str = match.group(1).strip()
        eff_date = datetime.strptime(
            date_str.upper(), "%d %B %Y" if len(date_str.split()[1]) > 3 else "%d %b %Y"
        )
        next_date = eff_date + timedelta(days=28)

        return SystemAiracResponse(
            effective_date=eff_date.strftime("%d %b %Y UTC"),
            next_date=next_date.strftime("%d %b %Y UTC"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query failed: {e!s}") from e

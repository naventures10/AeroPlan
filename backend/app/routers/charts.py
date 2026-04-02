"""
Charts Router — Aerodrome chart listing and PDF proxy.
"""

import httpx
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter(prefix="/api", tags=["Charts"])


@router.get("/aerodromes/{icao_code}/charts")
async def get_aerodrome_charts(icao_code: str, db: AsyncSession = Depends(get_db)):
    """Returns the list of available aerodrome charts for a given ICAO code."""
    query = text("""
        SELECT chart_id, chart_title, chart_index, chart_url
        FROM aerodrome_charts
        WHERE icao_code = :icao
        ORDER BY chart_index;
    """)
    result = await db.execute(query, {"icao": icao_code.upper()})
    rows = result.fetchall()
    return [
        {
            "chart_id": r.chart_id,
            "chart_title": r.chart_title,
            "chart_index": r.chart_index,
            "chart_url": r.chart_url,
        }
        for r in rows
    ]


@router.get("/proxy-pdf")
async def proxy_pdf(url: str = Query(..., description="Remote PDF URL to proxy")):
    """
    Proxies a remote PDF through the backend so the frontend can render it
    in an iframe without CORS issues.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    }
    try:
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=30.0, verify=False
        ) as client:
            resp = await client.get(url, headers=headers)
        if resp.status_code != 200:
            return Response(
                content=f"Upstream returned {resp.status_code}",
                status_code=resp.status_code,
            )
        return Response(
            content=resp.content,
            media_type="application/pdf",
            headers={"Content-Disposition": "inline"},
        )
    except httpx.RequestError as exc:
        return Response(content=f"Proxy error: {exc}", status_code=502)

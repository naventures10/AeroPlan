"""
Optional async profiling utilities using yappi.

Usage:
    1. Import and mount in main.py when DEBUG=True:
       from app.profiling import profiling_router
       app.include_router(profiling_router)

    2. Start profiling:    POST /api/debug/profiling/start
    3. Stop and get stats: POST /api/debug/profiling/stop

    Stats are returned as JSON and also written to /tmp/yappi_profile.txt

Note: This module is dev-only and should NOT be mounted in production.
"""

import yappi  # type: ignore
from fastapi import APIRouter
from fastapi.responses import JSONResponse

profiling_router = APIRouter(prefix="/api/debug", tags=["Profiling"])


@profiling_router.post("/profiling/start")
async def start_profiling() -> JSONResponse:
    """Start yappi async profiling."""
    if yappi.is_running():
        return JSONResponse({"status": "already_running"})
    yappi.set_clock_type("wall")  # wall clock for async I/O workloads
    yappi.start(builtins=True, profile_threads=False)
    return JSONResponse({"status": "started", "clock_type": "wall"})


@profiling_router.post("/profiling/stop")
async def stop_profiling() -> JSONResponse:
    """Stop yappi and return top-50 functions by total time."""
    if not yappi.is_running():
        return JSONResponse({"status": "not_running"})
    yappi.stop()
    stats = yappi.get_func_stats()
    stats.sort("ttot", "desc")

    # Save full report to disk
    stats.save("/tmp/yappi_profile.txt", type="pstat")

    # Build JSON summary of top 50 hottest functions
    rows = []
    for i, s in enumerate(stats):
        if i >= 50:
            break
        rows.append(
            {
                "name": s.full_name,
                "ncall": s.ncall,
                "ttot_ms": round(s.ttot * 1000, 2),
                "tsub_ms": round(s.tsub * 1000, 2),
                "tavg_ms": round(s.tavg * 1000, 2),
            }
        )

    yappi.clear_stats()
    return JSONResponse(
        {
            "status": "stopped",
            "top_functions": rows,
            "full_report": "/tmp/yappi_profile.txt",
        }
    )

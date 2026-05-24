from fastapi import APIRouter

from app.api.v1.endpoints import (
    aerodromes,
    aip_supplements,
    ats_routes,
    auth,
    charts,
    daylight,
    navaids,
    notams,
    rnp,
    search,
    spatial,
    weather,
)

api_router = APIRouter()

api_router.include_router(aerodromes.router)
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(search.router)
api_router.include_router(charts.router)
api_router.include_router(rnp.router)
api_router.include_router(spatial.router)
api_router.include_router(weather.router)
api_router.include_router(notams.router)
api_router.include_router(daylight.router)
api_router.include_router(ats_routes.router)
api_router.include_router(navaids.router)
api_router.include_router(aip_supplements.router)

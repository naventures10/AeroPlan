from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import aerodromes, charts, daylight, notams, search, spatial, weather

app = FastAPI(title="Aero Plan API", version="0.1.0")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    return {"status": "online"}


# --- REGISTER ROUTERS ---
app.include_router(aerodromes.router)
app.include_router(search.router)
app.include_router(charts.router)
app.include_router(spatial.router)
app.include_router(weather.router)
app.include_router(notams.router)
app.include_router(daylight.router)

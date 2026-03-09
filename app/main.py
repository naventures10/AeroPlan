from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# --- IMPORT YOUR NEW ROUTER ---
from app.routers import features

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


# --- REGISTER THE ROUTER ---
app.include_router(features.router)

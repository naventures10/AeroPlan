from fastapi import APIRouter

router = APIRouter()

@router.get("/{icao}")
def get_aerodrome(icao: str):
    return {"icao": icao, "status": "Not implemented"}

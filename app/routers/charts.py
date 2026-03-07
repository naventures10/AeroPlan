from fastapi import APIRouter

router = APIRouter()

@router.get("/{icao}/procedures")
def get_procedures(icao: str):
    return {"icao": icao, "procedures": [], "status": "Not implemented"}

from pydantic import BaseModel


class SearchResultResponse(BaseModel):
    id: str
    name: str | None = None
    type: str
    center: list[float] | None = None
    bounds: list[float] | None = None

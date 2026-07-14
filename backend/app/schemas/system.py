from pydantic import BaseModel


class SystemAiracResponse(BaseModel):
    effective_date: str
    next_date: str

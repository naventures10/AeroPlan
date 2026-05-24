import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    username: str | None = None
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    username: str | None
    email: EmailStr
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

from pydantic import BaseModel, EmailStr
from app.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None
    role: UserRole = UserRole.viewer


class UserOut(BaseModel):
    id: int
    email: str
    name: str | None = None
    role: UserRole

    model_config = {"from_attributes": True}

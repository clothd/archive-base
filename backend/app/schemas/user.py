from pydantic import BaseModel, EmailStr
from app.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: UserRole = UserRole.viewer


class UserOut(BaseModel):
    id: int
    email: str
    role: UserRole

    model_config = {"from_attributes": True}

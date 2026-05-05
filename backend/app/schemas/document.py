from datetime import datetime
from pydantic import BaseModel


class DocumentOut(BaseModel):
    id: int
    pin_id: int
    filename: str
    content_type: str
    type: str
    size_kb: int | None
    uploaded_by: str | None
    created_at: datetime

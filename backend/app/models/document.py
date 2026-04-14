from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func

from app.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    pin_id = Column(Integer, ForeignKey("chainage_pins.id"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    s3_key = Column(String, nullable=False)
    content_type = Column(String, nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

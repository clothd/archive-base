import enum

from sqlalchemy import Column, Integer, ForeignKey, Enum

from app.database import Base


class AccessLevel(str, enum.Enum):
    viewer = "viewer"
    editor = "editor"
    admin = "admin"


class PipelineAccess(Base):
    __tablename__ = "pipeline_access"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    pipeline_id = Column(Integer, ForeignKey("pipelines.id"), primary_key=True)
    access_level = Column(Enum(AccessLevel), nullable=False, default=AccessLevel.viewer)

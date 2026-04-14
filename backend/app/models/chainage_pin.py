from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, func
from geoalchemy2 import Geometry

from app.database import Base


class ChainagePin(Base):
    __tablename__ = "chainage_pins"

    id = Column(Integer, primary_key=True, index=True)
    pipeline_id = Column(Integer, ForeignKey("pipelines.id"), nullable=False, index=True)
    chainage_km = Column(Float, nullable=False)
    geometry = Column(Geometry("POINT", srid=4326), nullable=False)
    label = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

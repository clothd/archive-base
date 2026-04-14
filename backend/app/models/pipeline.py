from sqlalchemy import Column, Integer, String, DateTime, func
from geoalchemy2 import Geometry

from app.database import Base


class Pipeline(Base):
    __tablename__ = "pipelines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String)
    # SRID 4326 = WGS84 lat/lng — what GPS uses
    geometry = Column(Geometry("LINESTRING", srid=4326), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

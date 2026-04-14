import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from geoalchemy2.functions import ST_AsGeoJSON
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.models.chainage_pin import ChainagePin
from app.models.pipeline import Pipeline
from app.models.user import User
from app.schemas.pipeline import PipelineOut


router = APIRouter()


@router.get("/", response_model=List[PipelineOut])
def list_pipelines(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Pipeline).all()


@router.get("/{pipeline_id}/geojson")
def get_pipeline_geojson(
    pipeline_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pipeline = db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    geom_json = db.scalar(ST_AsGeoJSON(pipeline.geometry))
    return {
        "type": "Feature",
        "geometry": json.loads(geom_json),
        "properties": {"id": pipeline.id, "name": pipeline.name},
    }


@router.get("/{pipeline_id}/pins")
def get_pipeline_pins(
    pipeline_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pipeline = db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    pins = db.query(ChainagePin).filter(ChainagePin.pipeline_id == pipeline_id).all()
    features = []
    for pin in pins:
        geom_json = db.scalar(ST_AsGeoJSON(pin.geometry))
        features.append({
            "type": "Feature",
            "geometry": json.loads(geom_json),
            "properties": {
                "id": pin.id,
                "label": pin.label,
                "chainage_km": pin.chainage_km,
            },
        })
    return {"type": "FeatureCollection", "features": features}

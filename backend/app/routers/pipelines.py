import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from geoalchemy2.functions import ST_AsGeoJSON, ST_ClosestPoint, ST_GeomFromText
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user, require_role
from app.dependencies.db import get_db
from app.models.chainage_pin import ChainagePin
from app.models.document import Document
from app.models.pipeline import Pipeline
from app.models.user import User
from app.schemas.pipeline import PipelineOut


class PinCreate(BaseModel):
    label: str
    chainage_km: float
    lat: float
    lng: float


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

    pins = db.query(ChainagePin).filter(ChainagePin.pipeline_id == pipeline_id).order_by(ChainagePin.chainage_km).all()

    pin_ids = [p.id for p in pins]
    counts = {}
    if pin_ids:
        rows = (
            db.query(Document.pin_id, func.count(Document.id).label("cnt"))
            .filter(Document.pin_id.in_(pin_ids))
            .group_by(Document.pin_id)
            .all()
        )
        counts = {r.pin_id: r.cnt for r in rows}

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
                "status": pin.status,
                "doc_count": counts.get(pin.id, 0),
            },
        })
    return {"type": "FeatureCollection", "features": features}


@router.post("/{pipeline_id}/pins", status_code=status.HTTP_201_CREATED)
def create_pin(
    pipeline_id: int,
    payload: PinCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "editor")),
):
    pipeline = db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    click_wkt = f"POINT({payload.lng} {payload.lat})"
    snapped_geom = db.scalar(
        ST_ClosestPoint(
            pipeline.geometry,
            ST_GeomFromText(click_wkt, 4326),
        )
    )

    pin = ChainagePin(
        pipeline_id=pipeline_id,
        chainage_km=payload.chainage_km,
        label=payload.label,
        geometry=snapped_geom,
        status="pending",
    )
    db.add(pin)
    db.commit()
    db.refresh(pin)
    geom_json = db.scalar(ST_AsGeoJSON(pin.geometry))
    return {
        "type": "Feature",
        "geometry": json.loads(geom_json),
        "properties": {
            "id": pin.id,
            "label": pin.label,
            "chainage_km": pin.chainage_km,
            "status": pin.status,
            "doc_count": 0,
        },
    }

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from geoalchemy2.functions import ST_AsGeoJSON, ST_ClosestPoint, ST_GeomFromText
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user, require_role
from app.dependencies.db import get_db
from app.models.chainage_pin import ChainagePin
from app.models.document import Document
from app.models.pipeline import Pipeline
from app.models.user import User
from app.schemas.document import DocumentOut
from app.services.storage import delete_file, upload_file


class PinMove(BaseModel):
    lat: float
    lng: float
    label: Optional[str] = None
    chainage_km: Optional[float] = None


router = APIRouter()


@router.get("/{pin_id}/documents", response_model=List[DocumentOut])
def list_documents(
    pin_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pin = db.get(ChainagePin, pin_id)
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")
    return db.query(Document).filter(Document.pin_id == pin_id).all()


@router.post("/{pin_id}/documents", response_model=DocumentOut, status_code=201)
async def upload_document(
    pin_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pin = db.get(ChainagePin, pin_id)
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")
    content = await file.read()
    s3_key = upload_file(content, file.filename, file.content_type)
    doc = Document(
        pin_id=pin_id,
        filename=file.filename,
        s3_key=s3_key,
        content_type=file.content_type,
        uploaded_by=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/{pin_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pin(
    pin_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "editor")),
):
    pin = db.get(ChainagePin, pin_id)
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")

    # Remove all attached documents (S3 best-effort, then DB)
    docs = db.query(Document).filter(Document.pin_id == pin_id).all()
    for doc in docs:
        try:
            delete_file(doc.s3_key)
        except Exception:
            pass  # best-effort — don't block DB delete if S3 fails
        db.delete(doc)

    db.delete(pin)
    db.commit()


@router.patch("/{pin_id}")
def move_pin(
    pin_id: int,
    payload: PinMove,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "editor")),
):
    pin = db.get(ChainagePin, pin_id)
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")

    pipeline = db.get(Pipeline, pin.pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    click_wkt = f"POINT({payload.lng} {payload.lat})"
    snapped_geom = db.scalar(
        ST_ClosestPoint(
            pipeline.geometry,
            ST_GeomFromText(click_wkt, 4326),
        )
    )
    pin.geometry = snapped_geom
    if payload.label is not None:
        pin.label = payload.label
    if payload.chainage_km is not None:
        pin.chainage_km = payload.chainage_km

    db.commit()
    db.refresh(pin)
    geom_json = db.scalar(ST_AsGeoJSON(pin.geometry))
    return {
        "type": "Feature",
        "geometry": json.loads(geom_json),
        "properties": {"id": pin.id, "label": pin.label, "chainage_km": pin.chainage_km},
    }

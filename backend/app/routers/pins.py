import json
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
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
from app.services.storage import delete_file, upload_file


class PinMove(BaseModel):
    lat: float
    lng: float
    label: Optional[str] = None
    chainage_km: Optional[float] = None


def _ext_to_type(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return {
        "pdf": "pdf", "dwg": "dwg", "dxf": "dwg",
        "jpg": "img", "jpeg": "img", "png": "img", "gif": "img",
        "xls": "xls", "xlsx": "xls", "csv": "xls",
        "doc": "doc", "docx": "doc", "txt": "doc",
        "zip": "zip",
    }.get(ext, "doc")


router = APIRouter()


@router.get("/{pin_id}/documents")
def list_documents(
    pin_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pin = db.get(ChainagePin, pin_id)
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")

    rows = (
        db.query(Document, User.email, User.name)
        .join(User, Document.uploaded_by == User.id)
        .filter(Document.pin_id == pin_id)
        .all()
    )
    return [
        {
            "id": doc.id,
            "pin_id": doc.pin_id,
            "filename": doc.filename,
            "content_type": doc.content_type,
            "type": _ext_to_type(doc.filename),
            "size_kb": (doc.size_bytes // 1024) if doc.size_bytes else None,
            "uploaded_by": name or email,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
        }
        for doc, email, name in rows
    ]


@router.post("/{pin_id}/documents", status_code=201)
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
        size_bytes=len(content),
        uploaded_by=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {
        "id": doc.id,
        "pin_id": doc.pin_id,
        "filename": doc.filename,
        "content_type": doc.content_type,
        "type": _ext_to_type(doc.filename),
        "size_kb": (doc.size_bytes // 1024) if doc.size_bytes else None,
        "uploaded_by": current_user.name or current_user.email,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
    }


@router.delete("/{pin_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pin(
    pin_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "editor")),
):
    pin = db.get(ChainagePin, pin_id)
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")

    docs = db.query(Document).filter(Document.pin_id == pin_id).all()
    for doc in docs:
        try:
            delete_file(doc.s3_key)
        except Exception:
            pass
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
    doc_count = db.scalar(func.count(Document.id).filter(Document.pin_id == pin.id))
    return {
        "type": "Feature",
        "geometry": json.loads(geom_json),
        "properties": {
            "id": pin.id,
            "label": pin.label,
            "chainage_km": pin.chainage_km,
            "status": pin.status,
            "doc_count": doc_count or 0,
        },
    }

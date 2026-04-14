from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.models.chainage_pin import ChainagePin
from app.models.document import Document
from app.models.user import User
from app.schemas.document import DocumentOut
from app.services.storage import upload_file


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

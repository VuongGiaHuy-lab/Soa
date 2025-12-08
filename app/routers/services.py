from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import schemas, models
from ..deps import RequireOwner

router = APIRouter(prefix="/services", tags=["services"])


@router.get("/", response_model=List[schemas.ServiceOut])
def list_services(db: Session = Depends(get_db)):
    return db.query(models.Service).filter(models.Service.is_active == True).all()


@router.post("/", response_model=schemas.ServiceOut, dependencies=[Depends(RequireOwner)])
def create_service(payload: schemas.ServiceCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Service).filter(models.Service.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Service already exists")
    svc = models.Service(**payload.model_dump())
    db.add(svc)
    db.commit()
    db.refresh(svc)
    return svc


@router.put("/{service_id}", response_model=schemas.ServiceOut, dependencies=[Depends(RequireOwner)])
def update_service(service_id: int, payload: schemas.ServiceUpdate, db: Session = Depends(get_db)):
    svc = db.get(models.Service, service_id)
    if not svc:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(svc, k, v)
    db.commit()
    db.refresh(svc)
    return svc


@router.delete("/{service_id}", dependencies=[Depends(RequireOwner)])
def delete_service(service_id: int, db: Session = Depends(get_db)):
    svc = db.query(models.Service).get(service_id)
    if not svc:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(svc)
    db.commit()
    return {"ok": True}

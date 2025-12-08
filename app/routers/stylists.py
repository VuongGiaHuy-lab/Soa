from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import schemas, models
from ..deps import RequireOwner
from ..auth import get_password_hash

router = APIRouter(prefix="/stylists", tags=["stylists"])

@router.get("/", response_model=List[schemas.StylistOut])
def list_stylists(db: Session = Depends(get_db)):
    return db.query(models.Stylist).all()

@router.post("/", response_model=schemas.StylistOut, dependencies=[Depends(RequireOwner)])
def create_stylist(payload: schemas.StylistCreateFull, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = models.User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        role=models.Role.STYLIST.value
    )
    db.add(user)
    db.flush()
    
    stylist = models.Stylist(
        user_id=user.id,
        display_name=payload.display_name,
        bio=payload.bio,
        start_hour=payload.start_hour,
        end_hour=payload.end_hour
    )
    db.add(stylist)
    db.commit()
    db.refresh(stylist)
    return stylist

@router.put("/{stylist_id}", response_model=schemas.StylistOut, dependencies=[Depends(RequireOwner)])
def update_stylist(stylist_id: int, payload: schemas.StylistUpdate, db: Session = Depends(get_db)):
    stylist = db.get(models.Stylist, stylist_id)
    if not stylist:
        raise HTTPException(status_code=404, detail="Stylist not found")
    
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(stylist, key, value)
    
    db.commit()
    db.refresh(stylist)
    return stylist

@router.delete("/{stylist_id}", dependencies=[Depends(RequireOwner)])
def delete_stylist(stylist_id: int, db: Session = Depends(get_db)):
    stylist = db.get(models.Stylist, stylist_id)
    if not stylist:
        raise HTTPException(status_code=404, detail="Stylist not found")
    
    if stylist.bookings:
        raise HTTPException(status_code=400, detail="Cannot delete stylist with existing bookings. Delete bookings first.")

    user = stylist.user
    if user:
        user.role = models.Role.CUSTOMER.value

    db.delete(stylist)
    db.commit()
    return {"ok": True}
# app/routers/stylists.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import schemas, models
from ..deps import RequireOwner

router = APIRouter(prefix="/stylists", tags=["stylists"])

@router.get("/", response_model=List[schemas.StylistOut])
def list_stylists(db: Session = Depends(get_db)):
    return db.query(models.Stylist).all()

@router.post("/", response_model=schemas.StylistOut, dependencies=[Depends(RequireOwner)])
def create_stylist(display_name: str, user_id: int, bio: str | None = None, start_hour: int = 9, end_hour: int = 20, db: Session = Depends(get_db)):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing = db.query(models.Stylist).filter(models.Stylist.user_id == user_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already has a stylist profile")
    
    user.role = models.Role.STYLIST.value
    stylist = models.Stylist(
        user_id=user_id, 
        display_name=display_name, 
        bio=bio,
        start_hour=start_hour,
        end_hour=end_hour
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

    # Reset role user về Customer nếu muốn, hoặc giữ nguyên
    user = stylist.user
    if user:
        user.role = models.Role.CUSTOMER.value

    db.delete(stylist)
    db.commit()
    return {"ok": True}
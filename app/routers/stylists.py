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
def create_stylist(display_name: str, user_id: int, bio: str | None = None, db: Session = Depends(get_db)):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Ensure user does not already have a stylist profile
    existing = db.query(models.Stylist).filter(models.Stylist.user_id == user_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already has a stylist profile")
    user.role = models.Role.STYLIST.value
    stylist = models.Stylist(user_id=user_id, display_name=display_name, bio=bio)
    db.add(stylist)
    db.commit()
    db.refresh(stylist)
    return stylist

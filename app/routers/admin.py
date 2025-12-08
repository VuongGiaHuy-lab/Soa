from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import schemas, models
from ..deps import RequireOwner

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(RequireOwner)])


@router.get("/users")
def list_users(db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    return [{"id": u.id, "email": u.email, "role": u.role, "is_active": u.is_active} for u in users]

@router.get("/bookings")
def list_all_bookings(db: Session = Depends(get_db)):
    """Owner can view all bookings."""
    return db.query(models.Booking).order_by(models.Booking.start_time.desc()).all()



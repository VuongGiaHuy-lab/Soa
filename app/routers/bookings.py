# app/routers/bookings.py
from datetime import datetime, timedelta, time, date as date_type
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from ..database import get_db
from .. import schemas, models
from ..deps import get_current_user, RequireOwner
from ..email_utils import send_email
from ..payment import luhn_checksum, mask_card, validate_expiry

router = APIRouter(prefix="/bookings", tags=["bookings"])

def get_service(db: Session, service_id: int) -> models.Service:
    svc = db.get(models.Service, service_id)
    if not svc or not svc.is_active:
        raise HTTPException(status_code=404, detail="Service not found")
    return svc

def is_overlapping(db: Session, stylist_id: int, start: datetime, end: datetime, exclude_booking_id: Optional[int] = None) -> bool:
    q = db.query(models.Booking).filter(
        models.Booking.stylist_id == stylist_id,
        models.Booking.status != models.BookingStatus.CANCELLED.value,
        models.Booking.start_time < end,
        models.Booking.end_time > start,
    )
    if exclude_booking_id:
        q = q.filter(models.Booking.id != exclude_booking_id)
    return db.query(q.exists()).scalar()

@router.get("/availability", response_model=List[schemas.TimeSlot])
def availability(service_id: int, date: date_type, stylist_id: int = Query(...), db: Session = Depends(get_db)):
    svc = get_service(db, service_id)
    stylist = db.get(models.Stylist, stylist_id)
    if not stylist:
        raise HTTPException(status_code=404, detail="Stylist not found")

    day_start = datetime(date.year, date.month, date.day, stylist.start_hour, 0)
    day_end = datetime(date.year, date.month, date.day, stylist.end_hour, 0)
    
    slots: List[schemas.TimeSlot] = []
    current = day_start
    while current + timedelta(minutes=svc.duration_minutes) <= day_end:
        end = current + timedelta(minutes=svc.duration_minutes)
        if not is_overlapping(db, stylist_id, current, end):
            slots.append(schemas.TimeSlot(start_time=current, end_time=end, stylist_id=stylist_id))
        current += timedelta(minutes=60)
    return slots

@router.post("/", response_model=schemas.BookingOut)
def create_booking(payload: schemas.BookingCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    svc = get_service(db, payload.service_id)
    start = payload.start_time
    end = start + timedelta(minutes=svc.duration_minutes)

    if not payload.stylist_id:
        raise HTTPException(status_code=400, detail="Stylist selection is required")

    if is_overlapping(db, payload.stylist_id, start, end):
        raise HTTPException(status_code=409, detail="Stylist is unavailable at this time")

    booking = models.Booking(
        customer_id=user.id,
        service_id=svc.id,
        stylist_id=payload.stylist_id,
        start_time=start,
        end_time=end,
        status=models.BookingStatus.CONFIRMED.value,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking

# --- Endpoint Guest Booking (MỚI) ---
@router.post("/guest", response_model=schemas.BookingOut)
def create_guest_booking(payload: schemas.WalkinBookingCreate, db: Session = Depends(get_db)):
    svc = get_service(db, payload.service_id)
    start = payload.start_time
    end = start + timedelta(minutes=svc.duration_minutes)

    # Validate Stylist & Working Hours
    stylist = db.get(models.Stylist, payload.stylist_id)
    if not stylist:
         raise HTTPException(status_code=404, detail="Stylist not found")
    
    if not (stylist.start_hour <= start.hour < stylist.end_hour):
         raise HTTPException(status_code=400, detail="Stylist is not working at this time")

    if is_overlapping(db, payload.stylist_id, start, end):
        raise HTTPException(status_code=409, detail="Stylist is unavailable at this time")

    booking = models.Booking(
        customer_id=None, 
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        service_id=svc.id,
        stylist_id=payload.stylist_id,
        start_time=start,
        end_time=end,
        status=models.BookingStatus.CONFIRMED.value,
        is_walkin=False,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    
    if payload.customer_email:
        send_email(payload.customer_email, "Booking Confirmed", f"Your booking ID is #{booking.id}")

    return booking

# --- Endpoint Create Walk-in (Owner only) ---
@router.post("/walkin", response_model=schemas.BookingOut, dependencies=[Depends(RequireOwner)])
def create_walkin(payload: schemas.WalkinBookingCreate, db: Session = Depends(get_db)):
    # Tương tự Guest Booking nhưng đánh dấu is_walkin=True
    svc = get_service(db, payload.service_id)
    start = payload.start_time
    end = start + timedelta(minutes=svc.duration_minutes)
    
    if is_overlapping(db, payload.stylist_id, start, end):
        raise HTTPException(status_code=409, detail="Stylist is unavailable")
        
    booking = models.Booking(
        customer_id=None,
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        service_id=svc.id,
        stylist_id=payload.stylist_id,
        start_time=start,
        end_time=end,
        status=models.BookingStatus.CONFIRMED.value,
        is_walkin=True, # Đặt tại quầy
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking

@router.put("/{booking_id}/cancel", response_model=schemas.BookingOut)
def cancel_booking(booking_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.query(models.Booking).get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if user.role != models.Role.OWNER.value and booking.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    booking.status = models.BookingStatus.CANCELLED.value
    db.commit()
    db.refresh(booking)
    return booking

# --- Endpoint Delete Booking (MỚI - Chỉ Owner) ---
@router.delete("/{booking_id}", dependencies=[Depends(RequireOwner)])
def delete_booking(booking_id: int, db: Session = Depends(get_db)):
    booking = db.query(models.Booking).get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Xóa thanh toán liên quan
    db.query(models.Payment).filter(models.Payment.booking_id == booking.id).delete()
    
    db.delete(booking)
    db.commit()
    return {"ok": True}

@router.get("/me", response_model=List[schemas.BookingOut])
def my_bookings(user=Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(models.Booking).filter(models.Booking.customer_id == user.id)
    return q.order_by(models.Booking.start_time.desc()).all()

@router.post("/{booking_id}/pay", response_model=schemas.PaymentOut)
def pay_booking(
    booking_id: int, 
    payload: schemas.PaymentRequest, 
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    booking = db.query(models.Booking).get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.customer_id and booking.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not yours")
    if booking.status == models.BookingStatus.CANCELLED.value:
        raise HTTPException(status_code=400, detail="Booking cancelled")

    if not luhn_checksum(payload.card_number) or not validate_expiry(payload.expiry_month, payload.expiry_year):
        raise HTTPException(status_code=400, detail="Invalid payment details")

    amount = db.query(models.Service).get(booking.service_id).price
    payment = db.query(models.Payment).filter(models.Payment.booking_id == booking.id).first()
    if not payment:
        payment = models.Payment(booking_id=booking.id, amount=amount)
        db.add(payment)
        db.flush()

    payment.status = models.PaymentStatus.SUCCESS.value
    payment.masked_details = mask_card(payload.card_number)
    payment.provider = "mock"
    db.commit()
    db.refresh(payment)

    email_to = user.email if booking.customer_id else booking.customer_email
    if email_to:
        body_content = (
            f"Thank you for your payment.\n\n"
            f"Booking ID: {booking.id}\n"
            f"Service ID: {booking.service_id}\n"
            f"Amount: ${amount:.2f}\n"
            f"Paid with: {payment.masked_details}\n"
        )
        background_tasks.add_task(
            send_email,
            to_email=email_to,
            subject="Salon Booking Payment Receipt",
            body=body_content
        )

    return payment
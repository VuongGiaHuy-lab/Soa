# app/routers/bookings.py

from datetime import datetime, timedelta, time, date as date_type
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks # Thêm BackgroundTasks
from sqlalchemy.orm import Session
from ..database import get_db
from .. import schemas, models
from ..deps import get_current_user, RequireOwner
from ..email_utils import send_email
from ..payment import luhn_checksum, mask_card, validate_expiry

router = APIRouter(prefix="/bookings", tags=["bookings"])

# ... Giữ nguyên hàm get_service ...
def get_service(db: Session, service_id: int) -> models.Service:
    svc = db.get(models.Service, service_id)
    if not svc or not svc.is_active:
        raise HTTPException(status_code=404, detail="Service not found")
    return svc

# ... Giữ nguyên hàm is_overlapping ...
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

# --- Endpoint Check Availability (Cập nhật giờ linh hoạt) ---
@router.get("/availability", response_model=List[schemas.TimeSlot])
def availability(service_id: int, date: date_type, stylist_id: int = Query(...), db: Session = Depends(get_db)):
    svc = get_service(db, service_id)
    
    # Lấy thông tin stylist để biết giờ làm việc
    stylist = db.get(models.Stylist, stylist_id)
    if not stylist:
        raise HTTPException(status_code=404, detail="Stylist not found")

    # Dùng giờ của stylist thay vì hardcode (9, 0) và (20, 0)
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

# --- Endpoint Create Booking (Giữ nguyên, chỉ đảm bảo logic cũ) ---
@router.post("/", response_model=schemas.BookingOut)
def create_booking(payload: schemas.BookingCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    svc = get_service(db, payload.service_id)
    start = payload.start_time
    end = start + timedelta(minutes=svc.duration_minutes)

    stylist_id = payload.stylist_id
    if stylist_id is None:
        raise HTTPException(status_code=400, detail="Stylist selection is required")

    if is_overlapping(db, stylist_id, start, end):
        raise HTTPException(status_code=409, detail="Stylist is unavailable at this time")

    booking = models.Booking(
        customer_id=user.id,
        service_id=svc.id,
        stylist_id=stylist_id,
        start_time=start,
        end_time=end,
        status=models.BookingStatus.CONFIRMED.value,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking

# --- Endpoint Cancel Booking (MỚI) ---
@router.put("/{booking_id}/cancel", response_model=schemas.BookingOut)
def cancel_booking(booking_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.query(models.Booking).get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Chỉ Owner hoặc chính khách hàng mới được hủy
    if user.role != models.Role.OWNER.value and booking.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this booking")
        
    booking.status = models.BookingStatus.CANCELLED.value
    db.commit()
    db.refresh(booking)
    return booking

# --- Endpoint Pay Booking (Cập nhật BackgroundTasks) ---
@router.post("/{booking_id}/pay", response_model=schemas.PaymentOut)
def pay_booking(
    booking_id: int, 
    payload: schemas.PaymentRequest, 
    background_tasks: BackgroundTasks,  # Inject BackgroundTasks
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

    # Gửi email qua Background Tasks (không chặn phản hồi API)
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
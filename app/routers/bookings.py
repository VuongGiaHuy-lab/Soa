# app/routers/bookings.py
from datetime import datetime, timedelta, time, date as date_type
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from ..database import get_db
from .. import schemas, models
from ..deps import get_current_user, RequireOwner, RequireStylist
from ..email_utils import send_email
from ..payment import luhn_checksum, mask_card, validate_expiry

router = APIRouter(prefix="/bookings", tags=["bookings"])

DEPOSIT_PERCENTAGE = 0.30

def get_service(db: Session, service_id: int) -> models.Service:
    svc = db.get(models.Service, service_id)
    if not svc or not svc.is_active:
        raise HTTPException(status_code=404, detail="Service not found")
    return svc

def is_overlapping(db: Session, stylist_id: int, start: datetime, end: datetime, exclude_booking_id: Optional[int] = None) -> bool:
    q = db.query(models.Booking).filter(
        models.Booking.stylist_id == stylist_id,
        models.Booking.status.in_([models.BookingStatus.CONFIRMED.value, models.BookingStatus.PENDING.value]),
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
    try:
        svc = get_service(db, payload.service_id)
        start = payload.start_time
        end = start + timedelta(minutes=svc.duration_minutes)

        if not payload.stylist_id:
            raise HTTPException(status_code=400, detail="Stylist selection is required")

        if is_overlapping(db, payload.stylist_id, start, end):
            raise HTTPException(status_code=409, detail="Stylist is unavailable at this time")
            
        # --- LOGIC TÍNH GIÁ MỚI ---
        current_price = svc.price
        # --------------------------

        booking = models.Booking(
            customer_id=user.id,
            service_id=svc.id,
            stylist_id=payload.stylist_id,
            start_time=start,
            end_time=end,
            status=models.BookingStatus.PENDING.value,
            
            service_price_snapshot=current_price, # <-- LƯU VẾT GIÁ
            total_amount=current_price,          # <-- LƯU TỔNG TIỀN
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
        return booking
    except Exception as e:
        db.rollback()
        raise e

@router.post("/guest", response_model=schemas.BookingOut)
def create_guest_booking(payload: schemas.WalkinBookingCreate, db: Session = Depends(get_db)):
    try:
        svc = get_service(db, payload.service_id)
        start = payload.start_time
        end = start + timedelta(minutes=svc.duration_minutes)

        stylist = db.get(models.Stylist, payload.stylist_id)
        if not stylist:
             raise HTTPException(status_code=404, detail="Stylist not found")
        
        if not (stylist.start_hour <= start.hour < stylist.end_hour):
             raise HTTPException(status_code=400, detail="Stylist is not working at this time")

        if is_overlapping(db, payload.stylist_id, start, end):
            raise HTTPException(status_code=409, detail="Stylist is unavailable at this time")
            
        # --- LOGIC TÍNH GIÁ MỚI ---
        current_price = svc.price
        # --------------------------

        booking = models.Booking(
            customer_id=None, 
            customer_name=payload.customer_name,
            customer_email=payload.customer_email,
            customer_phone=payload.customer_phone,
            service_id=svc.id,
            stylist_id=payload.stylist_id,
            start_time=start,
            end_time=end,
            status=models.BookingStatus.PENDING.value,
            is_walkin=False,
            
            service_price_snapshot=current_price, # <-- LƯU VẾT GIÁ
            total_amount=current_price,          # <-- LƯU TỔNG TIỀN
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
        
        if payload.customer_email:
            send_email(
                payload.customer_email, 
                "Booking Reserved - Payment Required", 
                f"Hello {payload.customer_name},\n\nYour booking #{booking.id} is reserved. Please pay deposit to confirm."
            )

        return booking
    except Exception as e:
        db.rollback()
        raise e

@router.post("/walkin", response_model=schemas.BookingOut, dependencies=[Depends(RequireOwner)])
def create_walkin(payload: schemas.WalkinBookingCreate, db: Session = Depends(get_db)):
    try:
        svc = get_service(db, payload.service_id)
        start = payload.start_time
        end = start + timedelta(minutes=svc.duration_minutes)
        
        if is_overlapping(db, payload.stylist_id, start, end):
            raise HTTPException(status_code=409, detail="Stylist is unavailable")
            
        # --- LOGIC TÍNH GIÁ MỚI ---
        current_price = svc.price
        # --------------------------

        booking = models.Booking(
            customer_id=None,
            customer_name=payload.customer_name,
            customer_email=payload.customer_email,
            customer_phone=payload.customer_phone,
            service_id=svc.id,
            stylist_id=payload.stylist_id,
            start_time=start,
            end_time=end,
            status=models.BookingStatus.CONFIRMED.value,
            is_walkin=True,
            
            service_price_snapshot=current_price, # <-- LƯU VẾT GIÁ
            total_amount=current_price,          # <-- LƯU TỔNG TIỀN
        )
        db.add(booking)
        db.flush()

        # TỰ ĐỘNG TẠO PAYMENT (CASH)
        payment = models.Payment(
            booking_id=booking.id,
            amount=current_price,
            status=models.PaymentStatus.SUCCESS.value,
            provider="cash_pos",
            masked_details="Walk-in Cash"
        )
        db.add(payment)

        db.commit()
        db.refresh(booking)
        return booking
    except Exception as e:
        db.rollback()
        raise e

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

@router.delete("/{booking_id}", dependencies=[Depends(RequireOwner)])
def delete_booking(booking_id: int, db: Session = Depends(get_db)):
    try:
        booking = db.query(models.Booking).get(booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        db.query(models.Payment).filter(models.Payment.booking_id == booking.id).delete()
        db.delete(booking)
        db.commit()
        return {"ok": True}
    except Exception as e:
        db.rollback()
        raise e

@router.get("/me", response_model=List[schemas.BookingOut])
def my_bookings(user=Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(models.Booking).filter(models.Booking.customer_id == user.id)
    return q.order_by(models.Booking.start_time.desc()).all()

@router.get("/stylist-schedule", response_model=List[schemas.BookingOut], dependencies=[Depends(RequireStylist)])
def stylist_schedule(user=Depends(get_current_user), db: Session = Depends(get_db)):
    stylist = db.query(models.Stylist).filter(models.Stylist.user_id == user.id).first()
    if not stylist:
        raise HTTPException(status_code=404, detail="Stylist profile not found")
    
    return db.query(models.Booking).filter(
        models.Booking.stylist_id == stylist.id
    ).order_by(models.Booking.start_time.desc()).all()

# --- HELPER GỬI MAIL ---
def send_confirmation_email(booking, payment, paid_amount, note, db, bg_tasks):
    recipient_email = booking.customer_email
    customer_name = booking.customer_name or "Valued Customer"
    if not recipient_email and booking.customer_id:
        u = db.query(models.User).get(booking.customer_id)
        if u: recipient_email = u.email; customer_name = u.full_name or customer_name

    if recipient_email:
        appt_time = booking.start_time.strftime("%A, %d %B %Y at %I:%M %p")
        pay_time = datetime.now().strftime("%I:%M %p")
        
        body = (
            f"Hello {customer_name},\n\n"
            f"Booking Confirmed! ✅\n"
            f"{note}\n\n"
            f"--- Details ---\n"
            f"📅 Appointment: {appt_time}\n"
            f"💵 Amount Paid Now: ${paid_amount:.2f}\n"
            f"🕒 Payment Time: {pay_time}\n"
            f"🆔 Booking ID: #{booking.id}\n"
            f"💰 Total Price: ${booking.total_amount:.2f}\n" # Thêm tổng tiền
            f"\nSee you soon!\nSalon Luxury"
        )
        bg_tasks.add_task(send_email, recipient_email, "Booking Confirmed", body)

# --- 1. PAY FULL (Online) ---
@router.post("/{booking_id}/pay", response_model=schemas.PaymentOut)
def pay_booking(
    booking_id: int, 
    payload: schemas.PaymentRequest, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    try:
        booking = db.query(models.Booking).get(booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        # Kiểm tra xem đã trả hết tiền chưa
        if booking.total_amount <= db.query(func.sum(models.Payment.amount)).filter(models.Payment.booking_id == booking_id, models.Payment.status == models.PaymentStatus.SUCCESS.value).scalar() or 0:
            raise HTTPException(status_code=400, detail="Booking already fully paid")

        if not luhn_checksum(payload.card_number) or not validate_expiry(payload.expiry_month, payload.expiry_year):
            raise HTTPException(status_code=400, detail="Invalid payment details")

        # Lấy số tiền còn thiếu (để trả full)
        remaining_to_pay = booking.total_amount - (db.query(func.sum(models.Payment.amount)).filter(models.Payment.booking_id == booking_id, models.Payment.status == models.PaymentStatus.SUCCESS.value).scalar() or 0)
        
        # Nếu payload.amount không khớp, ta sẽ lấy số tiền còn thiếu
        amount_to_charge = remaining_to_pay

        payment = models.Payment(
            booking_id=booking.id, 
            amount=amount_to_charge, 
            status=models.PaymentStatus.SUCCESS.value,
            provider="mock_full",
            masked_details=mask_card(payload.card_number)
        )
        db.add(payment)
        
        booking.status = models.BookingStatus.CONFIRMED.value
        db.commit()
        db.refresh(payment)

        send_confirmation_email(booking, payment, amount_to_charge, "Full Payment Received", db, background_tasks)
        return payment
    except Exception as e:
        db.rollback()
        raise e

# --- 2. PAY DEPOSIT (Cọc 30%) ---
@router.post("/{booking_id}/pay-deposit", response_model=schemas.PaymentOut)
def pay_deposit(
    booking_id: int, 
    payload: schemas.PaymentRequest, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    try:
        booking = db.query(models.Booking).get(booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        # Kiểm tra xem đã trả cọc/full rồi chưa
        if db.query(models.Payment).filter(models.Payment.booking_id == booking_id, models.Payment.status == models.PaymentStatus.SUCCESS.value).first():
            raise HTTPException(status_code=400, detail="Deposit/Full payment already received.")

        if not luhn_checksum(payload.card_number) or not validate_expiry(payload.expiry_month, payload.expiry_year):
            raise HTTPException(status_code=400, detail="Invalid payment details")

        # Tính tiền cọc
        deposit_amount = round(booking.total_amount * DEPOSIT_PERCENTAGE, 2)
        remaining = round(booking.total_amount - deposit_amount, 2)

        # Ghi nhận thanh toán CỌC
        payment = models.Payment(
            booking_id=booking.id, 
            amount=deposit_amount, 
            status=models.PaymentStatus.SUCCESS.value,
            provider="mock_deposit",
            masked_details=mask_card(payload.card_number) + f" (Deposit {DEPOSIT_PERCENTAGE*100:.0f}%)"
        )
        db.add(payment)
        
        booking.status = models.BookingStatus.CONFIRMED.value
        db.commit()
        db.refresh(payment)

        note = f"Deposit Paid ({DEPOSIT_PERCENTAGE*100:.0f}%). Remaining balance ${remaining:.2f} due at salon."
        send_confirmation_email(booking, payment, deposit_amount, note, db, background_tasks)
        
        return payment
    except Exception as e:
        db.rollback()
        raise e
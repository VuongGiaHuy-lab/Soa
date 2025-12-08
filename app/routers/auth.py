# app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status, Body, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
import os

from ..database import get_db
from .. import schemas, models
from ..auth import get_password_hash, verify_password, create_access_token, decode_token
from ..email_utils import send_email
from ..config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=schemas.UserOut)
def register(
    user_in: schemas.UserCreate, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    existing = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = models.User(
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=get_password_hash(user_in.password),
        role=models.Role.CUSTOMER.value,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Email already registered")
    db.refresh(user)

    # --- SỬA ĐỔI: Gửi email chào mừng cho KHÁCH HÀNG ---
    subject = "Welcome to Salon Luxury! 🎉"
    body = (
        f"Hi {user.full_name or 'Friend'},\n\n"
        f"Thank you for joining us! Your account has been successfully created.\n"
        f"You can now log in to book appointments and track your history.\n\n"
        f"Best regards,\nSalon Luxury Team"
    )
    # Gửi đến chính email của user vừa đăng ký
    background_tasks.add_task(send_email, user.email, subject, body)
    # ---------------------------------------------------

    return user

@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    
    if not user and form_data.username == settings.ADMIN_EMAIL:
        user = models.User(
            email=form_data.username,
            full_name="Store Owner",
            hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
            role=models.Role.OWNER.value,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": token, "token_type": "bearer"}

@router.post("/forgot-password")
def forgot_password(email_in: str = Body(..., embed=True), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email_in).first()
    if not user:
        return {"msg": "If your email is registered, you will receive a reset link."}
    
    reset_token = create_access_token(
        data={"sub": str(user.id), "type": "reset"}, 
        expires_delta=timedelta(minutes=15)
    )
    link = f"http://localhost:8000/frontend/reset-password.html?token={reset_token}"
    
    # Gửi link reset pass cho khách hàng
    send_email(user.email, "Password Reset Request", f"Click here to reset your password: {link}")
    
    return {"msg": "Email sent"}

@router.post("/reset-password")
def reset_password(token: str = Body(...), new_password: str = Body(...), db: Session = Depends(get_db)):
    payload = decode_token(token)
    if not payload or payload.get("type") != "reset":
        raise HTTPException(status_code=400, detail="Invalid token")
    user = db.query(models.User).filter(models.User.id == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = get_password_hash(new_password)
    db.commit()
    return {"msg": "Success"}
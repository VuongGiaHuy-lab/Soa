from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
import os
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ..database import get_db
from .. import schemas, models
from ..auth import get_password_hash, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.UserOut)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
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
        # Covers race conditions where another request inserted same email concurrently
        raise HTTPException(status_code=400, detail="Email already registered")
    db.refresh(user)
    return user


@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    # Fallback: ensure admin can login even if seeding hasn't created it yet
    if not user and form_data.username == os.getenv("ADMIN_EMAIL", "@ownersalon.local"):
        user = models.User(
            email=form_data.username,
            full_name="Store Owner",
            hashed_password=get_password_hash(os.getenv("ADMIN_PASSWORD", "Owner@12345")),
            role=models.Role.OWNER.value,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": token, "token_type": "bearer"}

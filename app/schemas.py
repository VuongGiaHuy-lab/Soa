
from datetime import datetime, date, time
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str = Field(min_length=8)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str]
    role: str
    class Config:
        from_attributes = True

class ServiceBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    duration_minutes: int = 60

class ServiceCreate(ServiceBase):
    pass

class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    duration_minutes: Optional[int] = None
    is_active: Optional[bool] = None

class ServiceOut(ServiceBase):
    id: int
    is_active: bool
    class Config:
        from_attributes = True

class StylistOut(BaseModel):
    id: int
    display_name: str
    bio: Optional[str] = None
    start_hour: int
    end_hour: int
    class Config:
        from_attributes = True

class StylistUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    start_hour: Optional[int] = None
    end_hour: Optional[int] = None

class StylistCreateFull(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str
    display_name: str
    bio: Optional[str] = None
    start_hour: int = 9
    end_hour: int = 20

class BookingCreate(BaseModel):
    service_id: int
    stylist_id: Optional[int] = None
    start_time: datetime

class WalkinBookingCreate(BaseModel):
    service_id: int
    stylist_id: int
    start_time: datetime
    customer_name: str
    customer_email: Optional[EmailStr] = None
    customer_phone: Optional[str] = None

class AvailabilityQuery(BaseModel):
    service_id: int
    stylist_id: Optional[int] = None
    date: date

class TimeSlot(BaseModel):
    start_time: datetime
    end_time: datetime
    stylist_id: Optional[int] = None

class BookingOut(BaseModel):
    id: int
    service_id: int
    stylist_id: Optional[int]
    start_time: datetime
    end_time: datetime
    status: str
    is_walkin: bool
    customer_phone: Optional[str] = None
    class Config:
        from_attributes = True

class PaymentRequest(BaseModel):
    amount: float
    card_number: str
    expiry_month: int
    expiry_year: int
    cvv: str
    cardholder_name: str

class PaymentOut(BaseModel):
    id: int
    booking_id: int
    amount: float
    status: str
    masked_details: Optional[str]
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
class EmailIn(BaseModel):
    email: EmailStr
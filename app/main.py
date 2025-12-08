from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from .database import Base, engine, get_db, SessionLocal
from . import models
from .auth import get_password_hash
from .routers import auth as auth_router
from .routers import services as services_router
from .routers import stylists as stylists_router
from .routers import bookings as bookings_router
from .routers import admin as admin_router
import os

app = FastAPI(title="Salon Booking API")

# Create tables
Base.metadata.create_all(bind=engine)

# Seed default owner
@app.on_event("startup")
def seed_owner():
    from .models import User, Role
    with SessionLocal() as db:
        admin_email = os.getenv("ADMIN_EMAIL", "owner@salon.local")
        admin_password = os.getenv("ADMIN_PASSWORD", "Owner@12345")
        user = db.query(User).filter(User.email == admin_email).first()
        if not user:
            user = User(email=admin_email, hashed_password=get_password_hash(admin_password), role=Role.OWNER.value, full_name="Store Owner")
            db.add(user)
            db.commit()
        else:
            # Ensure known password and role for test/dev
            user.hashed_password = get_password_hash(admin_password)
            user.role = Role.OWNER.value
            db.commit()
        # Seed a default stylist if none exist
        from .models import Stylist
        has_stylist = db.query(Stylist).count() > 0
        if not has_stylist:
            st = Stylist(user_id=user.id, display_name="Sam", bio="Default stylist")
            db.add(st)
            db.commit()

app.include_router(auth_router.router)
app.include_router(services_router.router)
app.include_router(stylists_router.router)
app.include_router(bookings_router.router)
app.include_router(admin_router.router)

# Dev CORS (allow local files and localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.get("/")
def root():
    # Redirect to auth page by default so users land on login first
    return RedirectResponse(url="/auth")

# Convenience routes for multi-page frontend
@app.get("/auth")
def page_auth():
    return FileResponse("frontend/auth.html")

@app.get("/register")
def page_register():
    return FileResponse("frontend/register.html")

@app.get("/services")
def page_services():
    return FileResponse("frontend/services.html")

@app.get("/book")
def page_book():
    return FileResponse("frontend/book.html")

@app.get("/admin")
def page_admin():
    return FileResponse("frontend/admin.html")

@app.get("/forgot-password")
def page_forgot_password():
    return FileResponse("frontend/forgot-password.html")

# Also mount static frontend assets (if you add css/js files later)
app.mount("/static", StaticFiles(directory="frontend"), name="static")
# Serve the entire frontend directory at /frontend so direct file paths work
app.mount("/frontend", StaticFiles(directory="frontend"), name="frontend")

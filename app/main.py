# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from .database import Base, engine, SessionLocal
from .config import settings
from .auth import get_password_hash
from .routers import auth as auth_router
from .routers import services as services_router
from .routers import stylists as stylists_router
from .routers import bookings as bookings_router
from .routers import admin as admin_router

app = FastAPI(title="Salon Booking API")

# Create tables
Base.metadata.create_all(bind=engine)

# Seed default owner
@app.on_event("startup")
def seed_owner():
    from .models import User, Role, Stylist
    with SessionLocal() as db:
        admin_email = settings.ADMIN_EMAIL
        admin_password = settings.ADMIN_PASSWORD
        
        user = db.query(User).filter(User.email == admin_email).first()
        if not user:
            user = User(
                email=admin_email, 
                hashed_password=get_password_hash(admin_password), 
                role=Role.OWNER.value, 
                full_name="Store Owner"
            )
            db.add(user)
            db.commit()
        else:
            user.hashed_password = get_password_hash(admin_password)
            user.role = Role.OWNER.value
            db.commit()
            
        # Seed a default stylist if none exist
        has_stylist = db.query(Stylist).count() > 0
        if not has_stylist:
            st = Stylist(user_id=user.id, display_name="Sam", bio="Default stylist", start_hour=9, end_hour=20)
            db.add(st)
            db.commit()

app.include_router(auth_router.router)
app.include_router(services_router.router)
app.include_router(stylists_router.router)
app.include_router(bookings_router.router)
app.include_router(admin_router.router)

# Dev CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# --- SỬA ĐỔI QUAN TRỌNG Ở ĐÂY ---
@app.get("/")
def root():
    # Trả về trang chủ thay vì redirect
    return FileResponse("frontend/index.html")
# --------------------------------

# Frontend routes
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

@app.get("/reset-password")
def page_reset_password():
    return FileResponse("frontend/reset-password.html")

app.mount("/static", StaticFiles(directory="frontend"), name="static")
app.mount("/frontend", StaticFiles(directory="frontend"), name="frontend")
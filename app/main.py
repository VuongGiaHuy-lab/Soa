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

Base.metadata.create_all(bind=engine)

@app.on_event("startup")
def seed_data():
    # Import Models bên trong hàm để tránh lỗi vòng lặp
    from .models import User, Role, Stylist, Service
    
    with SessionLocal() as db:
        # 1. TẠO OWNER (ADMIN)
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
            # Đảm bảo quyền luôn là Owner
            user.role = Role.OWNER.value
            db.commit()
        
        # 2. TẠO STYLIST MẶC ĐỊNH (Nếu chưa có)
        has_stylist = db.query(Stylist).count() > 0
        if not has_stylist:
            # Lấy user vừa tạo/tìm thấy ở trên để làm stylist mẫu
            # Lưu ý: Trong thực tế nên tạo user riêng, nhưng để demo thì dùng tạm
            try:
                st = Stylist(
                    user_id=user.id, 
                    display_name="Sam", 
                    bio="Top Stylist", 
                    start_hour=9, 
                    end_hour=20
                )
                db.add(st)
                db.commit()
            except:
                pass # Bỏ qua nếu user.id đã có trong bảng stylists (Unique constraint)

        # 3. TẠO 3 DỊCH VỤ MẪU (SERVICES) <-- PHẦN MỚI THÊM
        sample_services = [
            {
                "name": "Women's Haircut",
                "price": 40.0,
                "duration_minutes": 60,
                "description": "Wash, cut & blowdry styling."
            },
            {
                "name": "Men's Haircut",
                "price": 25.0,
                "duration_minutes": 30,
                "description": "Standard clipper or scissor cut."
            },
            {
                "name": "Color & Style",
                "price": 100.0,
                "duration_minutes": 120,
                "description": "Full hair coloring and professional styling."
            }
        ]

        for svc_data in sample_services:
            # Kiểm tra xem dịch vụ đã tồn tại chưa (dựa theo tên)
            exists = db.query(Service).filter(Service.name == svc_data["name"]).first()
            if not exists:
                new_svc = Service(**svc_data)
                db.add(new_svc)
        
        db.commit() # Lưu tất cả dịch vụ mới

app.include_router(auth_router.router)
app.include_router(services_router.router)
app.include_router(stylists_router.router)
app.include_router(bookings_router.router)
app.include_router(admin_router.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.get("/")
def root():
    return FileResponse("frontend/index.html")

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

@app.get("/stylist-portal")
def page_stylist():
    return FileResponse("frontend/stylist.html")

app.mount("/static", StaticFiles(directory="frontend"), name="static")
app.mount("/frontend", StaticFiles(directory="frontend"), name="frontend")
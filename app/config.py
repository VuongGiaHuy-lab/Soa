# app/config.py
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite:///./salon.db"
    
    # Security
    JWT_SECRET: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    
    # Admin mặc định
    ADMIN_EMAIL: str = "owner@salon.local"
    ADMIN_PASSWORD: str = "Owner@12345"
    
    # Email (SMTP)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASS: Optional[str] = None
    SMTP_SENDER: str = "no-reply@salon.local"

    class Config:
        env_file = ".env"

settings = Settings()
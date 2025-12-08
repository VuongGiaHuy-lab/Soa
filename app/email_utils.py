# app/email_utils.py
import smtplib
from email.message import EmailMessage
from .config import settings # Import settings

def send_email(to_email: str, subject: str, body: str) -> None:
    # Kiểm tra cấu hình từ settings
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASS:
        print("[EMAIL MOCK] To:", to_email)
        print("Subject:", subject)
        print("Body:\n", body)
        return

    msg = EmailMessage()
    msg["From"] = settings.SMTP_SENDER
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASS)
            server.send_message(msg)
    except Exception as e:
        print(f"Failed to send email: {e}")
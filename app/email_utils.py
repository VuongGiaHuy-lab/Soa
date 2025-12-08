import os
import smtplib
from email.message import EmailMessage

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
SMTP_SENDER = os.getenv("SMTP_SENDER", "no-reply@salon.local")


def send_email(to_email: str, subject: str, body: str) -> None:
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASS:
        # Fallback: log to console if SMTP not configured
        print("[EMAIL MOCK] To:", to_email)
        print("Subject:", subject)
        print("Body:\n", body)
        return

    msg = EmailMessage()
    msg["From"] = SMTP_SENDER
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.send_message(msg)

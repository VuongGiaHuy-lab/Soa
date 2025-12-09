
import smtplib
from email.message import EmailMessage
from .config import settings  

def send_email(to_email: str, subject: str, body: str) -> None:
    print("[EMAIL DEBUG] To:", to_email)
    print("Subject:", subject)
    print("Body:\n", body)

    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASS:
        print("[EMAIL MOCK] SMTP not configured. Using mock mode (no real email sent).")
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
        print("[EMAIL SUCCESS] Email sent successfully.")
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send email: {e}. Falling back to mock (link already printed above).")
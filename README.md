# Salon Booking System (FastAPI)

A simple FastAPI backend for a salon booking system with JWT auth, role-based access (customer, owner, stylist), services, stylists, bookings with timeslots, mock payments, and SMTP email receipts.

## Features
- Register/login with email + password
- Role-based access (Customer, Owner, Stylist)
- Browse services and stylists
- Check availability and create bookings in hourly timeslots
- Prevent double-booking of stylists
- Owner admin endpoints to manage services, users, and assign stylists
- Owner can create walk-in bookings that also block timeslots
- Mock payment processing; email receipt sent via SMTP

## Quick start (Windows cmd)

1. Create and activate a virtual environment (optional but recommended):
```cmd
python -m venv .venv
.venv\Scripts\activate
```

2. Install dependencies:
```cmd
pip install -r requirements.txt
```

3. Create a .env file with SMTP settings (optional for local dev):
```env
# .env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_user
SMTP_PASS=your_pass
SMTP_SENDER=salon@example.com
JWT_SECRET=change-me
ADMIN_EMAIL=owner@salon.local
ADMIN_PASSWORD=Owner@12345
```

If you skip SMTP, emails will be logged to console.

4. Run the server:
```cmd
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open docs at http://localhost:8000/docs

### Default owner account
On first run, the app seeds an Owner account from env vars (ADMIN_EMAIL/ADMIN_PASSWORD). If not set, it falls back to owner@salon.local / owner@salon.local.

## Tests
Run a quick smoke test:
```cmd
pytest -q
```

## Notes
- Payments are simulated; do not enter real card/bank details. The API stores only masked last-4 digits.
- Timeslot length defaults to service duration (60m default). Overlap prevention uses server-side checks.

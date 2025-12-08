from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def get_token(email: str, password: str) -> str:
    res = client.post("/auth/login", data={"username": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def test_flow():
    # Owner login (seeded)
    owner_email = "owner@salon.local"
    owner_password = "Owner@12345"
    owner_token = get_token(owner_email, owner_password)

    # Create a service
    svc = {"name": "Basic Cut", "description": "Haircut", "price": 20.0, "duration_minutes": 60}
    res = client.post("/services/", json=svc, headers={"Authorization": f"Bearer {owner_token}"})
    if res.status_code == 400:  # already exists
        res = client.get("/services/")
        service_id = [s for s in res.json() if s["name"] == "Basic Cut"][0]["id"]
    else:
        assert res.status_code == 200, res.text
        service_id = res.json()["id"]

    # Create a customer
    cust = {"email": "alice@example.com", "password": "Password123!", "full_name": "Alice"}
    res = client.post("/auth/register", json=cust)
    assert res.status_code in (200, 400), res.text  # ok if already exists

    # Customer login
    token = get_token("alice@example.com", "Password123!")

    # Create a stylist by converting owner user into stylist profile (simplification for test)
    # In real flow, you would create another user; here we reuse owner for brevity.
    res = client.post(
        "/stylists/",
        params={"display_name": "Sam", "user_id": 1},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code in (200, 400, 422), res.text  # might already exist or conflicts

    # List stylists
    res = client.get("/stylists/")
    assert res.status_code == 200
    stylists = res.json()
    assert len(stylists) >= 1
    stylist_id = stylists[0]["id"]

    # Create booking
    from datetime import datetime, timedelta
    start = datetime.utcnow().replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    payload = {"service_id": service_id, "stylist_id": stylist_id, "start_time": start.isoformat()}
    res = client.post("/bookings/", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code in (200, 409), res.text
    if res.status_code == 409:
        # try another hour
        start = start + timedelta(hours=1)
        payload["start_time"] = start.isoformat()
        res = client.post("/bookings/", json=payload, headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200, res.text
    booking = res.json()

    # Pay booking
    pay = {
        "amount": 20.0,
        "card_number": "4242424242424242",
        "expiry_month": 12,
        "expiry_year": 2099,
        "cvv": "123",
        "cardholder_name": "Alice",
    }
    res = client.post(f"/bookings/{booking['id']}/pay", json=pay, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, res.text

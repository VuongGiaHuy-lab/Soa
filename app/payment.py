from datetime import datetime


def luhn_checksum(card_number: str) -> bool:
    digits = [int(d) for d in card_number if d.isdigit()]
    if len(digits) < 12:
        return False
    checksum = 0
    parity = len(digits) % 2
    for i, d in enumerate(digits):
        if i % 2 == parity:
            d *= 2
            if d > 9:
                d -= 9
        checksum += d
    return checksum % 10 == 0


def mask_card(card_number: str) -> str:
    digits = ''.join([d for d in card_number if d.isdigit()])
    return f"**** **** **** {digits[-4:]}" if len(digits) >= 4 else "****"


def validate_expiry(month: int, year: int) -> bool:
    if month < 1 or month > 12:
        return False
    # assume year is yyyy
    now = datetime.utcnow()
    if year < now.year or (year == now.year and month < now.month):
        return False
    return True


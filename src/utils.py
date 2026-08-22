import hmac
import hashlib
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def paise_to_inr(paise: int) -> float:
    if paise < 0:
        raise ValueError("paise must be non-negative")
    return paise / 100


def resolve_phone(event_phone: Optional[str]) -> str:
    default_phone = os.getenv("DEMO_TARGET_PHONE", "whatsapp:+919876543210")
    raw = event_phone or default_phone
    if not raw:
        return default_phone
    if raw.startswith("whatsapp:"):
        prefix = "whatsapp:"
        number_part = raw[len("whatsapp:"):]
    else:
        prefix = "whatsapp:"
        number_part = raw

    clean_digits = "".join(c for c in number_part if c.isdigit())
    if len(clean_digits) == 10:
        clean_digits = f"91{clean_digits}"
    return f"{prefix}+{clean_digits}"


def verify_hmac_sha256(body: bytes, signature: str, secret: str) -> bool:
    if not signature:
        return False
    expected = hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def build_dispatch_entry(
    dispatch_id: str,
    to: str,
    frm: str,
    message: str,
    payment_url: Optional[str],
    channel: str,
    status: str,
    **extra: Any,
) -> Dict[str, Any]:
    entry: Dict[str, Any] = {
        "dispatch_id": dispatch_id,
        "to": to,
        "from": frm,
        "message": message,
        "payment_url": payment_url,
        "channel": channel,
        "status": status,
        "timestamp": os.getenv("CURRENT_TIME", utc_now_iso()),
    }
    entry.update(extra)
    return entry


def redact_pii(contact_str: Optional[str]) -> str:
    if not contact_str:
        return "anon_contact"
    clean = contact_str.replace("whatsapp:", "").strip()
    if len(clean) >= 10:
        return f"{clean[:3]}****{clean[-3:]}"
    import hashlib
    return f"hash_{hashlib.sha256(clean.encode()).hexdigest()[:8]}"

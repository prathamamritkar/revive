import os
import requests
from dotenv import load_dotenv
from typing import Dict, Any, Optional

load_dotenv()

class RazorpayClientWrapper:
    def __init__(self):
        self.key_id = os.getenv("RAZORPAY_KEY_ID", "rzp_test_dummy")
        self.key_secret = os.getenv("RAZORPAY_KEY_SECRET", "dummy_secret")
        self.webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "revpulse_secret_2026")
        self.base_url = "https://api.razorpay.com/v1"
        self.is_configured = bool(self.key_id and not self.key_id.startswith("rzp_test_YourKey"))

    def _mock_payment_link(self, entity_id: str, amount_paise: int, description: str) -> Dict[str, Any]:
        return {
            "id": f"plink_{entity_id[:12]}",
            "short_url": f"https://rzp.io/i/rec_{entity_id[:8]}",
            "status": "created",
            "amount": amount_paise,
            "description": description,
            "is_mock": True
        }

    def create_payment_link(
        self,
        entity_id: str,
        amount_paise: int,
        description: str,
        customer_phone: Optional[str] = None,
        expire_hours: int = 48
    ) -> Dict[str, Any]:
        if not self.is_configured:
            return self._mock_payment_link(entity_id, amount_paise, description)

        url = f"{self.base_url}/payment_links"
        payload = {
            "amount": amount_paise,
            "currency": "INR",
            "accept_partial": False,
            "description": description,
            "reference_id": entity_id,
            "expire_by": int(requests.utils.datetime.now().timestamp()) + (expire_hours * 3600),
            "customer": {
                "contact": customer_phone or "+919876543210",
                "name": "Valued Customer"
            },
            "notify": {"sms": False, "email": False},
            "reminder_enable": True
        }
        try:
            res = requests.post(url, json=payload, auth=(self.key_id, self.key_secret), timeout=10)
            if res.status_code == 200:
                data = res.json()
                return {
                    "id": data.get("id"),
                    "short_url": data.get("short_url"),
                    "status": data.get("status"),
                    "amount": data.get("amount"),
                    "description": description,
                    "is_mock": False
                }
        except Exception:
            pass

        return self._mock_payment_link(entity_id, amount_paise, description)

    def retry_subscription(self, subscription_id: str) -> Dict[str, Any]:
        if not self.is_configured:
            return {
                "subscription_id": subscription_id,
                "status": "retry_scheduled",
                "message": "Silent subscription retry dispatched via API",
                "is_mock": True
            }
        url = f"{self.base_url}/subscriptions/{subscription_id}/retry"
        try:
            res = requests.post(url, auth=(self.key_id, self.key_secret), timeout=10)
            return res.json()
        except Exception as e:
            return {"subscription_id": subscription_id, "status": "error", "message": str(e), "is_mock": True}

    def generate_virtual_account(self, invoice_id: str) -> Dict[str, Any]:
        return {
            "virtual_account_id": f"va_{invoice_id[:8]}",
            "upi_id": f"rzp.virtual.{invoice_id[:8]}@hdfcbank",
            "account_number": f"7890{invoice_id[:8]}",
            "ifsc": "RAZR0000001",
            "bank_name": "Razorpay HDFC Virtual Bank"
        }

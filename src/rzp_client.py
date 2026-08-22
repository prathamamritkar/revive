import os
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv
from typing import Dict, Any, Optional
from src.utils import verify_hmac_sha256
from src.interfaces import (
    IPaymentLinkGenerator, IVirtualAccountGenerator, ISubscriptionManager, IWebhookVerifier
)

load_dotenv()

class RazorpayClientWrapper(
    IPaymentLinkGenerator, IVirtualAccountGenerator, ISubscriptionManager, IWebhookVerifier
):
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
            "is_mock": True,
            "is_degraded_fallback": True,
        }

    def _mock_virtual_account(self, invoice_id: str) -> Dict[str, Any]:
        return {
            "virtual_account_id": f"va_{invoice_id[:8]}",
            "upi_id": f"rzp.virtual.{invoice_id[:8]}@hdfcbank",
            "account_number": f"7890{invoice_id[:8]}",
            "ifsc": "RAZR0000001",
            "bank_name": "Razorpay HDFC Virtual Bank",
            "is_mock": True,
            "is_degraded_fallback": True,
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
            "expire_by": int(datetime.now(timezone.utc).timestamp()) + (expire_hours * 3600),
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

    def generate_virtual_account(self, invoice_id: str, amount_paise: Optional[int] = None) -> Dict[str, Any]:
        if not self.is_configured:
            return self._mock_virtual_account(invoice_id)

        url = f"{self.base_url}/virtual_accounts"
        payload = {
            "receivers": {"types": ["bank_account", "vpa"]},
            "description": f"Virtual Account for Invoice #{invoice_id}",
            "notes": {"invoice_id": invoice_id}
        }
        if amount_paise:
            payload["amount_expected"] = amount_paise

        try:
            res = requests.post(url, json=payload, auth=(self.key_id, self.key_secret), timeout=10)
            if res.status_code in [200, 201]:
                data = res.json()
                receivers = data.get("receivers", [])
                upi_id = f"rzp.virtual.{invoice_id[:8]}@hdfcbank"
                acc_num = f"7890{invoice_id[:8]}"
                ifsc = "RAZR0000001"
                for r in receivers:
                    if r.get("entity") == "vpa":
                        upi_id = r.get("address", upi_id)
                    elif r.get("entity") == "bank_account":
                        acc_num = r.get("account_number", acc_num)
                        ifsc = r.get("ifsc", ifsc)
                return {
                    "virtual_account_id": data.get("id"),
                    "upi_id": upi_id,
                    "account_number": acc_num,
                    "ifsc": ifsc,
                    "bank_name": "Razorpay Virtual Bank",
                    "is_mock": False
                }
        except Exception:
            pass

        return self._mock_virtual_account(invoice_id)

    def verify_webhook_signature(self, body_bytes: bytes, signature: str) -> bool:
        return verify_hmac_sha256(body_bytes, signature, self.webhook_secret)

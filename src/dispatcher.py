import os
from typing import Dict, Any, List
from dotenv import load_dotenv
from src.schemas import DispatchRequest, ChannelType

load_dotenv()

class WhatsAppDispatcher:
    def __init__(self):
        self.use_mock = os.getenv("USE_MOCK_DISPATCHER", "true").lower() in ["true", "1", "yes"]
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
        self.from_whatsapp = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")
        self.mock_log: List[Dict[str, Any]] = []

    def dispatch(self, request: DispatchRequest) -> Dict[str, Any]:
        target = request.phone_number
        if not target.startswith("whatsapp:"):
            target = f"whatsapp:{target}"

        content = request.message
        if request.payment_url and request.payment_url not in content:
            content += f"\n\nPay securely here: {request.payment_url}"

        if self.use_mock or not (self.account_sid and not self.account_sid.startswith("ACXXXX")):
            entry = {
                "dispatch_id": f"disp_mock_{len(self.mock_log) + 1:03d}",
                "to": target,
                "from": self.from_whatsapp,
                "message": content,
                "payment_url": request.payment_url,
                "channel": request.channel.value,
                "status": "SENT_MOCK",
                "timestamp": os.getenv("CURRENT_TIME", "2026-08-22 17:00:00")
            }
            self.mock_log.append(entry)
            return entry

        try:
            from twilio.rest import Client
            client = Client(self.account_sid, self.auth_token)
            msg = client.messages.create(
                from_=self.from_whatsapp,
                body=content,
                to=target
            )
            entry = {
                "dispatch_id": msg.sid,
                "to": target,
                "from": self.from_whatsapp,
                "message": content,
                "payment_url": request.payment_url,
                "channel": request.channel.value,
                "status": msg.status,
                "timestamp": str(msg.date_created)
            }
            self.mock_log.append(entry)
            return entry
        except Exception as e:
            entry = {
                "dispatch_id": f"disp_err_{len(self.mock_log) + 1:03d}",
                "to": target,
                "from": self.from_whatsapp,
                "message": content,
                "payment_url": request.payment_url,
                "channel": request.channel.value,
                "status": "FAILED",
                "error": str(e)
            }
            self.mock_log.append(entry)
            return entry

    def get_dispatch_history(self) -> List[Dict[str, Any]]:
        return self.mock_log

    @property
    def dispatch_log(self) -> List[Dict[str, Any]]:
        return self.mock_log

    @dispatch_log.setter
    def dispatch_log(self, value: List[Dict[str, Any]]) -> None:
        self.mock_log = value

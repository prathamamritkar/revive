import os
from typing import Dict, Any, List
from dotenv import load_dotenv
from src.schemas import DispatchRequest, ChannelType, redact_pii

load_dotenv()

def generate_hinglish_voice_twiml(customer_name: str, amount_inr: float, order_id: str) -> str:
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="hi-IN" voice="Polly.Aditi">
        Namaste {customer_name}. Aapka Razorpay order reference {order_id[-4:]} ka payment network timeout ki wajah se complete nahi ho paya.
        Humne aapke registered WhatsApp number par ek secure 1-click payment link bhej diya hai. 
        Kripya link par click karke apna order confirm karein. Amount: Rupee {amount_inr:,.2f}. Dhanyawad!
    </Say>
</Response>"""
    return twiml

class WhatsAppDispatcher:
    def __init__(self):
        self.use_mock = os.getenv("USE_MOCK_DISPATCHER", "true").lower() in ["true", "1", "yes"]
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
        self.from_whatsapp = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")
        self.mock_log: List[Dict[str, Any]] = []

    def dispatch(self, request: DispatchRequest) -> Dict[str, Any]:
        target = request.phone_number
        if request.channel == ChannelType.WHATSAPP_HINGLISH and not target.startswith("whatsapp:"):
            target = f"whatsapp:{target}"

        content = request.message
        if request.payment_url and request.payment_url not in content:
            content += f"\n\nPay securely here: {request.payment_url}"

        if request.channel == ChannelType.VOICE_IVR_NUDGE:
            voice_script = f"IVR OUTBOUND CALL [Hinglish]: Namaste! Razorpay AI Recovery Assistant calling for {target}. {content}"
            if not self.use_mock and self.account_sid and not self.account_sid.startswith("ACXXXX"):
                try:
                    from twilio.rest import Client
                    client = Client(self.account_sid, self.auth_token)
                    phone_clean = target.replace("whatsapp:", "")
                    from_phone = os.getenv("TWILIO_VOICE_NUMBER", self.from_whatsapp.replace("whatsapp:", ""))
                    call = client.calls.create(
                        twiml=f'<Response><Say language="hi-IN">{content}</Say></Response>',
                        to=phone_clean,
                        from_=from_phone
                    )
                    entry = {
                        "dispatch_id": call.sid,
                        "to": target,
                        "from": from_phone,
                        "message": voice_script,
                        "payment_url": request.payment_url,
                        "channel": request.channel.value,
                        "status": call.status,
                        "voice_transcript": voice_script,
                        "timestamp": os.getenv("CURRENT_TIME", "2026-08-22 17:00:00")
                    }
                    self.mock_log.append(entry)
                    return entry
                except Exception as e:
                    pass

            entry = {
                "dispatch_id": f"voice_mock_{len(self.mock_log) + 1:03d}",
                "to": target,
                "from": "IVR_AUTOMATED_SPOKEN_CALL",
                "message": voice_script,
                "payment_url": request.payment_url,
                "channel": request.channel.value,
                "status": "CALL_COMPLETED_MOCK",
                "voice_transcript": voice_script,
                "timestamp": os.getenv("CURRENT_TIME", "2026-08-22 17:00:00")
            }
            self.mock_log.append(entry)
            return entry

        if request.channel == ChannelType.HUMAN_ESCALATION:
            entry = {
                "dispatch_id": f"esc_mock_{len(self.mock_log) + 1:03d}",
                "to": "FINANCE_OPS_QUEUE",
                "from": target,
                "message": f"ESCALATED TO HUMAN: {content}",
                "payment_url": request.payment_url,
                "channel": request.channel.value,
                "status": "ESCALATED",
                "timestamp": os.getenv("CURRENT_TIME", "2026-08-22 17:00:00")
            }
            self.mock_log.append(entry)
            return entry

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

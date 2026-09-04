import logging
import os
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv
from src.schemas import DispatchRequest, ChannelType, redact_pii
from src.utils import build_dispatch_entry
from src.interfaces import IDispatcher, IDispatchHistory

load_dotenv()

log = logging.getLogger(__name__)


def generate_hinglish_voice_twiml(customer_name: str, amount_paise: int, order_id: str) -> str:
    """Generates bilingual Hinglish TwiML XML with Amazon Polly Aditi neural voice and en-IN fallback."""
    amount_inr = amount_paise / 100.0
    ref_short = order_id[-4:] if len(order_id) >= 4 else order_id
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="hi-IN" voice="Polly.Aditi">
        Namaste {customer_name}. Aapka order reference {ref_short} ka payment network issue ki wajah se complete nahi ho paya.
    </Say>
    <Say language="en-IN">
        Your pending transaction amount is Rupees {amount_inr:,.2f}. We have dispatched an instant 1-click payment link directly to your WhatsApp.
    </Say>
    <Say language="hi-IN" voice="Polly.Aditi">
        Kripya WhatsApp link par click karke payment confirm karein. Agar aap kal pay karna chahte hain toh ek dabayein. Dhanyawad!
    </Say>
</Response>"""


def generate_twiml_voice_recovery(customer_name: str, amount_inr: float, reference_id: str) -> str:
    """Backward-compatible voice recovery generator for test_suite and legacy endpoints."""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="hi-IN" voice="Polly.Aditi">
        Namaste {customer_name}. Aapka order reference {reference_id[-4:]} ka payment network issue ki wajah se complete nahi ho paya.
        Humne aapke WhatsApp par ek secure payment link bhej diya hai. 
        Kripya link par click karke payment confirm karein. Dhanyawad!
    </Say>
</Response>"""


def synthesize_mock_audio_manifest(order_id: str, script: str) -> Dict[str, Any]:
    """Generates structured JSON payload for browser audio playback and telephony UI."""
    ref_short = order_id[-4:] if len(order_id) >= 4 else order_id
    return {
        "order_id": order_id,
        "engine": "Polly.Aditi",
        "voice_language": "hi-IN",
        "script": script,
        "audio_format": "audio/mp3",
        "audio_url": f"https://cdn.revive.internal/audio/synthetic_{order_id}.mp3",
        "duration_seconds": max(5, min(30, len(script) // 15)),
        "is_mock": True,
        "dtmf_options": {
            "1": "Schedule Promise-To-Pay for tomorrow 10:00 AM IST",
            "2": "Resend 1-Click WhatsApp payment link",
            "3": "Transfer call to human support agent"
        },
        "telemetry_ref": f"ivr_audio_{ref_short}",
    }


# --- OCP & LSP: Communication Channel Extensibility & Behavioral Subtyping ---

class BaseChannelHandler(ABC):
    @abstractmethod
    def supports(self, channel: ChannelType) -> bool:
        pass

    @abstractmethod
    def handle(self, request: DispatchRequest, dispatcher: 'SentinelDispatcher', target: str, content: str) -> Dict[str, Any]:
        pass


class VoiceIVRChannelHandler(BaseChannelHandler):
    def supports(self, channel: ChannelType) -> bool:
        return channel == ChannelType.VOICE_IVR_NUDGE

    def handle(self, request: DispatchRequest, dispatcher: 'SentinelDispatcher', target: str, content: str) -> Dict[str, Any]:
        voice_script = f"IVR OUTBOUND CALL [Hinglish]: Namaste! Revive AI Recovery Assistant calling for {target}. {content}"
        if dispatcher.is_live_twilio:
            try:
                from twilio.rest import Client
                client = Client(dispatcher.account_sid, dispatcher.auth_token)
                phone_clean = target.replace("whatsapp:", "")
                from_phone = os.getenv("TWILIO_VOICE_NUMBER", dispatcher.from_whatsapp.replace("whatsapp:", ""))
                call = client.calls.create(
                    twiml=f'<Response><Say language="hi-IN">{content}</Say></Response>',
                    to=phone_clean,
                    from_=from_phone,
                )
                return dispatcher._log(build_dispatch_entry(
                    dispatch_id=call.sid,
                    to=target,
                    frm=from_phone,
                    message=voice_script,
                    payment_url=request.payment_url,
                    channel=request.channel.value,
                    status=call.status,
                    voice_transcript=voice_script,
                ))
            except Exception as exc:
                log.warning("Twilio Voice IVR dispatch failed, falling back to mock: %s", exc)

        return dispatcher._log(build_dispatch_entry(
            dispatch_id=dispatcher._next_mock_id("voice_mock"),
            to=target,
            frm="IVR_AUTOMATED_SPOKEN_CALL",
            message=voice_script,
            payment_url=request.payment_url,
            channel=request.channel.value,
            status="CALL_COMPLETED_MOCK",
            voice_transcript=voice_script,
            is_degraded_fallback=True,
        ))


class HumanEscalationChannelHandler(BaseChannelHandler):
    def supports(self, channel: ChannelType) -> bool:
        return channel == ChannelType.HUMAN_ESCALATION

    def handle(self, request: DispatchRequest, dispatcher: 'SentinelDispatcher', target: str, content: str) -> Dict[str, Any]:
        return dispatcher._log(build_dispatch_entry(
            dispatch_id=dispatcher._next_mock_id("esc_mock"),
            to="FINANCE_OPS_QUEUE",
            frm=target,
            message=f"ESCALATED TO HUMAN: {content}",
            payment_url=request.payment_url,
            channel=request.channel.value,
            status="ESCALATED",
        ))


class SilentApiRetryChannelHandler(BaseChannelHandler):
    def supports(self, channel: ChannelType) -> bool:
        return channel == ChannelType.SILENT_API_RETRY

    def handle(self, request: DispatchRequest, dispatcher: 'SentinelDispatcher', target: str, content: str) -> Dict[str, Any]:
        return dispatcher._log(build_dispatch_entry(
            dispatch_id=dispatcher._next_mock_id("silent_api_mock"),
            to="REVIVE_RETRY_ENGINE",
            frm="REVIVE_SILENT_API",
            message=content,
            payment_url=request.payment_url,
            channel=request.channel.value,
            status="SILENT_RETRY_SCHEDULED",
        ))


class WhatsAppChannelHandler(BaseChannelHandler):
    def supports(self, channel: ChannelType) -> bool:
        return channel == ChannelType.WHATSAPP_HINGLISH

    def handle(self, request: DispatchRequest, dispatcher: 'SentinelDispatcher', target: str, content: str) -> Dict[str, Any]:
        if not dispatcher.is_live_twilio:
            return dispatcher._log(build_dispatch_entry(
                dispatch_id=dispatcher._next_mock_id("disp_mock"),
                to=target,
                frm=dispatcher.from_whatsapp,
                message=content,
                payment_url=request.payment_url,
                channel=request.channel.value,
                status="SENT_MOCK",
            ))

        try:
            from twilio.rest import Client
            client = Client(dispatcher.account_sid, dispatcher.auth_token)
            msg = client.messages.create(from_=dispatcher.from_whatsapp, body=content, to=target)
            return dispatcher._log(build_dispatch_entry(
                dispatch_id=msg.sid,
                to=target,
                frm=dispatcher.from_whatsapp,
                message=content,
                payment_url=request.payment_url,
                channel=request.channel.value,
                status=msg.status,
                timestamp=str(msg.date_created),
            ))
        except Exception as e:
            return dispatcher._log(build_dispatch_entry(
                dispatch_id=dispatcher._next_mock_id("disp_err"),
                to=target,
                frm=dispatcher.from_whatsapp,
                message=content,
                payment_url=request.payment_url,
                channel=request.channel.value,
                status="FAILED",
                error=str(e),
            ))


class ChannelHandlerRegistry:
    def __init__(self):
        self.handlers: List[BaseChannelHandler] = [
            VoiceIVRChannelHandler(),
            HumanEscalationChannelHandler(),
            SilentApiRetryChannelHandler(),
            WhatsAppChannelHandler(),
        ]

    def register(self, handler: BaseChannelHandler, priority_index: Optional[int] = 0) -> None:
        if priority_index is not None:
            self.handlers.insert(priority_index, handler)
        else:
            self.handlers.append(handler)

    def handle(self, request: DispatchRequest, dispatcher: 'SentinelDispatcher', target: str, content: str) -> Dict[str, Any]:
        for h in self.handlers:
            if h.supports(request.channel):
                return h.handle(request, dispatcher, target, content)
        return WhatsAppChannelHandler().handle(request, dispatcher, target, content)


# --- ISP: Segregated Interfaces for Dispatching & History Access ---

class SentinelDispatcher(IDispatcher, IDispatchHistory):
    def __init__(self):
        self.use_mock = os.getenv("USE_MOCK_DISPATCHER", "true").lower() in ["true", "1", "yes"]
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
        self.from_whatsapp = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")
        self.mock_log: List[Dict[str, Any]] = []
        self.handler_registry = ChannelHandlerRegistry()

    @property
    def is_live_twilio(self) -> bool:
        return not self.use_mock and bool(self.account_sid) and not self.account_sid.startswith("ACXXXX")

    def register_custom_handler(self, handler: BaseChannelHandler, priority_index: Optional[int] = 0) -> None:
        self.handler_registry.register(handler, priority_index)

    def _next_mock_id(self, prefix: str) -> str:
        return f"{prefix}_{len(self.mock_log) + 1:03d}"

    def _log(self, entry: Dict[str, Any]) -> Dict[str, Any]:
        self.mock_log.append(entry)
        return entry

    def dispatch(self, request: DispatchRequest) -> Dict[str, Any]:
        target = request.phone_number
        if request.channel == ChannelType.WHATSAPP_HINGLISH and not target.startswith("whatsapp:"):
            target = f"whatsapp:{target}"

        content = request.message
        if request.payment_url and request.payment_url not in content:
            content += f"\n\nPay securely here: {request.payment_url}"

        return self.handler_registry.handle(request, self, target, content)

    def get_dispatch_history(self) -> List[Dict[str, Any]]:
        return self.mock_log

    @property
    def dispatch_log(self) -> List[Dict[str, Any]]:
        return self.mock_log

    @dispatch_log.setter
    def dispatch_log(self, value: List[Dict[str, Any]]) -> None:
        self.mock_log = value


# Canonical multi-channel dispatcher name & backward-compatible alias
WhatsAppDispatcher = SentinelDispatcher

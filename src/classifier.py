import json
import logging
import os
import urllib.request
from abc import ABC, abstractmethod
from typing import Optional, List

from pydantic import BaseModel
from src.schemas import TelemetryEvent, FailureClassification, AIIntentResponse
from src.constants import EVIDENCE_CONFIDENCE_THRESHOLD

log = logging.getLogger(__name__)

_VALID_CLASSIFICATIONS = {c.value for c in FailureClassification}

_SYSTEM_PROMPT = (
    "You are Revive — an intelligent payment-failure classifier.\n\n"
    "Given an unstructured text describing a payment failure, respond ONLY with a valid JSON object "
    "(no markdown, no commentary) matching this schema exactly:\n\n"
    "{\n"
    '  "classification": "<TRANSIENT_NETWORK_DOWN|TRANSIENT_BALANCE_LOW|TERMINAL_ACCOUNT_CLOSED|TERMINAL_AUTH_REJECTED|ABANDONED_CHECKOUT|B2B_OVERDUE_INVOICE>",\n'
    '  "confidence": <float 0.0-1.0>,\n'
    '  "detected_intent": "<one-sentence description of the inferred customer situation>",\n'
    '  "urgency_level": "<LOW|MEDIUM|HIGH|CRITICAL>",\n'
    '  "suggested_tone": "<terse CamelCase tone token>"\n'
    "}\n\n"
    "Rules:\n"
    "- TERMINAL_* classifications must have confidence >= 0.85.\n"
    "- When uncertain, prefer TRANSIENT_NETWORK_DOWN over any TERMINAL_* class.\n"
    "- Never invent classification values outside the allowed set.\n"
    "- Never add extra JSON fields."
)


def _parse_llm_json(raw: str, text_payload: str) -> Optional[AIIntentResponse]:
    try:
        data = json.loads(raw.strip())
        cls_val = data.get("classification", "")
        if cls_val not in _VALID_CLASSIFICATIONS:
            raise ValueError(f"Unknown classification: {cls_val}")
        return AIIntentResponse(
            classification=FailureClassification(cls_val),
            confidence=float(data.get("confidence", 0.80)),
            detected_intent=str(data.get("detected_intent", "")),
            urgency_level=str(data.get("urgency_level", "MEDIUM")),
            suggested_tone=str(data.get("suggested_tone", "LLM_CLASSIFIED")),
            evidence_source="LLM_SEMANTIC_REASONER",
            evidence_payload=text_payload[:128],
        )
    except Exception as exc:
        log.warning("LLM JSON parse failed (%s); falling back to keyword classifier", exc)
        return None


# --- OCP: LLM Provider Extensibility ---

class BaseLLMProvider(ABC):
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    def generate(self, text_payload: str) -> Optional[AIIntentResponse]:
        pass


class GeminiLLMProvider(BaseLLMProvider):
    def name(self) -> str:
        return "Gemini"

    def generate(self, text_payload: str) -> Optional[AIIntentResponse]:
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            return None
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
            model = genai.GenerativeModel(model_name=model_name, system_instruction=_SYSTEM_PROMPT)
            resp = model.generate_content(text_payload)
            raw = resp.text or ""
            log.info("Gemini classifier invoked (model=%s)", model_name)
            return _parse_llm_json(raw, text_payload)
        except Exception as exc:
            log.warning("Gemini classifier error: %s", exc)
            return None


class OllamaLLMProvider(BaseLLMProvider):
    def name(self) -> str:
        return "Ollama"

    def generate(self, text_payload: str) -> Optional[AIIntentResponse]:
        host = os.getenv("OLLAMA_HOST")
        if not host:
            return None
        try:
            model_name = os.getenv("OLLAMA_MODEL", "llama3")
            payload = json.dumps({
                "model": model_name,
                "system": _SYSTEM_PROMPT,
                "prompt": text_payload,
                "stream": False,
            }).encode()
            url = host.rstrip("/") + "/api/generate"
            req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=15) as r:
                data = json.loads(r.read())
            raw = data.get("response", "")
            log.info("Ollama classifier invoked (model=%s, host=%s)", model_name, host)
            return _parse_llm_json(raw, text_payload)
        except Exception as exc:
            log.warning("Ollama classifier error: %s", exc)
            return None


class KeywordFallbackLLMProvider(BaseLLMProvider):
    def name(self) -> str:
        return "KeywordFallback"

    def generate(self, text_payload: str) -> Optional[AIIntentResponse]:
        t = text_payload.lower()
        if any(k in t for k in ("salary", "next week", "pay on", "insufficient", "balance")):
            return AIIntentResponse(
                classification=FailureClassification.TRANSIENT_BALANCE_LOW,
                confidence=0.88,
                detected_intent="Customer experiencing temporary cash flow delay before payroll",
                urgency_level="LOW",
                suggested_tone="EMPATHETIC_SALARY_CYCLE_REMINDER",
                evidence_source="KEYWORD_REASONER",
                evidence_payload=text_payload[:128],
            )
        if any(k in t for k in ("timeout", "gateway", "slow", "bank down")):
            return AIIntentResponse(
                classification=FailureClassification.TRANSIENT_NETWORK_DOWN,
                confidence=0.85,
                detected_intent="Issuer bank CBS timeout during payment handshake",
                urgency_level="HIGH",
                suggested_tone="TRANSACTIONAL_SILENT_RETRY",
                evidence_source="KEYWORD_REASONER",
                evidence_payload=text_payload[:128],
            )
        if any(k in t for k in ("expired", "blocked", "closed", "revoked", "cancelled card", "closed account")):
            return AIIntentResponse(
                classification=FailureClassification.TERMINAL_ACCOUNT_CLOSED,
                confidence=0.95,
                detected_intent="Terminal instrument invalidity — card expired or mandate revoked",
                urgency_level="CRITICAL",
                suggested_tone="TERMINAL_ZERO_TOUCH_HALT",
                evidence_source="KEYWORD_REASONER",
                evidence_payload=text_payload[:128],
            )
        if any(k in t for k in ("dispute", "wrong amount", "cancel subscription", "cancel mandate", "cancellation")):
            return AIIntentResponse(
                classification=FailureClassification.TERMINAL_AUTH_REJECTED,
                confidence=0.85,
                detected_intent="Customer active billing dispute or manual payment cancellation",
                urgency_level="HIGH",
                suggested_tone="HUMAN_ESCALATION_REQUIRED",
                evidence_source="KEYWORD_REASONER",
                evidence_payload=text_payload[:128],
            )
        return AIIntentResponse(
            classification=FailureClassification.TERMINAL_AUTH_REJECTED,
            confidence=0.0,
            detected_intent="Ambiguous payment drop-off — uncertain classification, fail-safe halt",
            urgency_level="CRITICAL",
            suggested_tone="TERMINAL_ZERO_TOUCH_HALT",
            evidence_source="KEYWORD_REASONER",
            evidence_payload=text_payload[:128],
        )


class LLMProviderRegistry:
    def __init__(self):
        self.providers: List[BaseLLMProvider] = [
            GeminiLLMProvider(),
            OllamaLLMProvider(),
            KeywordFallbackLLMProvider(),
        ]

    def register(self, provider: BaseLLMProvider, priority_index: Optional[int] = None) -> None:
        if priority_index is not None:
            self.providers.insert(priority_index, provider)
        else:
            # Insert before default keyword fallback
            self.providers.insert(len(self.providers) - 1, provider)

    def analyze(self, text_payload: str) -> AIIntentResponse:
        for provider in self.providers:
            res = provider.generate(text_payload)
            if res:
                return res
        # Non-Negotiable Fail-Safe Default (AGENTS.md Invariant #1)
        return AIIntentResponse(
            classification=FailureClassification.TERMINAL_AUTH_REJECTED,
            confidence=0.0,
            detected_intent="Uncertain classification — defaulting to fail-safe zero-touch halt",
            urgency_level="CRITICAL",
            suggested_tone="TERMINAL_ZERO_TOUCH_HALT",
        )


_LLM_REGISTRY = LLMProviderRegistry()


def register_llm_provider(provider: BaseLLMProvider, priority_index: Optional[int] = None) -> None:
    _LLM_REGISTRY.register(provider, priority_index)


def analyze_unstructured_dropoff(text_payload: str) -> AIIntentResponse:
    return _LLM_REGISTRY.analyze(text_payload)


# --- OCP: Diagnostic Rule Extensibility ---

class BaseDiagnosticRule(ABC):
    @abstractmethod
    def evaluate(self, event: TelemetryEvent, bank_cbs_health: dict) -> Optional[FailureClassification]:
        pass


class EventTypeRule(BaseDiagnosticRule):
    def evaluate(self, event: TelemetryEvent, bank_cbs_health: dict) -> Optional[FailureClassification]:
        if event.event_type == "invoice.overdue":
            return FailureClassification.B2B_OVERDUE_INVOICE
        if event.event_type == "checkout.dropped":
            return FailureClassification.ABANDONED_CHECKOUT
        return None


class NetworkTimeoutRule(BaseDiagnosticRule):
    def evaluate(self, event: TelemetryEvent, bank_cbs_health: dict) -> Optional[FailureClassification]:
        error = (event.raw_error_code or "").upper()
        bank_info = bank_cbs_health.get(event.issuing_bank or "", {"status": "HEALTHY"})
        if "TIMEOUT" in error or "GATEWAY_ERROR" in error or bank_info.get("status") == "DEGRADED":
            return FailureClassification.TRANSIENT_NETWORK_DOWN
        return None


class InsufficientFundsRule(BaseDiagnosticRule):
    def evaluate(self, event: TelemetryEvent, bank_cbs_health: dict) -> Optional[FailureClassification]:
        error = (event.raw_error_code or "").upper()
        if "INSUFFICIENT_FUNDS" in error or "BALANCE_LOW" in error:
            return FailureClassification.TRANSIENT_BALANCE_LOW
        return None


class TerminalAccountRule(BaseDiagnosticRule):
    def evaluate(self, event: TelemetryEvent, bank_cbs_health: dict) -> Optional[FailureClassification]:
        error = (event.raw_error_code or "").upper()
        if "CARD_EXPIRED" in error or "MANDATE_REVOKED" in error or "ACCOUNT_BLOCKED" in error:
            return FailureClassification.TERMINAL_ACCOUNT_CLOSED
        return None


class DiagnosticRuleRegistry:
    def __init__(self):
        self.rules: List[BaseDiagnosticRule] = [
            EventTypeRule(),
            NetworkTimeoutRule(),
            InsufficientFundsRule(),
            TerminalAccountRule(),
        ]

    def register(self, rule: BaseDiagnosticRule, priority_index: Optional[int] = None) -> None:
        if priority_index is not None:
            self.rules.insert(priority_index, rule)
        else:
            self.rules.append(rule)

    def evaluate_all(self, event: TelemetryEvent, bank_cbs_health: dict) -> FailureClassification:
        for rule in self.rules:
            res = rule.evaluate(event, bank_cbs_health)
            if res:
                return res
        return FailureClassification.TERMINAL_AUTH_REJECTED


class SemanticReasoningOutput(BaseModel):
    classification: FailureClassification
    confidence: float
    detected_intent: str
    suggested_tone: str


class TelemetryClassifier:
    def __init__(self):
        self.bank_cbs_health = {
            "HDFC": {"status": "DEGRADED", "avg_recovery_mins": 45},
            "SBIN": {"status": "HEALTHY",  "avg_recovery_mins": 0},
            "ICIC": {"status": "HEALTHY",  "avg_recovery_mins": 0},
            "UTIB": {"status": "DEGRADED", "avg_recovery_mins": 30},
            "KKBK": {"status": "DEGRADED", "avg_recovery_mins": 60},
        }
        self.rule_registry = DiagnosticRuleRegistry()

    def register_custom_rule(self, rule: BaseDiagnosticRule, priority_index: Optional[int] = None) -> None:
        self.rule_registry.register(rule, priority_index)

    def diagnose_deterministic(self, event: TelemetryEvent) -> Optional[FailureClassification]:
        return self.rule_registry.evaluate_all(event, self.bank_cbs_health)

    def diagnose_with_ai_fallback(self, unstructured_text: str) -> SemanticReasoningOutput:
        intent = analyze_unstructured_dropoff(unstructured_text)
        return SemanticReasoningOutput(
            classification=intent.classification,
            confidence=intent.confidence,
            detected_intent=intent.detected_intent,
            suggested_tone=intent.suggested_tone,
        )

    def diagnose(self, event: TelemetryEvent) -> FailureClassification:
        return self.rule_registry.evaluate_all(event, self.bank_cbs_health)

    def diagnose_with_ai(self, event: TelemetryEvent, customer_note: Optional[str] = None) -> AIIntentResponse:
        if customer_note or (event.raw_error_code and len(event.raw_error_code) > 15):
            query_text = customer_note or event.raw_error_code or ""
            return analyze_unstructured_dropoff(query_text)

        base_cls = self.diagnose(event)
        return AIIntentResponse(
            classification=base_cls,
            confidence=0.96,
            detected_intent=f"Deterministic CBS diagnostic signature for {event.event_type}",
            urgency_level="MEDIUM",
            suggested_tone="REVIVE_DETERMINISTIC_POLICY",
        )

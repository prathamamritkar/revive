"""
Autonomous Intervention Agent
================================
Prior state: "AGENTIC_AUTONOMOUS" mode selected an intervention by walking
a hard-coded strategy list and returning the first regex/attribute match
(RecoveryStrategyRegistry.find_strategy). No model reasoned about anything;
the LLM in this codebase only ever classified free-text drop-off notes
(src/classifier.py). The "agentic trace" attached to every decision was a
fixed f-string template, not the record of an actual decision process.

This module makes the intervention DECISION itself agentic: given a
bounded, pre-approved menu of legal candidate actions (computed
deterministically — see RecoveryStrategyRegistry.find_candidates in
src/orchestrator.py), an LLM reasons over the specific context and picks
one, with a rationale that gets written into the audit ledger's decision
trace.

Design boundary — what stays deterministic and why:
  The candidate menu itself, the TRAI Chrono-Gate, the PTP lock, the MDP
  mathematical stopping rule, the terminal-failure 0-touch halt, and the
  mandate execution-attempt ceiling (src/mandate_policy.py) are NOT put
  under LLM control. Those encode regulatory bounds and a closed-form
  yield formula — letting a model reason its way past a compliance window
  or an attempt cap would be a regression, not an improvement. The LLM's
  authority is scoped to: given a set of already-legal options, which one
  actually fits this case. That mirrors how src/classifier.py already
  separates deterministic CBS error-code parsing from LLM-based intent
  reasoning on ambiguous free text — same pattern, applied to the
  intervention-selection step instead of the diagnosis step.

Safety property: a selection outside the supplied candidate set is treated
as an invalid response and discarded, falling through the provider chain
to the deterministic fallback — the same fail-safe pattern already used by
LLMProviderRegistry in src/classifier.py.
"""
import json
import logging
import os
import urllib.request
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from src.schemas import ChannelType, FailureClassification

log = logging.getLogger(__name__)


class CandidateOption(BaseModel):
    """One pre-approved, policy-legal action the agent may choose."""
    model_config = ConfigDict(frozen=True)
    strategy_name: str
    channel: ChannelType
    expected_net_yield_paise: int
    success_probability: float
    channel_cost_paise: int


class InterventionContext(BaseModel):
    """Everything the agent is given to reason over. No field here is
    itself a lever the agent can pull outside the candidate list."""
    model_config = ConfigDict(frozen=True)
    entity_id: str
    classification: FailureClassification
    attempt: int
    amount_inr: float
    issuing_bank: Optional[str] = None
    candidates: List[CandidateOption]
    mandate_context: Optional[Dict[str, Any]] = None
    ptp_status: Optional[str] = None
    customer_note: Optional[str] = None


class AgenticInterventionDecision(BaseModel):
    selected_strategy_name: str
    reasoning: str
    confidence: float = Field(default=0.85, ge=0.0, le=1.0)
    escalate_to_human: bool = False
    decision_source: str = "DETERMINISTIC_FALLBACK"


_AGENT_SYSTEM_PROMPT = (
    "You are the Revive Autonomous Intervention Agent, a revenue-recovery decision agent "
    "for an Indian payments platform. You choose exactly ONE recovery action for a single "
    "at-risk payment event, from a fixed menu of pre-approved, policy-compliant candidate "
    "actions supplied to you. You never invent an action outside that menu.\n\n"
    "You will receive JSON describing: the failure classification, attempt number, amount, "
    "issuing bank, any mandate-execution constraints, prior promise-to-pay status, and a list "
    "of candidate options — each with a strategy_name, channel, expected net recovery yield "
    "in paise, success probability, and channel cost in paise.\n\n"
    "Decision guidance:\n"
    "- Prefer higher expected net yield, but override yield alone when a channel is a poor "
    "fit for the context: a B2B commercial receivable should not receive a casual consumer "
    "voice nudge; after repeated automated attempts, a corporate account is better served by "
    "escalation to a human Finance Ops contact than another automated message.\n"
    "- If mandate_context.npci_attempts_exhausted is true, you MUST NOT select a candidate "
    "that re-attempts a silent mandate debit; NPCI's execution-attempt ceiling has been hit "
    "for this cycle, so prefer a consumer/human-facing candidate or the one that best avoids "
    "a further silent retry.\n"
    "- Set escalate_to_human=true only when you select a HUMAN_ESCALATION channel candidate, "
    "or you judge the case now needs manual review beyond further automation.\n\n"
    "Respond ONLY with a valid JSON object, no markdown, no commentary, matching exactly:\n"
    "{\n"
    '  "selected_strategy_name": "<one of the supplied candidate strategy_name values, verbatim>",\n'
    '  "reasoning": "<2-3 sentences, specific to this context, not generic>",\n'
    '  "confidence": <float 0.0-1.0>,\n'
    '  "escalate_to_human": <true|false>\n'
    "}"
)


def _context_to_prompt_payload(context: InterventionContext) -> str:
    return json.dumps({
        "entity_id": context.entity_id,
        "classification": context.classification.value,
        "attempt": context.attempt,
        "amount_inr": context.amount_inr,
        "issuing_bank": context.issuing_bank,
        "mandate_context": context.mandate_context,
        "ptp_status": context.ptp_status,
        "customer_note": context.customer_note,
        "candidates": [
            {
                "strategy_name": c.strategy_name,
                "channel": c.channel.value,
                "expected_net_yield_paise": c.expected_net_yield_paise,
                "success_probability": c.success_probability,
                "channel_cost_paise": c.channel_cost_paise,
            }
            for c in context.candidates
        ],
    })


def _clean_json_str(raw: str) -> str:
    cleaned = raw.strip()
    if "```" in cleaned:
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    first_brace = cleaned.find("{")
    last_brace = cleaned.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        cleaned = cleaned[first_brace:last_brace + 1]
    return cleaned


def _parse_and_validate(raw: str, context: InterventionContext, decision_source: str) -> Optional[AgenticInterventionDecision]:
    valid_names = {c.strategy_name for c in context.candidates}
    try:
        data = json.loads(_clean_json_str(raw))
        chosen = data.get("selected_strategy_name", "")
        if chosen not in valid_names:
            raise ValueError(f"Agent selected '{chosen}', outside legal candidate set {valid_names}")
        return AgenticInterventionDecision(
            selected_strategy_name=chosen,
            reasoning=str(data.get("reasoning", "")),
            confidence=float(data.get("confidence", 0.85)),
            escalate_to_human=bool(data.get("escalate_to_human", False)),
            decision_source=decision_source,
        )
    except Exception as exc:
        log.warning("Agentic decision rejected (%s); falling through provider chain", exc)
        return None


class BaseInterventionProvider(ABC):
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    def decide(self, context: InterventionContext) -> Optional[AgenticInterventionDecision]:
        pass


class GeminiInterventionAgent(BaseInterventionProvider):
    def name(self) -> str:
        return "Gemini"

    def decide(self, context: InterventionContext) -> Optional[AgenticInterventionDecision]:
        if len(context.candidates) <= 1:
            return None  # nothing to reason about; let the fallback take the single candidate
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            return None
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model_name = os.getenv("GEMINI_AGENT_MODEL", os.getenv("GEMINI_MODEL", "gemini-3.6-flash"))
            model = genai.GenerativeModel(model_name=model_name, system_instruction=_AGENT_SYSTEM_PROMPT)
            resp = model.generate_content(_context_to_prompt_payload(context))
            raw = resp.text or ""
            log.info("Gemini intervention agent invoked (model=%s, entity=%s)", model_name, context.entity_id)
            return _parse_and_validate(raw, context, decision_source="LLM_AGENT_GEMINI")
        except Exception as exc:
            log.warning("Gemini intervention agent error: %s", exc)
            return None


class OllamaInterventionAgent(BaseInterventionProvider):
    def name(self) -> str:
        return "Ollama"

    def decide(self, context: InterventionContext) -> Optional[AgenticInterventionDecision]:
        if len(context.candidates) <= 1:
            return None
        host = os.getenv("OLLAMA_HOST")
        if not host:
            return None
        try:
            model_name = os.getenv("OLLAMA_AGENT_MODEL", os.getenv("OLLAMA_MODEL", "llama3"))
            payload = json.dumps({
                "model": model_name,
                "system": _AGENT_SYSTEM_PROMPT,
                "prompt": _context_to_prompt_payload(context),
                "stream": False,
            }).encode()
            url = host.rstrip("/") + "/api/generate"
            req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=15) as r:
                data = json.loads(r.read())
            raw = data.get("response", "")
            log.info("Ollama intervention agent invoked (model=%s, host=%s)", model_name, host)
            return _parse_and_validate(raw, context, decision_source="LLM_AGENT_OLLAMA")
        except Exception as exc:
            log.warning("Ollama intervention agent error: %s", exc)
            return None


class DeterministicFallbackInterventionAgent(BaseInterventionProvider):
    """Fail-safe default: preserves the pre-existing first-candidate behavior
    so the system degrades to the old deterministic policy, never to no
    decision at all, when no LLM is configured or available."""

    def name(self) -> str:
        return "DeterministicFallback"

    def decide(self, context: InterventionContext) -> Optional[AgenticInterventionDecision]:
        if not context.candidates:
            return None
        chosen = context.candidates[0]
        return AgenticInterventionDecision(
            selected_strategy_name=chosen.strategy_name,
            reasoning=(
                "No LLM agent available or confident for this decision; applied the "
                "deterministic first-eligible-candidate policy as a fail-safe default."
            ),
            confidence=0.75,
            escalate_to_human=(chosen.channel == ChannelType.HUMAN_ESCALATION),
            decision_source="DETERMINISTIC_FALLBACK",
        )


class InterventionAgentRegistry:
    def __init__(self):
        self.providers: List[BaseInterventionProvider] = [
            GeminiInterventionAgent(),
            OllamaInterventionAgent(),
            DeterministicFallbackInterventionAgent(),
        ]

    def register(self, provider: BaseInterventionProvider, priority_index: Optional[int] = None) -> None:
        if priority_index is not None:
            self.providers.insert(priority_index, provider)
        else:
            self.providers.insert(len(self.providers) - 1, provider)

    def decide(self, context: InterventionContext) -> Optional[AgenticInterventionDecision]:
        for provider in self.providers:
            result = provider.decide(context)
            if result:
                return result
        return None


_AGENT_REGISTRY = InterventionAgentRegistry()


def register_intervention_provider(provider: BaseInterventionProvider, priority_index: Optional[int] = None) -> None:
    _AGENT_REGISTRY.register(provider, priority_index)


def decide_intervention(context: InterventionContext) -> Optional[AgenticInterventionDecision]:
    return _AGENT_REGISTRY.decide(context)

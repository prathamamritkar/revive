# Revive — Central Master Architecture & Agent Guide (SSOT)

> **Single Source of Truth (SSOT), Architectural Boundaries & Non-Negotiable Invariants**

[← Back to Master Overview](./README.md) • [Technical Specifications (TECHNICAL.md)](./TECHNICAL.md) • [OpenSpec Roadmap (openspec/README.md)](./openspec/README.md)

---

## Core Invariant

> **AI/ML models classify, explain, and select among pre-validated candidate interventions; deterministic policy rules, TRAI chrono-gates, stopping invariants, and mathematical MDP compute those candidates, bound the model's choice to them, and execute.**

- Model output (error classification, and — in `AGENTIC_AUTONOMOUS` mode — intervention selection) is an evidence-bound candidate, never an unbounded autonomous decision: the model chooses only from a menu the deterministic layer already computed as legal, and an out-of-menu choice is discarded, not executed (see [src/agentic_agent.py](./src/agentic_agent.py)).
- Missing or uncertain classification defaults to `TERMINAL_AUTH_REJECTED` (halt), not an inferred optimistic action.
- Recovery results are reproducible from stored facts: `entity_id`, `classification`, `attempt_count`, `gross_amount_paise`, bank CBS state.
- Every payment state transition is an audited, SHA-256-hashed ledger block.

---

## Automation Modes

1. **Agentic Mode (`ExecutionMode.AGENTIC_AUTONOMOUS`)**: Evaluates telemetry, computes MDP net yield per legal candidate, delegates intervention *selection* to an LLM agent bounded to that deterministically-computed candidate set ([src/agentic_agent.py](./src/agentic_agent.py) — falls back to a deterministic first-candidate policy if no LLM is configured or its output fails validation), logs `AgenticDecisionTrace` with the real decision rationale and `decision_source`, and auto-approves the resulting intervention (`policy_approved = True`).
2. **Manual Mode (`ExecutionMode.MANUAL_POLICY_GATED`)**: Human-in-the-loop governance. The LLM agent is not invoked; the deterministic first-candidate policy proposes recovery actions (`policy_approved = False`) requiring manual operator signoff (`approve` or `reject`) before dispatching links or voice calls.

---

## Architectural Boundaries

| Boundary | Component | Mandatory Rule |
| --- | --- | --- |
| **Classifier** | [src/classifier.py](./src/classifier.py) | May parse error codes and CBS registry; **cannot** schedule actions or mutate ledger. |
| **Orchestrator** | [src/orchestrator.py](./src/orchestrator.py) | Enforces TRAI gate, PTP freeze, MDP stopping rules, mandate execution ceiling, and ExecutionMode signoff; computes the legal candidate set; **cannot** dispatch directly. |
| **Agentic Agent** | [src/agentic_agent.py](./src/agentic_agent.py) | May select one action from the orchestrator-supplied candidate set and record its rationale; **cannot** select outside that set, invoke a channel directly, or override TRAI/PTP/MDP/mandate invariants. |
| **Dispatcher** | [src/dispatcher.py](./src/dispatcher.py) | May send WhatsApp messages, trigger Twilio Voice IVR calls, or create payment links/accounts; **cannot** mutate ledger or retry policy. |
| **Ledger** | [src/ledger.py](./src/ledger.py) | Append-only SHA-256 chain; **cannot** be mutated after `record_entry()`. |
| **Dashboard** | [dashboard.py](./dashboard.py) | Presentation layer; toggles theme and automation mode; **cannot** bypass stopping invariants. |

---

## Master Architecture Principles Matrix (SSOT)

| Principle | Technical Specification & Core Implementation | Target Modules |
| --- | --- | --- |
| **DRY** | Centralized constants in [src/constants.py](./src/constants.py) and helpers in [src/utils.py](./src/utils.py). | [src/constants.py](./src/constants.py), [src/utils.py](./src/utils.py) |
| **OCP** | Extensible strategy registries for LLMs, Diagnostic Rules, Recovery Strategies, Channels, and Webhooks. | [src/classifier.py](./src/classifier.py), [src/orchestrator.py](./src/orchestrator.py), [src/dispatcher.py](./src/dispatcher.py), [app.py](./app.py) |
| **KISS** | Epoch time math `(epoch_time + 19800) % 86400 // 3600`, simplified route extractions, single-pass ledger summary. | [src/orchestrator.py](./src/orchestrator.py), [app.py](./app.py), [src/ledger.py](./src/ledger.py) |
| **LSP** | Behavioral subtyping for channel handlers (`SilentApiRetryChannelHandler`). | [src/dispatcher.py](./src/dispatcher.py) |
| **ISP** | Segregated role protocols (`IPaymentLinkGenerator`, `IVirtualAccountGenerator`, `ISubscriptionManager`, `IWebhookVerifier`, `IDispatcher`, `IDispatchHistory`). | [src/interfaces.py](./src/interfaces.py), [src/payment_client.py](./src/payment_client.py) |
| **PoLA** | Canonical `SentinelDispatcher` naming, state-aware PTP amounts, explicit keyword boundaries. | [src/dispatcher.py](./src/dispatcher.py), [src/orchestrator.py](./src/orchestrator.py) |
| **Fail-Safe Defaults** | Uncertain/missing ML classifications default to `TERMINAL_AUTH_REJECTED` (0-touch halt). | [src/classifier.py](./src/classifier.py) |
| **Defense in Depth** | Missing `X-Webhook-Signature` headers are explicitly rejected (HTTP 401) when secrets are active. | [app.py](./app.py) |
| **Immutability** | `model_config = ConfigDict(frozen=True)` on ledger entries, decision traces, and telemetry events. | [src/schemas.py](./src/schemas.py) |
| **Idempotency** | Re-processing webhooks for `RECOVERED` entities returns `None` with 0 duplicate dispatches. | [src/orchestrator.py](./src/orchestrator.py) |
| **CQS** | Pure inspection query `inspect_ptp_status()` separated from command `evaluate_p2p_compliance()`. | [src/orchestrator.py](./src/orchestrator.py) |
| **HITL** | Complete operator lifecycle via `reject_and_halt()` and `/api/v1/operator/reject`. | [src/orchestrator.py](./src/orchestrator.py), [app.py](./app.py) |
| **MDP Stopping Rule** | Sequence halts under `HALTED_MDP_STOPPING_RULE` when `E[R_net] <= 0` via `MDPYieldCalculator`. | [src/orchestrator.py](./src/orchestrator.py) |
| **Evidence-Bound** | Classifications capture `evidence_source` & `evidence_payload`; terminal candidate confidence must be $\ge 0.85$. | [src/schemas.py](./src/schemas.py), [src/classifier.py](./src/classifier.py), [src/orchestrator.py](./src/orchestrator.py) |
| **Explainability First** | 5-step structured rationale chains (`reasoning_chain`) embedded into `AgenticDecisionTrace`, including the agent's actual selection rationale (`step_3_intervention_selection`) and its `decision_source`, not a templated description written after the fact. | [src/schemas.py](./src/schemas.py), [src/orchestrator.py](./src/orchestrator.py), [src/agentic_agent.py](./src/agentic_agent.py) |
| **Bounded Autonomy** | LLM intervention selection is constrained to a deterministically pre-computed candidate set (`RecoveryStrategyRegistry.find_candidates()`); a selection outside that set is rejected and falls through the provider chain to a deterministic fallback. | [src/agentic_agent.py](./src/agentic_agent.py), [src/orchestrator.py](./src/orchestrator.py) |
| **Auditability by Design** | Single-block SHA-256 cryptographic proofs via `verify_block_proof()` and `/api/v1/ledger/audit/{log_id}`. | [src/ledger.py](./src/ledger.py), [app.py](./app.py) |
| **12-Factor App** | Environment config (`HOST`, `PORT`), unbuffered `sys.stdout` event logs, FastAPI `lifespan` disposability. | [src/constants.py](./src/constants.py), [app.py](./app.py) |
| **Graceful Degradation** | API/IVR outages fall back to synthetic mocks tagged with `"is_degraded_fallback": True`. | [src/payment_client.py](./src/payment_client.py), [src/dispatcher.py](./src/dispatcher.py) |
| **Chronological Compliance** | TRAI gate bounds (08:00–19:00 IST) defer non-compliant dispatches by `+12h` (`is_trai_deferred: True`). | [src/orchestrator.py](./src/orchestrator.py) |
| **Poka-Yoke** | Defect prevention in inputs: phone normalization (`whatsapp:+91...`), `ValueError` on non-positive PTP inputs. | [src/utils.py](./src/utils.py), [src/orchestrator.py](./src/orchestrator.py) |
| **SSOT** | Unified entity lifecycle inspection getter `get_entity_ssot()` and `/api/v1/entity/{entity_id}/ssot` API. | [src/orchestrator.py](./src/orchestrator.py), [app.py](./app.py) |
| **Context Map Pattern** | Structural context map artifact `.antigravity-context-map.md` mapping all 6 bounded contexts & repository index. | [.antigravity-context-map.md](./.antigravity-context-map.md) |
| **Reproducibility** | Deterministic decision replay engine `replay_event()` and `/api/v1/replay` API endpoint for 100% reproducible audit replay. | [src/orchestrator.py](./src/orchestrator.py), [app.py](./app.py) |

---

## Stopping Invariants (Non-Negotiable)

1. **Terminal failure → 0 touches.** `TERMINAL_ACCOUNT_CLOSED` and `TERMINAL_AUTH_REJECTED` immediately halt all recovery. No WhatsApp, no Voice, no retry, no escalation.
2. **Attempt cap → halt.** When `attempt_count >= MAX_ATTEMPTS` (3), the orchestrator returns `None`. No further actions are scheduled.
3. **TRAI chrono-gate → defer, not cancel.** Communications outside 08:00–19:00 IST are deferred by +12h, not dropped. Silent API retries are exempt.
4. **Promise-to-Pay (PTP) freeze → defer.** When `status == PROMISE_TO_PAY_PENDING`, all recovery retries freeze until `promised_timestamp_epoch`.
5. **MDP stopping condition.** The sequence halts at step `k*` when `E[R_net](k*) <= 0`. This is checked per entity.
6. **Mandate execution ceiling.** AutoPay/e-mandate debit re-presentment is bounded to 4 total execution attempts (1 original + 3 retries) per NPCI's AutoPay rules — a separate ceiling from the customer-contact attempt cap above, since one governs contacting the customer and the other governs the underlying bank debit instruction (see [src/mandate_policy.py](./src/mandate_policy.py)).

---

## File Ownership

| File | Owner Layer | Primary Responsibility |
| --- | --- | --- |
| [src/classifier.py](./src/classifier.py) | Classification layer | CBS registry + error parsing rules + LLM Provider Registry |
| [src/orchestrator.py](./src/orchestrator.py) | Recovery policy layer | Scheduling, TRAI gate, PTP freeze, stopping rules, MDP, candidate-set computation, Agentic trace, SSOT |
| [src/agentic_agent.py](./src/agentic_agent.py) | Decision layer | Bounded LLM intervention selection, validation against the legal candidate set, deterministic fallback |
| [src/mandate_policy.py](./src/mandate_policy.py) | Compliance layer | NPCI AutoPay mandate execution-attempt ceiling and non-peak execution windows |
| [src/ledger.py](./src/ledger.py) | Audit layer | Append-only SHA-256 chain + Block proof verifier |
| [src/dispatcher.py](./src/dispatcher.py) | Communication layer | `SentinelDispatcher` (WhatsApp Hinglish + Twilio Voice IVR) |
| [src/payment_client.py](./src/payment_client.py) | Integration layer | REST API client (Links, Retries, Virtual Accounts) & Webhook verifier |
| [app.py](./app.py) | API boundary | FastAPI routes, live webhook auto-reconciler, readiness probes, SSOT routes |
| [dashboard.py](./dashboard.py) | Presentation layer | Streamlit 5-tab command center UI & mode controls |
| [run_demo.py](./run_demo.py) | Automated orchestrator | Python master launcher managing FastAPI, Streamlit, and pyngrok tunnels |
| [run.bat](./run.bat) / [run.ps1](./run.ps1) | Launchers | 1-click execution scripts |
| [data/synthetic_batch_50.json](./data/synthetic_batch_50.json) | Evaluation Dataset | 50-record benchmark dataset |

---

## Testing Contract

Run `python test_suite.py` ([test_suite.py](./test_suite.py)) to verify all 9 stages:
1. Telemetry Classifier + CBS health diagnosis
2. Orchestrator policy gates + stopping invariants
3. 1-Click Payment Link + Virtual Account generation
4. WhatsApp Hinglish dispatcher (mock & Twilio mode)
5. Hinglish Voice IVR call dispatch & Promise-to-Pay (PTP) freeze
6. SHA-256 ledger integrity over 50-record benchmark batch
7. FastAPI REST Endpoints End-to-End
8. Comprehensive Master Architectural Principles Verification Matrix
9. Autonomous Intervention Agent: bounded candidate set, B2B/escalation routing fix, mandate ceiling, live decision trace

All 9 stages must pass before any PR or demo deployment.

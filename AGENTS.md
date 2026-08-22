# RevPulse Sentinel — Agent & Developer Guide

## Core Invariant

> **AI/ML models classify and explain; deterministic policy rules, TRAI chrono-gates, stopping invariants, and mathematical MDP validate and execute.**

- Model output (error classification) is an evidence-bound candidate, never an autonomous recovery decision.
- Missing or uncertain classification defaults to `TERMINAL_AUTH_REJECTED` (halt), not an inferred optimistic action.
- Recovery results are reproducible from stored facts: `entity_id`, `classification`, `attempt_count`, `gross_amount_paise`, bank CBS state.
- Every payment state transition is an audited, SHA-256-hashed ledger block.

---

## Automation Modes

1. **Agentic Mode (`ExecutionMode.AGENTIC_AUTONOMOUS`)**: 100% Autonomous AI execution. Evaluates telemetry, computes MDP net yield, logs `AgenticDecisionTrace`, and auto-approves interventions (`policy_approved = True`).
2. **Manual Mode (`ExecutionMode.MANUAL_POLICY_GATED`)**: Human-in-the-loop governance. Proposes recovery actions (`policy_approved = False`) requiring manual operator signoff before dispatching links or voice calls.

---

## Architectural Boundaries

| Boundary | Rule |
| --- | --- |
| **Classifier** | May parse error codes and CBS registry; **cannot** schedule actions or mutate ledger. |
| **Orchestrator** | Enforces TRAI gate, PTP freeze, MDP stopping rules, and ExecutionMode signoff; **cannot** dispatch directly. |
| **Dispatcher** | May send WhatsApp messages, trigger Twilio Voice IVR calls, or create Razorpay links/accounts; **cannot** mutate ledger or retry policy. |
| **Ledger** | Append-only SHA-256 chain; **cannot** be mutated after `record_entry()`. |
| **Dashboard** | Presentation layer; toggles theme and automation mode; **cannot** bypass stopping invariants. |

---

## Stopping Invariants (Non-Negotiable)

1. **Terminal failure → 0 touches.** `TERMINAL_ACCOUNT_CLOSED` and `TERMINAL_AUTH_REJECTED` immediately halt all recovery. No WhatsApp, no Voice, no retry, no escalation.
2. **Attempt cap → halt.** When `attempt_count >= MAX_ATTEMPTS` (3), the orchestrator returns `None`. No further actions are scheduled.
3. **TRAI chrono-gate → defer, not cancel.** Communications outside 08:00–19:00 IST are deferred by +12h, not dropped. Silent API retries are exempt.
4. **Promise-to-Pay (PTP) freeze → defer.** When `status == PROMISE_TO_PAY_PENDING`, all recovery retries freeze until `promised_timestamp_epoch`.
5. **MDP stopping condition.** The sequence halts at step $k^*$ when $\mathbb{E}[R_{\text{net}}](k^*) \le 0$. This is checked per entity.

---

## Code Conventions

- **All monetary amounts are stored in Paise (integer).** Never convert to INR in backend logic; convert only at display boundaries.
- **SHA-256 hash payload format**: `f"{entity_id}:{status.value}:{recovered_paise}:{prev_hash}"`.
- **Entity IDs** must be globally unique. Format: `{prefix}_{unix_epoch}` for synthetic events.
- **Environment variables** govern all feature toggles (`TRAI_ENFORCE_TIME_GATE`, `USE_MOCK_DISPATCHER`). Never hardcode.
- **No inline code comments** in generated code blocks (per token optimization rules).

---

## File Ownership

| File | Owner | Responsibility |
| --- | --- | --- |
| `src/classifier.py` | Classification layer | CBS registry + error parsing rules |
| `src/orchestrator.py` | Recovery policy layer | Scheduling, TRAI gate, PTP freeze, stopping rules, MDP, Agentic trace |
| `src/ledger.py` | Audit layer | Append-only SHA-256 chain |
| `src/dispatcher.py` | Communication layer | WhatsApp Hinglish + Twilio Voice IVR |
| `src/rzp_client.py` | Integration layer | Razorpay REST API (Links, Retries, Virtual Accounts) & Webhook signature verifier |
| `app.py` | API boundary | FastAPI routes, live webhook auto-reconciler, readiness probes |
| `dashboard.py` | Presentation layer | Streamlit 5-tab command center UI & mode controls |
| `run_demo.py` | Automated orchestrator | Python master launcher managing FastAPI, Streamlit, and pyngrok tunnels |
| `run.bat` / `run.ps1` | Executables | 1-click execution scripts |
| `data/` | Evaluation | `synthetic_batch_50.json` benchmark |

---

## Testing Contract

Run `python test_suite.py` to verify all 6 stages:
1. Telemetry Classifier + CBS health diagnosis
2. Orchestrator policy gates + stopping invariants
3. Razorpay Payment Link + Virtual Account generation
4. WhatsApp Hinglish dispatcher (mock & Twilio mode)
5. Hinglish Voice IVR call dispatch & Promise-to-Pay (PTP) freeze
6. SHA-256 ledger integrity over 50-record benchmark batch

All 6 stages must pass before any PR or demo deployment.

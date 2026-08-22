# RevPulse Sentinel — Agent & Developer Guide

## Core Invariant

> **AI/ML models classify and explain; deterministic policy rules, TRAI chrono-gates, stopping invariants, and mathematical MDP validate and execute.**

- Model output (error classification) is an evidence-bound candidate, never an autonomous recovery decision.
- Missing or uncertain classification defaults to `TERMINAL_AUTH_REJECTED` (halt), not an inferred optimistic action.
- Recovery results are reproducible from stored facts: entity_id, classification, attempt_count, gross_amount_paise, bank CBS state.
- Every payment state transition is an audited, SHA-256-hashed ledger block.

## Architectural Boundaries

| Boundary | Rule |
| --- | --- |
| Classifier | May parse error codes and CBS registry; **cannot** schedule actions or mutate ledger. |
| Orchestrator | Enforces TRAI gate and stopping invariant before any action; **cannot** dispatch directly. |
| Dispatcher | May send WhatsApp messages or create Razorpay links; **cannot** mutate ledger or retry policy. |
| Ledger | Append-only SHA-256 chain; **cannot** be mutated after `record_entry()`. |
| Dashboard | Read-only orchestrator view; may trigger `process_event` and `execute_mock_batch`; **cannot** bypass stopping invariants. |

## Stopping Invariants (Non-Negotiable)

1. **Terminal failure → 0 touches.** `TERMINAL_ACCOUNT_CLOSED` and `TERMINAL_AUTH_REJECTED` immediately halt all recovery. No WhatsApp, no retry, no escalation.
2. **Attempt cap → halt.** When `attempt_count >= MAX_ATTEMPTS` (3), the orchestrator returns `None`. No further actions are scheduled.
3. **TRAI chrono-gate → defer, not cancel.** Communications outside 08:00–19:00 IST are deferred by +12h, not dropped. Silent API retries are exempt.
4. **MDP stopping condition.** The sequence halts at step k* when `𝔼[R_net](k*) < C_action + λ·L_fatigue(k*)`. This is checked per-entity.

## Code Conventions

- **All monetary amounts are stored in Paise (integer).** Never convert to INR in backend logic; convert only at display boundaries.
- **SHA-256 hash payload format**: `f"{entity_id}:{status.value}:{recovered_paise}:{prev_hash}"`.
- **Entity IDs** must be globally unique. Format: `{prefix}_{unix_epoch}` for synthetic events.
- **Environment variables** govern all feature toggles (`TRAI_ENFORCE_TIME_GATE`, `USE_MOCK_DISPATCHER`). Never hardcode.
- **No inline code comments** in generated code blocks (per token optimization rules).

## File Ownership

| File | Owner | Mutation |
| --- | --- | --- |
| `src/classifier.py` | Classification layer | CBS registry + error parsing rules |
| `src/orchestrator.py` | Recovery policy layer | Scheduling, TRAI gate, stopping rules, MDP |
| `src/ledger.py` | Audit layer | Append-only SHA-256 chain |
| `src/dispatcher.py` | Communication layer | WhatsApp Hinglish + mock |
| `src/rzp_client.py` | Integration layer | Razorpay API / mock |
| `app.py` | API boundary | FastAPI routes, webhook handler |
| `dashboard.py` | Presentation layer | Streamlit 5-tab command center |
| `data/` | Evaluation | `synthetic_batch_50.json` benchmark |

## Testing Contract

Run `python test_suite.py` to verify all 5 stages:
1. Telemetry Classifier + CBS health diagnosis
2. Orchestrator policy gates + stopping invariants
3. Razorpay Payment Link + Virtual Account generation
4. WhatsApp Hinglish dispatcher (mock mode)
5. SHA-256 ledger integrity over 50-record benchmark batch

All 5 stages must pass before any PR or demo deployment.

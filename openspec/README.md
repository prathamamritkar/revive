# Revive — OpenSpec Engineering Roadmap

## Versioned Specifications

### v1.0 — Full Executable System (Current)

**Status**: ✓ Fully Implemented & 100% Verified.

#### Data Schemas (`src/schemas.py`)

| Schema | Fields | Notes |
| --- | --- | --- |
| `TelemetryEvent` | event_id, event_type, entity_id, gross_amount_paise, customer_contact_hash, issuing_bank, raw_error_code, invoice_age_days, timestamp_utc | Paise integer enforced via `Field(gt=0)` |
| `RecoveryAction` | action_id, entity_id, target_channel, scheduled_timestamp_epoch, payload, attempt_index, reason_code, policy_approved | `policy_approved=True` in Agentic mode; `False` in Manual mode |
| `AuditLedgerEntry` | log_id, timestamp, entity_id, initial_amount_paise, recovered_amount_paise, status, attempt_count, total_cost_incurred_paise, audit_hash | SHA-256 hash of `entity_id:status:recovered_paise:prev_hash` |
| `DispatchRequest` | phone_number, message, payment_url, channel | Used by WhatsApp & Voice IVR dispatcher |
| `PTPCommitRequest` | entity_id, promised_timestamp_epoch, promised_amount_paise, note | Used for Promise-to-Pay registration |
| `AgenticDecisionTrace` | agent_id, telemetry_audit, cbs_diagnosis, fatigue_reasoning, recommended_channel, confidence_score, auto_executed, timestamp | Detailed reasoning log for Agentic AI mode |

---

#### Failure Classification & Channel Routing

```
TRANSIENT_NETWORK_DOWN   → SILENT_API_RETRY    (+45m CBS-window delay)
TRANSIENT_BALANCE_LOW    → WHATSAPP_HINGLISH   (+24h, Payment Link)
B2B_OVERDUE_INVOICE      → WHATSAPP_HINGLISH   (+1h, Virtual Account)
ABANDONED_CHECKOUT       → WHATSAPP_HINGLISH   (+15m, Payment Link)
ESCALATED_ATTEMPT_3      → VOICE_IVR_NUDGE     (+30m, Hinglish TwiML Call)
PROMISE_TO_PAY_PENDING   → FREEZE              (until promised epoch)
TERMINAL_ACCOUNT_CLOSED  → HALT               (0 touches)
TERMINAL_AUTH_REJECTED   → HALT               (0 touches)
MDP_EXPECTED_NET_LE_0    → HALT               (0 touches)
```

---

## Completed Feature Audit

| Feature | Status | Implementation Details |
| --- | --- | --- |
| Telemetry classifier + CBS registry | ✓ Done | Deterministic rule tree (`src/classifier.py`) |
| TRAI chrono-gate | ✓ Done | `is_trai_compliant_time()` (08:00–19:00 IST) |
| Stopping invariants | ✓ Done | Terminal halt, Attempt cap (3), PTP freeze, MDP net return halt |
| Automation Mode Selector | ✓ Done | Dual execution mode (`Agentic Autonomous` vs `Manual Policy-Gated`) |
| AI Agent Decision Trace Engine | ✓ Done | `AgenticDecisionTrace` with confidence scoring (`96% Confidence`) |
| Hinglish WhatsApp dispatcher | ✓ Done | Twilio SDK + mock mode (`src/dispatcher.py`) |
| Hinglish Voice IVR dispatcher | ✓ Done | Twilio Voice API TwiML `<Say language="hi-IN">` call synthesis |
| Promise-to-Pay (PTP) tracker | ✓ Done | `register_ptp_commitment` & `POST /api/v1/ptp/commit` |
| 1-Click Payment Link generation | ✓ Done | Real REST API `/v1/payment_links` integration |
| Virtual Account generation | ✓ Done | Real REST API `/v1/virtual_accounts` integration |
| Webhook Auto-Reconciliation | ✓ Done | HMAC SHA-256 signature verification & auto-ledger block creation |
| SHA-256 audit ledger | ✓ Done | Append-only chain + O(n) verify (`src/ledger.py`) |
| 50-record benchmark dataset | ✓ Done | `data/synthetic_batch_50.json` (68.62% net recovery yield) |
| 1-Click Master Launcher | ✓ Done | `run_demo.py`, `run.bat`, `run.ps1` with `pyngrok` tunneling |
| 8-Stage Automated Test Suite | ✓ Done | `test_suite.py` (100% assertion pass rate) |

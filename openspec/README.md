# RevPulse Sentinel — OpenSpec Engineering Roadmap

## Versioned Specifications

### v1.0 — Prototype (Current)

**Status**: ✓ Implemented and demo-ready.

#### Data Schemas (`src/schemas.py`)

| Schema | Fields | Notes |
| --- | --- | --- |
| `TelemetryEvent` | event_id, event_type, entity_id, gross_amount_paise, customer_contact_hash, issuing_bank, raw_error_code, invoice_age_days, timestamp_utc | Paise integer enforced via `Field(gt=0)` |
| `RecoveryAction` | action_id, entity_id, target_channel, scheduled_timestamp_epoch, payload, attempt_index, reason_code, policy_approved | `policy_approved=True` only after TRAI + invariant checks |
| `AuditLedgerEntry` | log_id, timestamp, entity_id, initial_amount_paise, recovered_amount_paise, status, attempt_count, total_cost_incurred_paise, audit_hash | SHA-256 hash of `entity_id:status:recovered_paise:prev_hash` |
| `DispatchRequest` | phone_number, message, payment_url, channel | Used by WhatsApp dispatcher |

#### Failure Classification Rules

```
TRANSIENT_NETWORK_DOWN   → SILENT_API_RETRY    (+45m CBS-window delay)
TRANSIENT_BALANCE_LOW    → WHATSAPP_HINGLISH   (+24h, Payment Link)
B2B_OVERDUE_INVOICE      → WHATSAPP_HINGLISH   (+1h, Virtual Account)
ABANDONED_CHECKOUT       → WHATSAPP_HINGLISH   (+15m, Payment Link)
TERMINAL_ACCOUNT_CLOSED  → HALT               (0 touches)
TERMINAL_AUTH_REJECTED   → HALT               (0 touches)
```

#### TRAI Chrono-Gate Rule

```
enforce = os.getenv("TRAI_ENFORCE_TIME_GATE", "true")
ist_hour = (utc_hour + 5 + ceil(utc_min + 30) / 60) % 24
compliant = 8 <= ist_hour < 19
non-compliant → scheduled_time += 12h  (WhatsApp only)
```

#### SHA-256 Block Format

```
hash_n = SHA256(f"{entity_id}:{status.value}:{recovered_paise}:{hash_{n-1}}")
prev_hash_initial = "00000000000000000000000000000000"
```

#### Recovery Cost Model

| Channel | Cost per touch |
| --- | --- |
| SILENT_API_RETRY | ₹0.00 (internal) |
| WHATSAPP_HINGLISH | ₹0.60 (Twilio BSP) |
| VOICE_IVR_NUDGE | ₹2.40 (estimated) |
| HUMAN_ESCALATION | ₹180.00 (estimated) |

---

## Honest Task Progress

| Feature | Status | Notes |
| --- | --- | --- |
| Telemetry classifier + CBS registry | ✓ Done | Deterministic rule tree |
| TRAI chrono-gate | ✓ Done | `is_trai_compliant_time()` |
| Stopping invariants | ✓ Done | Attempt cap + terminal halt |
| WhatsApp Hinglish dispatcher | ✓ Done | Twilio SDK + mock mode |
| Razorpay Payment Link generation | ✓ Done (mock test key) | Real API call in `rzp_test_*` mode |
| Razorpay Virtual Account generation | ✓ Done (mock test key) | Real API call in `rzp_test_*` mode |
| SHA-256 audit ledger | ✓ Done | Append-only chain + O(n) verify |
| 50-record benchmark dataset | ✓ Done | `data/synthetic_batch_50.json` |
| FastAPI webhook handler | ✓ Done | `/webhook/razorpay` |
| Streamlit 5-tab command center | ✓ Done | Full design system rewrite |
| CBS health matrix (live feed) | ✗ Roadmap | Currently static fixture |
| Merchant-configurable attempt cap | ✗ Roadmap | Hardcoded at 3 |
| MDP online learning (adaptive P) | ✗ Roadmap | Currently static probability |
| PostgreSQL persistence | ✗ Roadmap | Currently in-memory state store |
| Redis caching layer | ✗ Roadmap | Not implemented |
| Outbound voice IVR dispatch | ✗ Roadmap | Schema exists, not wired |
| Human escalation queue | ✗ Roadmap | Schema exists, not wired |

---

## Remaining Work (Honest)

1. **Live CBS telemetry feed**: Replace static `bank_cbs_health` dict with a webhook receiver subscribing to Razorpay's internal CBS degradation events.
2. **Persistent state store**: Migrate `orchestrator.state_store` from in-memory dict to PostgreSQL `recovery_states` table with row-level locking.
3. **Adaptive MDP probability**: Replace static `P(Success)` with a Bayesian posterior updated on historical recovery outcomes per merchant + bank + error_code triple.
4. **Merchant configuration API**: `POST /api/merchants/{id}/config` to set `max_attempts`, `allowed_channels`, `fatigue_lambda` per merchant plan.
5. **Voice IVR dispatch**: Wire `VOICE_IVR_NUDGE` channel via Twilio Programmable Voice.

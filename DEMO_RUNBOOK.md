# RevPulse Sentinel — Demo Runbook

## Pre-Demo Checklist (2 minutes)

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Verify .env is configured
cat .env  # Must have RAZORPAY_KEY_ID, USE_MOCK_DISPATCHER=true, TRAI_ENFORCE_TIME_GATE=true

# 3. Verify test suite passes (46 sec)
python test_suite.py

# 4. Launch dashboard
python -m streamlit run dashboard.py
```

Open: `http://localhost:8501`

## 60-Second Live Demo Tour

### Step 1 — Command Center (Tab 1) · 10s

1. Open tab **📊 Command Center**.
2. Point to the 4 KPI cards: **₹2,11,600 Exposed GMV**, **₹1,45,200 Recovered**, **₹16.20 Ops Cost**, **0 Violations**.
3. Say: _"68.62% yield at 0.011% ops cost. Every paisa of recovery is cryptographically verified."_
4. Click **▶ Run 50-Record Benchmark** — ledger populates live with SHA-256 hash badge turning green.

### Step 2 — CBS Diagnostic Inspector (Tab 2) · 15s

1. Open tab **🔬 CBS Diagnostic Inspector**.
2. Select **HDFC** bank, error code **GATEWAY_TIMEOUT**, event type **subscription.charged_failed**.
3. Click **🔬 Run Diagnostic Classification**.
4. Show result: `TRANSIENT_NETWORK_DOWN` → channel: `SILENT_API_RETRY` → delay: `+45m`.
5. Say: _"Most tools retry immediately into the same HDFC maintenance window at 02:00 AM and permanently cancel the subscription. We wait 45 minutes for CBS to recover — then retry silently."_
6. Switch error code to **CARD_EXPIRED** → show `TERMINAL_ACCOUNT_CLOSED` + stopping invariant triggered immediately. _"Zero touches wasted on unrecoverable failures."_

### Step 3 — MDP Simulator (Tab 3) · 10s

1. Open tab **🧮 MDP Recovery Simulator**.
2. Set amount ₹3,500, P(Success) 0.72, IST hour to 2 AM.
3. Show TRAI window badge turning red → deferred +12h.
4. Set hour to 10 AM → green. Show 𝔼[R_net] = **₹{p·V − C}** live.
5. Say: _"The engine solves a constrained MDP — every step has a provable expected yield. The sequence stops when marginal recovery drops below operational cost."_

### Step 4 — WhatsApp Sandbox (Tab 4) · 15s

1. Open tab **💬 WhatsApp Hinglish Sandbox**.
2. Click preset **🛒 Cart Drop-Off** → Razorpay Payment Link appears in phone frame bubble.
3. Click preset **📑 B2B Invoice** → Virtual Account UPI ID appears.
4. Click **🚫 Card Expired** → show stopping invariant halted badge. No message generated.
5. Say: _"Empathetic Hinglish — not robotic SMS — with a 1-click signed Razorpay UPI link. 2.4× higher open rate."_

### Step 5 — SHA-256 Audit Ledger (Tab 5) · 10s

1. Open tab **🔐 SHA-256 Audit Ledger**.
2. Point to **VALID ✓** chain integrity badge.
3. Show the block explorer — each block shows hash prefix, status, initial/recovered amounts.
4. Say: _"Every state transition is a cryptographic block. Any tampered entry breaks the entire chain — verified in O(n). RBI-audit-ready out of the box."_

## Acceptance Criteria

| Criterion | Expected |
| --- | --- |
| `python test_suite.py` all 5 stages | ✓ All PASS |
| 50-record benchmark yield | ≥ 65% |
| SHA-256 chain integrity | ✓ VALID |
| TRAI / RBI violations | 0 |
| Terminal errors → action returned | `None` |
| CBS HDFC DEGRADED → channel | `SILENT_API_RETRY` |
| CARD_EXPIRED → action | `None` (halted) |
| WhatsApp dispatch (mock) → status | `SENT_MOCK` |

## Rollback / Fallback

If Streamlit fails to start: run `pip install streamlit` first. If port 8501 is busy: `streamlit run dashboard.py --server.port 8502`.

If `python test_suite.py` fails on ledger integrity: delete `__pycache__` and re-run.

All Razorpay API calls use `rzp_test_*` key — no live transactions are created.

## Live API Server (Optional Demo Extension)

```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
# Test webhook:
curl -X POST http://localhost:8000/api/event \
  -H "Content-Type: application/json" \
  -d '{"event_id":"demo_1","event_type":"subscription.charged_failed","entity_id":"sub_demo","gross_amount_paise":150000,"customer_contact_hash":"h1","issuing_bank":"HDFC","raw_error_code":"GATEWAY_TIMEOUT","timestamp_utc":"2026-08-22T12:00:00Z"}'
```

# RevPulse Sentinel — Telemetry-Aware Revenue Recovery Engine

**Track 03 — AI Revenue Recovery**: Telemetry-Aware Mandate & Payment Degradation Recovery Sentinel natively built for the Razorpay platform.

---

## Executive Overview

Revenue leakage in modern digital commerce is a multi-stage decay process across **Checkout Drop-offs**, **Involuntary Mandate Churn**, and **Overdue B2B Receivables**. Blind retries fail because they retry during the same bank outage window or send cold robotic spam that alienates customers.

**RevPulse Sentinel** solves this with an autonomous 4-layer engine:
1. **Layer 1 — Root-Cause Telemetry Classifier**: Parses error signatures against issuing bank core banking system (CBS) health matrices (e.g. HDFC 02:00 AM batch window downtime).
2. **Layer 2 — Policy-Gated Recovery Orchestrator**: Enforces TRAI 8 AM – 7 PM IST contact rules and strict stopping invariants ($\le 2$ touches).
3. **Layer 3 — Conversational Hinglish Dispatcher**: Dispatches empathetic Hinglish WhatsApp messages with signed 1-click Razorpay Payment Links (`plink_...`).
4. **Layer 4 — SHA-256 Immutable Audit Ledger**: Cryptographically verifies every payment state transition and paisa-exact recovery yield.

---

## Mathematical Objective

Solves a constrained Markov Decision Process (MDP) to maximize **Net Expected Recovered Capital ($\mathbb{E}[R_{\text{net}}]$)**:

$$\mathbb{E}[R_{\text{net}}] = \sum_{k=1}^{K} \left[ \mathbb{P}(\text{Success} \mid \text{RootCause}, \tau_k, \mathbf{x}_c) \cdot V - C_{\text{action}}(a_k) - \lambda \cdot L_{\text{fatigue}}(k) \right]$$

**Stopping Invariant**: The recovery sequence strictly terminates at step $k^*$ when marginal expected recovery falls below intervention operational cost + fatigue penalty.

---

## Project Architecture & Scaffolding

```text
d:/Dev/Projects/Razorpay/
├── AGENTS.md                   # Core invariants & coding rules
├── BUSINESS.md                 # ROI, unit economics & business case
├── DEMO_RUNBOOK.md             # 60-second pitch runbook
├── TECHNICAL.md                # System guide & sequence diagrams
├── README.md                   # Project documentation
├── app.py                      # FastAPI server for webhooks & readiness
├── dashboard.py                # Streamlit 5-tab Command Center
├── data/
│   └── synthetic_batch_50.json # 50-record evaluation benchmark
├── openspec/                   # Technical specs & engineering roadmap
└── src/
    ├── __init__.py
    ├── schemas.py              # Pydantic models (Paise integers)
    ├── classifier.py           # Telemetry & error diagnostic engine
    ├── orchestrator.py         # TRAI chrono-gate, stopping rules & scheduler
    ├── rzp_client.py           # Razorpay SDK / API client
    ├── dispatcher.py           # WhatsApp Hinglish dispatcher
    └── ledger.py               # SHA-256 state-transition audit chain
```

---

## Quickstart & Installation

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Environment (.env)
```ini
RAZORPAY_KEY_ID="rzp_test_YourKeyIdHere"
RAZORPAY_KEY_SECRET="YourKeySecretHere"
RAZORPAY_WEBHOOK_SECRET="revpulse_secret_2026"

USE_MOCK_DISPATCHER="true"
TWILIO_ACCOUNT_SID="ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
TWILIO_AUTH_TOKEN="your_twilio_auth_token"
TWILIO_WHATSAPP_NUMBER="whatsapp:+14155238886"
DEMO_TARGET_PHONE="whatsapp:+919876543210"

TRAI_ENFORCE_TIME_GATE="true"
SERVER_PORT=8000
```

### 3. Launch Pitch Dashboard (Streamlit)
```bash
venv\Scripts\streamlit.exe run dashboard.py
```

### 4. Launch FastAPI Webhook Server
```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

---

## 50-Record Benchmark Results

```
====================================================================================================
                             REVPULSE SENTINEL: BATCH RECOVERY BENCHMARK
====================================================================================================
Total Records Processed         : 50
Total At-Risk GMV Exposed       : ₹2,11,600.00 (21,160,000 Paise)
Total Capital Recovered         : ₹1,45,200.00 (14,520,000 Paise)
Net Recovery Yield Rate         : 68.62%
Total Communication Ops Cost    : ₹16.20 (0.011% of Recovered GMV)
Ledger Integrity Verification   : 100% Cryptographically Valid (SHA-256 Unbroken)
Regulatory / Stopping Violations: 0 (100% Policy Adherence)
====================================================================================================
```

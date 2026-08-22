# RevPulse Sentinel — AI Revenue Recovery Engine

> **Track 03: AI Revenue Recovery** — *Find revenue that’s slipping away and win it back.*

Build an agent that detects revenue at risk, determines the right intervention, and executes a bounded recovery workflow: from payment failures and checkout abandonment to overdue receivables.

---

## Executive Overview: Why Now?

Revenue loss rarely happens in one clean step. A payment degrades, a checkout gets abandoned, a subscription fails, or an invoice goes overdue. **RevPulse Sentinel** closes the loop from detecting the problem to diagnosing it, choosing the right intervention, and recovering the money.

Built natively for the Razorpay platform, it operates across dual execution modes (**Agentic Autonomous AI** or **Manual Policy-Gated**):

1. **Layer 1 — Root Cause Diagnostic Agent**: Hybrid classification combining fast heuristics with LLM/bounded AI intent analysis (`AIIntentResponse`) to parse error codes and unstructured customer drop-off notes against issuing bank core banking system (CBS) health matrices.
2. **Layer 2 — Policy-Gated Orchestrator**: Enforces TRAI 08:00–19:00 IST contact rules, Promise-to-Pay (P2P) grace period locks, MDP stopping invariants ($\mathbb{E}[R_{\text{net}}] \le 0 \implies \text{HALT}$), and `MAX_ATTEMPTS = 3` caps.
3. **Layer 3 — Multi-Channel Conversational Dispatcher**: Dispatches empathetic Hinglish WhatsApp messages with signed 1-click Razorpay Payment Links (`plink_...`), live Twilio TwiML Voice IVR speech calls (`<Say language="hi-IN">`), and auto-reconciling Razorpay Virtual Accounts (`rzp.virtual.*@hdfcbank`).
4. **Layer 4 — Cryptographic SHA-256 Audit Ledger**: Cryptographically hashes every payment state transition (`f"{entity_id}:{status}:{recovered_paise}:{prev_hash}"`) for O(n) tamper-proof compliance.

---

## The Razorpay Evaluation Bar & 4 Pillars

| Pillar | Razorpay Hackathon Bar | RevPulse Sentinel Implementation |
| --- | --- | --- |
| **Problem taste** | *Did you pick something that actually matters?* | Solves ₹2.1L exposed GMV leakage across checkout drop-offs, mandate failures, and B2B receivables. |
| **Build quality** | *Does it run, is it structured, would you trust it?* | 6-stage automated test suite, HMAC-SHA256 signature security, zero-tamper cryptographic ledger chain. |
| **AI judgment** | *The right tool in the right place, and where you chose not to use one.* | Hybrid LLM intent extraction for ambiguous notes + deterministic mathematical MDP for stopping invariants. |
| **Failure recovery** | *What broke, and what you did about it.* | Handles bank CBS maintenance windows (+45m delay), P2P salary date locks (+7d delay), and broken-promise escalation. |

---

## 7 Razorpay Recovery Directions Natively Covered

1. `Payment degradation → root cause → recovery action`
2. `Checkout drop-off recovery`
3. `Failed-subscription recovery`
4. `B2B receivables chaser`
5. `Mandate retry sequencer`
6. `Hinglish voice recovery`
7. `Promise-to-pay tracker`

---

## Dual Automation Modes

- **Agentic Mode (Autonomous AI)**: The AI Agent (`RevPulse-Agent-01`) autonomously analyzes telemetry, constructs multi-step reasoning traces (`96% Confidence`), and executes dispatches instantly without human delay.
- **Manual Mode (Policy-Gated)**: Human operator retains control; the engine diagnoses telemetry and proposes interventions (`policy_approved = False`), requiring manual operator signoff in a dedicated pending approval queue.

---

## Mathematical Objective & MDP Stopping Invariant

Solves a constrained Markov Decision Process (MDP) to maximize **Net Expected Recovered Capital ($\mathbb{E}[R_{\text{net}}]$)**:

$$\mathbb{E}[R_{\text{net}}](k) = P_{\text{success}}(k) \times \text{gross\_amount\_paise} - (C_{\text{channel}} + \lambda \cdot k)$$

**Stopping Invariant**: The recovery sequence strictly halts (`HALTED_MDP_STOPPING_RULE`) at step $k^*$ when expected net return falls to or below 0.

---

## Project Structure & Architecture

```text
d:/Dev/Projects/Razorpay/
├── AGENTS.md                   # Core invariants & developer guide
├── BUSINESS.md                 # ROI, unit economics & business case
├── DEMO_RUNBOOK.md             # 60-second pitch runbook
├── LIVE_SETUP_GUIDE.md         # Step-by-step setup documentation
├── TECHNICAL.md                # Technical system guide & sequence diagrams
├── README.md                   # Project documentation
├── app.py                      # FastAPI REST server & HMAC webhook ingestion
├── dashboard.py                # Streamlit 5-tab Command Center UI
├── run_demo.py                 # Master 1-click automated launcher & pyngrok tunnel
├── run.bat                     # 1-click Windows executable script
├── run.ps1                     # PowerShell executable script
├── test_suite.py               # 6-stage automated test runner
├── data/
│   └── synthetic_batch_50.json # 50-record evaluation benchmark
├── openspec/                   # Technical specs & engineering roadmap
└── src/
    ├── __init__.py
    ├── schemas.py              # Pydantic schemas (Paise integers & AIIntentResponse)
    ├── classifier.py           # Hybrid AI intent & error diagnostic engine
    ├── orchestrator.py         # TRAI gate, P2P grace locks, MDP stopping rules & scheduler
    ├── rzp_client.py           # Razorpay SDK REST API & HMAC signature verifier
    ├── dispatcher.py           # Twilio WhatsApp & TwiML Hinglish Voice IVR dispatcher
    └── ledger.py               # Cryptographic SHA-256 state-transition audit chain
```

---

## 1-Click Autonomous Quickstart

### Launch Entire Stack (API + Dashboard + Live Tunnel):
```powershell
.\run.bat
```

Or via Python:
```powershell
.\venv\Scripts\python.exe run_demo.py
```

### URLs:
- **Streamlit Command Center**: [http://localhost:8501](http://localhost:8501)
- **FastAPI OpenAPI Specs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Readiness Probe**: [http://localhost:8000/api/v1/readiness](http://localhost:8000/api/v1/readiness)

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

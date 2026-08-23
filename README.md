# Revive — Autonomous AI Revenue Recovery Engine

> **Find revenue slipping away and win it back — deterministically, safely, and at scale.**

**Revive** is an enterprise-grade, autonomous revenue recovery platform designed to eliminate loss across the entire merchant payment lifecycle. By pairing hybrid LLM intent intelligence with deterministic policy rules, TRAI contact bounds, mathematical MDP stopping invariants, and a SHA-256 cryptographic audit ledger, Revive turns payment failures, abandoned checkouts, failed mandates, and overdue receivables into recovered capital.

---

## 📚 Complete Project Documentation Index

Explore the specialized documentation suite designed for enterprise evaluators, software architects, finance executives, and operators:

| Document | Audience & Purpose | Key Contents |
| --- | --- | --- |
| 📖 [**AGENTS.md**](file:///d:/Dev/Projects/Razorpay/AGENTS.md) | **Developers & AI Assistants** | Single Source of Truth (SSOT), non-negotiable stopping invariants, 23 master architectural principles, and test suite contracts. |
| 💼 [**BUSINESS.md**](file:///d:/Dev/Projects/Razorpay/BUSINESS.md) | **C-Suite & Business Leaders** | Financial ROI models, unit economics, payback period analysis, gmv leakage classification, and commercial impact. |
| ⚙️ [**TECHNICAL.md**](file:///d:/Dev/Projects/Razorpay/TECHNICAL.md) | **Engineering Teams & Architects** | Deep-dive system architecture, multi-layer sequence diagrams, API schemas, hybrid LLM classification mechanics, and ledger cryptography. |
| 🚀 [**DEMO_RUNBOOK.md**](file:///d:/Dev/Projects/Razorpay/DEMO_RUNBOOK.md) | **Product Managers & Evaluators** | Step-by-step 60-second pitch runbook, script guide, manual approval queue flows, and visual dashboard walkthrough. |
| 🛠️ [**LIVE_SETUP_GUIDE.md**](file:///d:/Dev/Projects/Razorpay/LIVE_SETUP_GUIDE.md) | **DevOps & Integration Engineers** | Production environment setup, Twilio WhatsApp/Voice credentials, live Payment Gateway API keys, and public ngrok webhook listener configuration. |
| 🗺️ [**.antigravity-context-map.md**](file:///d:/Dev/Projects/Razorpay/.antigravity-context-map.md) | **Domain Engineers** | Bounded Context map (DDD), domain entities, value objects, invariant boundaries, and module mappings. |
| 📋 [**openspec/README.md**](file:///d:/Dev/Projects/Razorpay/openspec/README.md) | **Engineering Leadership** | Formal specification, current v1.0 feature audit, versioned schema definitions, and production roadmap. |

---

## Executive Overview: Why Revive?

Revenue loss rarely happens in a single dramatic failure. Instead, it leaks silently across multiple touchpoints: a temporary bank outage during subscription billing, a customer hesitating at checkout, an uncollected B2B invoice, or a mandate failing due to low balance.

Traditional systems rely on naive, static retries that annoy customers, incur heavy API fees, or violate regulatory calling hours. **Revive** introduces a 4-Layer Autonomous Recovery Architecture that intelligently detects, diagnoses, orchestrates, and verifies recovery while protecting merchant brand equity.

### The 4-Layer Autonomous Architecture

```
                  ┌─────────────────────────────────────────────────────────┐
                  │                 PAYMENT TELEMETRY EVENT                 │
                  └────────────────────────────┬────────────────────────────┘
                                               │
 ┌─────────────────────────────────────────────▼─────────────────────────────────────────────┐
 │ LAYER 1: TELEMETRY CLASSIFIER & HYBRID AI INTENT ENGINE                                   │
 │ • Rule-tree parse of raw error codes against Core Banking System (CBS) matrices          │
 │ • LLM-powered intent extraction for ambiguous customer notes (AIIntentResponse)           │
 └─────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                               │
 ┌─────────────────────────────────────────────▼─────────────────────────────────────────────┐
 │ LAYER 2: POLICY-GATED ORCHESTRATOR & MATHEMATICAL MDP                                     │
 │ • TRAI Chrono-Gate: Enforces 08:00–19:00 IST contact rules (defers outside bounds)         │
 │ • Promise-to-Pay (P2P) Freeze: Halts retries during agreed grace window                     │
 │ • MDP Stopping Invariant: Halts sequence when E[R_net] <= 0 or Attempt >= 3               │
 └─────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                               │
 ┌─────────────────────────────────────────────▼─────────────────────────────────────────────┐
 │ LAYER 3: MULTI-CHANNEL CONVERSATIONAL DISPATCHER                                          │
 │ • WhatsApp Hinglish: Empathetic messages + signed 1-click Payment Links                   │
 │ • Voice IVR Nudge: Outbound Twilio speech calls with interactive DTMF nudge               │
 │ • Virtual Accounts: Auto-reconciling NEFT/RTGS accounts for B2B overdue invoices          │
 └─────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                               │
 ┌─────────────────────────────────────────────▼─────────────────────────────────────────────┐
 │ LAYER 4: CRYPTOGRAPHIC SHA-256 AUDIT LEDGER                                               │
 │ • Append-only, tamper-proof blockchain-style ledger (O(n) verification)                   │
 └───────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Pillars & Enterprise Evaluation Matrix

| Evaluation Pillar | Industry Target Standard | Revive System Implementation |
| --- | --- | --- |
| **Problem Value & ROI** | *Solves meaningful revenue leakage?* | Recovers **₹1.45L out of ₹2.11L (68.62% yield)** exposed GMV across failed subscriptions, checkout drop-offs, and overdue B2B invoices. |
| **Build & Software Quality** | *Enterprise ready and robust?* | 8-stage automated test suite ([test_suite.py](file:///d:/Dev/Projects/Razorpay/test_suite.py)), HMAC-SHA256 signature security, clean layered DDD architecture. |
| **AI Judgment & Safety** | *Right balance of AI vs Determinism?* | Hybrid LLM intent analysis for natural language customer notes + 100% deterministic mathematical MDP stopping rules for financial safety. |
| **Resilience & Degraded Mode** | *What happens during outages?* | Automatic fallback to synthetic payment links during gateway outages (`is_degraded_fallback: True`), bank CBS window deferrals (+45m), and PTP salary locks (+7d). |

---

## 7 Native Recovery Directions Covered

Revive natively supports 7 specialized revenue recovery workflows out of the box:

1. **Payment Failure Recovery**: Real-time diagnostic parsing of issuing bank error codes (e.g. `GATEWAY_TIMEOUT`, `CARD_EXPIRED`) to route between silent retries and customer nudges.
2. **Checkout Drop-off Recovery**: Instant 1-click UPI/Card payment link generation (`plink_...`) dispatched via WhatsApp within 15 minutes of cart abandonment.
3. **Failed Subscription Renewal**: Multi-attempt recovery for recurring payments with intelligent balance-check scheduling.
4. **B2B Receivables Chaser**: Auto-generation of dedicated Virtual Accounts (`rzp.virtual.*@hdfcbank`) with NEFT/RTGS payment details for overdue corporate invoices.
5. **Mandate Retry Sequencer**: Automated rescheduling of recurring debit mandates aligned with bank settlement windows.
6. **Hinglish Voice Recovery**: Interactive outbound IVR speech calls using Twilio TwiML (`<Say language="hi-IN">`) with 1-click payment link SMS dispatch.
7. **Promise-to-Pay (PTP) Tracker**: Financial commitment tracking that freezes recovery nudges until the promised date (e.g., salary credit day).

---

## Dual Automation Modes

Revive supports two distinct operational modes configurable via UI or environment flags:

- 🤖 **Agentic Mode (`ExecutionMode.AGENTIC_AUTONOMOUS`)**: 100% Autonomous AI execution. The AI agent ([Revive-Agent-01](file:///d:/Dev/Projects/Razorpay/src/schemas.py#L36)) evaluates telemetry, computes MDP net yield, logs an `AgenticDecisionTrace` with multi-step reasoning, and auto-executes dispatches instantly (`policy_approved = True`).
- 👤 **Manual Mode (`ExecutionMode.MANUAL_POLICY_GATED`)**: Human-in-the-Loop governance. The system computes diagnostics and proposes recovery actions (`policy_approved = False`), queuing them in an Operator Approval Queue for manual signoff.

---

## Mathematical Objective & MDP Stopping Invariant

Revive models recovery as a constrained Markov Decision Process (MDP) to maximize **Net Expected Recovered Capital ($\mathbb{E}[R_{\text{net}}]$)** while eliminating customer fatigue and unnecessary operational costs:

$$\mathbb{E}[R_{\text{net}}](k) = P_{\text{success}}(k) \cdot \text{gross\_amount\_paise} - \left( C_{\text{channel}} + \lambda \cdot k \right)$$

Where:
- $P_{\text{success}}(k)$: Success probability at attempt $k$ (decaying with repeated attempts: $0.75 \rightarrow 0.50 \rightarrow 0.25$).
- $\text{gross\_amount\_paise}$: Total transaction value in Paise (exact integer calculation).
- $C_{\text{channel}}$: Operational cost of the communication channel (e.g. WhatsApp: ₹0.60, Voice IVR: ₹1.50, Human: ₹5.00).
- $\lambda \cdot k$: Customer fatigue penalty scaling with attempt count $k$.

> 🛑 **Non-Negotiable Stopping Invariant**: The recovery sequence strictly halts (`HALTED_MDP_STOPPING_RULE`) at step $k^*$ when $\mathbb{E}[R_{\text{net}}](k^*) \le 0$, or when `attempt_count >= 3`, or upon encountering terminal failure codes (`TERMINAL_ACCOUNT_CLOSED`, `TERMINAL_AUTH_REJECTED`).

---

## Project Structure & Repository Index

```text
d:/Dev/Projects/Revive/
├── AGENTS.md                   # Core invariants, SSOT & developer guidelines
├── BUSINESS.md                 # ROI models, unit economics & financial business case
├── DEMO_RUNBOOK.md             # 60-second pitch runbook & visual UI walkthrough
├── LIVE_SETUP_GUIDE.md         # Production setup guide (Twilio, Payment APIs, Webhooks)
├── TECHNICAL.md                # Technical architecture, sequence diagrams & schemas
├── README.md                   # Master enterprise README documentation
├── .antigravity-context-map.md # Domain-Driven Design (DDD) context map
├── app.py                      # FastAPI REST API server & HMAC-SHA256 webhook listener
├── dashboard.py                # Streamlit 5-tab Command Center UI
├── run_demo.py                 # Master 1-click automated launcher with pyngrok tunnel
├── run.bat                     # 1-click Windows execution batch script
├── run.ps1                     # 1-click PowerShell execution script
├── commit_changes.bat          # Segregated git commit helper script (CMD)
├── commit_changes.ps1          # Segregated git commit helper script (PowerShell)
├── test_suite.py               # 8-stage automated verification test suite
├── requirements.txt            # System dependencies
├── data/
│   └── synthetic_batch_50.json # 50-record evaluation benchmark dataset
├── openspec/
│   └── README.md               # OpenSpec engineering specifications & v1.0 roadmap
└── src/
    ├── __init__.py             # Revive core source package
    ├── schemas.py              # Strict Pydantic models (Paise integer enforcement)
    ├── classifier.py           # Hybrid AI intent & CBS rule classification engine
    ├── orchestrator.py         # Policy-Gated Orchestrator, TRAI gates & MDP calculator
    ├── payment_client.py       # Payment Gateway API wrapper & HMAC verifier
    ├── rzp_client.py           # Native SDK integration client
    ├── dispatcher.py           # Twilio WhatsApp & TwiML Hinglish Voice IVR dispatcher
    ├── ledger.py               # Cryptographic SHA-256 state-transition audit chain
    ├── constants.py            # Code-bound constants & immutable SSOT invariants
    ├── interfaces.py           # ISP Segregated Protocol Interfaces
    └── utils.py                # Helper utilities (Paise conversion, PII redaction, HMAC)
```

---

## 🚀 Quickstart & 1-Click Execution

### 1. Master Startup (FastAPI + Streamlit Dashboard + Live Tunnel):
Execute the automated launcher script to start all services simultaneously:

```powershell
.\run.bat
```
*Or via PowerShell:*
```powershell
.\run.ps1
```
*Or via Python directly:*
```powershell
python run_demo.py
```

### 2. Live Application Endpoints:
- 📊 **Streamlit Command Center UI**: [http://localhost:8501](http://localhost:8501)
- 🔌 **FastAPI OpenAPI Interactive Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- 🩺 **System Readiness Probe**: [http://localhost:8000/api/v1/readiness](http://localhost:8000/api/v1/readiness)
- 🔍 **Single Source of Truth (SSOT) API**: [http://localhost:8000/api/v1/entity/{entity_id}/ssot](http://localhost:8000/api/v1/entity/sub_01/ssot)

---

## 📊 50-Record Benchmark Performance & Economics

Revive includes a comprehensive 50-record evaluation benchmark dataset ([data/synthetic_batch_50.json](file:///d:/Dev/Projects/Razorpay/data/synthetic_batch_50.json)). Run `python test_suite.py` to verify:

```text
====================================================================================================
                             REVIVE: BATCH RECOVERY BENCHMARK
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

### Unit Economics Summary:
- **Net Recovery Value**: **₹1,45,200.00** recovered from ₹2,11,600.00 total exposed GMV.
- **Operational Cost**: **₹16.20 total spend** across WhatsApp, Voice IVR, and Silent Retries.
- **ROI Multiple**: **8,962x Return on Recovery Cost**.

---

## 🧪 Automated Testing & Verification

Revive maintains an 8-Stage Automated Test Suite ([test_suite.py](file:///d:/Dev/Projects/Razorpay/test_suite.py)) verifying all system components and architectural principles:

```powershell
python test_suite.py
```

### Test Suite Execution Plan:
1. **Stage 1**: Telemetry Classifier + CBS Health Diagnosis & LLM Fallback
2. **Stage 2**: Orchestrator Policy Gates, TRAI Chrono-Gate & Stopping Invariants
3. **Stage 3**: 1-Click Payment Link & Virtual Account Generation
4. **Stage 4**: WhatsApp Hinglish Dispatcher (Mock & Live Twilio Modes)
5. **Stage 5**: Hinglish Voice IVR Call Dispatch & Promise-to-Pay (PTP) Grace Locks
6. **Stage 6**: Cryptographic SHA-256 Audit Ledger Integrity (50-Record Batch)
7. **Stage 7**: FastAPI REST Endpoints & Webhook Auto-Reconciler End-to-End
8. **Stage 8**: Comprehensive Master Architectural Principles Verification Matrix (23 Principles)

---

## 🔐 Security, Compliance & Auditability

- **HMAC-SHA256 Signature Verification**: Every incoming webhook payload is verified via `X-Webhook-Signature` / `X-Razorpay-Signature` headers using secret `REVIVE_WEBHOOK_SECRET`.
- **Cryptographic Audit Ledger**: Every payment state transition is appended to a SHA-256 hash chain ([src/ledger.py](file:///d:/Dev/Projects/Razorpay/src/ledger.py)). Hashes are computed as `SHA-256(entity_id:status:recovered_paise:prev_hash:timestamp)` for 100% tamper-proof auditability.
- **TRAI Chronological Compliance**: Communications are strictly bounded between 08:00 and 19:00 IST. Non-compliant dispatches outside this window are deferred automatically (+12h).
- **PII Redaction**: Contact numbers and customer identifiers are hashed (`anon_contact` / `hash_...`) across logs and public responses.

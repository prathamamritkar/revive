# Revive — Autonomous Revenue Recovery Engine

> **Deterministic, Policy-Gated Capital Recovery for Enterprise Payment Platforms**

[![Architecture](https://img.shields.io/badge/Architecture-4--Layer%20DDD-0A84FF?style=flat-square)](./TECHNICAL.md) [![Verification](https://img.shields.io/badge/Verification-9--Stage%20Pass-30D158?style=flat-square)](./test_suite.py) [![Compliance](https://img.shields.io/badge/Compliance-TRAI%20IST%20%26%20NPCI-FF9F0A?style=flat-square)](./AGENTS.md) [![Auditability](https://img.shields.io/badge/Ledger-SHA--256%20Chained-BF5AF2?style=flat-square)](./src/ledger.py) [![Runtime](https://img.shields.io/badge/Runtime-Node.js%20%7C%20FastAPI%20Dual--Engine-5856D6?style=flat-square)](./server.ts)

---

## Executive Summary

Revenue loss across enterprise payment platforms rarely stems from a single catastrophic event. Instead, capital leaks silently across four compounding failure vectors:
1. **Recurring e-Mandate / UPI AutoPay Downtime Dips**: Immediate uncoordinated retries execute during Core Banking System (CBS) bank outages, exhausting authorization limits and triggering permanent mandate revocation.
2. **High-Intent Checkout Drops**: Payment gateway drops and UPI app aborts are left unaddressed or chased via delayed, impersonal email campaigns 24 hours later.
3. **Overdue B2B Receivables**: Invoices sit past net-30 terms because corporate clients require dedicated Virtual Accounts (NEFT/RTGS) rather than credit card links.
4. **Broken Customer Commitments**: Blind outreach spams customers on non-payday cycles, violating consumer protection laws and triggering customer churn.

**Revive** is a production-grade, policy-governed revenue recovery engine. It pairs **bounded agentic AI reasoning** with **strict deterministic financial invariants**, **telecom chrono-gates (TRAI)**, **mathematical Markov Decision Process (MDP) stopping rules**, and an **immutable SHA-256 cryptographic audit chain**.

Revive does not rely on static rules or unconstrained AI prompts. In Revive, **deterministic financial policies compute legal candidate recovery actions; the AI agent reasons and selects within that pre-validated candidate set; and mathematical stopping rules execute or halt.**

---

## 🏛️ System Architecture Topology

Revive is structured as a resilient **4-Layer Domain-Driven Design (DDD)** engine with dual execution modes and a dual-runtime architecture (full-stack TypeScript/Express engine with Vite React UI on port 3000, paired with an enterprise FastAPI Python backend on port 8000/8001):

```text
                                 ┌──────────────────────────────────────────────┐
                                 │       INCOMING PAYMENT TELEMETRY EVENT       │
                                 │   (Razorpay / Stripe / Bank Webhook Event)   │
                                 └──────────────────────┬───────────────────────┘
                                                        │
 ┌──────────────────────────────────────────────────────▼─────────────────────────────────────────────────────┐
 │ LAYER 1: DIAGNOSTIC & INTENT CLASSIFICATION ENGINE                                                         │
 │ • Deterministic error code parsing against CBS bank downtime registries (HDFC, SBI, ICICI, Axis, Kotak)   │
 │ • Sub-millisecond error classification into 6 discrete failure states                                      │
 │ • Bounded LLM semantic intent triage for unstructured drop-off customer notes                              │
 └──────────────────────────────────────────────────────┬─────────────────────────────────────────────────────┘
                                                        │
 ┌──────────────────────────────────────────────────────▼─────────────────────────────────────────────────────┐
 │ LAYER 2: POLICY ORCHESTRATOR & MATHEMATICAL MDP BOUNDS                                                     │
 │ • TRAI Chrono-Gate: Strict 08:00–19:00 IST contact window; automatically defers off-hour touches by +12h   │
 │ • NPCI AutoPay Rule: Hard ceiling of 4 execution attempts (1 original + 3 retries) on debit mandates      │
 │ • Promise-to-Pay (PTP) Lock: Freezes automated outreach during active customer promise windows             │
 │ • Finite-Horizon MDP Yield Optimizer: Halts recovery sequence when Expected Net Yield E[R_net] <= 0        │
 └──────────────────────────────────────────────────────┬─────────────────────────────────────────────────────┘
                                                        │
                        ┌───────────────────────────────┴───────────────────────────────┐
                        │                                                               │
        [AGENTIC AUTONOMOUS MODE]                                           [MANUAL POLICY-GATED MODE]
        LLM Agent selects optimal intervention                              Deterministic policy proposes action;
        bounded strictly to orchestrator candidate set                      Action routed to Operator Review Queue
                        │                                                               │
                        └───────────────────────────────┬───────────────────────────────┘
                                                        │
 ┌──────────────────────────────────────────────────────▼─────────────────────────────────────────────────────┐
 │ LAYER 3: ADAPTIVE MULTI-CHANNEL DISPATCHER                                                                 │
 │ • Machine-to-Machine Silent API Retries: Paced +45m after bank CBS recovery windows (TRAI-Exempt)         │
 │ • Localized WhatsApp Hinglish: Contextual messages with pre-signed 1-click Razorpay payment links          │
 │ • Outbound Twilio Voice IVR: Spoken interactive phone nudge with Amazon Polly Aditi neural voice          │
 │ • Smart Collect Virtual Accounts: Dedicated NEFT/RTGS virtual bank accounts for B2B invoice settlement     │
 └──────────────────────────────────────────────────────┬─────────────────────────────────────────────────────┘
                                                        │
 ┌──────────────────────────────────────────────────────▼─────────────────────────────────────────────────────┐
 │ LAYER 4: CRYPTOGRAPHIC SHA-256 AUDIT LEDGER                                                                │
 │ • Tamper-evident append-only hash chain linking every state transition to the previous block hash          │
 │ • Integer Paise precision (1 INR = 100 Paise) eliminating IEEE-754 floating point drift                    │
 │ • Provable auditability: Single-block verification and complete O(N) chain validation                       │
 └────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Hackathon Evaluation Matrix & Verifiable Evidence

| Hackathon Judging Criterion | Revive Implementation & Architectural Safeguards | Verifiable Code Artifact |
| :--- | :--- | :--- |
| **1. Problem Value & Relevance** | Solves compound GMV leakage across subscriptions, checkouts, and invoices. Evaluated across 50 realistic enterprise payment failure events representing ₹2,11,600.00 exposed GMV. | [`data/synthetic_batch_50.json`](./data/synthetic_batch_50.json)<br>[`BUSINESS.md`](./BUSINESS.md) |
| **2. Architectural Rigor & Code Craft** | Clean 4-Layer DDD architecture. Strict Single Source of Truth (SSOT), 23 architectural principles, and zero circular dependencies. Full automated test suite. | [`AGENTS.md`](./AGENTS.md)<br>[`TECHNICAL.md`](./TECHNICAL.md)<br>[`test_suite.py`](./test_suite.py) |
| **3. Authentic AI vs. Deterministic Safeguards** | **Bounded Autonomy**: AI does not make unchecked financial decisions. The deterministic policy pre-computes legal candidate actions; the LLM selects within this set; out-of-menu choices are rejected with deterministic fallback. | [`src/agentic_agent.py`](./src/agentic_agent.py)<br>[`src/orchestrator.py`](./src/orchestrator.py) |
| **4. Regulatory Compliance & Invariants** | Strict enforcement of TRAI TCCCPR 2018 (08:00–19:00 IST), NPCI AutoPay 4-attempt debit ceiling, and RBI Fair Practice Promise-to-Pay (PTP) temporal freeze. | [`src/mandate_policy.py`](./src/mandate_policy.py)<br>[`src/utils.py`](./src/utils.py) |
| **5. Cryptographic Integrity & Auditability** | Every payment mutation generates an immutable SHA-256 block (`H_i = SHA-256(entity || status || recovered_paise || H_{i-1} || timestamp)`). Verifiable in sub-millisecond time. | [`src/ledger.py`](./src/ledger.py)<br>[`src/engine/ledger.ts`](./src/engine/ledger.ts) |
| **6. Quantifiable Economic Impact** | **68.62% Net Recovery Rate** (₹1,45,200.00 recovered). **₹16.20 total operational cost** (0.011% of recovered capital). **8,962× ROI multiplier**. | [`src/orchestrator.py`](./src/orchestrator.py)<br>[`test_suite.py`](./test_suite.py) |
| **7. Production Completeness & UX** | Fully functional React 18 + Tailwind operator dashboard with Duolingo-style high-contrast accessibility, live webhook simulator, and interactive audio preview. | [`src/components/`](./src/components/)<br>[`server.ts`](./server.ts) |

---

## 🔒 The Five Non-Negotiable Invariants

Revive enforces five mathematical and regulatory boundaries that cannot be bypassed by any automation mode or LLM decision:

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       REVIVE FIVE NON-NEGOTIABLE INVARIANTS                                      │
├─────────────────────────┬─────────────────────────┬─────────────────────────┬──────────────────┬─────────────────┤
│ INVARIANT 1: TERMINAL   │ INVARIANT 2: TRAI       │ INVARIANT 3: FINITE     │ INVARIANT 4: PTP │ INVARIANT 5:    │
│ PROHIBITION (0-TOUCH)   │ CHRONO-GATE (08-19 IST) │ MDP STOPPING CONDITION  │ TEMPORAL FREEZE  │ NPCI MANDATE CAP│
├─────────────────────────┼─────────────────────────┼─────────────────────────┼──────────────────┼─────────────────┤
│ Immediate halt on       │ All customer contact    │ Sequence halts when     │ Customer promise │ Hard cap of 4   │
│ ACCOUNT_CLOSED or       │ restricted to 08:00 to  │ E[R_net] <= 0 or        │ freezes retries  │ debit attempts  │
│ AUTH_REJECTED. Zero     │ 19:00 IST. Off-hour     │ attempt >= 3. Zero      │ until promised   │ per NPCI rules. │
│ outreach spam.          │ touches deferred +12h.  │ unprofitable outreach.  │ epoch timestamp. │ Protects debit. │
└─────────────────────────┴─────────────────────────┴─────────────────────────┴──────────────────┴─────────────────┘
```

1. **Terminal Failure Prohibition (Zero Touches)**: Permanent error signatures (`TERMINAL_ACCOUNT_CLOSED`, `TERMINAL_AUTH_REJECTED`) trigger an immediate halt (`HALTED_TERMINAL_FAILURE`). No WhatsApp message, no voice call, and no API retry is ever dispatched.
2. **TRAI Chrono-Gate Bounds (08:00–19:00 IST)**: Customer-facing communication outside the regulatory window is deferred by `+12h` (`is_trai_deferred: True`). Machine-to-machine silent API retries are exempt.
3. **Finite-Horizon MDP Stopping Rule**: The policy evaluator calculates expected net return:
   $$\mathbb{E}[R_{net}](k) = P(k) \cdot \text{GrossAmount} - (C_{channel} + \lambda \cdot k)$$
   Outreach halts immediately (`HALTED_MDP_STOPPING_RULE`) at step $k^*$ when $\mathbb{E}[R_{net}](k^*) \le 0$ or upon hitting the attempt cap ($k=3$).
4. **Promise-to-Pay (PTP) Temporal Freeze**: When a customer records a payment promise date, automated retries freeze (`PROMISE_TO_PAY_PENDING`) until `promised_timestamp_epoch`.
5. **NPCI AutoPay Mandate Execution Ceiling**: Debit re-presentment is bounded to 4 total attempts (1 original + 3 retries) per NPCI guidelines ([`src/mandate_policy.py`](./src/mandate_policy.py)), operating independently of customer messaging channels.

---

## 📊 Empirical 50-Record Benchmark Results

Tested on a benchmark dataset of 50 enterprise payment events ([`data/synthetic_batch_50.json`](./data/synthetic_batch_50.json)) spanning recurring subscriptions, high-intent checkouts, and B2B receivables:

```text
====================================================================================================
                             REVIVE: BATCH RECOVERY BENCHMARK REPORT
====================================================================================================
Total Ingested Failure Records  : 50
Total At-Risk GMV Exposed       : ₹2,11,600.00 (21,160,000 Paise)
Total Capital Recovered         : ₹1,45,200.00 (14,520,000 Paise)
Net Recovery Yield Rate         : 68.62% of Exposed GMV
Total Communication Ops Cost    : ₹16.20 (0.011% of Recovered Capital)
Net Profit Realized             : ₹1,45,183.80
Return on Communication Cost    : 8,962× Multiple
Ledger Integrity Verification   : 100% Cryptographically Valid (50/50 SHA-256 Blocks)
Regulatory & Stopping Invariants: 0 Violations (100% TRAI, NPCI, and PTP Adherence)
====================================================================================================
```

### Side-by-Side: Revive vs. Naive Static Baseline

| Metric | Naive Static Retry Strategy | Revive Autonomous Policy Engine | Delta Lift |
| :--- | :--- | :--- | :--- |
| **Capital Recovered** | ₹96,400.00 (45.56%) | **₹1,45,200.00 (68.62%)** | **+₹48,800.00 (+23.06% lift)** |
| **Communication Cost** | ₹84.50 (uncoordinated spam) | **₹16.20 (telemetry-aware)** | **-₹68.30 (80.8% cost reduction)** |
| **TRAI Off-Hour Violations** | 14 night-time dispatches | **0 (strict 08:00–19:00 gate)** | **100% regulatory compliance** |
| **Mandate Invalidation Rate** | 22% burned mandate limits | **0% (paced +45m after CBS outage)** | **Preserves recurring billing rights** |
| **Audit Verification** | Unverified application logs | **Cryptographic SHA-256 chain** | **Instant mathematical proof** |

---

## 🎛️ Dual Automation Modes

Revive supports two operational modes selectable via the user interface or API:

```text
                                ┌──────────────────────────────────────┐
                                │          EXECUTION MODES             │
                                └──────────────────┬───────────────────┘
                                                   │
                  ┌────────────────────────────────┴────────────────────────────────┐
                  ▼                                                                 ▼
      [AGENTIC AUTONOMOUS MODE]                                         [MANUAL POLICY-GATED MODE]
      • Autonomous 24/7 recovery execution                              • Human-in-the-loop compliance review
      • Evaluates telemetry + CBS bank matrix                           • Deterministic policy calculates candidate action
      • LLM selects action from legal candidate set                     • Action placed in Operator Review Queue
      • Auto-approves intervention (policy_approved = True)             • Requires operator approval before dispatch
```

1. **Agentic Mode (`ExecutionMode.AGENTIC_AUTONOMOUS`)**:
   Designed for high-volume automated operations. The orchestrator computes legal candidate interventions; the LLM agent evaluates customer history, error codes, and channel costs to select the optimal strategy; and the intervention is dispatched autonomously.
2. **Manual Mode (`ExecutionMode.MANUAL_POLICY_GATED`)**:
   Designed for compliance-sensitive operations. The deterministic policy computes the recommended recovery action, but marks it unapproved (`policy_approved = False`). It appears in the operator review queue for human sign-off (`/api/v1/operator/approve`).

---

## 📁 Repository Structure & Module Index

```text
.
├── AGENTS.md                   # Single Source of Truth, 23 Master Architectural Principles & Invariants
├── README.md                   # Master System Documentation & Architecture Overview
├── .antigravity-context-map.md # Domain-Driven Design (DDD) Context Map & Entity Mappings
├── server.ts                   # Full-Stack Express Server & TypeScript Engine Bridge (Port 3000)
├── app.py                      # FastAPI REST Gateway, Webhook Listener & SSOT Inspector (Port 8000)
├── dashboard.py                # Streamlit 5-Tab Command Center Alternative (Port 8501)
├── run_demo.py                 # Multi-Process Launcher (FastAPI + Streamlit + ngrok tunnel)
├── test_suite.py               # 9-Stage Automated Verification Suite
│
├── docs/                       # 📂 Consolidated Enterprise Documentation
│   ├── TECHNICAL.md            # Deep Technical Architecture, Sequence Flows & Mathematical Proofs
│   ├── BUSINESS.md             # Executive Business Case, Financial Models & Payback Period
│   ├── DEMO_RUNBOOK.md         # 60-Second Hackathon Walkthrough & Evaluation Runbook
│   └── LIVE_SETUP_GUIDE.md     # Production Gateway, Twilio & Webhook Configuration Guide
│
├── scripts/                    # 📂 Cross-Platform Launcher Scripts
│   ├── run.bat                 # Windows CMD 1-click launcher
│   └── run.ps1                 # Windows PowerShell 1-click launcher
│
├── data/
│   └── synthetic_batch_50.json # 50-Record Benchmark Evaluation Dataset
│
├── src/
│   ├── components/             # React 18 UI Modules (Overview, Console, Benchmark, Policy, Ledger)
│   ├── engine/                 # TypeScript Core Engine (Classifier, Orchestrator, Ledger, Dispatcher)
│   ├── schemas.py              # Strict Pydantic Data Contracts (Paise Integer Enforcement)
│   ├── classifier.py           # CBS Bank Outage Matrix & Error Taxonomy Engine
│   ├── orchestrator.py         # State Transitions, TRAI Gate, PTP Freeze & MDP Optimizer
│   ├── agentic_agent.py        # Bounded LLM Intervention Agent with Deterministic Fallback
│   ├── mandate_policy.py       # NPCI AutoPay 4-Attempt Mandate Execution Ceiling
│   ├── payment_client.py       # Gateway REST API Wrapper & Webhook Signature Verifier
│   ├── dispatcher.py           # WhatsApp Hinglish & Twilio Voice IVR Speech Dispatcher
│   ├── ledger.py               # Append-Only SHA-256 Cryptographic Audit Chain
│   ├── constants.py            # Financial & Regulatory System Invariants
│   ├── interfaces.py           # Interface Segregation Principle (ISP) Protocols
│   └── utils.py                # Pure Helper Utilities (HMAC-SHA256, PII Redaction, IST Time)
│
└── openspec/
    └── README.md               # Formal Engineering Specification & Roadmap
```

---

## 🚀 Quickstart & Verification

### 1. Web Application (React 18 + Full-Stack Express Bridge)

The complete application runs on **Port 3000**:

```bash
# Start development server
npm run dev

# Or build for production
npm run build
npm start
```

### 2. Python Backend & Automated Verification (FastAPI + Test Suite)

```bash
# Run the 9-stage automated test suite
python test_suite.py

# Launch multi-process Python environment (FastAPI on 8000 + Streamlit on 8501)
python run_demo.py
# Or on Windows: .\scripts\run.bat (or .\run.bat)
```

### 3. Key REST API Endpoints

- **System Readiness Probe**: `GET /api/v1/readiness`
- **SSOT Entity State Inspector**: `GET /api/v1/entity/{entity_id}/ssot`
- **Incoming Webhook Ingestion**: `POST /webhook/payment` or `POST /api/v1/webhook/razorpay`
- **Promise-to-Pay Registration**: `POST /api/v1/ptp/commit`
- **Operator Review Approval**: `POST /api/v1/operator/approve`
- **Cryptographic Block Audit**: `GET /api/v1/ledger/audit/{log_id}`
- **Evaluation Batch Benchmark**: `GET /api/benchmark`

---

## 📄 Documentation Suite Index

| Document | Focus & Audience | Key Contents |
| :--- | :--- | :--- |
| **[AGENTS.md](./AGENTS.md)** | Core Engineers & AI Assistants | Single Source of Truth (SSOT), 23 Master Architecture Principles, Non-Negotiable Invariants. |
| **[TECHNICAL.md](./docs/TECHNICAL.md)** | System Architects & Leads | Mathematical MDP Proofs, Sequence Diagrams, State Machines, SHA-256 Ledger Mechanics. |
| **[BUSINESS.md](./docs/BUSINESS.md)** | Executive & Finance Leaders | Unit Economics, ROI Multipliers, GMV Leakage Vectors, Payback Period Calculations. |
| **[DEMO_RUNBOOK.md](./docs/DEMO_RUNBOOK.md)** | Hackathon Judges & Operators | 60-Second Pitch Guide, Evaluation Walkthrough, Script & Live Scenario Tracing. |
| **[LIVE_SETUP_GUIDE.md](./docs/LIVE_SETUP_GUIDE.md)** | DevOps & Integration Engineers | Live Razorpay Webhook Configuration, Twilio WhatsApp/Voice Setup, and Environment Variables. |
| **[.antigravity-context-map.md](./.antigravity-context-map.md)** | Domain Engineers | Domain-Driven Design (DDD) Bounded Context Map and Architectural Boundaries. |
| **[openspec/README.md](./openspec/README.md)** | Engineering Leadership | Formal OpenSpec Specifications, v1.0 Feature Audit, and Long-Term Roadmap. |

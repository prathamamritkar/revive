# Revive — Revenue Recovery Engine

> **Deterministic, Policy-Gated Capital Recovery Engine for Enterprise Payment Platforms**

[![Architecture](https://img.shields.io/badge/Architecture-4--Layer%20DDD-0A84FF?style=flat-square)](./TECHNICAL.md) [![Verification](https://img.shields.io/badge/Verification-8--Stage%20Pass-30D158?style=flat-square)](./test_suite.py) [![Compliance](https://img.shields.io/badge/Compliance-TRAI%20IST-FF9F0A?style=flat-square)](./AGENTS.md) [![Auditability](https://img.shields.io/badge/Ledger-SHA--256-BF5AF2?style=flat-square)](./src/ledger.py)

---

## Overview

Revenue loss across payment platforms is rarely a single catastrophic event; it leaks silently across degrading payments, abandoned checkouts, failed subscriptions, or overdue invoices. Traditional recovery systems rely on uncoordinated static retries that trigger customer fatigue, incur heavy API transaction fees, or violate regulatory calling bounds.

**Revive** closes the loop from detection and diagnosis to intervention and actual money recovery. By pairing hybrid LLM intent intelligence with deterministic policy rules, TRAI contact bounds, mathematical Markov Decision Process (MDP) stopping invariants, and a SHA-256 cryptographic audit ledger, Revive turns at-risk payment flows into recovered capital.

```text
                           ┌─────────────────────────────────┐
                           │   INGESTED TELEMETRY EVENT (E)  │
                           └────────────────┬────────────────┘
                                            │
 ┌──────────────────────────────────────────▼──────────────────────────────────────────┐
 │ LAYER 1: DIAGNOSTIC & HYBRID INTENT ENGINE                                          │
 │ • Deterministic error code parsing against Core Banking System (CBS) matrices       │
 │ • LLM-powered natural language intent classification for customer drop-off notes    │
 └──────────────────────────────────────────┬──────────────────────────────────────────┘
                                            │
 ┌──────────────────────────────────────────▼──────────────────────────────────────────┐
 │ LAYER 2: POLICY ORCHESTRATOR & MATHEMATICAL MDP                                     │
 │ • TRAI Chrono-Gate: Bounded contact window (08:00–19:00 IST); defers non-compliant  │
 │ • Promise-to-Pay (P2P) Lock: Freezes outreach during active grace periods           │
 │ • MDP Stopping Invariant: Halts sequence when E[R_net] <= 0 or Attempt >= 3         │
 └──────────────────────────────────────────┬──────────────────────────────────────────┘
                                            │
 ┌──────────────────────────────────────────▼──────────────────────────────────────────┐
 │ LAYER 3: ADAPTIVE MULTI-CHANNEL DISPATCHER                                          │
 │ • WhatsApp Hinglish: Context-aware messaging + signed 1-click Payment Links         │
 │ • Voice IVR Nudge: Outbound Twilio speech calls with interactive DTMF selection     │
 │ • Virtual Accounts: Auto-reconciling NEFT/RTGS virtual accounts for B2B receivables │
 └──────────────────────────────────────────┬──────────────────────────────────────────┘
                                            │
 ┌──────────────────────────────────────────▼──────────────────────────────────────────┐
 │ LAYER 4: CRYPTOGRAPHIC AUDIT LEDGER                                                 │
 │ • Append-only, tamper-proof SHA-256 hash chain recording every state mutation       │
 └─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📚 System Documentation Index

Documentation is partitioned by operational domain and target persona:

| Document | Primary Audience | Information Domain |
| --- | --- | --- |
| 📖 [AGENTS.md](./AGENTS.md) | **AI Assistants & Core Engineers** | Single Source of Truth (SSOT), non-negotiable stopping invariants, 23 master architectural principles, and test suite contracts. |
| 💼 [BUSINESS.md](./BUSINESS.md) | **C-Suite & Business Leaders** | Financial ROI models, unit economics, payback period analysis, GMV leakage taxonomy, and commercial impact metrics. |
| ⚙️ [TECHNICAL.md](./TECHNICAL.md) | **System Architects & Leads** | Layered architecture, sequence diagrams, API schemas, hybrid LLM classification mechanics, and ledger cryptography. |
| 🚀 [DEMO_RUNBOOK.md](./DEMO_RUNBOOK.md) | **Product Managers & Operators** | 60-second pitch runbook, script guide, manual approval queue workflows, and visual dashboard walkthrough. |
| 🛠️ [LIVE_SETUP_GUIDE.md](./LIVE_SETUP_GUIDE.md) | **DevOps & Integration Engineers** | Production environment configuration, Twilio WhatsApp/Voice credentials, live Gateway API keys, and public ngrok setup. |
| 🗺️ [.antigravity-context-map.md](./.antigravity-context-map.md) | **Domain Engineers** | Domain-Driven Design (DDD) context map, domain entities, value objects, invariant boundaries, and module mappings. |
| 📋 [openspec/README.md](./openspec/README.md) | **Engineering Leadership** | Formal specification, current v1.0 feature audit, versioned schema definitions, and production roadmap. |

---

## Application Modules

The application interface organizes recovery operations into five canonical modules:

| Module | Navigation | Functional Scope |
| --- | --- | --- |
| **Overview** | `Overview` | Financial recovery metrics, bank CBS availability status, pending review queue, and recent dispatches feed. |
| **Console** | `Console` | Interactive channel simulator (WhatsApp Hinglish & Voice IVR), 4-step decision traces, and custom webhook ingestion. |
| **Benchmark** | `Benchmark` | 50-record batch simulation, side-by-side performance comparison vs. naive baseline, and live cryptographic audit stream. |
| **Policy** | `Policy` | Issuing bank CBS pacing matrix, TRAI chrono-gate bounds, MDP net yield formula, and deterministic routing table. |
| **Ledger** | `Ledger` | Append-only SHA-256 state transition ledger, block explorer, and single-block cryptographic proof verification. |

---

## Core Architectural Pillars

Revive is engineered around three non-negotiable architectural pillars designed to maximize recovered capital while eliminating customer fatigue and ensuring full regulatory compliance:

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CORE ARCHITECTURAL PILLARS                                     │
├──────────────────────────────┬───────────────────────────────────┬───────────────────────────────┤
│    PILLAR 1: TRAI CHRONO-    │    PILLAR 2: FINITE-HORIZON       │    PILLAR 3: SHA-256          │
│             GATE             │       MDP YIELD OPTIMIZER         │        AUDIT LEDGER           │
├──────────────────────────────┼───────────────────────────────────┼───────────────────────────────┤
│ • Strict 08:00–19:00 IST     │ • Mathematical stopping rule k*   │ • Append-only SHA-256 hash    │
│   commercial outreach window │ • Halts when E[R_net](k*) <= 0    │   block state transitions     │
│ • Non-compliant dispatches   │ • Balances empirical recovery vs. │ • Cryptographically verifiable│
│   deferred by +12h           │   transmission & fatigue costs    │   provable audit trail        │
│ • Silent API retries exempt  │ • Hard cap at 3 attempts          │ • Zero floating-point drift   │
└──────────────────────────────┴───────────────────────────────────┴───────────────────────────────┘
```

### Pillar 1: TRAI Chrono-Gate (08:00–19:00 IST)
Zero customer fatigue or nighttime spam. Under Telecom Commercial Communications Customer Preference Regulations (TCCCPR), all customer-facing touches (WhatsApp, SMS, IVR Voice calls) are chronologically restricted to **08:00 AM to 07:00 PM IST** (UTC+5:30). Communications triggered during off-hours are automatically rolled forward by `+12h` without dropping contextual state or intent. Machine-to-machine silent API retries remain active 24/7.

### Pillar 2: Finite-Horizon Markov Decision Process (MDP) Net Yield Optimizer
Revive treats payment recovery as a sequential decision problem over a finite horizon ($k \in \{1, 2, 3\}$). The policy evaluator calculates expected net yield:
$$\mathbb{E}[R_{net}](k) = P(k) \cdot \text{GrossAmount} - (C_{channel} + \lambda \cdot k)$$
Outreach halts immediately at step $k^*$ when $\mathbb{E}[R_{net}](k^*) \le 0$ or upon hitting the maximum attempt cap ($k=3$), preventing uncoordinated retry loops and protecting merchant brand reputation.

### Pillar 3: Cryptographic SHA-256 Audit Ledger
Every state transition—from initial failure ingestion to PTP lock, channel dispatch, or webhook settlement—generates an immutable SHA-256 cryptographic hash block linking to the previous block hash. All monetary quantities are strictly processed in **Integer Paise** (1 INR = 100 Paise), guaranteeing zero IEEE-754 floating-point drift across accounting audits.

---

## The 4-Stage Recovery Lifecycle

Revive executes an automated 4-stage lifecycle for every payment failure event:

```text
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│    STAGE 01     │ ───> │    STAGE 02     │ ───> │    STAGE 03     │ ───> │    STAGE 04     │
│ Ingest &        │      │ Policy Gate &   │      │ Targeted        │      │ Cryptographic   │
│ Diagnose        │      │ Timing          │      │ Outreach        │      │ Proof           │
└─────────────────┘      └─────────────────┘      └─────────────────┘      └─────────────────┘
 • Verified Webhook       • TRAI Chrono-Gate       • WhatsApp Hinglish      • SHA-256 Hash
   Ingestion (HMAC)         Bounds (08-19 IST)       1-Click Link             Chain Append
 • CBS Gateway Health     • PTP Lock Check         • Outbound Twilio        • Proof Inspector
   Matrix Lookup          • Mathematical MDP         Voice IVR Call           Validation
 • Intent Extraction        Yield Calculator       • Smart Virtual Acct     • Webhook Recon
```

1. **Stage 01: Ingest & Diagnose**
   Ingests verified payment failure webhooks (`subscription.charged_failed`, `payment.failed`, checkout drops) with HMAC-SHA256 signature verification. Performs sub-millisecond deterministic error code categorization against the Core Banking System (CBS) registry, with bounded LLM classification for unstructured customer notes.
2. **Stage 02: Policy Gate & Timing Evaluation**
   Validates the candidate against non-negotiable invariants: TRAI contact window check, active Promise-to-Pay (PTP) temporal lock check, terminal failure prohibition (0-touch halt on `TERMINAL_ACCOUNT_CLOSED` / `TERMINAL_AUTH_REJECTED`), and finite-horizon MDP net yield optimization.
3. **Stage 03: Targeted Outreach & Channel Execution**
   Dispatches the optimal recovery vehicle: localized WhatsApp Hinglish notifications with pre-signed 1-click Razorpay links, outbound Twilio Voice IVR speech calls with DTMF keypad interaction, dedicated Smart Collect Virtual Accounts, or paced silent API retries.
4. **Stage 04: Cryptographic Settlement & Audit Proof**
   Appends the state transition to the append-only SHA-256 audit ledger, storing cryptographic proof of compliance, timestamp, channel cost, and recovered capital for full accounting traceability.

---

## Three Specialized Recovery Channels

Revive deploys specialized recovery strategies calibrated to specific revenue streams:

| Revenue Channel | Failure Modes & Signatures | Recovery Mechanism | Operational Outcome |
|---|---|---|---|
| **Recurring Subscriptions & Mandates** | `INSUFFICIENT_FUNDS`, `GATEWAY_TIMEOUT`, bank network dips | Bank CBS outage pacing (+45m cooldown), localized WhatsApp Hinglish notifications with pre-signed 1-click Razorpay links (`https://rzp.io/i/...`). | Eliminates involuntary churn without burning mandate authorization limits. |
| **Abandoned Checkouts** | High-intent drop-offs, user session timeouts, UPI app aborts | Instant intent triage, automated 1-click pre-signed payment link generated within 15 minutes of abandonment with loss-averse personalized copy. | Recovers high-intent buyers before drop-off intent decays. |
| **B2B Overdue Invoices & Receivables** | Commercial net-30 delays, disputed invoices, procurement lag | Dedicated Razorpay Smart Collect Virtual Accounts (`rzp.virtual.*@hdfcbank`) auto-reconciling NEFT/RTGS wire transfers, paired with Promise-to-Pay (PTP) grace period freezes. | Provides friction-free corporate wire transfer settlement with automated ledger reconciliation. |

---

## Separation of Concerns: Documentation vs. Demonstrator UI

Revive maintains a strict boundary between documentation and user interface:

- **The Interactive Web Application**: Designed strictly as an operator command center and live demonstration instrument. All visual screens are dedicated to active controls, real-time telemetry feeds, interactive Voice IVR dialpads, bank gateway health toggles, and cryptographic ledger verification. It contains zero marketing brochures, promotional hero copy, or duplicate informational text.
- **The Repository Documentation Suite (`README.md`, `TECHNICAL.md`, `AGENTS.md`)**: Serves as the authoritative knowledge repository containing architectural pillars, mathematical formulations, regulatory compliance specifications, economic ROI models, and integration runbooks.

---

## Failure Diagnostic Taxonomy & Recovery Workflows

The diagnostic engine maps incoming telemetry events to a discrete classification space using a 2-stage pipeline: deterministic CBS registry mapping followed by bounded LLM fallback for ambiguous natural language notes.

```
Classification Space C ∈ {
  TRANSIENT_NETWORK_DOWN, TRANSIENT_BALANCE_LOW,
  TERMINAL_ACCOUNT_CLOSED, TERMINAL_AUTH_REJECTED,
  ABANDONED_CHECKOUT,      B2B_OVERDUE_INVOICE
}
```

| Failure Signature | Diagnostic Classification | Native Recovery Direction | Channel & Action Vector |
| --- | --- | --- | --- |
| `GATEWAY_TIMEOUT` / 504 | `TRANSIENT_NETWORK_DOWN` | Payment degradation $\rightarrow$ root cause $\rightarrow$ action | Silent API retry shifted +45m to clear CBS window |
| `INSUFFICIENT_FUNDS` / 402 | `TRANSIENT_BALANCE_LOW` | Mandate retry & Failed-subscription recovery | WhatsApp Hinglish link + P2P salary date lock |
| `CART_ABANDONED` | `ABANDONED_CHECKOUT` | Checkout drop-off recovery | WhatsApp 1-click UPI/Card payment link (+15m) |
| `OVERDUE_INVOICE_15D` | `B2B_OVERDUE_INVOICE` | B2B receivables chaser | Dedicated Virtual Account (`rzp.virtual.*@hdfcbank`) for NEFT |
| Escalated Attempt 3 | Escalated Nudge | Hinglish voice recovery | Interactive outbound Twilio Voice IVR speech call |
| `ACCOUNT_CLOSED` / 403 | `TERMINAL_ACCOUNT_CLOSED` | Terminal Prohibition | 0-Touch HALT (No dispatch) |
| `AUTH_REJECTED` / 401 | `TERMINAL_AUTH_REJECTED` | Terminal Prohibition | 0-Touch HALT (No dispatch) |

---

## Policy Governance & Mathematical MDP Invariants

Revive models recovery as a constrained Markov Decision Process (MDP) to maximize Net Expected Recovered Capital `E[R_net]` while bounding operational costs and customer fatigue:

$$
\mathbb{E}[R_{net}](k) = P(k) \cdot \text{GrossAmount} - (C_{channel} + \lambda \cdot k)
$$

Where:
- $P(k)$: Empirical recovery probability at attempt $k$ ($P(1)=0.75, P(2)=0.50, P(3)=0.25$).
- $\text{GrossAmount}$: Transaction amount in integer Paise ($1\text{ INR} = 100\text{ Paise}$).
- $C_{channel}$: Operational transmission cost ($\text{Silent}=0, \text{WhatsApp}=60, \text{Voice}=150, \text{Human}=500\text{ Paise}$).
- $\lambda \cdot k$: Customer fatigue penalty function ($\lambda = 100\text{ Paise/attempt}$).

### Non-Negotiable Invariant Rules

1. **MDP Halting Threshold**: Outreach strictly halts (`HALTED_MDP_STOPPING_RULE`) at step `k*` when `E[R_net](k*) <= 0`.
2. **Attempt Ceiling**: Hard cap at `k = 3` attempts (`HALTED_MAX_ATTEMPTS`).
3. **Terminal Prohibition**: Immediate 0-touch halt on `TERMINAL_ACCOUNT_CLOSED` and `TERMINAL_AUTH_REJECTED`.
4. **TRAI Chrono-Gate Bounds**: Customer outreach is restricted to **08:00–19:00 IST**. Non-compliant schedules are deferred by `+12h` (`is_trai_deferred: True`).
5. **Promise-to-Pay (PTP) Lock**: Active PTP commitments freeze outreach until `promised_timestamp_epoch`.
6. **Dual Operational Modes**: Supports **Agentic Autonomous Mode** (`ExecutionMode.AGENTIC_AUTONOMOUS` with `policy_approved=True`) and **Manual Policy-Gated Mode** (`ExecutionMode.MANUAL_POLICY_GATED` requiring operator signoff).

---

## Cryptographic Audit Ledger & Security Controls

- **SHA-256 Chain Integrity**: Every state transition generates an immutable hash block:

$$
H_i = \text{SHA-256}(\text{entity-id} \parallel \text{status} \parallel \text{recovered-paise} \parallel H_{i-1} \parallel \text{timestamp})
$$

- **HMAC Signature Authentication**: Ingested webhooks verify HMAC-SHA256 signature headers (`X-Webhook-Signature` / `X-Razorpay-Signature`) against `REVIVE_WEBHOOK_SECRET`.
- **PII Anonymization**: Telephone numbers and customer identifiers are hashed via `redact_pii()` prior to logging or external API transmission.

---

## Repository Architecture & Module Index

```text
.
├── AGENTS.md                   # Single Source of Truth & Core System Invariants
├── BUSINESS.md                 # Executive ROI Analysis & Unit Economic Models
├── DEMO_RUNBOOK.md             # 60-Second Pitch & Operator Runbook
├── LIVE_SETUP_GUIDE.md         # Production API, Twilio & Webhook Deployment Guide
├── TECHNICAL.md                # Technical Architecture, Sequence Flows & Schemas
├── README.md                   # System Documentation & Architecture Overview
├── .antigravity-context-map.md # Domain-Driven Design (DDD) Bounded Context Map
├── app.py                      # FastAPI Gateway Server & Webhook Ingestion Router
├── dashboard.py                # Streamlit 5-Tab Command Center Interface
├── run_demo.py                 # Master Application Launcher & Public HTTPS Tunnel
├── run.bat                     # Executable Windows Batch Launcher
├── run.ps1                     # Executable PowerShell Launcher
├── test_suite.py               # 8-Stage Automated Verification Suite
├── requirements.txt            # Package Dependency Specification
├── data/
│   └── synthetic_batch_50.json # 50-Record Evaluation Benchmark Dataset
├── openspec/
│   └── README.md               # OpenSpec Specification & v1.0 Engineering Roadmap
└── src/
    ├── __init__.py             # Revive Package Initializer
    ├── schemas.py              # Strict Pydantic Data Contracts (Paise Validation)
    ├── classifier.py           # Diagnostic Rule Tree & LLM Intent Classifier
    ├── orchestrator.py         # Policy Orchestrator, TRAI Gate & MDP Calculator
    ├── payment_client.py       # Gateway REST API Wrapper & Webhook Signature Verifier
    ├── rzp_client.py           # Native SDK Integration Client
    ├── dispatcher.py           # WhatsApp & Twilio Voice IVR Speech Dispatcher
    ├── ledger.py               # Cryptographic SHA-256 Audit Chain Manager
    ├── constants.py            # System Constants & Domain Invariants
    ├── interfaces.py           # Protocol Definitions (ISP Segregated Interfaces)
    └── utils.py                # Pure Helper Utilities (HMAC, PII Redaction, Conversions)
```

### Module Cross-Reference

- **[app.py](./app.py)**: Webhook ingestion (`/webhook/payment`), HMAC validation, REST API routes.
- **[dashboard.py](./dashboard.py)**: Streamlit visual analytics, approval queues, interactive scenario launcher.
- **[run_demo.py](./run_demo.py)**: Multi-process orchestration launching FastAPI, Streamlit, and pyngrok tunnels.
- **[test_suite.py](./test_suite.py)**: 8-stage automated test runner verifying system contracts.
- **[src/schemas.py](./src/schemas.py)**: Pydantic domain models with strict Paise integer validation.
- **[src/classifier.py](./src/classifier.py)**: Core diagnostic heuristics and LLM intent extraction.
- **[src/orchestrator.py](./src/orchestrator.py)**: State transition logic, TRAI time gates, and MDP stopping calculator.
- **[src/payment_client.py](./src/payment_client.py)**: Payment link generation and Virtual Account allocation.
- **[src/dispatcher.py](./src/dispatcher.py)**: Multichannel dispatch handler (WhatsApp Hinglish & Twilio TwiML Voice).
- **[src/ledger.py](./src/ledger.py)**: Immutable SHA-256 state-transition ledger implementation.

---

## Empirical Benchmark & Operational Economics

Revive includes a 50-record evaluation benchmark ([data/synthetic_batch_50.json](./data/synthetic_batch_50.json)). Execute `python test_suite.py` to verify:

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

### Economic Return Metrics

- **Gross Exposed Capital**: ₹2,11,600.00 across 50 telemetry events.
- **Net Recovered Capital**: **₹1,45,200.00 (68.62% Yield Rate)**.
- **Total Operational Expense**: **₹16.20** total dispatch costs.
- **Capital Efficiency Multiple**: **8,962x Return on Outreach Cost**.

---

## Execution Runbook & Verification

### 1. Launch Environment (API + Visual Interface + Public Tunnel)

```powershell
.\run.bat
```
*Or via PowerShell:*
```powershell
.\run.ps1
```
*Or via Python:*
```powershell
python run_demo.py
```

### 2. Primary Endpoints

- **Streamlit Command Center**: [http://localhost:8501](http://localhost:8501)
- **FastAPI Interactive Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **System Readiness Probe**: [http://localhost:8000/api/v1/readiness](http://localhost:8000/api/v1/readiness)
- **SSOT State Inspector**: [http://localhost:8000/api/v1/entity/{entity_id}/ssot](http://localhost:8000/api/v1/entity/sub_01/ssot)

### 3. Automated Test Suite Execution

Run the complete 8-stage automated verification suite:

```powershell
python test_suite.py
```

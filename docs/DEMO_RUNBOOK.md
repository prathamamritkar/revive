# Revive — Hackathon Demonstration Runbook & Pitch Guide

> **Step-by-Step Evaluator Walkthrough, Script & Live Scenario Tracing**

[← Back to Master Overview](../README.md) • [Technical Architecture (TECHNICAL.md)](./TECHNICAL.md) • [Business Case (BUSINESS.md)](./BUSINESS.md)

---

## ⚡ Pre-Demo Quickstart (Under 30 Seconds)

1. **Launch the complete environment**:
   ```bash
   # Development Server (React + Express fullstack on Port 3000)
   npm run dev
   ```
   *Or for Python FastAPI & Streamlit multi-process launcher:*
   ```bash
   python run_demo.py
   # Or on Windows: .\run.bat
   ```

2. **Access Points**:
   - **Web Application**: [http://localhost:3000](http://localhost:3000)
   - **Streamlit Command Center**: [http://localhost:8501](http://localhost:8501)
   - **FastAPI OpenAPI Interactive Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **System Readiness Probe**: [http://localhost:8000/api/v1/readiness](http://localhost:8000/api/v1/readiness)

---

## ⏱️ The 60-Second Hackathon Pitch Script

| Time | Screen / Action | Pitch Script & Key Talking Points |
| :--- | :--- | :--- |
| **00:00–00:15** | **Tab 1: Overview**<br>Point to recovery KPI cards | *"Every year, payment platforms lose billions to payment failure churn. But revenue loss isn't a single event—it leaks across failed recurring debits, abandoned checkouts, and overdue B2B invoices. Revive is an autonomous revenue recovery engine that couples bounded agentic AI with deterministic financial policy rules to systematically win back lost capital."* |
| **00:15–00:30** | **Tab 3: Benchmark**<br>Click **▶ EXECUTE BENCHMARK** | *"Here is our empirical 50-event benchmark. Watch Revive process ₹2,11,600 in exposed GMV. It claws back ₹1,45,200—a **68.62% net recovery yield**—at an operational communication cost of just **₹16.20**. That is an **8,962× return on communication spend**, with **zero regulatory violations**."* |
| **00:30–00:45** | **Tab 2: Console**<br>Trigger `INSUFFICIENT_FUNDS` event | *"Notice our core architectural invariant: **AI classifies and selects; deterministic policy bounds and executes.** The LLM cannot make unbounded decisions. It selects from a deterministically pre-computed candidate set, automatically deferring touches outside TRAI hours (08:00–19:00 IST) and dispatching localized WhatsApp links or Hinglish Voice IVR nudges."* |
| **00:45–01:00** | **Tab 5: Ledger**<br>Click **VERIFY BLOCK PROOF** | *"Finally, every state mutation is sealed in an immutable, cryptographically chained SHA-256 ledger. Each block links to the previous block's hash with integer Paise precision. If any actor alters a historical record, the entire downstream chain fails validation. Revive is audit-ready and enterprise-grade out-of-the-box."* |

---

## 🔍 In-Depth 3-Minute Evaluator Tour

### Step 1: Ingestion & Bank Downtime Awareness (Tab 2: Console)
1. In the **Console** view, click **Simulate Failure Webhook**.
2. Select **Bank: HDFC** and **Error: `GATEWAY_TIMEOUT`**.
3. **What to Observe**:
   - The engine identifies an active Core Banking System (CBS) network dip.
   - Instead of immediately spamming the customer or retrying the bank, Revive schedules a **Machine-to-Machine Silent API Retry** shifted by `+45m` to allow the bank outage to resolve.
   - Because silent retries do not contact the customer, they are **TRAI-Exempt** and execute 24/7.

### Step 2: Bounded Agentic Reasoning & Decision Trace (Tab 2: Console)
1. Switch scenario to **Bank: SBIN** and **Error: `INSUFFICIENT_FUNDS`** on a ₹1,500 subscription.
2. Examine the **Agentic Decision Trace** panel:
   - **Step 1 (Telemetry Audit)**: Validates error code against bank CBS health.
   - **Step 2 (MDP Yield Evaluation)**: Calculates expected net return ($E[R_{net}] > 0$).
   - **Step 3 (Intervention Selection)**: Selects localized **WhatsApp Hinglish** notification with pre-signed 1-click Razorpay payment link.
   - **Step 4 (Regulatory Verification)**: Validates TRAI 08:00–19:00 IST window and active Promise-to-Pay status.
3. Switch Automation Mode in settings to **Manual Policy-Gated Mode**:
   - Notice that the action is marked `policy_approved = False` and placed in the **Pending Review Queue**, requiring human sign-off before dispatch.

### Step 3: Promise-to-Pay (PTP) Grace Period Lock (Tab 2: Console)
1. In the interactive phone dialpad or chat preview, click **Commit to Pay (PTP)**.
2. Select a commitment date (e.g., +7 days when salary deposits).
3. **What to Observe**:
   - The entity immediately enters `PROMISE_TO_PAY_PENDING`.
   - Automated retries freeze completely until the promised epoch timestamp.
   - This eliminates customer harassment complaints and strictly follows RBI Fair Practice recovery guidelines.

### Step 4: Cryptographic Proof Verification (Tab 5: Ledger)
1. Navigate to the **Ledger** view.
2. Inspect the latest block:
   - View `entity_id`, `status: RECOVERED`, `recovered_paise: 150000`, `total_cost_paise: 60`.
   - Inspect the block's `audit_hash` and `prev_hash`.
3. Click **Verify Chain**:
   - The engine validates the SHA-256 hash linkage from Genesis block (0) to the current head block in $O(N)$ time.
   - Confirms that zero database mutations or historical record alterations have occurred.

---

## 💡 Evaluator FAQ: Handling Technical Questions

#### Q1: "Why not let an LLM autonomously decide how many times to retry or when to call?"
> **Answer**: In regulated enterprise fintech, unconstrained LLM autonomy is a liability. An LLM could hallucinate off-hour calls (violating TRAI regulations), repeatedly charge a depleted card (burning NPCI mandate limits), or spam an angry customer. Revive enforces **bounded autonomy**: deterministic policy code computes strictly legal candidate actions and evaluates mathematical stopping rules; the LLM provides contextual reasoning to choose the best option within that legal set.

#### Q2: "How does Revive handle floating-point rounding errors in financial audits?"
> **Answer**: All monetary values throughout Revive are strictly calculated and stored in **Integer Paise** ($1\text{ INR} = 100\text{ Paise}$). We strictly prohibit IEEE-754 floating-point numbers in financial state calculations, eliminating fractional-cent drift across accounting ledgers.

#### Q3: "What happens if an external API (Twilio or Razorpay) experiences an outage?"
> **Answer**: Revive features graceful degradation. If external carrier or gateway APIs are unreachable or in mock mode, the dispatcher automatically activates synthetic mock handlers tagged with `"is_degraded_fallback": true`. The state machine, decision trace, and cryptographic ledger continue to function without crashing.

#### Q4: "How does the system know when a bank's Core Banking System is down?"
> **Answer**: Layer 1 maintains an active CBS status matrix for major Indian issuing banks (HDFC, SBI, ICICI, Axis, Kotak). When a webhook arrives with transient network or gateway timeouts, Revive correlates the failure code against the issuing bank's CBS health profile and spaces retries around the typical 45-minute clearing window.

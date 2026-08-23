# Revive — 60-Second Pitch & Demonstration Runbook

> **Operational Operator Guide & Evaluator Walkthrough**

[← Back to Master Overview](./README.md) • [Technical Specifications (TECHNICAL.md)](./TECHNICAL.md) • [Live Setup Guide (LIVE_SETUP_GUIDE.md)](./LIVE_SETUP_GUIDE.md)

---

## Pre-Demo Quickstart Checklist (30 seconds)

1. Launch the complete application stack (FastAPI + Streamlit Dashboard + Live Public Tunnel) in 1 click:
   ```powershell
   .\run.bat
   ```
   *Or via PowerShell:* `.\run.ps1`  
   *Or via Python directly:* `python run_demo.py`

2. Open **Streamlit Command Center**: [http://localhost:8501](http://localhost:8501)
3. Open **FastAPI Interactive API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 60-Second Pitch Tour

### Step 1 — Executive Overview & Mission (Tab 1) · 10s
1. Point to **AUTONOMOUS REVENUE RECOVERY ENGINE** header: *"Find revenue slipping away and win it back."*
2. Point to **ENTERPRISE COMPLIANCE** summary cards highlighting key evaluation pillars:
   - **Problem Value**: Solves ₹2.11L exposed GMV leakage across checkout drop-offs, mandate failures & B2B receivables.
   - **Build Quality**: 100% reliable HMAC signature security & SHA-256 state ledger chain.
   - **AI Judgment**: Hybrid LLM intent extraction for ambiguous customer notes + MDP stopping invariants.
   - **Failure Recovery**: P2P salary date locks & Hinglish Voice IVR call escalation.

### Step 2 — Autonomous AI Decision Trace (Tab 1) · 10s
1. Show the **AUTONOMOUS AI AGENT DECISION TRACE ENGINE** panel ([Revive-Agent-01](./src/schemas.py)).
2. Point to the **96% Agent Confidence Score** and 3-stage reasoning trace (Telemetry Audit $\rightarrow$ MDP Yield Reasoning $\rightarrow$ Multi-Channel Dispatch).
3. Click **▶ EXECUTE EVALUATION BENCHMARK** — watch ₹1,45,200 recovered capital populate live (**68.62% yield**) across 50 audited events.

### Step 3 — 7 Recovery Directions & Hybrid AI Intent (Tab 2) · 10s
1. Open **TELEMETRY & TOPOLOGY (Tab 2)**.
2. Point to **7 RECOVERY DIRECTIONS COVERED** overview matrix.
3. Type custom natural language note: *"Will pay next week when salary hits my account"* $\rightarrow$ show **HYBRID AI INTENT INSPECTOR** extracting `TRANSIENT_BALANCE_LOW` at 94% confidence.
4. Select **HDFC** bank + **GATEWAY_TIMEOUT** error code $\rightarrow$ show `+45m` silent retry delay.

### Step 4 — MDP Yield Calculator & Policy Bounds (Tab 3) · 10s
1. Open **POLICY ENGINE (Tab 3)**.
2. Show formula:

$$\mathbb{E}[R_{\text{net}}](k) = P_{\text{success}}(k) \cdot V - C_{\text{action}} - \lambda \cdot L_{\text{fatigue}}(k)$$
3. Point to TRAI Chrono-Gate indicator (08:00–19:00 IST) and Salary-Cycle Retry Sequencer visual chart.
4. Highlight: *"The sequence strictly halts when expected net recovery falls below operational outreach cost + customer fatigue penalty."*

### Step 5 — Promise-to-Pay & TwiML Voice IVR (Tab 4) · 10s
1. Open **DISPATCH SANDBOX (Tab 4)**.
2. Fire a custom recovery event $\rightarrow$ view live Hinglish WhatsApp payment link dispatch in chat preview.
3. Register a **Promise-to-Pay (PTP)** commitment for `inv_b2b_101` (+7 days delay) $\rightarrow$ view active PTP tracker table and grace period lock.
4. Click **SYNTHESIZE HINGLISH TWIML VOICE XML** $\rightarrow$ view TwiML XML speech payload (`<Say language="hi-IN" voice="Polly.Aditi">`).

### Step 6 — SHA-256 Cryptographic Audit Ledger (Tab 5) · 10s
1. Open **SHA-256 LEDGER (Tab 5)**.
2. Point to **SHA-256 Hash Status: VALID (O(N) Verified)** indicator.
3. Click **VERIFY SHA-256 CHAIN** — toast notification confirms zero-tamper proof across all ledger blocks.
4. Highlight: *"Every state transition is an audited cryptographic block formatted as `entity_id:status:recovered_paise:prev_hash`. RBI compliance ready out-of-the-box."*

---

## Verification & Acceptance Criteria

| Criterion | Evaluation Target | Verified Status | Reference |
| --- | --- | --- | --- |
| `python test_suite.py` 8 stages | All PASS | **100% PASS** | [test_suite.py](./test_suite.py) |
| 50-Record Benchmark Yield | Measured Money Recovered ($\ge 65\%$) | **68.62%** (₹1,45,200.00) | [data/synthetic_batch_50.json](./data/synthetic_batch_50.json) |
| Operational Cost Ratio | $< 0.05\%$ of Recovered GMV | **0.011%** (₹16.20) | [BUSINESS.md](./BUSINESS.md) |
| Cryptographic Ledger Integrity | 100% Valid SHA-256 Hash Chain | **VALID** | [src/ledger.py](./src/ledger.py) |
| TRAI / RBI Regulatory Violations | 0 Violations (08:00–19:00 IST) | **0** | [AGENTS.md](./AGENTS.md) |

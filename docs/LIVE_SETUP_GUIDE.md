# Revive — Production Setup & Live Gateway Integration Guide

> **Deployment Guide for Live Payment Gateways, Carrier Communications & Webhook Listeners**

[← Back to Master Overview](../README.md) • [Technical Architecture (TECHNICAL.md)](./TECHNICAL.md) • [Demo Pitch Guide (DEMO_RUNBOOK.md)](./DEMO_RUNBOOK.md)

---

## 1. Runtime Environment & Dual-Stack Architecture

Revive is architected to run seamlessly in both **simulation/testing mode** (zero external dependencies required) and **live production mode** (connected to Razorpay, Twilio, and Google Gemini).

The system supports two complementary runtime stacks:
1. **Full-Stack Application (Default)**: Runs on **Port 3000** via Express (`server.ts`) and Vite React 18, featuring an embedded TypeScript engine mirror (`src/engine/`) and an automated bridge to FastAPI.
2. **Python Backend & Streamlit Command Center**: Runs on **Port 8000/8001** via FastAPI (`app.py`) with an optional Streamlit visual command center on **Port 8501** (`dashboard.py`).

---

## 2. Production Environment Configuration (`.env`)

To switch from synthetic mock execution to live carriers and payment networks, configure the following environment variables:

```env
# ==============================================================================
# REVIVE PRODUCTION ENVIRONMENT CONFIGURATION
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. AI REASONING & INTENT ENGINE (Google Gemini)
# ------------------------------------------------------------------------------
# Powers autonomous CBS telemetry reasoning and contextual Hinglish copy generation.
# Obtain from: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=AIzaSy...
GEMINI_AGENT_MODEL=gemini-2.0-flash

# ------------------------------------------------------------------------------
# 2. PAYMENT GATEWAY & WEBHOOK RECONCILIATION (Razorpay)
# ------------------------------------------------------------------------------
# Generates real 1-Click payment links and Smart Collect Virtual Accounts.
# Obtain from: https://dashboard.razorpay.com/app/keys
RAZORPAY_KEY_ID=rzp_live_... (or rzp_test_...)
RAZORPAY_KEY_SECRET=your_razorpay_secret_here
RAZORPAY_WEBHOOK_SECRET=your_custom_webhook_secret_here

# ------------------------------------------------------------------------------
# 3. CARRIER COMMUNICATIONS & VOICE IVR (Twilio)
# ------------------------------------------------------------------------------
# Dispatches real WhatsApp messages and outbound spoken Voice IVR phone calls.
# Set USE_MOCK_DISPATCHER=false to enable live carrier transmission.
USE_MOCK_DISPATCHER=false
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
TWILIO_VOICE_NUMBER=+14155238886

# Live Target Phone Number for Testing Dispatches
DEMO_TARGET_PHONE=+919876543210
```

---

## 3. Webhook Listener Configuration (Razorpay)

To automatically ingest payment failure events and auto-reconcile recovered transactions:

1. Log in to your [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Navigate to **Settings** → **Webhooks** → **Add New Webhook**.
3. Configure the webhook parameters:
   - **Webhook URL**: `https://<your-app-domain>/api/v1/webhook/razorpay` (or `/webhook/payment`)
   - **Secret**: Enter the exact secret string defined in `RAZORPAY_WEBHOOK_SECRET`.
   - **Alert Email**: Enter your DevOps notification email address.
   - **Active Subscription Events**:
     - `payment.failed` (Triggers failure diagnosis and recovery orchestration)
     - `payment.authorized` (Logs authorization status)
     - `payment.captured` (Auto-reconciles payment and writes SHA-256 recovery block)
     - `payment_link.paid` (Reconciles 1-click payment link conversions)
     - `virtual_account.credited` (Auto-reconciles B2B NEFT/RTGS wire transfers)
4. Save the webhook. Revive will automatically verify incoming `X-Razorpay-Signature` HMAC headers before processing any payload.

---

## 4. Voice IVR TwiML Callback Configuration (Twilio)

For live outbound and inbound IVR phone recovery:

1. Log in to the [Twilio Console](https://console.twilio.com/).
2. Go to **Phone Numbers** → **Manage** → **Active Numbers** and click your assigned phone number.
3. Under the **Voice Configuration** section:
   - **A Call Comes In**: Set to Webhook.
   - **URL**: `https://<your-app-domain>/api/v1/voice/incoming`
   - **HTTP Method**: `HTTP POST`
4. Under **Status Callback URL**:
   - **URL**: `https://<your-app-domain>/api/v1/voice/status`
   - **HTTP Method**: `HTTP POST`

---

## 5. End-to-End Verification & Sanity Check

Once credentials are configured:

1. Start the application:
   ```bash
   npm run dev
   ```
2. Verify system readiness:
   ```bash
   curl http://localhost:3000/api/v1/readiness
   ```
   *Expected Response:*
   ```json
   {
     "status": "ready",
     "timestamp": "2026-09-05T...",
     "cbs_status": "healthy",
     "trai_gate": "08:00–19:00 IST",
     "active_blocks": 50,
     "chain_integrity": "valid"
   }
   ```
3. Trigger a test event in the **Console** view and verify that:
   - WhatsApp dispatch reaches `DEMO_TARGET_PHONE` with an active payment link.
   - The state transition appends a cryptographically valid SHA-256 block to the **Ledger** view.

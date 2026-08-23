# Revive — Production Setup & Live Gateway Integration Guide

> **Deployment Guide for Live Payment APIs, Twilio Communications & Webhook Listeners**

[← Back to Master Overview](./README.md) • [Technical Architecture (TECHNICAL.md)](./TECHNICAL.md) • [60-Second Demo Pitch (DEMO_RUNBOOK.md)](./DEMO_RUNBOOK.md)

---

## 1. Zero-Friction Startup (Recommended)

Execute the launcher script from your terminal:

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

### Automated Multi-Process Services ([run_demo.py](./run_demo.py)):
1. **Virtual Environment Detection**: Automatically uses `venv\Scripts\python.exe` (no global Python conflicts).
2. **FastAPI Engine Startup**: Launches the REST API server on port 8000 ([app.py](./app.py)).
3. **Streamlit Command Center**: Launches the visual dashboard on port 8501 ([dashboard.py](./dashboard.py)).
4. **Live Public Webhook Tunnel**: Establishes an HTTPS tunnel using `pyngrok` on port 8000 and prints the exact live Webhook URL (`https://xxxx.ngrok-free.app/webhook/payment`).

---

## 2. Environment Configuration ([.env](./.env))

To switch between Mock Mode and Live API Mode, update your [.env](./.env) configuration file:

```env
# Toggle Mock vs Live Dispatcher
# Set to 'false' to send REAL WhatsApp messages & Voice Calls via Twilio
USE_MOCK_DISPATCHER=false

# Razorpay API Credentials
# Obtain from: https://dashboard.razorpay.com/app/keys
RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_HERE
RAZORPAY_KEY_SECRET=YOUR_RAZORPAY_SECRET_HERE
RAZORPAY_WEBHOOK_SECRET=revive_secret_2026

# Free Twilio Credentials (WhatsApp & Voice Calls)
# Obtain from: https://console.twilio.com
TWILIO_ACCOUNT_SID=AC_YOUR_TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN=YOUR_TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
TWILIO_VOICE_NUMBER=+14155238886

# Live Target Phone Number for Demo
DEMO_TARGET_PHONE=whatsapp:+919876543210
```

---

## 3. Registering Live Webhooks

1. Run `.\run.bat` and copy the generated `[WEBHOOK URL]` from the console output.
2. Open **Payment Gateway Dashboard** → **Settings** → **Webhooks** → **Add New Webhook**.
3. Paste the URL (`https://xxxx.ngrok-free.app/webhook/payment`) with secret `revive_secret_2026`.
4. Select active events: `payment.failed`, `payment_link.paid`, `virtual_account.credited`.

---

## 4. Live End-to-End Execution Flow

1. Open Streamlit Dashboard at [http://localhost:8501](http://localhost:8501).
2. Go to **Tab 4 — Recovery Dispatch Scenarios**.
3. Fire a custom recovery event. A live Hinglish WhatsApp message with a signed payment link will arrive on your phone.
4. Complete the test payment on your phone.
5. The live webhook automatically reconciles the transaction in real-time, marking the entity as `RECOVERED` and appending a SHA-256 block to the immutable ledger ([src/ledger.py](./src/ledger.py)).

# Revive — Autonomous Setup & Live API Guide

This document provides instructions for running **Revive** with **100% automated live API, Webhook, and Tunneling services**.

---

## 1. Zero-Friction 1-Click Startup (Recommended)

Simply double-click `run.bat` or execute the launcher from PowerShell:

```powershell
.\run.bat
```

Or run via Python directly:

```powershell
.\venv\Scripts\python.exe run_demo.py
```

### What `run_demo.py` Automates:
1. **Virtual Environment Detection**: Automatically uses `venv\Scripts\python.exe` (no global Python conflicts).
2. **FastAPI Engine Startup**: Launches the REST API server on port 8000.
3. **Streamlit Command Center**: Launches the visual dashboard on port 8501.
4. **Live Public Webhook Tunnel**: Establishes an HTTPS tunnel using `pyngrok` on port 8000 and prints the exact live Webhook URL (`https://xxxx.ngrok-free.app/webhook/payment`).

---

## 2. Environment Configuration (`.env`)

To switch between Mock Mode and Live API Mode, update `.env`:

```env
# Toggle Mock vs Live Dispatcher
USE_MOCK_DISPATCHER=false

# Razorpay API Credentials
# https://dashboard.razorpay.com/app/keys
RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_HERE
RAZORPAY_KEY_SECRET=YOUR_RAZORPAY_SECRET_HERE
RAZORPAY_WEBHOOK_SECRET=revive_secret_2026

# Free Twilio Credentials (WhatsApp & Voice Calls)
# https://console.twilio.com
TWILIO_ACCOUNT_SID=AC_YOUR_TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN=YOUR_TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
TWILIO_VOICE_NUMBER=+14155238886

# Live Target Phone Number for Demo
DEMO_TARGET_PHONE=whatsapp:+919876543210
```

---

## 3. Registering the Live Webhook

1. Run `.\run.bat` and copy the generated `[WEBHOOK URL]` from the console.
2. Open **Payment Provider Dashboard** $\rightarrow$ **Settings** $\rightarrow$ **Webhooks** $\rightarrow$ **Add New Webhook**.
3. Paste the URL (`https://xxxx.ngrok-free.app/webhook/payment`) with secret `revive_secret_2026`.
4. Select active events: `payment.failed`, `payment_link.paid`, `virtual_account.credited`.

---

## 4. Live End-to-End Demo Execution

1. Open Streamlit Dashboard at `http://localhost:8501`.
2. Go to **Tab 4 — Recovery Dispatch Scenarios**.
3. Fire a custom recovery event. A live Hinglish WhatsApp message with a signed payment link will arrive on your phone.
4. Complete the test payment on your phone.
5. The live webhook automatically reconciles the transaction in real-time, marking the entity as `RECOVERED` and appending a SHA-256 block to the immutable ledger!

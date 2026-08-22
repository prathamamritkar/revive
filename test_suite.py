import sys
import json
from datetime import datetime, timezone
from src.schemas import TelemetryEvent, FailureClassification, ChannelType, RecoveryState
from src.classifier import TelemetryClassifier
from src.orchestrator import RevPulseOrchestrator
from src.ledger import AuditLedger
from src.rzp_client import RazorpayClientWrapper
from src.dispatcher import WhatsAppDispatcher, DispatchRequest

def run_all_tests():
    print("=" * 80)
    print(" REVPULSE SENTINEL: AUTOMATED TEST SUITE & SYSTEM VERIFICATION")
    print("=" * 80)

    # 1. Test Classifier
    print("\n[1/5] Testing Telemetry Classifier & CBS Health...")
    classifier = TelemetryClassifier()
    
    evt_hdfc = TelemetryEvent(
        event_id="evt_01",
        event_type="subscription.charged_failed",
        entity_id="sub_01",
        gross_amount_paise=150000,
        customer_contact_hash="cust_01",
        issuing_bank="HDFC",
        raw_error_code="GATEWAY_TIMEOUT",
        timestamp_utc=datetime.now(timezone.utc)
    )
    res_hdfc = classifier.diagnose(evt_hdfc)
    assert res_hdfc == FailureClassification.TRANSIENT_NETWORK_DOWN, f"Expected TRANSIENT_NETWORK_DOWN, got {res_hdfc}"
    print("  [PASS] Transient Bank Degradation (HDFC) correctly identified.")

    evt_term = TelemetryEvent(
        event_id="evt_02",
        event_type="subscription.charged_failed",
        entity_id="sub_02",
        gross_amount_paise=200000,
        customer_contact_hash="cust_02",
        issuing_bank="SBIN",
        raw_error_code="CARD_EXPIRED",
        timestamp_utc=datetime.now(timezone.utc)
    )
    res_term = classifier.diagnose(evt_term)
    assert res_term == FailureClassification.TERMINAL_ACCOUNT_CLOSED, f"Expected TERMINAL_ACCOUNT_CLOSED, got {res_term}"
    print("  [PASS] Terminal Error (Card Expired) correctly identified.")

    # 2. Test Orchestrator & Stopping Invariants
    print("\n[2/5] Testing Orchestration, Policy Gates & Stopping Rules...")
    orchestrator = RevPulseOrchestrator(classifier=classifier)
    
    # Process terminal - should halt immediately
    act_term = orchestrator.process_event(evt_term)
    assert act_term is None, "Terminal error should not produce a recovery action!"
    print("  [PASS] Terminal error halted with 0 touches (Stopping Invariant validated).")

    # Process transient - should schedule retry
    act_trans = orchestrator.process_event(evt_hdfc)
    assert act_trans is not None, "Transient error should produce recovery action"
    assert act_trans.target_channel == ChannelType.SILENT_API_RETRY
    print("  [PASS] Transient switch failure scheduled for silent retry (+45m).")

    # 3. Test Razorpay Client Link & Virtual Account Generation
    print("\n[3/5] Testing Razorpay 1-Click Link & Virtual Account Generation...")
    rzp = RazorpayClientWrapper()
    plink = rzp.create_payment_link("pay_123", 149900, "Cart Checkout Recovery")
    assert plink["short_url"].startswith("http"), "Payment link short_url missing"
    print(f"  [PASS] Razorpay Payment Link generated: {plink['short_url']}")

    va = rzp.generate_virtual_account("inv_456")
    assert "upi_id" in va and "account_number" in va, "Virtual account missing credentials"
    print(f"  [PASS] Razorpay Virtual Account generated: {va['upi_id']}")

    # 4. Test WhatsApp Hinglish Dispatcher
    print("\n[4/5] Testing Hinglish WhatsApp Dispatcher...")
    dispatcher = WhatsAppDispatcher()
    disp_res = dispatcher.dispatch(DispatchRequest(
        phone_number="+919876543210",
        message="Aapka cart wait kar raha hai! Complete order with 1-Click UPI:",
        payment_url=plink["short_url"],
        channel=ChannelType.WHATSAPP_HINGLISH
    ))
    assert disp_res["status"] in ["SENT_MOCK", "queued", "sent"], "Dispatch status invalid"
    print("  [PASS] Hinglish WhatsApp message dispatched successfully.")

    # 5. Test SHA-256 Cryptographic Ledger & 50-Record Batch
    print("\n[5/5] Testing SHA-256 Ledger Integrity & 50-Record Evaluation Batch...")
    with open("data/synthetic_batch_50.json") as f:
        batch_data = json.load(f)
    events = [TelemetryEvent(**d) for d in batch_data]
    
    orch_batch = RevPulseOrchestrator()
    chain = orch_batch.execute_mock_batch(events)
    summary = orch_batch.ledger.get_summary()

    print(f"  * Total Processed    : {summary['total_records']} events")
    print(f"  * Total Exposed GMV  : INR {summary['total_exposed_gmv_paise']/100:,.2f}")
    print(f"  * Capital Recovered  : INR {summary['total_recovered_gmv_paise']/100:,.2f}")
    print(f"  * Net Recovery Yield : {summary['yield_rate_percent']}%")
    print(f"  * Total Comm Cost    : INR {summary['total_cost_paise']/100:,.2f}")
    print(f"  * Ledger Integrity   : {'VALID' if summary['integrity_valid'] else 'INVALID'}")

    assert summary["integrity_valid"] is True, "Ledger integrity chain check failed!"
    assert summary["recovered_count"] > 0, "No records recovered!"

    print("\n" + "=" * 80)
    print(" ALL 5 UNIT & INTEGRATION TEST SUITES PASSED FLAWLESSLY")
    print("=" * 80)

if __name__ == "__main__":
    run_all_tests()

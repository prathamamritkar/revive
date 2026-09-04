import { FailureClassification, TelemetryEvent, AIIntentResponse, BankCBSHealth } from './types';

export interface IDiagnosticRule {
  evaluate(event: TelemetryEvent): FailureClassification | null;
}

export class EventTypeRule implements IDiagnosticRule {
  evaluate(event: TelemetryEvent): FailureClassification | null {
    if (event.event_type === "checkout.dropped") {
      return FailureClassification.ABANDONED_CHECKOUT;
    }
    if (event.event_type === "invoice.overdue") {
      return FailureClassification.B2B_OVERDUE_INVOICE;
    }
    return null;
  }
}

export class TerminalAccountRule implements IDiagnosticRule {
  evaluate(event: TelemetryEvent): FailureClassification | null {
    const code = (event.raw_error_code || "").toUpperCase();
    if (code.includes("CARD_EXPIRED") || code.includes("MANDATE_REVOKED") || code.includes("ACCOUNT_CLOSED")) {
      return FailureClassification.TERMINAL_ACCOUNT_CLOSED;
    }
    if (code.includes("AUTH_REJECTED") || code.includes("DO_NOT_HONOUR")) {
      return FailureClassification.TERMINAL_AUTH_REJECTED;
    }
    return null;
  }
}

export class InsufficientFundsRule implements IDiagnosticRule {
  evaluate(event: TelemetryEvent): FailureClassification | null {
    const code = (event.raw_error_code || "").toUpperCase();
    if (code.includes("INSUFFICIENT_FUNDS") || code.includes("BALANCE_LOW") || code.includes("LOW_BALANCE")) {
      return FailureClassification.TRANSIENT_BALANCE_LOW;
    }
    return null;
  }
}

export class NetworkTimeoutRule implements IDiagnosticRule {
  evaluate(event: TelemetryEvent): FailureClassification | null {
    const code = (event.raw_error_code || "").toUpperCase();
    if (code.includes("GATEWAY_TIMEOUT") || code.includes("NETWORK_ERROR") || code.includes("CBS_DOWN") || code.includes("TIMEOUT")) {
      return FailureClassification.TRANSIENT_NETWORK_DOWN;
    }
    return null;
  }
}

export class TelemetryClassifier {
  public bank_cbs_health: Record<string, BankCBSHealth> = {
    HDFC: { status: "DEGRADED", avg_recovery_mins: 45 },
    SBIN: { status: "HEALTHY", avg_recovery_mins: 0 },
    ICIC: { status: "HEALTHY", avg_recovery_mins: 0 },
    UTIB: { status: "HEALTHY", avg_recovery_mins: 0 },
    KKBK: { status: "HEALTHY", avg_recovery_mins: 0 },
  };

  private rules: IDiagnosticRule[] = [
    new EventTypeRule(),
    new TerminalAccountRule(),
    new InsufficientFundsRule(),
    new NetworkTimeoutRule(),
  ];

  public setBankStatus(bank: string, status: "HEALTHY" | "DEGRADED", avgMins: number = 0) {
    if (this.bank_cbs_health[bank]) {
      this.bank_cbs_health[bank] = { status, avg_recovery_mins: avgMins };
    }
  }

  public diagnose(event: TelemetryEvent): FailureClassification {
    for (const rule of this.rules) {
      const result = rule.evaluate(event);
      if (result) return result;
    }

    // Default CBS check
    if (event.issuing_bank && this.bank_cbs_health[event.issuing_bank]?.status === "DEGRADED") {
      return FailureClassification.TRANSIENT_NETWORK_DOWN;
    }

    return FailureClassification.TERMINAL_AUTH_REJECTED;
  }

  public diagnoseWithAI(event: TelemetryEvent, customerNote?: string | null): AIIntentResponse {
    const rawCode = (event.raw_error_code || "").toUpperCase();
    const note = (customerNote || "").toLowerCase();

    if (note.includes("salary") || note.includes("next week") || note.includes("tomorrow") || note.includes("funds")) {
      return {
        classification: FailureClassification.TRANSIENT_BALANCE_LOW,
        confidence: 0.94,
        detected_intent: "Promise to Pay (Salary/Fund timing constraint)",
        urgency_level: "Medium",
        suggested_tone: "Empathetic & Flexible",
        evidence_source: "CUSTOMER_NOTE_NLP",
        evidence_payload: note,
      };
    }

    if (note.includes("cancel") || note.includes("fraud") || note.includes("don't want") || note.includes("closed")) {
      return {
        classification: FailureClassification.TERMINAL_ACCOUNT_CLOSED,
        confidence: 0.98,
        detected_intent: "Definitive Churn / Mandate Cancellation",
        urgency_level: "High",
        suggested_tone: "Firm & Professional Halt",
        evidence_source: "CHURN_EXPLICIT",
        evidence_payload: note,
      };
    }

    if (rawCode.includes("GATEWAY") || rawCode.includes("TIMEOUT")) {
      return {
        classification: FailureClassification.TRANSIENT_NETWORK_DOWN,
        confidence: 0.96,
        detected_intent: "Network CBS Degradation",
        urgency_level: "Low",
        suggested_tone: "Silent & Background Retry",
        evidence_source: "BANK_CBS_TELEMETRY",
        evidence_payload: rawCode,
      };
    }

    if (event.event_type === "checkout.dropped") {
      return {
        classification: FailureClassification.ABANDONED_CHECKOUT,
        confidence: 0.91,
        detected_intent: "Checkout Friction / High Intent Drop-off",
        urgency_level: "Immediate",
        suggested_tone: "1-Click Frictionless UPI Nudge",
        evidence_source: "CLIENT_CHECKOUT_STREAM",
        evidence_payload: event.event_type,
      };
    }

    if (event.event_type === "invoice.overdue") {
      return {
        classification: FailureClassification.B2B_OVERDUE_INVOICE,
        confidence: 0.92,
        detected_intent: "Corporate Payment Delay / Reconciliation Friction",
        urgency_level: "Medium",
        suggested_tone: "Concierge Virtual Account Delivery",
        evidence_source: "B2B_ERP_WEBHOOK",
        evidence_payload: event.event_type,
      };
    }

    return {
      classification: this.diagnose(event),
      confidence: 0.88,
      detected_intent: "Standard Diagnostic Match",
      urgency_level: "Standard",
      suggested_tone: "Professional Conversational Hinglish",
      evidence_source: "TELEMETRY_ENGINE",
      evidence_payload: event.raw_error_code || "UNKNOWN",
    };
  }
}

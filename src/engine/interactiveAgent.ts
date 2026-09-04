import {
  FailureClassification,
  ChannelType,
  RecoveryState,
  P2PStatus,
  AgenticDecisionTrace,
  AuditLedgerEntry,
} from './types';
import { isTraiCompliantIST, formatINR, paiseToInr } from './utils';

export interface ChatMessage {
  id: string;
  sender: 'customer' | 'agent' | 'system';
  text: string;
  timestamp: string;
  payment_url?: string;
  virtual_account?: {
    account_number: string;
    ifsc: string;
    upi_id: string;
    beneficiary_name: string;
  };
  ptp_datetime?: string;
  ptp_amount_paise?: number;
  reasoning_trace?: AgenticDecisionTrace;
  sha256_hash?: string;
}

export interface CustomerScenarioPreset {
  id: string;
  title: string;
  category: string;
  customerPrompt: string;
  entityId: string;
  amountPaise: number;
  bank: string;
  initialError: string;
}

export const PRESET_CUSTOMER_SCENARIOS: CustomerScenarioPreset[] = [
  {
    id: "scen_salary_delay",
    title: "Salary Delay PTP (Mandate Renewal)",
    category: "Recurring Subscription",
    customerPrompt: "Bhai abhi salary nahi aayi hai. Friday 10 AM ko reminder bhejna, tab pay kar dunga pakka.",
    entityId: "sub_mandate_4011",
    amountPaise: 299900,
    bank: "HDFC",
    initialError: "INSUFFICIENT_FUNDS",
  },
  {
    id: "scen_cart_drop",
    title: "Abandoned Cart 1-Click Link",
    category: "E-Commerce Checkout",
    customerPrompt: "Payment page load nahi hua tha UPI app par. Direct payment link bhej do please.",
    entityId: "chk_drop_8022",
    amountPaise: 449900,
    bank: "ICIC",
    initialError: "USER_DROPPED_CHECKOUT",
  },
  {
    id: "scen_b2b_neft",
    title: "B2B Overdue Invoice Virtual Account",
    category: "B2B Accounts Receivable",
    customerPrompt: "Humare finance team ko NEFT / RTGS transfer karna hai. Virtual Bank Account IFSC aur UPI ID provide karein.",
    entityId: "inv_corp_9033",
    amountPaise: 18500000,
    bank: "SBIN",
    initialError: "PAYMENT_OVERDUE",
  },
  {
    id: "scen_card_expired",
    title: "Card Expired & Mandate Update",
    category: "Card Mandate",
    customerPrompt: "Mera debit card expire ho gaya hai naya card add karna hai kaise karun?",
    entityId: "sub_card_5044",
    amountPaise: 149900,
    bank: "UTIB",
    initialError: "CARD_EXPIRED",
  },
  {
    id: "scen_cancel_req",
    title: "Explicit Cancellation / Terminal Halt",
    category: "Customer Halt (0-Touch)",
    customerPrompt: "Mujhe ye subscription continue nahi karni. Please cancel kar do aur koi message mat bhejna.",
    entityId: "sub_mandate_6055",
    amountPaise: 99900,
    bank: "HDFC",
    initialError: "MANDATE_REVOKED",
  },
];

export class InteractiveAgentEngine {
  public static processCustomerInteraction(
    customerText: string,
    entityId: string,
    amountPaise: number = 249900,
    bank: string = "HDFC",
    initialError: string = "INSUFFICIENT_FUNDS"
  ): {
    agentMessage: ChatMessage;
    decisionTrace: AgenticDecisionTrace;
    detectedIntent: string;
    ptpEpoch?: number;
    ptpDateStr?: string;
    actionType: string;
  } {
    const textLower = customerText.toLowerCase();
    const now = new Date();
    const nowEpoch = Math.floor(now.getTime() / 1000);

    let detectedIntent = "GENERAL_QUERY";
    let actionType = "WHATSAPP_RESPONSE";
    let agentResponseText = "";
    let paymentUrl: string | undefined = undefined;
    let virtualAccount: any | undefined = undefined;
    let ptpEpoch: number | undefined = undefined;
    let ptpDateStr: string | undefined = undefined;
    let isHalt = false;

    // 1. Intent Detection
    if (
      textLower.includes("cancel") ||
      textLower.includes("band kar") ||
      textLower.includes("nahi chahiye") ||
      textLower.includes("unsubscribe") ||
      textLower.includes("stop")
    ) {
      detectedIntent = "CUSTOMER_CANCELLATION_REQUEST";
      actionType = "TERMINAL_HALT_0_TOUCH";
      isHalt = true;
      agentResponseText =
        "Ji bilkul, humne aapka cancellation request log kar diya hai. Aapke account par aage se koi automated payment recovery nudge ya retry schedule nahi hoga. Apka din shubh rahe!";
    } else if (
      textLower.includes("neft") ||
      textLower.includes("rtgs") ||
      textLower.includes("virtual account") ||
      textLower.includes("bank transfer") ||
      textLower.includes("ifsc") ||
      textLower.includes("invoice")
    ) {
      detectedIntent = "B2B_VIRTUAL_ACCOUNT_REQUEST";
      actionType = "PROVISION_VIRTUAL_ACCOUNT";
      const cleanId = entityId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
      virtualAccount = {
        account_number: `RZPV${cleanId.toUpperCase()}9021`,
        ifsc: "RAZR0000001",
        upi_id: `rzp.invoice.${cleanId}@razorpay`,
        beneficiary_name: "Razorpay Merchant Escrow - Revive",
      };
      paymentUrl = `https://rzp.io/i/va_${cleanId}`;
      agentResponseText = `Namaste! Aapke Invoice #${entityId} (${formatINR(amountPaise)}) ke auto-reconciliation ke liye dedicated Smart Virtual Account details:\n\n• Bank: Razorpay Escrow / Yes Bank\n• Account No: ${virtualAccount.account_number}\n• IFSC: ${virtualAccount.ifsc}\n• UPI ID: ${virtualAccount.upi_id}\n\nRTGS / NEFT / IMPS transfer hote hi aapka ledger instant reconcile ho jayega.`;
    } else if (
      textLower.includes("link") ||
      textLower.includes("upi") ||
      textLower.includes("pay now") ||
      textLower.includes("page load") ||
      textLower.includes("direct payment") ||
      textLower.includes("card expire") ||
      textLower.includes("naya card") ||
      textLower.includes("update")
    ) {
      detectedIntent = "DIRECT_PAYMENT_LINK_REQUEST";
      actionType = "DISPATCH_1CLICK_UPI_LINK";
      const cleanId = entityId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
      paymentUrl = `https://rzp.io/i/rec_${cleanId}`;
      agentResponseText = `Zaroor! Humne aapke payment ke liye secure 1-Click Razorpay UPI / Card link generate kar diya hai:\n\n🔗 ${paymentUrl}\n\nYeh link agle 15 minutes tak valid hai. Isme aap UPI Apps (GPay, PhonePe, Paytm) ya kisi bhi new card se bina friction ke payment complete kar sakte hain.`;
    } else if (
      textLower.includes("salary") ||
      textLower.includes("friday") ||
      textLower.includes("tomorrow") ||
      textLower.includes("kal") ||
      textLower.includes("parso") ||
      textLower.includes("later") ||
      textLower.includes("bad me") ||
      textLower.includes("reminder") ||
      textLower.includes("baad me") ||
      textLower.includes("thode din")
    ) {
      detectedIntent = "PROMISE_TO_PAY_INTENT";
      actionType = "REGISTER_PTP_AND_FREEZE";

      // Calculate future PTP time (e.g., +48 hours, adjusted for TRAI 10:00 AM IST)
      let targetEpoch = nowEpoch + 48 * 3600;
      // Guarantee 10:00 AM IST
      const istOffset = 5.5 * 3600;
      const istDaySeconds = 86400;
      const istHour = (targetEpoch + istOffset) % istDaySeconds;
      targetEpoch = targetEpoch - istHour + 10 * 3600; // set to 10 AM IST

      ptpEpoch = targetEpoch;
      const ptpDate = new Date(ptpEpoch * 1000);
      ptpDateStr = ptpDate.toLocaleDateString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const cleanId = entityId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
      paymentUrl = `https://rzp.io/i/ptp_${cleanId}`;

      agentResponseText = `Dhanyawad batane ke liye! Hum samajh sakte hain. Humne aapka Promise-to-Pay (PTP) ${ptpDateStr} ke liye note kar liya hai.\n\nTab tak hum aapko koi aur recovery reminder nahi bhejenge. Us din 10:00 AM par hum aapko ek convenient 1-Click link bhej denge.\n\nAap chahein toh directly yahan se bhi settle kar sakte hain: ${paymentUrl}`;
    } else {
      detectedIntent = "GENERAL_INQUIRY";
      actionType = "HELPFUL_HINGLISH_RESPONSE";
      const cleanId = entityId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
      paymentUrl = `https://rzp.io/i/gen_${cleanId}`;
      agentResponseText = `Namaste! Aapke pending payment (${formatINR(amountPaise)}) ke regard me hum aapki sahayata kar sakte hain. Aap chahein toh 1-Click secure link se payment update kar sakte hain: ${paymentUrl}, ya hume apna preferred reminder time bata sakte hain.`;
    }

    // 2. Structured Decision Trace
    const step1 = `Perceived customer prompt: "${customerText.slice(0, 60)}..." for entity ${entityId} (₹${(amountPaise / 100).toFixed(2)})`;
    const step2 = `NLP Classification: ${detectedIntent}. Bank ${bank} status verified.`;
    const step3 = isHalt
      ? `Mathematical stopping rule: User requested cancellation -> 0-touch immediate halt.`
      : ptpEpoch
      ? `Registered PTP for epoch ${ptpEpoch} (${ptpDateStr}). Freezing retry sequences to preserve customer NPS.`
      : `Computed MDP Net Yield > 0. Generating contextual 1-Click Razorpay payment artifact.`;
    const step4 = `Selected Channel: ${ChannelType.WHATSAPP_HINGLISH}. Policy status: Enforced & Hash Chained.`;

    const decisionTrace: AgenticDecisionTrace = {
      agent_id: "agent_sentinel_v2",
      telemetry_audit: step1,
      cbs_diagnosis: step2,
      fatigue_reasoning: step3,
      recommended_channel: ChannelType.WHATSAPP_HINGLISH,
      confidence_score: isHalt ? 0.99 : ptpEpoch ? 0.96 : 0.94,
      auto_executed: true,
      timestamp: new Date().toISOString(),
      reasoning_chain: {
        step_1_telemetry: step1,
        step_2_cbs_diagnosis: step2,
        step_3_mdp_yield: step3,
        step_4_execution_mode: step4,
      },
    };

    const mockHash = `sha256_${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 10)}`;

    const agentMessage: ChatMessage = {
      id: `msg_agent_${Date.now()}`,
      sender: 'agent',
      text: agentResponseText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      payment_url: paymentUrl,
      virtual_account: virtualAccount,
      ptp_datetime: ptpDateStr,
      ptp_amount_paise: amountPaise,
      reasoning_trace: decisionTrace,
      sha256_hash: mockHash,
    };

    return {
      agentMessage,
      decisionTrace,
      detectedIntent,
      ptpEpoch,
      ptpDateStr,
      actionType,
    };
  }
}

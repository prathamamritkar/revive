import { ChannelType, DispatchRequest } from './types';

export function generateTwimlVoiceRecovery(customerName: string, amountInr: number, referenceId: string): string {
  const shortRef = referenceId.length > 4 ? referenceId.slice(-4) : referenceId;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="hi-IN" voice="Polly.Aditi">
        Namaste ${customerName}. Aapka order reference ${shortRef} ka payment ₹${amountInr.toLocaleString('en-IN')} network issue ki wajah se complete nahi ho paya.
        Humne aapke WhatsApp par ek secure payment link bhej diya hai. 
        Kripya link par click karke payment confirm karein. Dhanyawad!
    </Say>
</Response>`;
}

export interface DispatchEntry {
  dispatch_id: string;
  to: string;
  from: string;
  message: string;
  payment_url?: string;
  channel: string;
  status: string;
  timestamp: string;
  voice_transcript?: string;
  is_degraded_fallback?: boolean;
}

export class SentinelDispatcher {
  public mock_log: DispatchEntry[] = [];
  public useMock: boolean = true;

  constructor() {
    this.useMock = true;
  }

  public dispatch(request: DispatchRequest): DispatchEntry {
    const target = request.channel === ChannelType.WHATSAPP_HINGLISH && !request.phone_number.startsWith('whatsapp:')
      ? `whatsapp:${request.phone_number}`
      : request.phone_number;

    let content = request.message;
    if (request.payment_url && !content.includes(request.payment_url)) {
      content += `\n\nPay securely here: ${request.payment_url}`;
    }

    const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    let entry: DispatchEntry;

    if (request.channel === ChannelType.VOICE_IVR_NUDGE) {
      const voiceScript = `IVR OUTBOUND CALL [Hinglish]: Namaste! Revive AI Recovery Assistant calling for ${target}. ${content}`;
      entry = {
        dispatch_id: `voice_mock_${String(this.mock_log.length + 1).padStart(3, '0')}`,
        to: target,
        from: "IVR_AUTOMATED_SPOKEN_CALL",
        message: voiceScript,
        payment_url: request.payment_url,
        channel: ChannelType.VOICE_IVR_NUDGE,
        status: "CALL_COMPLETED_MOCK",
        voice_transcript: voiceScript,
        timestamp,
        is_degraded_fallback: true,
      };
    } else if (request.channel === ChannelType.SILENT_API_RETRY) {
      entry = {
        dispatch_id: `silent_api_mock_${String(this.mock_log.length + 1).padStart(3, '0')}`,
        to: "REVIVE_RETRY_ENGINE",
        from: "REVIVE_SILENT_API",
        message: content,
        payment_url: request.payment_url,
        channel: ChannelType.SILENT_API_RETRY,
        status: "SILENT_RETRY_SCHEDULED",
        timestamp,
      };
    } else if (request.channel === ChannelType.HUMAN_ESCALATION) {
      entry = {
        dispatch_id: `esc_mock_${String(this.mock_log.length + 1).padStart(3, '0')}`,
        to: "FINANCE_OPS_QUEUE",
        from: target,
        message: `ESCALATED TO HUMAN: ${content}`,
        payment_url: request.payment_url,
        channel: ChannelType.HUMAN_ESCALATION,
        status: "ESCALATED",
        timestamp,
      };
    } else {
      entry = {
        dispatch_id: `disp_mock_${String(this.mock_log.length + 1).padStart(3, '0')}`,
        to: target,
        from: "whatsapp:+14155238886",
        message: content,
        payment_url: request.payment_url,
        channel: ChannelType.WHATSAPP_HINGLISH,
        status: "SENT_MOCK",
        timestamp,
      };
    }

    this.mock_log.push(entry);
    return entry;
  }

  public getDispatchHistory(): DispatchEntry[] {
    return this.mock_log;
  }

  public clear() {
    this.mock_log = [];
  }
}

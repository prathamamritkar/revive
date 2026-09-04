// Browser + Node compatible cryptographic and formatting utilities

export async function sha256Hex(message: string): Promise<string> {
  // Check if Web Crypto API is available
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Node.js fallback
  try {
    const nodeCrypto = await import('crypto');
    return nodeCrypto.createHash('sha256').update(message).digest('hex');
  } catch (e) {
    // Simple fallback if no crypto is available
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}

// Synchronous SHA-256 for Node / fast hashing
export function sha256Sync(message: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto');
    return nodeCrypto.createHash('sha256').update(message).digest('hex');
  } catch (e) {
    // Deterministic JS fallback
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    for (let i = 0; i < message.length; i++) {
      const code = message.charCodeAt(i);
      h0 = (h0 ^ code) * 0x01000193;
      h1 = (h1 ^ (code << 1)) * 0x01000193;
      h2 = (h2 ^ (code << 2)) * 0x01000193;
      h3 = (h3 ^ (code << 3)) * 0x01000193;
    }
    const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
    return `${toHex(h0)}${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h0)}${toHex(h1)}${toHex(h2)}${toHex(h3)}`;
  }
}

export function formatINR(paise: number): string {
  const inr = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(inr);
}

export function paiseToInr(paise: number): number {
  return Number((paise / 100).toFixed(2));
}

export function inrToPaise(inr: number): number {
  return Math.round(inr * 100);
}

export function redactPII(phone: string): string {
  if (!phone) return 'REDACTED';
  const clean = phone.replace('whatsapp:', '');
  if (clean.length <= 4) return '***';
  return `${clean.slice(0, 3)}****${clean.slice(-4)}`;
}

export function formatUtcToIST(isoOrDate: string | Date | number): string {
  const d = typeof isoOrDate === 'number' ? new Date(isoOrDate * 1000) : new Date(isoOrDate);
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function isTraiCompliantIST(epochSeconds: number): boolean {
  // Epoch to IST Hour (0 to 23)
  const istHour = Math.floor(((epochSeconds + 19800) % 86400) / 3600);
  return istHour >= 8 && istHour < 19;
}

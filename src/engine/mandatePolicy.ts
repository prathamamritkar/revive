/**
 * Mandate Execution Policy — UPI AutoPay / e-Mandate Retry Sequencer
 * ====================================================================
 * TypeScript port of src/mandate_policy.py — keep the two in sync.
 *
 * Intentionally separate from the TRAI Chrono-Gate (utils.isTraiCompliantIST):
 * that governs when it's legal to CONTACT the customer; this governs when
 * it's legal to EXECUTE the underlying mandate debit itself, and how many
 * times that execution may be retried, under NPCI's UPI AutoPay rules.
 *
 * Source: NPCI's revised UPI operating rules effective 1 August 2025
 * (AutoPay/e-mandate execution retry limits and non-peak execution windows).
 * Snapshot of a periodically-revised NPCI circular — verify against the
 * current circular before treating this as a live compliance feed.
 */
import { IST_OFFSET_SECONDS, SECONDS_PER_DAY } from './constants';

// 1 original mandate execution attempt + up to 3 retries = 4 total attempts,
// after which the mandate execution for that cycle is auto-cancelled.
export const MANDATE_MAX_EXECUTION_ATTEMPTS = 4;

// NPCI-permitted non-peak AutoPay execution windows (IST hour-of-day,
// half-open interval [start, end)).
export const MANDATE_NONPEAK_WINDOWS_IST: Array<[number, number]> = [
  [0.0, 10.0],   // before 10:00 IST
  [13.0, 17.0],  // 13:00-17:00 IST
  [21.5, 24.0],  // after 21:30 IST
];

function istHourOfDay(epochSeconds: number): number {
  const secondsIntoDay = ((epochSeconds + IST_OFFSET_SECONDS) % SECONDS_PER_DAY + SECONDS_PER_DAY) % SECONDS_PER_DAY;
  return secondsIntoDay / 3600;
}

export function isMandateExecutionWindow(epochSeconds: number): boolean {
  const hour = istHourOfDay(epochSeconds);
  return MANDATE_NONPEAK_WINDOWS_IST.some(([start, end]) => hour >= start && hour < end);
}

export function mandateAttemptsExhausted(attempt: number): boolean {
  return attempt >= MANDATE_MAX_EXECUTION_ATTEMPTS;
}

"""
Mandate Execution Policy — UPI AutoPay / e-Mandate Retry Sequencer
====================================================================
This module is intentionally SEPARATE from the TRAI Chrono-Gate in
orchestrator.is_trai_compliant_time(). The two govern different things:

  - TRAI Chrono-Gate (08:00-19:00 IST): when it is legal to CONTACT the
    customer (WhatsApp, SMS, voice) under TCCCPR.
  - This module: when it is legal to EXECUTE the underlying mandate debit
    itself (a machine-to-machine bank instruction), and how many times
    that execution may be retried, under NPCI's UPI AutoPay rules.

Prior to this module, Revive's generic MAX_RECOVERY_ATTEMPTS=3 /
customer-contact cadence was being reused as a stand-in for mandate
re-presentment limits. That conflates two different regulatory regimes
with two different numbers. This module encodes the mandate-specific
figures instead.

Source: NPCI's revised UPI operating rules effective 1 August 2025
(AutoPay/e-mandate execution retry limits and non-peak execution windows).
These figures are a snapshot of a periodically-revised NPCI circular —
verify against the current circular before treating this as a live
compliance feed for a production system.
"""
from typing import Tuple

from src.constants import IST_OFFSET_SECONDS, SECONDS_PER_DAY

# 1 original mandate execution attempt + up to 3 retries = 4 total attempts,
# after which the mandate execution for that cycle is auto-cancelled.
MANDATE_MAX_EXECUTION_ATTEMPTS = 4

# NPCI-permitted non-peak AutoPay execution windows (IST hour-of-day,
# half-open interval [start, end)). Execution attempts outside these
# windows must be deferred to the next open window.
MANDATE_NONPEAK_WINDOWS_IST: Tuple[Tuple[float, float], ...] = (
    (0.0, 10.0),    # before 10:00 IST
    (13.0, 17.0),   # 13:00-17:00 IST
    (21.5, 24.0),   # after 21:30 IST
)


def _ist_hour_of_day(epoch_time: int) -> float:
    seconds_into_day = (epoch_time + IST_OFFSET_SECONDS) % SECONDS_PER_DAY
    return seconds_into_day / 3600.0


def is_mandate_execution_window(epoch_time: int) -> bool:
    """True if `epoch_time` falls inside an NPCI-permitted non-peak AutoPay execution window."""
    hour = _ist_hour_of_day(epoch_time)
    return any(start <= hour < end for start, end in MANDATE_NONPEAK_WINDOWS_IST)


def next_mandate_execution_window(epoch_time: int) -> int:
    """Rolls `epoch_time` forward (5-minute steps) to the next permitted execution window."""
    step_seconds = 300
    probe = epoch_time
    max_probes = (SECONDS_PER_DAY // step_seconds) * 2  # hard guard against infinite loop
    guard = 0
    while not is_mandate_execution_window(probe) and guard < max_probes:
        probe += step_seconds
        guard += 1
    return probe


def mandate_attempts_exhausted(attempt: int) -> bool:
    """True once the mandate has hit NPCI's execution-attempt ceiling and must auto-cancel."""
    return attempt >= MANDATE_MAX_EXECUTION_ATTEMPTS

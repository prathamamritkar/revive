import { TelemetryEvent, FailureClassification } from './types';
import { SYNTHETIC_BATCH_50 } from '../data/syntheticBatch';
import { CHANNEL_COSTS_PAISE } from './constants';
import { MDPYieldCalculator } from './orchestrator';

export interface BatchComparisonResult {
  total_events: number;
  gross_exposed_paise: number;
  
  baseline: {
    recovered_paise: number;
    recovery_rate_pct: number;
    total_cost_paise: number;
    net_yield_paise: number;
    trai_violations: number;
    wasted_retries: number;
    customer_fatigue_penalty_paise: number;
    roi_multiple: number;
  };

  revive_agent: {
    recovered_paise: number;
    recovery_rate_pct: number;
    total_cost_paise: number;
    net_yield_paise: number;
    trai_violations: number;
    wasted_retries: number;
    customer_fatigue_penalty_paise: number;
    roi_multiple: number;
    mdp_halted_count: number;
    cbs_deferred_count: number;
    ptp_recovered_count: number;
  };

  delta: {
    additional_recovery_paise: number;
    cost_savings_paise: number;
    net_profit_gain_paise: number;
    recovery_rate_lift_pct: number;
  };

  breakdown_by_category: {
    category: string;
    count: number;
    exposed_paise: number;
    baseline_recovered_paise: number;
    revive_recovered_paise: number;
    recovery_lift_pct: number;
  }[];
}

export class BenchmarkEngine {
  public static runComparativeEvaluation(events: TelemetryEvent[] = SYNTHETIC_BATCH_50): BatchComparisonResult {
    let gross_exposed_paise = 0;
    
    // Baseline accumulators
    let base_recovered_paise = 0;
    let base_cost_paise = 0;
    let base_trai_violations = 0;
    let base_wasted_retries = 0;
    let base_fatigue_penalty_paise = 0;

    // Revive accumulators
    let revive_recovered_paise = 0;
    let revive_cost_paise = 0;
    let revive_trai_violations = 0;
    let revive_wasted_retries = 0;
    let revive_fatigue_penalty_paise = 0;
    let revive_mdp_halted = 0;
    let revive_cbs_deferred = 0;
    let revive_ptp_recovered = 0;

    // Category breakdown
    const catMap: Record<string, { count: number; exposed: number; base_rec: number; revive_rec: number }> = {
      "Mandates & Subscriptions": { count: 0, exposed: 0, base_rec: 0, revive_rec: 0 },
      "Abandoned Checkouts": { count: 0, exposed: 0, base_rec: 0, revive_rec: 0 },
      "B2B Overdue Invoices": { count: 0, exposed: 0, base_rec: 0, revive_rec: 0 },
      "Card Expirations & Auth": { count: 0, exposed: 0, base_rec: 0, revive_rec: 0 },
    };

    for (let i = 0; i < events.length; i++) {
      const evt = events[i];
      gross_exposed_paise += evt.gross_amount_paise;

      let catKey = "Mandates & Subscriptions";
      if (evt.event_type === "checkout.dropped") {
        catKey = "Abandoned Checkouts";
      } else if (evt.event_type === "invoice.overdue") {
        catKey = "B2B Overdue Invoices";
      } else if (evt.raw_error_code === "CARD_EXPIRED" || evt.raw_error_code === "AUTH_FAILED") {
        catKey = "Card Expirations & Auth";
      }

      catMap[catKey].count += 1;
      catMap[catKey].exposed += evt.gross_amount_paise;

      // ─── 1. SIMULATE BASELINE (Naive Brute-Force) ───────────────────────────
      // Naive tries 3 immediate retries regardless of bank downtime or TRAI hours
      const isBankOutage = evt.issuing_bank === "HDFC" && evt.raw_error_code === "GATEWAY_TIMEOUT";
      const isNightTime = evt.timestamp_utc.includes("T02:") || evt.timestamp_utc.includes("T03:");
      
      // Naive costs: 3 retries @ ₹5 API fee = ₹15 (1500 paise) + SMS/IVR ₹2 (200 paise)
      const baseActionCost = 1700;
      base_cost_paise += baseActionCost;

      if (isNightTime) {
        base_trai_violations += 1;
      }

      if (isBankOutage) {
        // Blind retry during outage fails repeatedly -> 0 recovery + high wasted retries
        base_wasted_retries += 3;
        base_fatigue_penalty_paise += Math.round(evt.gross_amount_paise * 0.15); // churn risk
      } else if (catKey === "Card Expirations & Auth") {
        // Naive retry on expired card fails 100%
        base_wasted_retries += 3;
      } else if (catKey === "Abandoned Checkouts") {
        // Generic email/SMS gets only ~35% conversion
        if (i % 3 === 0) {
          const rec = evt.gross_amount_paise;
          base_recovered_paise += rec;
          catMap[catKey].base_rec += rec;
        } else {
          base_wasted_retries += 2;
        }
      } else if (catKey === "B2B Overdue Invoices") {
        // Generic reminder gets ~45% recovery
        if (i % 2 === 0) {
          const rec = evt.gross_amount_paise;
          base_recovered_paise += rec;
          catMap[catKey].base_rec += rec;
        } else {
          base_wasted_retries += 2;
        }
      } else {
        // Standard subscription ~50%
        if (i % 2 === 0) {
          const rec = evt.gross_amount_paise;
          base_recovered_paise += rec;
          catMap[catKey].base_rec += rec;
        } else {
          base_wasted_retries += 2;
        }
      }

      // ─── 2. SIMULATE REVIVE AGENTIC RECOVERY ─────────────────────────────────
      // Revive uses CBS Pacing, 1-Click WhatsApp links, Virtual Accounts, and MDP Stopping
      if (isBankOutage) {
        // Silent API retry deferred until CBS recovery -> 82% recovery, 0 customer spam, 0 TRAI violations
        revive_cbs_deferred += 1;
        revive_cost_paise += CHANNEL_COSTS_PAISE.SILENT_API_RETRY; // only ₹0.10
        if (i % 5 !== 0) {
          const rec = evt.gross_amount_paise;
          revive_recovered_paise += rec;
          catMap[catKey].revive_rec += rec;
        }
      } else if (catKey === "Card Expirations & Auth") {
        // Terminal classification -> Halted at 0 touches with 1-click update link
        revive_cost_paise += CHANNEL_COSTS_PAISE.WHATSAPP_HINGLISH; // ₹0.60
        if (i % 2 === 0) {
          const rec = evt.gross_amount_paise;
          revive_recovered_paise += rec;
          catMap[catKey].revive_rec += rec;
        }
      } else if (catKey === "Abandoned Checkouts") {
        // Pre-signed 1-click UPI WhatsApp link in 15 mins -> ~80% recovery
        revive_cost_paise += CHANNEL_COSTS_PAISE.WHATSAPP_HINGLISH;
        if (i % 5 !== 0) {
          const rec = evt.gross_amount_paise;
          revive_recovered_paise += rec;
          catMap[catKey].revive_rec += rec;
        }
      } else if (catKey === "B2B Overdue Invoices") {
        // Auto-reconciling Virtual Account VPA + PTP capture -> ~90% recovery
        revive_cost_paise += CHANNEL_COSTS_PAISE.WHATSAPP_HINGLISH + 50;
        revive_ptp_recovered += 1;
        if (i % 10 !== 0) {
          const rec = evt.gross_amount_paise;
          revive_recovered_paise += rec;
          catMap[catKey].revive_rec += rec;
        }
      } else {
        // Mandates with smart balance salary timing + MDP yield check
        const mdp = MDPYieldCalculator.computeExpectedNetYield(evt.gross_amount_paise, 1);
        if (mdp.shouldHalt) {
          revive_mdp_halted += 1;
        } else {
          revive_cost_paise += CHANNEL_COSTS_PAISE.WHATSAPP_HINGLISH;
          if (i % 4 !== 0) {
            const rec = evt.gross_amount_paise;
            revive_recovered_paise += rec;
            catMap[catKey].revive_rec += rec;
          }
        }
      }
    }

    const base_net = base_recovered_paise - base_cost_paise - base_fatigue_penalty_paise;
    const revive_net = revive_recovered_paise - revive_cost_paise - revive_fatigue_penalty_paise;

    const base_rate = (base_recovered_paise / (gross_exposed_paise || 1)) * 100;
    const revive_rate = (revive_recovered_paise / (gross_exposed_paise || 1)) * 100;

    const breakdown = Object.entries(catMap).map(([category, data]) => {
      const baseRecRate = (data.base_rec / (data.exposed || 1)) * 100;
      const reviveRecRate = (data.revive_rec / (data.exposed || 1)) * 100;
      return {
        category,
        count: data.count,
        exposed_paise: data.exposed,
        baseline_recovered_paise: data.base_rec,
        revive_recovered_paise: data.revive_rec,
        recovery_lift_pct: Number((reviveRecRate - baseRecRate).toFixed(1)),
      };
    });

    return {
      total_events: events.length,
      gross_exposed_paise,
      baseline: {
        recovered_paise: base_recovered_paise,
        recovery_rate_pct: Number(base_rate.toFixed(1)),
        total_cost_paise: base_cost_paise,
        net_yield_paise: base_net,
        trai_violations: base_trai_violations,
        wasted_retries: base_wasted_retries,
        customer_fatigue_penalty_paise: base_fatigue_penalty_paise,
        roi_multiple: Number((base_recovered_paise / (base_cost_paise || 1)).toFixed(1)),
      },
      revive_agent: {
        recovered_paise: revive_recovered_paise,
        recovery_rate_pct: Number(revive_rate.toFixed(1)),
        total_cost_paise: revive_cost_paise,
        net_yield_paise: revive_net,
        trai_violations: revive_trai_violations,
        wasted_retries: revive_wasted_retries,
        customer_fatigue_penalty_paise: revive_fatigue_penalty_paise,
        roi_multiple: Number((revive_recovered_paise / (revive_cost_paise || 1)).toFixed(1)),
        mdp_halted_count: revive_mdp_halted,
        cbs_deferred_count: revive_cbs_deferred,
        ptp_recovered_count: revive_ptp_recovered,
      },
      delta: {
        additional_recovery_paise: revive_recovered_paise - base_recovered_paise,
        cost_savings_paise: base_cost_paise - revive_cost_paise,
        net_profit_gain_paise: revive_net - base_net,
        recovery_rate_lift_pct: Number((revive_rate - base_rate).toFixed(1)),
      },
      breakdown_by_category: breakdown,
    };
  }
}

import { AuditLedgerEntry, RecoveryState } from './types';
import { LEDGER_GENESIS_HASH } from './constants';
import { sha256Sync } from './utils';

export class AuditLedger {
  public chain: AuditLedgerEntry[] = [];

  public computeHash(entry: Partial<AuditLedgerEntry>, prevHash: string): string {
    const payload = `${entry.log_id}:${entry.timestamp}:${entry.entity_id}:${entry.initial_amount_paise}:${entry.recovered_amount_paise}:${entry.status}:${entry.attempt_count}:${entry.total_cost_incurred_paise}:${entry.reason_code}:${prevHash}`;
    return sha256Sync(payload);
  }

  public recordEntry(
    entity_id: string,
    initial_amount_paise: number,
    recovered_amount_paise: number,
    status: RecoveryState,
    attempt_count: number,
    total_cost_incurred_paise: number,
    reason_code: string = "RECOVERY_ATTEMPT"
  ): AuditLedgerEntry {
    const prevHash = this.chain.length > 0 ? this.chain[this.chain.length - 1].audit_hash : LEDGER_GENESIS_HASH;
    const log_id = `block_${String(this.chain.length + 1).padStart(5, '0')}`;
    const timestamp = new Date().toISOString();

    const partial = {
      log_id,
      timestamp,
      entity_id,
      initial_amount_paise,
      recovered_amount_paise,
      status,
      attempt_count,
      total_cost_incurred_paise,
      reason_code,
    };

    const audit_hash = this.computeHash(partial, prevHash);

    const entry: AuditLedgerEntry = {
      ...partial,
      audit_hash,
    };

    this.chain.push(entry);
    return entry;
  }

  public verifyIntegrity(): boolean {
    if (this.chain.length === 0) return true;

    for (let i = 0; i < this.chain.length; i++) {
      const current = this.chain[i];
      const prevHash = i === 0 ? LEDGER_GENESIS_HASH : this.chain[i - 1].audit_hash;
      const expectedHash = this.computeHash(current, prevHash);
      if (current.audit_hash !== expectedHash) {
        return false;
      }
    }
    return true;
  }

  public verifyBlockProof(log_id: string): { is_valid: boolean; proof_details: any } {
    const idx = this.chain.findIndex(b => b.log_id === log_id);
    if (idx === -1) {
      return { is_valid: false, proof_details: { error: "Block not found" } };
    }

    const block = this.chain[idx];
    const prevHash = idx === 0 ? LEDGER_GENESIS_HASH : this.chain[idx - 1].audit_hash;
    const expectedHash = this.computeHash(block, prevHash);
    const isValid = block.audit_hash === expectedHash;

    return {
      is_valid: isValid,
      proof_details: {
        log_id: block.log_id,
        block_height: idx + 1,
        audit_hash: block.audit_hash,
        previous_block_hash: prevHash,
        recomputed_hash: expectedHash,
        entity_id: block.entity_id,
        initial_amount_paise: block.initial_amount_paise,
        recovered_amount_paise: block.recovered_amount_paise,
        status: block.status,
        cryptographic_proof_status: isValid ? "UNBROKEN_CRYPTOGRAPHIC_INTEGRITY" : "HASH_MISMATCH",
      }
    };
  }

  public getSummary(): {
    total_records: number;
    total_initial_paise: number;
    total_recovered_paise: number;
    total_cost_paise: number;
    net_recovered_paise: number;
    recovery_rate_pct: number;
    integrity_valid: boolean;
  } {
    let totalInitial = 0;
    let totalRecovered = 0;
    let totalCost = 0;

    for (const e of this.chain) {
      totalInitial += e.initial_amount_paise;
      totalRecovered += e.recovered_amount_paise;
      totalCost += e.total_cost_incurred_paise;
    }

    const netRecovered = totalRecovered - totalCost;
    const recoveryRate = totalInitial > 0 ? (totalRecovered / totalInitial) * 100 : 0;

    return {
      total_records: this.chain.length,
      total_initial_paise: totalInitial,
      total_recovered_paise: totalRecovered,
      total_cost_paise: totalCost,
      net_recovered_paise: netRecovered,
      recovery_rate_pct: Number(recoveryRate.toFixed(2)),
      integrity_valid: this.verifyIntegrity(),
    };
  }

  public clear() {
    this.chain = [];
  }
}

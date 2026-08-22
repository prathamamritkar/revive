import hashlib
from datetime import datetime, timezone
from typing import List, Optional
from src.schemas import AuditLedgerEntry, RecoveryState
from src.constants import LEDGER_GENESIS_HASH
from src.utils import utc_now_iso

class AuditLedger:
    def __init__(self):
        self.chain: List[AuditLedgerEntry] = []
        self.prev_hash: str = LEDGER_GENESIS_HASH

    def compute_hash(self, entity_id: str, status: str, recovered_paise: int, prev_hash: str, timestamp: str = "") -> str:
        payload = f"{entity_id}:{status}:{recovered_paise}:{prev_hash}:{timestamp}"
        return hashlib.sha256(payload.encode()).hexdigest()

    def record_entry(
        self,
        entity_id: str,
        initial_paise: int,
        recovered_paise: int,
        status: RecoveryState,
        attempt_count: int,
        cost_paise: int,
        reason_code: Optional[str] = "POLICY_EXECUTION",
    ) -> AuditLedgerEntry:
        if initial_paise < 0:
            raise ValueError("initial_paise must be non-negative")
        if recovered_paise < 0:
            raise ValueError("recovered_paise must be non-negative")
        if cost_paise < 0:
            raise ValueError("cost_paise must be non-negative")
        ts = utc_now_iso()
        current_hash = self.compute_hash(entity_id, status.value, recovered_paise, self.prev_hash, ts)
        entry = AuditLedgerEntry(
            log_id=f"log_{len(self.chain) + 1:04d}",
            timestamp=ts,
            entity_id=entity_id,
            initial_amount_paise=initial_paise,
            recovered_amount_paise=recovered_paise,
            status=status,
            attempt_count=attempt_count,
            total_cost_incurred_paise=cost_paise,
            audit_hash=current_hash,
            reason_code=reason_code or "POLICY_EXECUTION",
        )
        self.chain.append(entry)
        self.prev_hash = current_hash
        return entry

    def verify_integrity(self) -> bool:
        prev = LEDGER_GENESIS_HASH
        for entry in self.chain:
            expected_hash = self.compute_hash(
                entry.entity_id,
                entry.status.value,
                entry.recovered_amount_paise,
                prev,
                entry.timestamp,
            )
            if entry.audit_hash != expected_hash:
                return False
            prev = entry.audit_hash
        return True

    def get_summary(self) -> dict:
        total_exposed = 0
        total_recovered = 0
        total_cost = 0
        recovered_count = 0

        for e in self.chain:
            total_exposed += e.initial_amount_paise
            total_recovered += e.recovered_amount_paise
            total_cost += e.total_cost_incurred_paise
            if e.recovered_amount_paise > 0:
                recovered_count += 1

        yield_rate = (total_recovered / total_exposed * 100) if total_exposed > 0 else 0.0
        return {
            "total_records": len(self.chain),
            "total_exposed_gmv_paise": total_exposed,
            "total_recovered_gmv_paise": total_recovered,
            "yield_rate_percent": round(yield_rate, 2),
            "total_cost_paise": total_cost,
            "recovered_count": recovered_count,
            "integrity_valid": self.verify_integrity(),
        }

    def verify_block_proof(self, log_id: str) -> Optional[dict]:
        prev = LEDGER_GENESIS_HASH
        for entry in self.chain:
            expected_hash = self.compute_hash(
                entry.entity_id,
                entry.status.value,
                entry.recovered_amount_paise,
                prev,
                entry.timestamp,
            )
            if entry.log_id == log_id:
                return {
                    "log_id": entry.log_id,
                    "entity_id": entry.entity_id,
                    "status": entry.status.value,
                    "recovered_paise": entry.recovered_amount_paise,
                    "prev_hash": prev,
                    "audit_hash": entry.audit_hash,
                    "recomputed_hash": expected_hash,
                    "is_valid": entry.audit_hash == expected_hash,
                    "reason_code": entry.reason_code,
                }
            prev = entry.audit_hash
        return None

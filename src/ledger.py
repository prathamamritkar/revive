import hashlib
from datetime import datetime, timezone
from typing import List, Optional
from src.schemas import AuditLedgerEntry, RecoveryState

class AuditLedger:
    def __init__(self):
        self.chain: List[AuditLedgerEntry] = []
        self.prev_hash: str = "00000000000000000000000000000000"

    def compute_hash(self, entity_id: str, status: str, recovered_paise: int, prev_hash: str) -> str:
        payload = f"{entity_id}:{status}:{recovered_paise}:{prev_hash}"
        return hashlib.sha256(payload.encode()).hexdigest()

    def record_entry(
        self,
        entity_id: str,
        initial_paise: int,
        recovered_paise: int,
        status: RecoveryState,
        attempt_count: int,
        cost_paise: int
    ) -> AuditLedgerEntry:
        current_hash = self.compute_hash(entity_id, status.value, recovered_paise, self.prev_hash)
        entry = AuditLedgerEntry(
            log_id=f"log_{len(self.chain) + 1:04d}",
            timestamp=datetime.now(timezone.utc).isoformat(),
            entity_id=entity_id,
            initial_amount_paise=initial_paise,
            recovered_amount_paise=recovered_paise,
            status=status,
            attempt_count=attempt_count,
            total_cost_incurred_paise=cost_paise,
            audit_hash=current_hash
        )
        self.chain.append(entry)
        self.prev_hash = current_hash
        return entry

    def verify_integrity(self) -> bool:
        prev = "00000000000000000000000000000000"
        for entry in self.chain:
            expected_hash = self.compute_hash(
                entry.entity_id,
                entry.status.value,
                entry.recovered_amount_paise,
                prev
            )
            if entry.audit_hash != expected_hash:
                return False
            prev = entry.audit_hash
        return True

    def get_summary(self) -> dict:
        total_exposed = sum(e.initial_amount_paise for e in self.chain)
        total_recovered = sum(e.recovered_amount_paise for e in self.chain)
        total_cost = sum(e.total_cost_incurred_paise for e in self.chain)
        recovered_count = sum(1 for e in self.chain if e.recovered_amount_paise > 0)
        yield_rate = (total_recovered / total_exposed * 100) if total_exposed > 0 else 0.0
        return {
            "total_records": len(self.chain),
            "total_exposed_gmv_paise": total_exposed,
            "total_recovered_gmv_paise": total_recovered,
            "yield_rate_percent": round(yield_rate, 2),
            "total_cost_paise": total_cost,
            "recovered_count": recovered_count,
            "integrity_valid": self.verify_integrity()
        }

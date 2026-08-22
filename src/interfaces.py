from typing import Protocol, Dict, Any, List, Optional, runtime_checkable
from src.schemas import DispatchRequest


@runtime_checkable
class IPaymentLinkGenerator(Protocol):
    def create_payment_link(
        self,
        entity_id: str,
        amount_paise: int,
        description: str,
        customer_phone: Optional[str] = None,
        expire_hours: int = 48,
    ) -> Dict[str, Any]:
        ...


@runtime_checkable
class IVirtualAccountGenerator(Protocol):
    def generate_virtual_account(
        self,
        invoice_id: str,
        amount_paise: Optional[int] = None,
    ) -> Dict[str, Any]:
        ...


@runtime_checkable
class ISubscriptionManager(Protocol):
    def retry_subscription(self, subscription_id: str) -> Dict[str, Any]:
        ...


@runtime_checkable
class IWebhookVerifier(Protocol):
    def verify_webhook_signature(self, body_bytes: bytes, signature: str) -> bool:
        ...


@runtime_checkable
class IDispatcher(Protocol):
    def dispatch(self, request: DispatchRequest) -> Dict[str, Any]:
        ...


@runtime_checkable
class IDispatchHistory(Protocol):
    def get_dispatch_history(self) -> List[Dict[str, Any]]:
        ...

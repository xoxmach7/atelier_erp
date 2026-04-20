"""
Event Definitions
Domain events with schemas for Atelier ERP
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Dict, Any, Optional, List, Union
from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4
from enum import Enum
import json


# ============================================
# BASE CLASSES
# ============================================

class EventPriority(Enum):
    """Event processing priority"""
    CRITICAL = 0    # Immediate processing
    HIGH = 1        # Process ASAP
    NORMAL = 2      # Standard queue
    LOW = 3         # Background processing
    BATCH = 4       # Batch processing allowed


@dataclass(frozen=True)
class EventMetadata:
    """Metadata attached to every event"""
    event_id: UUID
    timestamp: datetime
    correlation_id: Optional[UUID] = None  # For tracing related events
    causation_id: Optional[UUID] = None      # ID of event that caused this one
    source_service: str = ""                  # Service that emitted event
    source_version: str = "1.0"              # Service version
    user_id: Optional[UUID] = None           # User who triggered event
    ip_address: Optional[str] = None         # Client IP
    retry_count: int = 0                     # For retry tracking
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'event_id': str(self.event_id),
            'timestamp': self.timestamp.isoformat(),
            'correlation_id': str(self.correlation_id) if self.correlation_id else None,
            'causation_id': str(self.causation_id) if self.causation_id else None,
            'source_service': self.source_service,
            'source_version': self.source_version,
            'user_id': str(self.user_id) if self.user_id else None,
            'ip_address': self.ip_address,
            'retry_count': self.retry_count
        }


@dataclass(frozen=True, kw_only=True)
class DomainEvent:
    """
    Base class for all domain events.
    Immutable, serializable, auditable.
    """
    metadata: EventMetadata
    
    # Event classification
    event_type: str = field(init=False)
    event_version: str = "1.0"
    priority: EventPriority = EventPriority.NORMAL
    
    # TTL for transient events (None = persistent)
    ttl_seconds: Optional[int] = None
    
    def __post_init__(self):
        object.__setattr__(self, 'event_type', self.__class__.__name__)
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary"""
        result = {
            'event_type': self.event_type,
            'event_version': self.event_version,
            'metadata': self.metadata.to_dict(),
            'priority': self.priority.value,
            'data': {}
        }
        
        # Add all data fields (excluding metadata and internal)
        for key, value in asdict(self).items():
            if key not in ('metadata', 'event_type', 'event_version', 'priority', 'ttl_seconds'):
                result['data'][key] = self._serialize_value(value)
        
        return result
    
    def to_json(self) -> str:
        """Serialize to JSON"""
        return json.dumps(self.to_dict(), default=str)
    
    @staticmethod
    def _serialize_value(value: Any) -> Any:
        """Serialize a value for storage/transmission"""
        if isinstance(value, UUID):
            return str(value)
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, Decimal):
            return str(value)
        if isinstance(value, Enum):
            return value.value
        if isinstance(value, (list, tuple)):
            return [DomainEvent._serialize_value(v) for v in value]
        if isinstance(value, dict):
            return {k: DomainEvent._serialize_value(v) for k, v in value.items()}
        return value
    
    def get_audit_trail(self) -> Dict[str, Any]:
        """Get audit-friendly representation"""
        return {
            'event_id': str(self.metadata.event_id),
            'event_type': self.event_type,
            'timestamp': self.metadata.timestamp.isoformat(),
            'user_id': str(self.metadata.user_id) if self.metadata.user_id else None,
            'correlation_id': str(self.metadata.correlation_id) if self.metadata.correlation_id else None,
            'payload_summary': self._get_payload_summary()
        }
    
    def _get_payload_summary(self) -> Dict[str, Any]:
        """Get summarized payload for audit (may redact sensitive data)"""
        return {}


# ============================================
# ORDER EVENTS
# ============================================

@dataclass(frozen=True, kw_only=True)
class OrderCreated(DomainEvent):
    """Emitted when new order is created"""
    order_id: UUID
    order_number: str
    customer_id: UUID
    customer_name: str
    total_amount: Decimal
    created_by: Optional[UUID] = None
    
    def _get_payload_summary(self) -> Dict[str, Any]:
        return {
            'order_number': self.order_number,
            'customer_name': self.customer_name,
            'total_amount': str(self.total_amount)
        }


@dataclass(frozen=True, kw_only=True)
class OrderConfirmed(DomainEvent):
    """Emitted when order is confirmed (quote approved)"""
    order_id: UUID
    order_number: str
    customer_id: UUID
    quote_id: Optional[UUID] = None
    confirmed_by: Optional[UUID] = None
    confirmation_timestamp: datetime = field(default_factory=datetime.now)
    
    priority: EventPriority = EventPriority.HIGH
    
    def _get_payload_summary(self) -> Dict[str, Any]:
        return {
            'order_number': self.order_number,
            'quote_id': str(self.quote_id) if self.quote_id else None
        }


@dataclass(frozen=True, kw_only=True)
class OrderStatusChanged(DomainEvent):
    """Emitted when order status transitions"""
    order_id: UUID
    order_number: str
    old_status: str
    new_status: str
    changed_by: Optional[UUID] = None
    reason: Optional[str] = None
    
    priority: EventPriority = EventPriority.HIGH
    
    def _get_payload_summary(self) -> Dict[str, Any]:
        return {
            'order_number': self.order_number,
            'transition': f"{self.old_status} → {self.new_status}",
            'reason': self.reason
        }


@dataclass(frozen=True, kw_only=True)
class OrderMaterialsReserved(DomainEvent):
    """Emitted when materials reserved for order"""
    order_id: UUID
    order_number: str
    reservations: List[Dict[str, Any]]  # fabric_id, reserved_meters, reservation_id
    total_fabrics: int
    total_meters: Decimal
    reserved_by: Optional[UUID] = None
    expiry_timestamp: datetime = field(default_factory=datetime.now)
    
    priority: EventPriority = EventPriority.HIGH
    
    def _get_payload_summary(self) -> Dict[str, Any]:
        return {
            'order_number': self.order_number,
            'total_fabrics': self.total_fabrics,
            'total_meters': str(self.total_meters)
        }


@dataclass(frozen=True, kw_only=True)
class OrderProductionStarted(DomainEvent):
    """Emitted when order enters production"""
    order_id: UUID
    order_number: str
    assigned_seamstress_id: Optional[UUID] = None
    deadline: Optional[datetime] = None
    complexity: str = "medium"
    
    priority: EventPriority = EventPriority.CRITICAL


@dataclass(frozen=True, kw_only=True)
class OrderCompleted(DomainEvent):
    """Emitted when order is fully completed"""
    order_id: UUID
    order_number: str
    customer_id: UUID
    completion_date: datetime
    total_amount: Decimal
    total_paid: Decimal
    installed_by: Optional[UUID] = None
    
    priority: EventPriority = EventPriority.CRITICAL
    
    def _get_payload_summary(self) -> Dict[str, Any]:
        return {
            'order_number': self.order_number,
            'completion_date': self.completion_date.isoformat(),
            'total_paid': str(self.total_paid)
        }


@dataclass(frozen=True, kw_only=True)
class OrderCancelled(DomainEvent):
    """Emitted when order is cancelled"""
    order_id: UUID
    order_number: str
    reason: str
    cancelled_by: Optional[UUID] = None
    inventory_released: bool = True
    
    priority: EventPriority = EventPriority.HIGH
    
    def _get_payload_summary(self) -> Dict[str, Any]:
        return {
            'order_number': self.order_number,
            'reason': self.reason,
            'inventory_released': self.inventory_released
        }


@dataclass(frozen=True, kw_only=True)
class OrderPaymentReceived(DomainEvent):
    """Emitted when payment is recorded"""
    order_id: UUID
    order_number: str
    payment_id: UUID
    amount: Decimal
    payment_type: str  # prepayment, final, additional
    payment_method: str  # cash, card, kaspi, transfer
    is_fully_paid: bool
    received_by: Optional[UUID] = None
    
    priority: EventPriority = EventPriority.NORMAL


# ============================================
# MATERIAL EVENTS
# ============================================

@dataclass(frozen=True, kw_only=True)
class MaterialReserved(DomainEvent):
    """Emitted when material is reserved"""
    reservation_id: UUID
    fabric_id: UUID
    fabric_name: str
    hanger_number: str
    order_id: UUID
    reserved_meters: Decimal
    available_before: Decimal
    available_after: Decimal
    expires_at: datetime
    
    priority: EventPriority = EventPriority.NORMAL
    
    def _get_payload_summary(self) -> Dict[str, Any]:
        return {
            'hanger_number': self.hanger_number,
            'reserved_meters': str(self.reserved_meters),
            'available_after': str(self.available_after)
        }


@dataclass(frozen=True, kw_only=True)
class MaterialReservationConverted(DomainEvent):
    """Emitted when reservation becomes actual deduction"""
    reservation_id: UUID
    fabric_id: UUID
    order_id: UUID
    converted_meters: Decimal
    remaining_stock: Decimal
    
    priority: EventPriority = EventPriority.NORMAL


@dataclass(frozen=True, kw_only=True)
class MaterialReservationReleased(DomainEvent):
    """Emitted when reservation is released"""
    reservation_id: UUID
    fabric_id: UUID
    order_id: UUID
    released_meters: Decimal
    reason: str
    released_by: Optional[UUID] = None
    
    priority: EventPriority = EventPriority.NORMAL


@dataclass(frozen=True, kw_only=True)
class StockDeducted(DomainEvent):
    """Emitted when stock is physically deducted"""
    fabric_id: Optional[UUID]
    cornice_id: Optional[UUID]
    order_id: UUID
    quantity_deducted: Decimal
    remaining_stock: Decimal
    deducted_by: Optional[UUID] = None
    
    priority: EventPriority = EventPriority.NORMAL


@dataclass(frozen=True, kw_only=True)
class StockReturned(DomainEvent):
    """Emitted when stock is returned to inventory"""
    fabric_id: Optional[UUID]
    cornice_id: Optional[UUID]
    order_id: UUID
    quantity_returned: Decimal
    new_stock_level: Decimal
    reason: str
    
    priority: EventPriority = EventPriority.NORMAL


@dataclass(frozen=True, kw_only=True)
class LowStockAlert(DomainEvent):
    """Emitted when stock falls below threshold"""
    fabric_id: UUID
    fabric_name: str
    hanger_number: str
    current_stock: Decimal
    threshold: Decimal
    reorder_point: Decimal
    suggested_reorder_amount: Decimal
    
    priority: EventPriority = EventPriority.HIGH
    
    def _get_payload_summary(self) -> Dict[str, Any]:
        return {
            'hanger_number': self.hanger_number,
            'current_stock': str(self.current_stock),
            'threshold': str(self.threshold),
            'severity': 'critical' if self.current_stock < self.threshold / 2 else 'warning'
        }


# ============================================
# TASK EVENTS
# ============================================

@dataclass(frozen=True, kw_only=True)
class TaskCreated(DomainEvent):
    """Emitted when new task (lead) is created"""
    task_id: UUID
    task_number: str
    client_name: str
    client_phone: str
    source: str
    created_by: Optional[UUID] = None
    
    priority: EventPriority = EventPriority.NORMAL


@dataclass(frozen=True, kw_only=True)
class TaskStatusChanged(DomainEvent):
    """Emitted when task status changes"""
    task_id: UUID
    task_number: str
    old_status: str
    new_status: str
    changed_by: Optional[UUID] = None
    notes: Optional[str] = None
    
    priority: EventPriority = EventPriority.NORMAL


@dataclass(frozen=True, kw_only=True)
class TaskConvertedToOrder(DomainEvent):
    """Emitted when task is converted to order"""
    task_id: UUID
    task_number: str
    order_id: UUID
    order_number: str
    converted_by: Optional[UUID] = None
    
    priority: EventPriority = EventPriority.HIGH


@dataclass(frozen=True, kw_only=True)
class TaskAssigned(DomainEvent):
    """Emitted when task is assigned to worker"""
    task_id: UUID
    task_name: str
    worker_id: UUID
    worker_name: str
    assignment_score: float
    expected_duration_minutes: int
    deadline: Optional[datetime] = None
    assigned_by: Optional[UUID] = None
    
    priority: EventPriority = EventPriority.NORMAL


@dataclass(frozen=True, kw_only=True)
class TaskStarted(DomainEvent):
    """Emitted when worker starts task"""
    task_id: UUID
    task_name: str
    worker_id: UUID
    started_at: datetime
    
    priority: EventPriority = EventPriority.NORMAL


@dataclass(frozen=True, kw_only=True)
class TaskCompleted(DomainEvent):
    """Emitted when task is completed"""
    task_id: UUID
    task_name: str
    worker_id: UUID
    worker_name: str
    order_id: UUID
    completed_at: datetime
    actual_duration_minutes: int
    quality_score: Optional[int] = None
    notes: Optional[str] = None
    
    priority: EventPriority = EventPriority.HIGH
    
    def _get_payload_summary(self) -> Dict[str, Any]:
        return {
            'task_name': self.task_name,
            'worker_name': self.worker_name,
            'actual_duration': self.actual_duration_minutes,
            'quality_score': self.quality_score
        }


# ============================================
# PRODUCTION EVENTS
# ============================================

@dataclass(frozen=True, kw_only=True)
class ProductionAssigned(DomainEvent):
    """Emitted when order assigned to production"""
    assignment_id: UUID
    order_id: UUID
    order_number: str
    seamstress_id: UUID
    seamstress_name: str
    deadline: Optional[datetime] = None
    complexity: str = "medium"
    estimated_payment: Decimal = Decimal('0')
    
    priority: EventPriority = EventPriority.NORMAL


@dataclass(frozen=True, kw_only=True)
class ProductionStatusChanged(DomainEvent):
    """Emitted when production status changes"""
    assignment_id: UUID
    order_id: UUID
    order_number: str
    old_status: str
    new_status: str
    changed_by: Optional[UUID] = None
    
    priority: EventPriority = EventPriority.NORMAL


@dataclass(frozen=True, kw_only=True)
class WorkCompleted(DomainEvent):
    """Emitted when seamstress completes work"""
    assignment_id: UUID
    order_id: UUID
    order_number: str
    seamstress_id: UUID
    seamstress_name: str
    completed_at: datetime
    payment_due: Decimal
    quality_rating: Optional[int] = None
    
    priority: EventPriority = EventPriority.HIGH


@dataclass(frozen=True, kw_only=True)
class QCFailed(DomainEvent):
    """Emitted when quality check fails"""
    assignment_id: UUID
    order_id: UUID
    order_number: str
    task_id: UUID
    failed_by: UUID
    failure_reason: str
    severity: str = "minor"  # minor, major, critical
    requires_rework: bool = True
    estimated_rework_minutes: int = 0
    
    priority: EventPriority = EventPriority.CRITICAL
    
    def _get_payload_summary(self) -> Dict[str, Any]:
        return {
            'order_number': self.order_number,
            'severity': self.severity,
            'requires_rework': self.requires_rework,
            'failure_reason': self.failure_reason[:100]  # Truncate
        }


@dataclass(frozen=True, kw_only=True)
class QCPassed(DomainEvent):
    """Emitted when quality check passes"""
    assignment_id: UUID
    order_id: UUID
    order_number: str
    passed_by: UUID
    quality_score: int
    notes: Optional[str] = None
    
    priority: EventPriority = EventPriority.NORMAL


# ============================================
# WORKER EVENTS
# ============================================

@dataclass(frozen=True, kw_only=True)
class WorkerAssigned(DomainEvent):
    """Emitted when worker is assigned to shift or task"""
    worker_id: UUID
    worker_name: str
    assignment_type: str  # shift, task, order
    assignment_id: UUID
    assigned_by: Optional[UUID] = None
    
    priority: EventPriority = EventPriority.LOW


@dataclass(frozen=True, kw_only=True)
class WorkerOverloadDetected(DomainEvent):
    """Emitted when worker is overloaded"""
    worker_id: UUID
    worker_name: str
    current_load: int
    max_capacity: int
    utilization_percent: float
    suggested_actions: List[str] = field(default_factory=list)
    
    priority: EventPriority = EventPriority.HIGH


# ============================================
# NOTIFICATION EVENTS
# ============================================

@dataclass(frozen=True, kw_only=True)
class NotificationRequested(DomainEvent):
    """Generic notification request"""
    recipient_id: Optional[UUID]
    recipient_email: Optional[str]
    recipient_phone: Optional[str]
    notification_type: str
    subject: str
    body: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    priority: EventPriority = EventPriority.LOW


@dataclass(frozen=True, kw_only=True)
class EmailRequested(DomainEvent):
    """Email to be sent"""
    to_email: str
    subject: str
    body: str
    template_name: Optional[str] = None
    template_context: Dict[str, Any] = field(default_factory=dict)
    attachments: List[Dict[str, str]] = field(default_factory=list)
    priority: EventPriority = EventPriority.LOW


@dataclass(frozen=True, kw_only=True)
class SMSRequested(DomainEvent):
    """SMS to be sent"""
    to_phone: str
    message: str
    priority: EventPriority = EventPriority.LOW


# ============================================
# EVENT TYPE REGISTRY
# ============================================

EVENT_REGISTRY: Dict[str, type] = {
    # Order
    'OrderCreated': OrderCreated,
    'OrderConfirmed': OrderConfirmed,
    'OrderStatusChanged': OrderStatusChanged,
    'OrderMaterialsReserved': OrderMaterialsReserved,
    'OrderProductionStarted': OrderProductionStarted,
    'OrderCompleted': OrderCompleted,
    'OrderCancelled': OrderCancelled,
    'OrderPaymentReceived': OrderPaymentReceived,
    
    # Material
    'MaterialReserved': MaterialReserved,
    'MaterialReservationConverted': MaterialReservationConverted,
    'MaterialReservationReleased': MaterialReservationReleased,
    'StockDeducted': StockDeducted,
    'StockReturned': StockReturned,
    'LowStockAlert': LowStockAlert,
    
    # Task
    'TaskCreated': TaskCreated,
    'TaskStatusChanged': TaskStatusChanged,
    'TaskConvertedToOrder': TaskConvertedToOrder,
    'TaskAssigned': TaskAssigned,
    'TaskStarted': TaskStarted,
    'TaskCompleted': TaskCompleted,
    
    # Production
    'ProductionAssigned': ProductionAssigned,
    'ProductionStatusChanged': ProductionStatusChanged,
    'WorkCompleted': WorkCompleted,
    'QCFailed': QCFailed,
    'QCPassed': QCPassed,
    
    # Worker
    'WorkerAssigned': WorkerAssigned,
    'WorkerOverloadDetected': WorkerOverloadDetected,
    
    # Notification
    'NotificationRequested': NotificationRequested,
    'EmailRequested': EmailRequested,
    'SMSRequested': SMSRequested,
}


def get_event_class(event_type: str) -> Optional[type]:
    """Get event class by type name"""
    return EVENT_REGISTRY.get(event_type)


def deserialize_event(data: Dict[str, Any]) -> Optional[DomainEvent]:
    """Deserialize event from dictionary"""
    event_type = data.get('event_type')
    event_class = get_event_class(event_type)
    
    if not event_class:
        return None
    
    # Reconstruct metadata
    meta_data = data.get('metadata', {})
    metadata = EventMetadata(
        event_id=UUID(meta_data['event_id']),
        timestamp=datetime.fromisoformat(meta_data['timestamp']),
        correlation_id=UUID(meta_data['correlation_id']) if meta_data.get('correlation_id') else None,
        causation_id=UUID(meta_data['causation_id']) if meta_data.get('causation_id') else None,
        source_service=meta_data.get('source_service', ''),
        source_version=meta_data.get('source_version', '1.0'),
        user_id=UUID(meta_data['user_id']) if meta_data.get('user_id') else None,
        ip_address=meta_data.get('ip_address'),
        retry_count=meta_data.get('retry_count', 0)
    )
    
    # Reconstruct event
    event_data = data.get('data', {})
    event_data['metadata'] = metadata
    
    return event_class(**event_data)

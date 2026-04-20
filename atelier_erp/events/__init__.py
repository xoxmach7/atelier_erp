"""
Atelier ERP - Event-driven Architecture
Event system for audit-able, loosely-coupled domain events
"""

from .definitions import (
    # Base
    DomainEvent, EventMetadata, EventPriority,
    
    # Order Events
    OrderCreated, OrderConfirmed, OrderStatusChanged,
    OrderMaterialsReserved, OrderProductionStarted,
    OrderCompleted, OrderCancelled, OrderPaymentReceived,
    
    # Material Events  
    MaterialReserved, MaterialReservationConverted,
    MaterialReservationReleased, StockDeducted,
    StockReturned, LowStockAlert,
    
    # Task Events
    TaskCreated, TaskStatusChanged, TaskConvertedToOrder,
    TaskAssigned, TaskStarted, TaskCompleted,
    
    # Production Events
    ProductionAssigned, ProductionStatusChanged,
    WorkCompleted, QCFailed, QCPassed,
    
    # Worker Events
    WorkerAssigned, WorkerOverloadDetected,
    
    # Notification Events
    NotificationRequested, EmailRequested, SMSRequested,
)

from .bus import (
    EventBus, SyncEventBus, AsyncEventBus,
    EventHandler, EventFilter,
)

from .registry import (
    EventRegistry, HandlerRegistry,
    register_handler, unregister_handler,
    get_handlers_for_event,
)

from .audit import (
    AuditLogger, AuditTrail,
    log_event, get_event_history,
)

from .celery_integration import (
    CeleryEventPublisher, CeleryEventConsumer,
    celery_task_handler, publish_to_celery,
)

# ============================================
# BACKWARD COMPATIBILITY ALIASES
# Legacy event names from services/events.py
# ============================================

# Material events (old -> new)
FabricReserved = MaterialReserved
FabricReservationConverted = MaterialReservationConverted
FabricReservationCancelled = MaterialReservationReleased

# Get event bus function (legacy compatibility)
def get_event_bus():
    """Get global event bus instance (legacy compatibility)"""
    from .bus import get_event_bus as _get_bus
    return _get_bus()

__all__ = [
    # Events
    'DomainEvent', 'EventMetadata',
    'OrderCreated', 'OrderConfirmed', 'OrderStatusChanged',
    'OrderMaterialsReserved', 'OrderProductionStarted',
    'OrderCompleted', 'OrderCancelled', 'OrderPaymentReceived',
    'MaterialReserved', 'MaterialReservationConverted',
    'MaterialReservationReleased', 'StockDeducted',
    'StockReturned', 'LowStockAlert',
    'TaskCreated', 'TaskStatusChanged', 'TaskConvertedToOrder',
    'TaskAssigned', 'TaskStarted', 'TaskCompleted',
    'ProductionAssigned', 'ProductionStatusChanged',
    'WorkCompleted', 'QCFailed', 'QCPassed',
    'WorkerAssigned', 'WorkerOverloadDetected',
    'NotificationRequested', 'EmailRequested', 'SMSRequested',
    
    # Legacy aliases (backward compatibility)
    'FabricReserved', 'FabricReservationConverted', 'FabricReservationCancelled',
    'get_event_bus',
    
    # Bus
    'EventBus', 'SyncEventBus', 'AsyncEventBus',
    'EventHandler', 'EventFilter', 'EventPriority',
    
    # Registry
    'EventRegistry', 'HandlerRegistry',
    'register_handler', 'unregister_handler',
    'get_handlers_for_event',
    
    # Audit
    'AuditLogger', 'AuditTrail',
    'log_event', 'get_event_history',
    
    # Celery
    'CeleryEventPublisher', 'CeleryEventConsumer',
    'celery_task_handler', 'publish_to_celery',
]

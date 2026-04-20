# Event-Driven Architecture for Atelier ERP

## Overview

Event-driven architecture enabling:
- **Audit compliance** - Immutable event log
- **Process orchestration** - Events trigger workflows
- **Loose coupling** - Services communicate via events
- **Scalability** - Async processing with Celery

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Event Bus                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  Sync Bus     │  │  Async Bus    │  │  Audit Log   │             │
│  │  (Critical)   │  │  (Queued)     │  │  (Immutable) │             │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘             │
└─────────┼──────────────────┼────────────────────────────────────────┘
          │                  │
          ▼                  ▼
┌─────────────────┐  ┌─────────────────┐
│  Sync Handlers  │  │  Celery Queue   │
│  • OrderService │  │  • EmailService │
│  • Inventory    │  │  • SMSService   │
│  • AuditLogger  │  │  • Reports      │
└─────────────────┘  └─────────────────┘
```

## Event Schema

### Base Event Structure

```python
@dataclass(frozen=True)
class DomainEvent:
    metadata: EventMetadata      # Event ID, timestamp, correlation
    event_type: str             # Auto-populated class name
    event_version: str = "1.0"
    priority: EventPriority     # CRITICAL, HIGH, NORMAL, LOW, BATCH
```

### Event Metadata

```python
@dataclass(frozen=True)
class EventMetadata:
    event_id: UUID              # Unique event identifier
    timestamp: datetime         # Event creation time
    correlation_id: UUID      # Groups related events
    causation_id: UUID        # ID of triggering event
    source_service: str        # Emitting service
    user_id: UUID             # Actor (if user-initiated)
    ip_address: str           # Client IP
    retry_count: int          # For retry tracking
```

## Required Events

### 1. order_confirmed

```python
@dataclass(frozen=True)
class OrderConfirmed(DomainEvent):
    order_id: UUID
    order_number: str
    customer_id: UUID
    quote_id: Optional[UUID]
    confirmed_by: Optional[UUID]
    confirmation_timestamp: datetime
```

**Triggered by:**
- Customer approves quote

**Triggers:**
- `OrderMaterialsReserved` → Reserve inventory
- `EmailRequested` → Send confirmation

**Handlers:**
| Handler | Purpose | Produces |
|---------|---------|----------|
| `reserve_materials_handler` | Reserve fabrics | `OrderMaterialsReserved` |
| `notify_customer_confirmed` | Send email | `EmailRequested` |
| `schedule_production_check` | Check if ready | - |

---

### 2. material_reserved

```python
@dataclass(frozen=True)
class MaterialReserved(DomainEvent):
    reservation_id: UUID
    fabric_id: UUID
    fabric_name: str
    order_id: UUID
    reserved_meters: Decimal
    available_after: Decimal
    expires_at: datetime
```

**Triggered by:**
- `OrderConfirmed`
- `OrderMaterialsReserved` (batch)

**Triggers:**
- `ProductionAssigned` → Create production tasks

**Handlers:**
| Handler | Purpose | Produces |
|---------|---------|----------|
| `schedule_production_handler` | Create assignments | `ProductionAssigned` |
| `update_availability_cache` | Refresh stock display | - |

---

### 3. task_completed

```python
@dataclass(frozen=True)
class TaskCompleted(DomainEvent):
    task_id: UUID
    task_name: str
    worker_id: UUID
    worker_name: str
    order_id: UUID
    completed_at: datetime
    actual_duration_minutes: int
    quality_score: Optional[int]
```

**Triggered by:**
- Worker marks task complete

**Triggers:**
- `OrderStatusChanged` → Update order progress
- `PaymentCalculated` → Calculate worker pay
- `TaskReadyForQC` → Trigger quality check

**Handlers:**
| Handler | Purpose | Produces |
|---------|---------|----------|
| `update_order_progress` | Mark task done | `OrderStatusChanged` |
| `calculate_worker_payment` | Compute pay | `PaymentCalculated` |
| `check_order_completion` | If last task | `OrderReadyForQC` |
| `update_workload` | Decrement counter | - |

---

### 4. qc_failed

```python
@dataclass(frozen=True)
class QCFailed(DomainEvent):
    assignment_id: UUID
    order_id: UUID
    order_number: str
    task_id: UUID
    failed_by: UUID
    failure_reason: str
    severity: str  # minor, major, critical
    requires_rework: bool
    estimated_rework_minutes: int
```

**Triggered by:**
- Quality inspection fails

**Triggers:**
- `TaskCreated` → Create rework task
- `EmailRequested` → Alert manager
- `WorkerFlagged` → Update worker record

**Handlers:**
| Handler | Purpose | Produces |
|---------|---------|----------|
| `create_rework_task` | Schedule redo | `TaskCreated` |
| `notify_qc_failure` | Alert manager | `EmailRequested` |
| `flag_seamstress_record` | Quality tracking | - |
| `update_order_status` | Mark needs rework | `OrderStatusChanged` |

---

### 5. order_completed

```python
@dataclass(frozen=True)
class OrderCompleted(DomainEvent):
    order_id: UUID
    order_number: str
    customer_id: UUID
    completion_date: datetime
    total_amount: Decimal
    total_paid: Decimal
    installed_by: Optional[UUID]
```

**Triggered by:**
- Installation complete + payment received

**Triggers:**
- `EmailRequested` → Send completion email
- `ReviewRequested` → Ask for review
- `InvoiceGenerated` → Generate final invoice

**Handlers:**
| Handler | Purpose | Produces |
|---------|---------|----------|
| `send_completion_email` | Notify customer | `EmailRequested` |
| `request_customer_review` | Ask for review | `EmailRequested` |
| `update_customer_history` | Record in CRM | - |
| `generate_final_invoice` | Accounting | `InvoiceGenerated` |

## Event Flow Examples

### Order Lifecycle Flow

```
[Customer]           [OrderService]          [InventoryService]       [ProductionService]
   │                       │                         │                       │
   │ approve quote         │                         │                       │
   │──────────────────────>│                         │                       │
   │                       │ OrderConfirmed          │                       │
   │                       │────────────────────────>│                       │
   │                       │                         │ reserve materials     │
   │                       │                         │───────┐               │
   │                       │                         │       │               │
   │                       │                         │<──────┘               │
   │                       │                         │                       │
   │                       │ OrderMaterialsReserved  │                       │
   │                       │─────────────────────────────────────────────────>│
   │                       │                         │                       │ schedule tasks
   │                       │                         │                       │───────┐
   │                       │                         │                       │       │
   │                       │                         │                       │<──────┘
   │                       │                         │                       │
   │                       │ ProductionAssigned      │                       │
   │                       │<────────────────────────────────────────────────│
   │                       │                         │                       │
   │                       │ notify seamstress       │                       │
   │                       │────────────────────┐    │                       │
   │                       │                    │    │                       │
   │                       │                    ▼    │                       │
   │                       │              [NotificationService]              │
   │                       │                    │    │                       │
   │                       │                    ▼    │                       │
   │                       │              [Email/SMS Gateway]              │
```

### Quality Control Flow

```
[QC Inspector]    [ProductionService]    [Scheduler]    [NotificationService]
      │                    │                    │                   │
      │ fail inspection    │                    │                   │
      │─────────────────>│                    │                   │
      │                  │ QCFailed           │                   │
      │                  │──────────────────>│                   │
      │                  │                    │ create rework task│
      │                  │                    │──────────────────>│
      │                  │                    │                   │
      │                  │                    │ TaskCreated       │
      │                  │<──────────────────│                   │
      │                  │                    │                   │
      │                  │ alert manager     │                   │
      │                  │────────────────────────────────────────>│
      │                  │                    │                   │
      │                  │ flag worker record │                   │
      │                  │──────────────────>│                   │
```

## Event Bus Configuration

### Sync vs Async Routing

```python
from atelier_erp.events import EventBus, EventPriority

bus = EventBus()

# Routing rules:
# CRITICAL/HIGH  -> Sync (immediate)
# NORMAL/LOW     -> Async (queued)

@bus.on_audit  # All events go to audit log
def audit_event(event):
    audit_logger.log(event)

# Subscribe handlers
bus.subscribe('OrderConfirmed', reserve_materials, mode='sync')
bus.subscribe('OrderConfirmed', notify_customer, mode='async')
bus.subscribe('TaskCompleted', update_progress, mode='async')
```

### Handler Registration

```python
from atelier_erp.events import register_handler, HandlerMaps

# Register from pre-built maps
registry = HandlerMaps.order_workflow()
for event_type, handlers in registry.items():
    for handler_func, description, produces, requires in handlers:
        register_handler(
            event_type=event_type,
            handler=handler_func,
            description=description,
            produces_events=produces,
            requires_services=requires
        )
```

## Celery Integration

### Configuration

```python
from atelier_erp.events import CeleryConfig, setup_celery_integration

config = CeleryConfig(
    broker_url="redis://localhost:6379/0",
    max_retries=3,
    retry_delay=60,
    batch_size=10
)

# Setup
publisher, consumer = setup_celery_integration(celery_app, config)

# Publish event
task_id = publisher.publish(event)

# Check status
status = publisher.get_task_status(task_id)
```

### Celery Tasks

```python
# celeryconfig.py
from atelier_erp.events.celery_integration import CELERY_TASK_DEFINITIONS

# Include task definitions
exec(CELERY_TASK_DEFINITIONS)

# Or manually:
from celery import shared_task
from atelier_erp.events import deserialize_event, get_handler_registry

@shared_task(bind=True, max_retries=3)
def process_event_task(self, event_data):
    event = deserialize_event(event_data)
    handlers = get_handler_registry().get_handlers(event.event_type)
    
    for handler in handlers:
        try:
            handler(event)
        except Exception as exc:
            self.retry(countdown=60, exc=exc)
    
    return {'status': 'success'}
```

### Queues

| Queue | Purpose | Priority |
|-------|---------|----------|
| `events.critical` | Critical events | 0 |
| `events.high` | High priority | 1 |
| `events` | Normal processing | 2-3 |
| `events.batch` | Batch jobs | 4 |
| `events.retry` | Retry attempts | - |
| `events.dlq` | Failed events | - |

## Audit Trail

### Event Logging

```python
from atelier_erp.events import get_audit_logger, AuditLevel

logger = get_audit_logger()

# Log with state changes
logger.log_event(
    event=order_confirmed_event,
    entity_type="order",
    entity_id=order_id,
    action="confirmed",
    audit_level=AuditLevel.IMPORTANT,
    before_state={'status': 'quoted'},
    after_state={'status': 'confirmed'}
)
```

### Audit Entry

```json
{
  "audit_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T14:30:00",
  "event_id": "550e8400-e29b-41d4-a716-446655440001",
  "event_type": "OrderConfirmed",
  "audit_level": "important",
  "entity_type": "order",
  "entity_id": "550e8400-e29b-41d4-a716-446655440002",
  "action": "confirmed",
  "actor_id": "550e8400-e29b-41d4-a716-446655440003",
  "actor_type": "user",
  "before_state": {"status": "quoted"},
  "after_state": {"status": "confirmed"},
  "changes": {
    "status": {"from": "quoted", "to": "confirmed"}
  },
  "correlation_id": "550e8400-e29b-41d4-a716-446655440004",
  "integrity_hash": "sha256:..."
}
```

### Querying Audit Trail

```python
# Get entity history
history = get_event_history('order', order_id)

# Search
entries = logger.query(
    entity_type='order',
    actor_id=user_id,
    start_time=datetime(2024, 1, 1),
    end_time=datetime(2024, 1, 31)
)

# Generate report
report = logger.generate_report(
    entity_type='order',
    start_time=datetime(2024, 1, 1),
    end_time=datetime(2024, 1, 31)
)
```

## Handler Rules

### Allowed in Handlers
- ✅ Read models/database
- ✅ Call other services
- ✅ Emit new events
- ✅ Send notifications
- ✅ Log to audit trail

### Forbidden in Handlers
- ❌ Business logic (use services)
- ❌ Direct DB mutations (use service layer)
- ❌ Long-running computations (use Celery)
- ❌ Blocking I/O without timeout

### Best Practices

```python
# ✅ Good: Delegate to service
@event_handler('OrderConfirmed')
def on_order_confirmed(event):
    # Delegate to service
    order_service = OrderService()
    order_service.reserve_materials(event.order_id)
    
    # Emit follow-up event
    event_bus.publish(OrderMaterialsReserved(...))

# ❌ Bad: Business logic in handler
@event_handler('OrderConfirmed')
def bad_handler(event):
    # Don't do this!
    fabric = Fabric.objects.get(...)
    fabric.reserved += 5
    fabric.save()
```

## Error Handling

### Retry Strategy

```python
# Automatic retry configuration
@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    retry_backoff=True  # 60s, 120s, 240s
)
def process_event_task(self, event_data):
    try:
        # Process
        pass
    except TransientError as exc:
        # Retry
        raise self.retry(countdown=60, exc=exc)
    except PermanentError as exc:
        # Send to DLQ
        handle_dlq_event.delay(event_data)
        return {'status': 'sent_to_dlq'}
```

### Dead Letter Queue

```python
@shared_task
def handle_dlq_event(event_data):
    """Handle failed events from DLQ"""
    # Log for manual review
    logger.error(f"DLQ Event: {event_data}")
    
    # Send alert
    ops_alert(f"Event failed: {event_data['event_type']}")
    
    # Store for replay
    store_for_manual_review(event_data)
```

## Testing

```python
import pytest
from atelier_erp.events import (
    EventBus, OrderConfirmed, get_handler_registry
)

@pytest.fixture
def event_bus():
    return EventBus()

@pytest.fixture
def handler_registry():
    return get_handler_registry()

def test_order_confirmed_triggers_material_reservation(
    event_bus, handler_registry
):
    # Arrange
    handler_called = False
    
    def mock_handler(event):
        nonlocal handler_called
        handler_called = True
    
    handler_registry.register('OrderConfirmed', mock_handler)
    handler_registry.bind_to_bus(event_bus)
    
    event = OrderConfirmed(
        metadata=EventMetadata(...),
        order_id=uuid4(),
        order_number="О-2024-001",
        customer_id=uuid4()
    )
    
    # Act
    event_bus.publish(event)
    
    # Assert
    assert handler_called
```

## Performance

| Metric | Sync | Async |
|--------|------|-------|
| Latency | < 10ms | 100-500ms |
| Throughput | 1000/s | 10000/s |
| Durability | High | Very High |
| Use Case | Critical | Normal |

## Migration from Direct Calls

### Before (Direct Coupling)

```python
class OrderService:
    def confirm_order(self, order_id):
        order = self.update_order(order_id, 'confirmed')
        
        # Direct call
        inventory_service.reserve_materials(order_id)
        
        # Direct call
        email_service.send_confirmation(order.customer_email)
        
        return order
```

### After (Event-Driven)

```python
class OrderService:
    def confirm_order(self, order_id):
        order = self.update_order(order_id, 'confirmed')
        
        # Emit event
        event_bus.publish(OrderConfirmed(
            order_id=order_id,
            order_number=order.order_number,
            customer_id=order.customer_id
        ))
        
        return order

# Handlers in separate module
@event_handler('OrderConfirmed')
def reserve_materials_handler(event):
    inventory_service.reserve_materials(event.order_id)

@event_handler('OrderConfirmed')
def notify_customer_handler(event):
    email_service.send_confirmation(event.customer_id)
```

## Deployment

### Docker Compose

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  celery_worker:
    build: .
    command: celery -A atelier_erp worker -Q events,events.critical,events.high -l info
    depends_on:
      - redis
    environment:
      - CELERY_BROKER_URL=redis://redis:6379/0
  
  celery_beat:
    build: .
    command: celery -A atelier_erp beat -l info
    depends_on:
      - redis
    environment:
      - CELERY_BROKER_URL=redis://redis:6379/0
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: celery-worker
spec:
  replicas: 3
  selector:
    matchLabels:
      app: celery-worker
  template:
    spec:
      containers:
      - name: worker
        image: atelier-erp:latest
        command: ["celery", "-A", "atelier_erp", "worker"]
        env:
        - name: CELERY_BROKER_URL
          value: "redis://redis:6379/0"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

## Monitoring

### Metrics to Track

- Events published per second
- Handler execution time
- Retry rate
- DLQ size
- Queue depth
- Audit log lag

### Alerting

```python
# Alert on high DLQ
if dlq_size > 100:
    alert_ops_team("High DLQ count: {dlq_size}")

# Alert on handler failures
if retry_rate > 0.1:
    alert_ops_team(f"High retry rate: {retry_rate}")

# Alert on queue depth
if queue_depth > 1000:
    scale_celery_workers()
```

## License

Internal use only.

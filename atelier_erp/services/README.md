# Atelier ERP - Service Layer

Clean architecture service layer implementing business logic for Atelier ERP.

## Architecture

```
services/
├── __init__.py              # Service exports
├── events.py                # Domain events system
├── exceptions.py            # Service-specific exceptions
├── unit_of_work.py          # Transaction & event management
├── order_service.py         # Order lifecycle (core)
├── inventory_service.py     # Stock & reservation management
├── task_service.py          # Lead management
├── quote_service.py         # Commercial proposals
├── payment_service.py        # Payment processing
├── production_service.py     # Production workflow
└── README.md
```

## Usage

### Basic Example

```python
from atelier_erp.services import UnitOfWork, OrderService, InventoryService

# Create Unit of Work (manages transaction + events)
uow = UnitOfWork()

with uow.atomic():
    # Create services with UOW
    inventory = InventoryService(uow)
    order_service = OrderService(uow, inventory)
    
    # Create order
    order = order_service.create_order(
        customer_id=customer_uuid,
        order_number="О-2024-001",
        items=[...],
        created_by=user_uuid
    )
    
    # Events dispatched automatically on commit
```

### Order Lifecycle Example

```python
from atelier_erp.services.unit_of_work import unit_of_work_context
from atelier_erp.services import OrderService, InventoryService

# Full lifecycle with proper FSM transitions
with unit_of_work_context() as uow:
    inventory = InventoryService(uow)
    order_svc = OrderService(uow, inventory)
    
    # 1. Create order (DRAFT)
    order = order_svc.create_order(
        customer_id=customer_id,
        order_number="О-2024-001",
        items=[...]
    )
    
    # 2. Confirm order (DRAFT → APPROVED)
    order = order_svc.confirm_order(order.id, confirmed_by=user_id)
    
    # 3. Record prepayment
    order, payment = order_svc.record_payment(
        order.id,
        amount=Decimal('25000'),
        payment_type='prepayment',
        payment_method='kaspi'
    )
    # Auto-transition: APPROVED → PREPAYMENT_RECEIVED
    
    # 4. Reserve materials
    order, reservations = order_svc.reserve_materials(
        order.id,
        reserved_by=user_id
    )
    
    # 5. Start production (converts reservations → deductions)
    order = order_svc.start_production(
        order.id,
        assigned_to=seamstress_id,
        deadline=date(2024, 2, 1),
        complexity='medium'
    )
    
    # 6. Complete order (after installation)
    order = order_svc.complete_order(
        order.id,
        installation_date=date(2024, 1, 30),
        completed_by=user_id
    )
```

### Handling Inventory with Locks

```python
from atelier_erp.services.unit_of_work import UnitOfWork
from atelier_erp.models import Fabric

uow = UnitOfWork()

# Acquire row locks on fabrics before reservation
fabric_ids = [item['fabric_id'] for item in items]
lock_items = [(Fabric, fid) for fid in fabric_ids]

with uow.atomic_with_locks(lock_items):
    inventory = InventoryService(uow)
    
    # Rows are now locked with SELECT FOR UPDATE
    reservations = inventory.reserve_fabrics_for_order(
        order_id=order_id,
        fabric_items=items
    )
```

## Services Reference

### OrderService

Core order lifecycle management.

**Methods:**
- `create_order()` - Create new order in DRAFT
- `create_order_from_quote()` - Convert approved quote to order
- `confirm_order()` - Customer approves (QUOTED → APPROVED)
- `reserve_materials()` - Reserve fabric (APPROVED → FABRIC_RESERVED)
- `start_production()` - Begin production (FABRIC_RESERVED → PRODUCTION)
- `complete_order()` - Mark completed (INSTALLATION → COMPLETED)
- `cancel_order()` - Cancel and return inventory
- `record_payment()` - Record payment with idempotency
- `transition_status()` - Generic FSM transition

**FSM Enforcement:**
All methods validate transitions using `OrderFSMRules.TRANSITIONS`

### InventoryService

Stock management and reservations.

**Methods:**
- `reserve_fabric()` - Create reservation
- `reserve_fabrics_for_order()` - Bulk reserve
- `cancel_reservation()` - Release reservation
- `convert_reservation_to_deduction()` - Reservation → actual stock deduction
- `convert_all_reservations()` - Convert all for order
- `allocate_cornice()` - Immediate cornice allocation
- `return_fabric_stock()` - Return on cancellation
- `release_all_reservations()` - Release all for order
- `check_bulk_availability()` - Check before reserving
- `expire_old_reservations()` - Background cleanup

**Invariants:**
- Reservations ≤ Physical stock (enforced at DB level)
- Only ACTIVE reservations can be converted
- Expired reservations auto-released by Celery task

### TaskService

Lead management pre-order.

**Methods:**
- `create_task()` - Create lead
- `assign_designer()` - Assign to designer
- `schedule_measurement()` - Book measurement
- `add_measurement()` - Record measurements
- `start_quoting()` - Begin quote preparation
- `send_quote()` - Send to customer
- `convert_to_order()` - Convert to order (requires quote)
- `mark_lost()` - Mark as lost opportunity
- `reactivate_task()` - Reactivate lost/postponed
- `postpone_task()` - Client wants to delay
- `delete_task()` - Delete (only LEAD/LOST/POSTPONED)

### QuoteService

Commercial proposal management.

**Methods:**
- `create_quote()` - Generate quote with items
- `calculate_line_item()` - Calculate single item costs
- `send_quote()` - Mark as sent
- `approve_quote()` - Customer approved
- `reject_quote()` - Customer rejected
- `revise_quote()` - Create new version
- `check_expired_quotes()` - Background cleanup

### PaymentService

Payment processing with idempotency.

**Methods:**
- `record_payment()` - Record with idempotency key
- `record_prepayment()` - 50%+ payment
- `record_final_payment()` - Remaining balance
- `process_external_payment()` - Webhook from Kaspi/etc
- `void_payment()` - Admin void (adjusts order)
- `reconcile_payments()` - Verify totals match
- `get_payment_summary()` - Payment status for order
- `get_outstanding_payments()` - All unpaid orders

### ProductionService

Production workflow and payments.

**Methods:**
- `create_assignment()` - Assign to seamstress
- `reassign_to_seamstress()` - Change assignment
- `update_status()` - Update production status
- `start_work()` - Mark as cutting
- `mark_sewing()` - Mark as sewing
- `quality_check()` - Pass/fail quality
- `mark_ready()` - Production complete
- `return_for_revision()` - Failed quality
- `resume_after_revision()` - Continue work
- `create_payment_record()` - Create seamstress payment
- `mark_payment_paid()` - Mark as paid
- `calculate_bulk_payments()` - Payroll calculation
- `get_workload_for_seamstress()` - Capacity view
- `get_production_queue()` - Management view

## Domain Events

Events are published on successful transaction commit.

### Order Events
- `OrderCreated`
- `OrderStatusChanged`
- `OrderConfirmed`
- `OrderMaterialsReserved`
- `OrderProductionStarted`
- `OrderCompleted`
- `OrderCancelled`
- `OrderPaymentReceived`

### Inventory Events
- `FabricReserved`
- `FabricReservationConverted`
- `FabricReservationCancelled`
- `StockDeducted`
- `StockReturned`
- `LowStockAlert`

### Task Events
- `TaskCreated`
- `TaskConvertedToOrder`

### Production Events
- `ProductionAssigned`
- `ProductionStatusChanged`
- `WorkCompleted`

### Subscribing to Events

```python
from atelier_erp.services.events import get_event_bus, OrderCompleted
from atelier_erp.services import OrderService

def send_completion_email(event: OrderCompleted):
    # Send email to customer
    order = Order.objects.get(pk=event.order_id)
    send_email(order.customer.email, "Your order is complete!")

# Subscribe
event_bus = get_event_bus()
event_bus.subscribe('OrderCompleted', send_completion_email)
```

## Transaction Management

### Unit of Work Pattern

```python
from atelier_erp.services import UnitOfWork

uow = UnitOfWork()

with uow.atomic():
    # All operations in this block are atomic
    # Events collected and dispatched on commit
    # Events cleared on rollback
    
    order = order_service.create_order(...)
    payment = payment_service.record_payment(...)
    
    # Both succeed or both fail
    # Events dispatched only after successful commit
```

### With Row Locking

```python
from atelier_erp.models import Fabric, Cornice

# Lock rows before modification
lock_items = [
    (Fabric, fabric_id_1),
    (Fabric, fabric_id_2),
    (Cornice, cornice_id),
]

with uow.atomic_with_locks(lock_items):
    # Rows locked with SELECT FOR UPDATE
    inventory.allocate_cornice(cornice_id, order_id, 2)
    inventory.reserve_fabric(fabric_id_1, order_id, Decimal('5.5'))
```

## Error Handling

All service methods raise specific exceptions:

```python
from atelier_erp.services.exceptions import (
    OrderNotFoundError,
    InvalidOrderStatusTransition,
    InsufficientStockError,
    DuplicatePaymentError
)

try:
    order = order_service.create_order(...)
except OrderValidationError as e:
    # Return 400 with error details
    return Response({'error': str(e)}, status=400)
except InvalidOrderStatusTransition as e:
    # Return 409 Conflict
    return Response({
        'error': str(e),
        'current_status': e.current_status,
        'allowed': e.allowed
    }, status=409)
```

## Testing

```python
import pytest
from django.test import TestCase
from atelier_erp.services import OrderService, UnitOfWork
from atelier_erp.services.exceptions import InvalidOrderStatusTransition

class OrderServiceTest(TestCase):
    def setUp(self):
        self.uow = UnitOfWork()
        self.service = OrderService(self.uow)
    
    def test_create_order(self):
        with self.uow.atomic():
            order = self.service.create_order(
                customer_id=self.customer.id,
                order_number="О-2024-001",
                items=[]
            )
            self.assertEqual(order.status, 'draft')
    
    def test_invalid_transition(self):
        with self.uow.atomic():
            order = self.service.create_order(...)
            
            with self.assertRaises(InvalidOrderStatusTransition):
                # Cannot go from DRAFT to COMPLETED
                order_service.transition_status(order.id, 'completed')
```

## Background Tasks

### Celery Tasks

```python
# tasks.py
from celery import shared_task
from atelier_erp.services import InventoryService, UnitOfWork

@shared_task
def expire_old_reservations():
    uow = UnitOfWork()
    with uow.atomic():
        inventory = InventoryService(uow)
        count = inventory.expire_old_reservations()
    return f"Expired {count} reservations"

@shared_task
def check_expired_quotes():
    from atelier_erp.services import QuoteService
    uow = UnitOfWork()
    with uow.atomic():
        quote_svc = QuoteService(uow)
        count = quote_svc.check_expired_quotes()
    return f"Marked {count} quotes as expired"
```

## Performance

### Optimized for 100k+ Orders

- Row-level locking (`select_for_update`) for inventory
- Idempotency keys prevent duplicate payments
- Bulk operations where possible
- Database constraints enforce invariants
- Indexes on all query patterns

### Lock Strategy

1. **Short duration**: Locks held only within transaction
2. **Ordered acquisition**: Always lock in consistent order (fabric_id ASC)
3. **Minimal scope**: Only lock rows being modified
4. **Timeout**: Set lock_timeout in PostgreSQL for stuck transactions

## License

Internal use only.

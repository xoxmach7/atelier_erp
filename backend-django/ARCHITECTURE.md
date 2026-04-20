# ERP Atelier Architecture — Technical Design Document

**Domain:** Curtain Manufacturing Atelier  
**Pattern:** DDD + Event-Driven + Layered Architecture  
**Transaction Model:** Sagas for long-running processes  

---

## 1. Bounded Contexts & Django Apps Structure

```
backend-django/
├── core/                          # Shared Kernel
│   ├── domain/                   # Base classes, value objects
│   ├── events/                   # Event bus, handlers registry
│   ├── exceptions.py             # Domain exceptions
│   └── permissions.py            # Base permission classes
│
├── apps/
│   ├── identity/                 # BC: Identity & Access
│   │   ├── domain/
│   │   │   ├── user.py          # User aggregate
│   │   │   ├── worker.py        # Worker aggregate
│   │   │   └── role.py          # Role VO
│   │   ├── services/
│   │   │   ├── user_service.py
│   │   │   └── worker_service.py
│   │   └── events/
│   │       └── handlers.py
│   │
│   ├── catalog/                  # BC: Product Catalog
│   │   ├── domain/
│   │   │   ├── product_template.py    # Template aggregate
│   │   │   ├── operation_template.py  # Operation type VO
│   │   │   └── pricing_rule.py        # Pricing VO
│   │   └── services/
│   │       └── template_service.py
│   │
│   ├── sales/                    # BC: Sales & Orders (Core Domain)
│   │   ├── domain/
│   │   │   ├── order.py         # Order aggregate root
│   │   │   ├── order_fsm.py     # State machine
│   │   │   ├── client.py        # Client aggregate
│   │   │   └── measurement.py   # Value object
│   │   ├── services/
│   │   │   ├── order_service.py         # @transaction.atomic
│   │   │   ├── order_lifecycle_service.py
│   │   │   └── client_service.py
│   │   └── events/
│   │       ├── publisher.py     # Order domain events
│   │       └── handlers.py      # Local handlers
│   │
│   ├── production/               # BC: Production & Tasks
│   │   ├── domain/
│   │   │   ├── task.py          # Task aggregate
│   │   │   ├── task_dag.py      # Dependency graph
│   │   │   ├── work_order.py    # Work order aggregate
│   │   │   └── quality_check.py # QC VO
│   │   ├── services/
│   │   │   ├── task_service.py          # @transaction.atomic
│   │   │   ├── task_assignment_service.py  # Celery + lock
│   │   │   ├── work_order_service.py
│   │   │   └── quality_control_service.py
│   │   └── events/
│   │       └── handlers.py      # Task completion handlers
│   │
│   ├── inventory/                # BC: Inventory Management
│   │   ├── domain/
│   │   │   ├── fabric.py         # Fabric aggregate
│   │   │   ├── reservation.py    # Reservation entity
│   │   │   ├── stock_level.py    # VO
│   │   │   └── supplier.py       # Supplier aggregate
│   │   ├── services/
│   │   │   ├── inventory_service.py      # @transaction.atomic + select_for_update
│   │   │   ├── reservation_service.py   # Saga coordinator
│   │   │   └── stock_alert_service.py   # Celery beat
│   │   └── events/
│   │       └── handlers.py
│   │
│   ├── procurement/              # BC: Procurement (future)
│   │   └── domain/
│   │       └── purchase_order.py
│   │
│   └── reporting/                # BC: Analytics & Reports
│       ├── services/
│       │   ├── dashboard_service.py     # Read-only
│       │   └── metrics_service.py       # Aggregations
│       └── queries/             # CQRS query models
│
├── infrastructure/               # Infrastructure Layer
│   ├── messaging/               # Event bus implementations
│   │   ├── celery_publisher.py
│   │   └── django_signals_bridge.py
│   ├── persistence/             # Repositories (if needed)
│   └── integrations/            # External APIs
│
└── config/                      # Django settings
    └── settings/
```

---

## 2. Application Layer Services

### 2.1 Sales Context Services

| Service | Responsibility | Transaction | Side Effects |
|---------|---------------|-------------|--------------|
| `OrderService.create_draft()` | Создание черновика | `@atomic` | `OrderCreated` |
| `OrderService.submit_for_confirmation()` | Отправка на подтверждение | `@atomic` | `OrderSubmitted` |
| `OrderLifecycleService.confirm()` | Подтверждение + запуск саги | `@atomic` | `OrderConfirmed`, вызов `InventorySaga.reserve_fabrics()` |
| `OrderLifecycleService.cancel()` | Отмена заказа | `@atomic + saga` | `OrderCancelled`, компенсация резервов |
| `OrderLifecycleService.start_production()` | Старт производства | `@atomic` | `ProductionStarted`, вызов `TaskGenerationService.generate_from_template()` |
| `OrderLifecycleService.complete()` | Завершение заказа | `@atomic + saga` | `OrderCompleted`, вызов `InventorySaga.consume_reservations()` |
| `ClientService.register()` | Регистрация клиента | `@atomic` | `ClientRegistered` |

**Critical Transaction Boundary:**
```python
# Order confirmation = Inventory reservation MUST succeed or fail together
with transaction.atomic():
    order.confirm()
    reservation_result = inventory_service.reserve_fabrics(order)
    if not reservation_result.success:
        raise InsufficientInventoryError()
```

### 2.2 Production Context Services

| Service | Responsibility | Sync/Async | Locking |
|---------|---------------|------------|---------|
| `TaskGenerationService.generate_from_template(order_id)` | DAG генерация | Sync | — |
| `TaskAssignmentService.auto_assign()` | Алгоритм назначения | Celery | `select_for_update()` on Worker |
| `TaskAssignmentService.assign_to_worker()` | Ручное назначение | Sync | `select_for_update()` |
| `TaskService.start_task()` | Начало работы | Sync | Check dependency completion |
| `TaskService.complete_task()` | Завершение + триггеры | `@atomic` | `post_save signal` → check order transition |
| `TaskService.reassign()` | Переназначение | Sync | Release + acquire locks |
| `QualityControlService.submit_check()` | QC результат | `@atomic` | Triggers order status change |
| `WorkOrderService.create_for_order()` | Создание наряда | Sync | — |

**Worker Overload Prevention:**
```python
# Lock pattern for concurrent assignment
with transaction.atomic():
    worker = Worker.objects.select_for_update().get(id=worker_id)
    if worker.current_load >= worker.max_parallel_tasks:
        raise WorkerOverloadError()
    worker.current_load += 1
    worker.save()
    task.assign(worker)
```

### 2.3 Inventory Context Services

| Service | Responsibility | Transaction Pattern | Saga |
|---------|---------------|-------------------|------|
| `InventoryService.reserve()` | Резервирование | `@atomic + select_for_update()` | — |
| `InventoryService.release_reservation()` | Отмена резерва | `@atomic` | Compensating action |
| `InventoryService.consume_reservation()` | Списание | `@atomic` | Final action |
| `InventoryService.record_waste()` | Учёт брака | `@atomic` | May trigger reorder |
| `ReservationSaga.coordinate_reservation()` | Множественный резерв | Saga pattern | Commit/rollback |
| `StockAlertService.check_levels()` | Проверка остатков | Celery Beat | `LowStock` event |

**Reservation Saga Pattern:**
```python
class ReservationSaga:
    """Saga для резервирования множества тканей"""
    
    def execute(self, order, fabric_items):
        reservations = []
        try:
            for item in fabric_items:
                reservation = self.inventory_service.reserve(item)
                reservations.append(reservation)
            return SagaResult.success(reservations)
        except InsufficientInventory as e:
            # Compensate: release all reserved
            for r in reservations:
                self.inventory_service.release_reservation(r)
            return SagaResult.failure(e)
```

---

## 3. Domain Events Catalog

### 3.1 Order Domain Events

| Event | Payload | Publisher | Handlers | Delivery |
|-------|---------|-----------|----------|----------|
| `OrderCreated` | `order_id`, `client_id`, `draft_data` | Order aggregate | NotificationService | Sync (same tx) |
| `OrderSubmitted` | `order_id`, `manager_id` | OrderService | — | Sync |
| `OrderConfirmed` | `order_id`, `deadline` | OrderLifecycleService | InventorySaga, TaskGenerationService | Sync |
| `OrderStatusChanged` | `order_id`, `old_status`, `new_status`, `reason` | Order aggregate | AuditLog, NotificationService | Sync + Async |
| `OrderCancelled` | `order_id`, `reason`, `cancellation_fee` | OrderLifecycleService | InventoryReleaseHandler, RefundHandler | Async (Celery) |
| `OrderCompleted` | `order_id`, `completion_date`, `final_cost` | OrderLifecycleService | InventoryConsumeHandler, ReviewRequestHandler | Async |
| `OrderOnHold` | `order_id`, `reason`, `hold_until` | OrderService | SupplierNotificationHandler | Async |
| `OrderPriorityChanged` | `order_id`, `new_priority`, `old_priority` | OrderService | ReschedulingHandler | Async |

### 3.2 Task Domain Events

| Event | Payload | Publisher | Handlers |
|-------|---------|-----------|----------|
| `TaskCreated` | `task_id`, `order_id`, `operation_type` | TaskGenerationService | AssignmentHandler |
| `TaskAssigned` | `task_id`, `worker_id`, `assigned_at` | TaskAssignmentService | NotificationService |
| `TaskStarted` | `task_id`, `worker_id`, `started_at` | TaskService | TimeTrackingHandler |
| `TaskCompleted` | `task_id`, `worker_id`, `actual_minutes`, `quality_score` | TaskService | OrderStatusChecker, WorkerStatsUpdater | Sync + Async |
| `TaskReassigned` | `task_id`, `old_worker_id`, `new_worker_id` | TaskService | Both workers notified | Async |
| `TaskBlocked` | `task_id`, `blocking_dependency_id` | DependencyChecker | — | Sync |
| `TaskOverdue` | `task_id`, `deadline`, `overdue_hours` | Celery Beat | AlertManager | Async |
| `AllTasksCompleted` | `order_id`, `completed_count` | OrderStatusChecker | QCAssignmentHandler | Sync |

### 3.3 Inventory Domain Events

| Event | Payload | Publisher | Handlers |
|-------|---------|-----------|----------|
| `FabricReserved` | `reservation_id`, `fabric_id`, `meters`, `order_id` | InventoryService | StockLevelUpdater | Sync |
| `FabricReservationConfirmed` | `reservation_id`, `confirmed_at` | ReservationSaga | — | Sync |
| `FabricReservationReleased` | `reservation_id`, `reason` | InventoryService | StockLevelUpdater | Sync |
| `FabricConsumed` | `reservation_id`, `fabric_id`, `meters`, `order_id` | InventorySaga | CostAccountingHandler | Async |
| `StockLow` | `fabric_id`, `current_meters`, `threshold` | StockAlertService | ProcurementInitiator, ManagerNotifier | Async |
| `StockCritical` | `fabric_id`, `current_meters` | StockAlertService | AllManagersAlert, TemplateBlocker | Async |
| `WasteRecorded` | `fabric_id`, `wasted_meters`, `reason`, `order_id` | InventoryService | CostAccountingHandler | Async |
| `FabricReceived` | `fabric_id`, `received_meters`, `purchase_order_id` | Procurement (future) | WaitingOrdersChecker | Async |

### 3.4 Worker Domain Events

| Event | Payload | Publisher | Handlers |
|-------|---------|-----------|----------|
| `WorkerAssigned` | `worker_id`, `task_count` | TaskAssignmentService | LoadBalancer | Sync |
| `WorkerOverloadWarning` | `worker_id`, `current_load`, `max_load` | TaskAssignmentService | ManagerAlert | Async |
| `WorkerEfficiencyUpdated` | `worker_id`, `new_rating`, `calculation_basis` | TaskCompletionHandler | — | Async |
| `WorkerAvailabilityChanged` | `worker_id`, `is_available`, `reason` | WorkerService | AssignmentQueue | Async |

### 3.5 Quality Control Events

| Event | Payload | Publisher | Handlers |
|-------|---------|-----------|----------|
| `QCStarted` | `order_id`, `qc_worker_id` | QCService | — | Sync |
| `QCPassed` | `order_id`, `score`, `checked_by` | QCService | OrderTransitionHandler | Sync |
| `QCFailed` | `order_id`, `score`, `defects`, `rework_required` | QCService | ReworkTaskGenerator, ClientNotifier | Sync + Async |
| `ReworkTaskCreated` | `original_task_id`, `rework_task_id`, `reason` | ReworkHandler | AssignmentHandler | Async |

### 3.6 Integration Events (Async via Celery)

| Event | Payload | Consumers |
|-------|---------|-----------|
| `OrderReadyForDelivery` | `order_id`, `client_phone`, `address` | SMS Gateway |
| `OrderReadyForInstallation` | `order_id`, `installation_date`, `installer_id` | Calendar Sync, SMS |
| `DailyProductionReport` | `date`, `completed_orders`, `qc_failures` | Email Reporter |
| `WeeklyStockReport` | `low_stock_items`, `consumption_stats` | Procurement System |

---

## 4. Transaction Boundaries & Concurrency Control

### 4.1 Critical Transactions (ACID Required)

| Operation | Isolation Level | Locking Strategy | Why |
|-----------|-----------------|------------------|-----|
| Order + Fabric Reservation | `SERIALIZABLE` | `select_for_update()` on InventoryItem | Prevent overselling same fabric to 2 orders |
| Task Assignment | `READ COMMITTED` | `select_for_update()` on Worker | Prevent overload (race condition) |
| Task Completion + Order Status | `READ COMMITTED` | Row lock on Order | Atomic status transition |
| QC Result + Rework | `READ COMMITTED` | — | Single aggregate update |
| Reservation → Consumption | `READ COMMITTED` | `select_for_update()` on Reservation | Prevent double-consumption |

### 4.2 Sagas (Distributed Transactions)

**Order Confirmation Saga:**
```
[START] → Reserve Fabric A → Reserve Fabric B → Reserve Fabric C → [COMMIT]
             ↓                       ↓                       ↓
         [FAIL]←──────────────────[FAIL]←──────────────────[FAIL]
             ↓
         Release A, B (compensate)
```

**Order Completion Saga:**
```
[START] → Consume Fabric A → Consume Fabric B → Update Order Status → [COMMIT]
             ↓                       ↓
         [FAIL]                  [FAIL]
             ↓
         Alert Admin (manual fix required)
```

### 4.3 Celery Tasks (Async Processing)

| Task | Trigger | ETA | Retry |
|------|---------|-----|-------|
| `auto_assign_tasks` | `OrderConfirmed` | 0s | 3×, 5min delay |
| `send_order_notification` | `OrderStatusChanged` | 0s | 5×, backoff |
| `check_stock_levels` | Celery Beat (every 1h) | — | — |
| `generate_daily_report` | Celery Beat (8:00) | — | 3× |
| `check_overdue_tasks` | Celery Beat (every 15min) | — | — |
| `release_expired_reservations` | Celery Beat (daily) | — | — |
| `update_worker_statistics` | `TaskCompleted` | 60s | 3× |
| `process_refund` | `OrderCancelled` | 0s | 5×, critical |

---

## 5. Signals & Hooks

### 5.1 Django Signals (Same Process)

```python
# Production signals
@receiver(post_save, sender=Task)
def on_task_completed(sender, instance, created, **kwargs):
    if instance.status == TaskStatus.DONE and not created:
        # Check if all tasks in order are done
        check_order_completion.delay(instance.order_id)

# Inventory signals
@receiver(post_save, sender=FabricReservation)
def on_reservation_confirmed(sender, instance, **kwargs):
    if instance.status_changed_to(CONFIRMED):
        update_available_stock(instance.fabric_id)

# Order signals
@receiver(pre_save, sender=Order)
def on_order_status_changing(sender, instance, **kwargs):
    if instance.status_changed():
        log_status_transition(instance)
        emit_order_status_changed_event(instance)
```

### 5.2 Event Bus Handlers (Cross-Context)

```python
# Event handler registry
class EventBus:
    handlers: Dict[EventType, List[Callable]]
    
    def publish(self, event: DomainEvent):
        # Sync handlers first (same transaction)
        for handler in self.get_sync_handlers(event.type):
            handler(event)
        
        # Async handlers (Celery)
        for handler in self.get_async_handlers(event.type):
            process_async_handler.delay(handler, event)
```

---

## 6. Architecture Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Race condition on fabric reservation** | HIGH | `select_for_update()` + unique constraint on `(fabric, order)` reservation |
| **Deadlock in Worker assignment** | MEDIUM | Ordered lock acquisition (worker_id ASC), timeout 5s |
| **Cascading failure in Order completion** | HIGH | Saga pattern with compensation, DLQ for failed async tasks |
| **Event loss on crash** | MEDIUM | Persistent Celery backend (Redis/RabbitMQ), idempotent handlers |
| **Status inconsistency (Order vs Tasks)** | HIGH | Database constraints, periodic consistency checker job |
| **Worker overload (concurrent assignments)** | HIGH | Optimistic locking on Worker.current_load, retry with backoff |
| **Memory leak in DAG generation** | LOW | Limit max tasks per order (100), pagination |
| **Slow queries on dashboard** | MEDIUM | CQRS — separate read models, materialized views |

---

## 7. Improvement Proposals

### 7.1 Short Term (MVP+)

1. **Optimistic Locking for Worker Load**
   - Add `version` field to Worker
   - Retry assignment on `OptimisticLockError`

2. **Outbox Pattern for Events**
   - Store events in `outbox` table (same TX as business logic)
   - Relay to Celery via polling
   - Guarantees at-least-once delivery

3. **Circuit Breaker for External Services**
   - SMS gateway, Email
   - Fallback to queue retry

### 7.2 Medium Term (Scale)

1. **Event Sourcing for Order Lifecycle**
   - Store all status changes as events
   - Rebuild state from stream
   - Audit trail built-in

2. **Read Model Projection**
   - Separate PostgreSQL schema for dashboards
   - Denormalized views updated by event handlers
   - Sub-100ms dashboard queries

3. **Worker Capacity Forecasting**
   - ML model predicts completion time
   - Optimizes task assignment beyond simple load balancing

### 7.3 Long Term (Enterprise)

1. **Split Bounded Contexts to Services**
   - Inventory Service (microservice)
   - Production Service (microservice)
   - Sales keeps Order aggregate (orchestrator)

2. **CQRS with Separate Read Stores**
   - Elasticsearch for order search
   - ClickHouse for analytics
   - Redis for real-time dashboards

3. **Blockchain for Critical Events**
   - Order completion certificates
   - QC results (tamper-proof)

---

## 8. API Layer (Thin Controllers)

```python
# Pattern: Controller → Service → Domain → Repository

class OrderController:
    def post(self, request):
        # 1. Validate input (Serializer)
        # 2. Call Application Service
        result = OrderService.create_draft(
            client_id=request.data['client_id'],
            template_id=request.data['template_id'],
            measurements=request.data['measurements']
        )
        # 3. Return DTO
        return Response(OrderDTO(result.order))
```

**No business logic in views.**

---

## 9. Testing Strategy

| Layer | Strategy | Tools |
|-------|----------|-------|
| Domain (Unit) | Pure Python tests | pytest, hypothesis (property-based) |
| Services (Integration) | In-memory DB, mocked events | pytest-django, factory-boy |
| Event Handlers | Async test with real Celery | pytest-celery, Redis |
| Concurrency | Load tests with `locust` | race condition detection |
| E2E | API tests with real DB | pytest, requests |

---

**Document Owner:** Backend Architect  
**Status:** Design Complete  
**Next Step:** Implementation of Core Domain (Order, Task, Reservation aggregates)

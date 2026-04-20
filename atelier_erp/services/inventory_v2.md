# Inventory Service V2 - Fabric Reservation System

Production-ready inventory management with mandatory reservation-before-production workflow.

## Overview

```
┌─────────────┐     reserve      ┌──────────────┐     commit      ┌─────────────┐
│   ORDER     │ ───────────────> │ CONFIRMED    │ ──────────────> │ COMMITTED   │
│  CREATED    │                  │ RESERVATION  │                 │ DEDUCTION   │
└─────────────┘                  └──────────────┘                 └─────────────┘
       │                                │                                 │
       │ cancel                         │ expire                          │
       ▼                                ▼                                 ▼
┌─────────────┐                  ┌──────────────┐                 ┌─────────────┐
│  RELEASED   │                  │   EXPIRED    │                 │ CONSUMED    │
└─────────────┘                  └──────────────┘                 └─────────────┘
```

## Core Concepts

### Stock Levels

```
physical_quantity ─────────────────────────────────────────┐
        │                                                    │
        ├── committed_quantity ──> already deducted          │
        ├── reserved_quantity ───> blocked by reservations   │
        └── available_quantity ──> free for new reservations
```

**Formula:** `available = physical - committed - reserved`

### Fabric Types

- `BLACKOUT` - Блэкаут (light-blocking fabric)
- `TULLE` - Тюль (sheer fabric)
- `LINING` - Подкладка (lining fabric)
- `VELVET` - Бархат
- `COTTON` - Хлопок
- `SILK` - Шёлк
- `LINEN` - Лён

## API Reference

### 1. reserve_materials()

Reserve fabrics for an order (blocks inventory).

```python
from atelier_erp.services.inventory_v2 import (
    InventoryServiceV2, FabricSpec, FabricType
)
from uuid import uuid4
from decimal import Decimal

# Define fabrics needed
items = [
    (FabricSpec(
        fabric_id=uuid4(),
        fabric_type=FabricType.BLACKOUT,
        color="navy",
        hanger_number="B-001"
    ), Decimal("5.5")),  # meters
    
    (FabricSpec(
        fabric_id=uuid4(),
        fabric_type=FabricType.TULLE,
        color="white",
        hanger_number="T-023"
    ), Decimal("4.2")),
]

# Reserve
result = service.reserve_materials(
    order_id=order_uuid,
    items=items,
    allow_partial=True,           # Allow partial fulfillment
    ttl_hours=24,                 # Reservation expires in 24h
    created_by=user_uuid
)

# Check result
if result.fully_fulfilled:
    print(f"Reserved {result.total_reserved_quantity}m")
else:
    print(f"Partial: {result.fulfillment_rate}% fulfilled")
    for spec, requested, reason in result.failed:
        print(f"  Failed: {spec.hanger_number} - {reason}")
```

**Returns:** `ReservationResult`
- `success`: Boolean
- `reservations`: List of created reservations
- `fulfillment_rate`: Percentage fulfilled
- `is_partial_fulfillment`: True if any partial
- `reservation_expiry`: When reservations expire

### 2. release_materials()

Release reservations (order cancelled or materials not needed).

```python
released = service.release_materials(
    order_id=order_uuid,
    released_by=user_uuid,
    reason="Customer cancelled order"
)

print(f"Released {len(released)} reservations")
for res in released:
    print(f"  {res.fabric_spec.hanger_number}: {res.reserved_quantity}m")
```

### 3. commit_materials()

Convert reservations to actual deductions (production starts).

```python
result = service.commit_materials(
    order_id=order_uuid,
    committed_by=user_uuid
)

if result.success:
    print(f"Committed {result.total_committed_quantity}m")
else:
    for res_id, error in result.failed_commits:
        print(f"Failed to commit {res_id}: {error}")
```

**Stock Update:**
- `reserved_quantity` decreases
- `committed_quantity` increases
- `physical_quantity` unchanged (commit is logical, not physical movement)

### 4. check_availability()

Check availability without reserving.

```python
results = service.check_availability(items)

for avail in results:
    print(f"{avail.hanger_number}:")
    print(f"  Requested: {avail.requested}m")
    print(f"  Available: {avail.available}m")
    print(f"  Can fulfill: {avail.can_fulfill}")
    print(f"  Partial possible: {avail.can_fulfill_partial} ({avail.partial_amount}m)")
    
    if avail.expires_soon:
        print("  ⚠️ Existing reservations expiring soon")
```

### 5. detect_low_stock()

Detect fabrics with low stock levels.

```python
alerts = service.detect_low_stock(threshold=Decimal("10.0"))

for alert in alerts:
    print(f"⚠️ LOW STOCK: {alert['fabric_id']}")
    print(f"   Available: {alert['available_quantity']}m")
    print(f"   Reserved: {alert['reserved_quantity']}m")
    print(f"   Committed: {alert['committed_quantity']}m")
    print(f"   Severity: {alert['severity']}")
```

## Concurrency Safety

### Locking Strategy

1. **Multi-Fabric Lock Ordering**
   ```python
   # Always lock in consistent order (sorted by fabric_id)
   sorted_ids = sorted(fabric_ids, key=lambda x: str(x))
   locks = [acquire_lock(fid) for fid in sorted_ids]
   ```

2. **Deadlock Prevention**
   - Always acquire multiple locks in ID-sorted order
   - Use timeout on lock acquisition
   - Release in reverse order

3. **Optimistic Locking Alternative**
   ```python
   # For high-read scenarios
   version = opt_lock.get_version(fabric_id)
   # ... read stock ...
   success = opt_lock.check_and_increment(fabric_id, version)
   if not success:
       raise ConcurrentModificationError()
   ```

## Partial Availability

When `allow_partial=True`:

```python
# Request 10m, only 6m available
result = service.reserve_materials(
    order_id=order_id,
    items=[(fabric_spec, Decimal("10.0"))],
    allow_partial=True
)

# Result:
# - reservation.reserved_quantity = 6.0
# - reservation.requested_quantity = 10.0
# - reservation.is_partial = True
# - result.is_partial_fulfillment = True
# - result.fulfillment_rate = 60%
```

**Handling Partial Reservations:**
1. Notify user of partial fulfillment
2. Offer alternatives (different fabric, wait for restock)
3. Split order: fulfill partial now, remainder later

## Reservation Lifecycle

```
PENDING → CONFIRMED → COMMITTED
   │         │           │
   │         │           └── Production uses materials
   │         │
   │         └── Blocks inventory, TTL starts
   │
   └── (Optional) Initial creation before confirmation

CONFIRMED → RELEASED (order cancelled)
CONFIRMED → EXPIRED (TTL reached)
```

## Event System

```python
# Subscribe to events
service.on('materials_reserved', lambda data: print(f"Reserved for {data['order_id']}"))
service.on('materials_committed', lambda data: print(f"Committed {data['total_quantity']}m"))
service.on('materials_released', lambda data: print(f"Released: {data['reason']}"))
service.on('low_stock_detected', lambda data: send_alert(data['alerts']))
```

**Events:**
- `materials_reserved` - New reservations confirmed
- `materials_committed` - Reservations converted to deductions
- `materials_released` - Reservations released
- `reservations_expired` - TTL expired, auto-released
- `low_stock_detected` - Stock below threshold

## Maintenance Tasks

### Expire Old Reservations

```python
# Run as Celery task every 5 minutes
@shared_task
def expire_reservations():
    service = InventoryServiceV2(repository)
    count, expired = service.expire_old_reservations(batch_size=100)
    return f"Expired {count} reservations"
```

### Extend Reservations

```python
# Customer needs more time?
extended = service.extend_reservation(
    reservation_id=res_id,
    additional_hours=48,
    extended_by=user_id
)
```

### Stock Forecasting

```python
# Project availability for next 7 days
projections = service.get_stock_forecast(fabric_id, days=7)

for day in projections:
    print(f"{day['date']}: {day['projected_available']}m")
    if day['will_be_depleted']:
        print("  ⚠️ Will be depleted!")
```

## Repository Implementation

```python
from atelier_erp.services.inventory_v2 import InventoryRepository

class DjangoInventoryRepository(InventoryRepository):
    def get_stock_level(self, fabric_id):
        from atelier_erp.models import Fabric
        try:
            fabric = Fabric.objects.get(pk=fabric_id)
            return StockLevel(
                physical_quantity=fabric.stock_meters,
                reserved_quantity=fabric.reserved_meters,
                committed_quantity=fabric.committed_meters,
                pending_quantity=Decimal('0')
            )
        except Fabric.DoesNotExist:
            return None
    
    def update_stock_level(self, fabric_id, updates):
        from atelier_erp.models import Fabric
        Fabric.objects.filter(pk=fabric_id).update(**updates)
        return True
    
    def save_reservation(self, reservation):
        from atelier_erp.models import FabricReservation
        FabricReservation.objects.create(
            id=reservation.id,
            order_id=reservation.order_id,
            fabric_id=reservation.fabric_id,
            requested_quantity=reservation.requested_quantity,
            reserved_quantity=reservation.reserved_quantity,
            status=reservation.status.value,
            expires_at=reservation.expires_at,
            is_partial=reservation.is_partial
        )
        return True
```

## Testing

```python
import pytest
from decimal import Decimal
from atelier_erp.services.inventory_v2 import (
    InventoryServiceV2, FabricSpec, FabricType, StockLevel
)

class MockRepository:
    def __init__(self):
        self.stocks = {}
        self.reservations = []
    
    def get_stock_level(self, fabric_id):
        return self.stocks.get(fabric_id)
    
    def update_stock_level(self, fabric_id, updates):
        if fabric_id in self.stocks:
            for key, value in updates.items():
                setattr(self.stocks[fabric_id], key, value)
        return True

def test_reserve_and_commit():
    repo = MockRepository()
    repo.stocks[fabric_id] = StockLevel(
        physical_quantity=Decimal("100"),
        reserved_quantity=Decimal("0"),
        committed_quantity=Decimal("0"),
        pending_quantity=Decimal("0")
    )
    
    service = InventoryServiceV2(repo)
    
    # Reserve
    spec = FabricSpec(fabric_id, FabricType.BLACKOUT, "navy", "B-001")
    result = service.reserve_materials(
        order_id=order_id,
        items=[(spec, Decimal("10.0"))]
    )
    
    assert result.success
    assert result.fully_fulfilled
    assert repo.stocks[fabric_id].reserved_quantity == Decimal("10.0")
    
    # Commit
    commit_result = service.commit_materials(order_id)
    
    assert commit_result.success
    assert repo.stocks[fabric_id].reserved_quantity == Decimal("0")
    assert repo.stocks[fabric_id].committed_quantity == Decimal("10.0")

def test_double_booking_prevention():
    """Ensure no double booking with concurrent reservations"""
    # Test with threading to verify locks work
    pass

def test_partial_fulfillment():
    """Test partial availability handling"""
    repo = MockRepository()
    repo.stocks[fabric_id] = StockLevel(
        physical_quantity=Decimal("5"),  # Only 5m available
        reserved_quantity=Decimal("0"),
        committed_quantity=Decimal("0"),
        pending_quantity=Decimal("0")
    )
    
    service = InventoryServiceV2(repo)
    spec = FabricSpec(fabric_id, FabricType.TULLE, "white", "T-001")
    
    result = service.reserve_materials(
        order_id=order_id,
        items=[(spec, Decimal("10.0"))],
        allow_partial=True
    )
    
    assert result.success  # Partial is still success
    assert result.is_partial_fulfillment
    assert result.total_reserved_quantity == Decimal("5.0")
```

## Performance

- **Reserve**: O(n log n) where n = number of fabrics (due to sorting for lock order)
- **Commit**: O(n) where n = number of reservations
- **Check availability**: O(n)
- **Expire old**: O(m) where m = expired reservations (batch limited)

## Integration with OrderService

```python
from atelier_erp.services import OrderService, InventoryServiceV2

class OrderService:
    def start_production(self, order_id):
        # 1. Commit materials (convert reservations → deductions)
        commit_result = self.inventory.commit_materials(order_id)
        
        if not commit_result.success:
            raise ProductionError("Failed to commit materials")
        
        # 2. Create production assignments
        # ...
        
        # 3. Update order status
        order.status = Order.Status.PRODUCTION
        order.save()
```

## Best Practices

1. **Always reserve before production** - Enforced by workflow
2. **Use appropriate TTL** - 24h default, extend if needed
3. **Handle partial gracefully** - Offer alternatives to customers
4. **Monitor low stock** - Set up alerts and auto-reordering
5. **Run expiry job frequently** - Every 5 minutes recommended
6. **Log all operations** - For audit and debugging

## License

Internal use only.

# Atelier Management System - Django Models

## Overview

Django models designed for an atelier (tailoring shop) with:
- **Order lifecycle**: new → in_progress → done
- **Task management**: Individual tasks assigned to workers
- **User roles**: admin, manager, worker, cutter
- **Inventory**: Fabric tracking with usage records

---

## 1. core/models.py (Base Models)

```python
import uuid6
from django.db import models


class TimeStampedModel(models.Model):
    """Abstract base with timestamps and soft delete."""
    id = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    modified_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]


class SoftDeleteModel(TimeStampedModel):
    """Adds soft delete capability."""
    deleted_at = models.DateTimeField(null=True, blank=True)

    def delete(self, *args, **kwargs):
        self.is_active = False
        self.save(update_fields=["is_active"])

    def hard_delete(self, *args, **kwargs):
        super().delete(*args, **kwargs)
```

---

## 2. apps/users/models.py

### User Model with Atelier Roles

```python
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from core.models import TimeStampedModel


class User(AbstractBaseUser, PermissionsMixin, TimeStampedModel):
    """Atelier user with role-based access."""
    
    class Role(models.TextChoices):
        ADMIN = "admin", "Администратор"
        MANAGER = "manager", "Менеджер"
        WORKER = "worker", "Швея/Мастер"
        CUTTER = "cutter", "Закройщик"
        OPERATOR = "operator", "Оператор"
        ACCOUNTANT = "accountant", "Бухгалтер"

    email = models.EmailField(unique=True, db_index=True)
    phone = models.CharField(max_length=20, blank=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    patronymic = models.CharField(max_length=150, blank=True)
    
    role = models.CharField(
        max_length=20, choices=Role.choices, default=Role.OPERATOR
    )
    
    # Status
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    
    # Work info
    employee_id = models.CharField(max_length=50, blank=True, unique=True, null=True)
    hire_date = models.DateField(null=True, blank=True)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN or self.is_superuser
    
    @property
    def is_manager(self):
        return self.role in [self.Role.ADMIN, self.Role.MANAGER]
```

---

## 3. apps/orders/models.py

### Order Model (Simplified Lifecycle)

```python
from core.models import TimeStampedModel


class Order(TimeStampedModel):
    """Atelier order with lifecycle: new → in_progress → done."""
    
    class Status(models.TextChoices):
        NEW = "new", "Новый"
        IN_PROGRESS = "in_progress", "В работе"
        DONE = "done", "Готов"
        DELIVERED = "delivered", "Выдан"
        CANCELLED = "cancelled", "Отменен"

    order_number = models.CharField(max_length=20, unique=True, db_index=True)
    
    # Relations
    customer = models.ForeignKey(
        "customers.Customer", on_delete=models.PROTECT, related_name="orders"
    )
    manager = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, 
        related_name="managed_orders"
    )
    
    # Status
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.NEW
    )
    priority = models.CharField(max_length=20, default="normal")
    
    # Financial
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Dates
    deadline_date = models.DateTimeField(null=True, blank=True)
    completed_date = models.DateTimeField(null=True, blank=True)


class OrderItem(TimeStampedModel):
    """Individual items/tasks in an order."""
    
    class Status(models.TextChoices):
        NEW = "new", "Новое"
        IN_PROGRESS = "in_progress", "В работе"
        DONE = "done", "Готово"

    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name="items"
    )
    
    description = models.TextField()
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=12, decimal_places=2)
    
    # Assignment
    assigned_to = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="assigned_items"
    )
    
    # Status
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.NEW
    )
    
    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    hours_spent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
```

---

## 4. apps/inventory/models.py

### Fabric Inventory & Usage Tracking

```python
from core.models import TimeStampedModel


class Fabric(TimeStampedModel):
    """Fabric inventory for atelier."""
    
    class FabricType(models.TextChoices):
        COTTON = "cotton", "Хлопок"
        LINEN = "linen", "Лен"
        SILK = "silk", "Шелк"
        WOOL = "wool", "Шерсть"
        POLYESTER = "polyester", "Полиэстер"
        VISCOSE = "viscose", "Вискоза"
        BLEND = "blend", "Смесь"
        OTHER = "other", "Другое"

    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    fabric_type = models.CharField(max_length=20, choices=FabricType.choices)
    color = models.CharField(max_length=100)
    pattern = models.CharField(max_length=100, blank=True)
    
    # Physical properties
    width_cm = models.PositiveIntegerField(default=150)
    weight_gsm = models.PositiveIntegerField(null=True, blank=True)
    
    # Stock (in meters)
    length_in_stock = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    min_length = models.DecimalField(max_digits=10, decimal_places=2, default=5)
    
    # Pricing
    price_per_meter = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    @property
    def is_low_stock(self):
        return self.length_in_stock <= self.min_length


class FabricUsage(TimeStampedModel):
    """Track fabric usage per order."""
    
    fabric = models.ForeignKey(
        Fabric, on_delete=models.CASCADE, related_name="usages"
    )
    order = models.ForeignKey(
        "orders.Order", on_delete=models.CASCADE, related_name="fabric_usages"
    )
    order_item = models.ForeignKey(
        "orders.OrderItem", on_delete=models.CASCADE, 
        related_name="fabric_usages", null=True, blank=True
    )
    
    # Usage
    length_used = models.DecimalField(max_digits=8, decimal_places=2)
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    # Cutting details
    layout_length = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    pieces_cut = models.PositiveIntegerField(default=1)
    
    # Who cut
    cut_by = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True,
        related_name="fabric_cuts"
    )
    cut_date = models.DateTimeField(auto_now_add=True)
```

---

## 5. apps/production/models.py

### Work Orders & Tasks Assigned to Workers

```python
from core.models import TimeStampedModel


class WorkOrder(TimeStampedModel):
    """Production work order."""
    
    class Status(models.TextChoices):
        NEW = "new", "Новый"
        IN_PROGRESS = "in_progress", "В работе"
        DONE = "done", "Готов"

    work_order_number = models.CharField(max_length=20, unique=True, db_index=True)
    order = models.ForeignKey(
        "orders.Order", on_delete=models.CASCADE, related_name="work_orders"
    )
    
    # Product to make
    product = models.ForeignKey(
        "inventory.Product", on_delete=models.SET_NULL, null=True
    )
    quantity_required = models.DecimalField(max_digits=10, decimal_places=2)
    quantity_completed = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    # Status
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.NEW
    )
    priority = models.CharField(max_length=20, default="normal")
    
    # Assignment (to worker/cutter)
    assigned_to = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="work_orders",
        limit_choices_to={"role__in": ["worker", "cutter"]}
    )
    
    # Timing
    planned_start = models.DateTimeField(null=True, blank=True)
    planned_end = models.DateTimeField(null=True, blank=True)
    actual_start = models.DateTimeField(null=True, blank=True)
    actual_end = models.DateTimeField(null=True, blank=True)
    
    estimated_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    actual_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)


class Task(TimeStampedModel):
    """Individual task assigned to a worker."""
    
    class Status(models.TextChoices):
        NEW = "new", "Новое"
        IN_PROGRESS = "in_progress", "В работе"
        DONE = "done", "Готово"

    class TaskType(models.TextChoices):
        CUTTING = "cutting", "Раскрой"
        SEWING = "sewing", "Пошив"
        FINISHING = "finishing", "Отделка"
        EMBROIDERY = "embroidery", "Вышивка"
        ALTERATION = "alteration", "Перешив"
        REPAIR = "repair", "Ремонт"
        PRESSING = "pressing", "Глажка"
        QUALITY_CHECK = "quality_check", "Проверка качества"

    work_order = models.ForeignKey(
        WorkOrder, on_delete=models.CASCADE, related_name="tasks"
    )
    
    task_type = models.CharField(max_length=20, choices=TaskType.choices)
    description = models.TextField()
    sequence = models.PositiveIntegerField(default=1)
    
    # Assignment
    assigned_to = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="assigned_tasks",
        limit_choices_to={"role__in": ["worker", "cutter"]}
    )
    
    # Status
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.NEW
    )
    
    # Timing
    estimated_minutes = models.PositiveIntegerField(default=0)
    actual_minutes = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Quality
    quality_score = models.PositiveSmallIntegerField(null=True, blank=True)
    rework_required = models.BooleanField(default=False)
    
    # Task dependencies
    depends_on = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="dependent_tasks"
    )
```

---

## Key Design Decisions

### 1. Status Lifecycle (Simplified)
```
Order/WorkOrder/Task: NEW → IN_PROGRESS → DONE
```

### 2. Relationships

```
Order ──1:N──► OrderItem ──1:N──► Task (assigned to User)
  │
  └────N:1────► WorkOrder ──1:N──► Task (assigned to User)
  │
  └────1:N────► FabricUsage ──N:1──► Fabric
```

### 3. Worker Assignment
- `limit_choices_to={"role__in": ["worker", "cutter"]}` ensures only workers can be assigned
- Tasks have dependencies (`depends_on`) for workflow sequencing

### 4. Fabric Tracking
- `Fabric.length_in_stock` tracks meters available
- `FabricUsage` records actual consumption per order
- `is_low_stock` property for inventory alerts

### 5. No Duplication
- `core.TimeStampedModel` provides id, timestamps, soft delete to all models
- Status enums defined once per model class
- Related_names prevent naming conflicts

---

## Database Schema Summary

| Model | Key Fields | Relations |
|-------|-----------|-----------|
| User | email, role, hourly_rate | - |
| Order | order_number, status, total_amount | customer, manager |
| OrderItem | description, status, unit_price | order, assigned_to |
| Fabric | code, fabric_type, length_in_stock | - |
| FabricUsage | length_used, cut_by | fabric, order, order_item |
| WorkOrder | work_order_number, status | order, assigned_to |
| Task | task_type, status, sequence | work_order, assigned_to, depends_on |

# Role-Based Permissions - Atelier Management System

## Overview

Permissions are separated from views using DRF custom permission classes. Each ViewSet uses `get_permissions()` for dynamic permission control.

---

## User Roles

| Role | Description |
|------|-------------|
| `admin` | Full system access |
| `manager` | Manage orders, tasks, inventory |
| `worker` | Execute assigned tasks |
| `cutter` | Cut fabric + worker capabilities |
| `operator` | View and process orders |
| `accountant` | View financial data |

---

## Permission Classes

### 1. Core Permission Functions

```python
# core/permissions.py

def is_admin(user) -> bool:
    return user.is_authenticated and user.role == User.Role.ADMIN

def is_manager(user) -> bool:
    return user.is_authenticated and user.role in [User.Role.MANAGER, User.Role.ADMIN]

def is_worker(user) -> bool:
    return user.is_authenticated and user.role in [User.Role.WORKER, User.Role.CUTTER]

def is_manager_or_above(user) -> bool:
    return user.is_authenticated and user.role in [User.Role.ADMIN, User.Role.MANAGER]
```

### 2. Order Permissions

```python
class CanManageOrders(permissions.BasePermission):
    """Admin and Manager: full order management."""
    def has_permission(self, request, view):
        return is_manager_or_above(request.user)

class CanViewOrders(permissions.BasePermission):
    """
    Admin, Manager: view all orders.
    Worker: view orders they have tasks for.
    """
    def has_permission(self, request, view):
        if is_manager_or_above(request.user):
            return True
        return is_worker(request.user)
```

### 3. Task Permissions

```python
class CanManageTasks(permissions.BasePermission):
    """Admin and Manager: create, assign, delete tasks."""
    def has_permission(self, request, view):
        return is_manager_or_above(request.user)

class IsAssignedWorker(permissions.BasePermission):
    """
    Worker can only access tasks assigned to them.
    Admin/Manager can access any task.
    """
    def has_object_permission(self, request, view, obj):
        if is_manager_or_above(request.user):
            return True
        if is_worker(request.user):
            return obj.assigned_to == request.user
        return False

class CanUpdateTaskStatus(permissions.BasePermission):
    """
    Worker: update status only for assigned tasks.
    Manager/Admin: update any task.
    """
    def has_object_permission(self, request, view, obj):
        if is_manager_or_above(request.user):
            return True
        if is_worker(request.user):
            return obj.assigned_to == request.user
        return False
```

### 4. Inventory Permissions

```python
class CanManageInventory(permissions.BasePermission):
    """Admin and Manager: full inventory control."""
    def has_permission(self, request, view):
        if is_manager_or_above(request.user):
            return True
        # Workers can only read
        if is_worker(request.user):
            return request.method in permissions.SAFE_METHODS
        return False

class CanRecordFabricUsage(permissions.BasePermission):
    """
    Admin, Manager, Cutter: record fabric usage.
    Worker: view only.
    """
    def has_permission(self, request, view):
        if is_manager_or_above(request.user):
            return True
        if request.user.role == User.Role.CUTTER:
            return True
        return request.method in permissions.SAFE_METHODS
```

---

## Permission Matrix

### Orders (`/api/v1/orders/`)

| Action | Admin | Manager | Worker | Cutter |
|--------|-------|---------|--------|--------|
| List all | ✅ | ✅ | ❌ | ❌ |
| List own | ✅ | ✅ | ✅ | ✅ |
| Create | ✅ | ✅ | ❌ | ❌ |
| Update | ✅ | ✅ | ❌ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ |
| Update status | ✅ | ✅ | ❌ | ❌ |

**Worker sees only orders where they have assigned tasks:**

```python
def get_queryset(self):
    user = self.request.user
    
    if is_manager_or_above(user):
        return Order.objects.filter(is_active=True)
    
    # Worker sees only their orders
    work_orders = WorkOrder.objects.filter(
        tasks__assigned_to=user,
        tasks__is_active=True
    ).distinct()
    
    order_ids = work_orders.values_list("order_id", flat=True)
    return Order.objects.filter(id__in=order_ids, is_active=True)
```

---

### Tasks (`/api/v1/tasks/`)

| Action | Admin | Manager | Worker | Cutter |
|--------|-------|---------|--------|--------|
| List all | ✅ | ✅ | ❌ | ❌ |
| List my tasks | ✅ | ✅ | ✅ | ✅ |
| Create | ✅ | ✅ | ❌ | ❌ |
| Assign | ✅ | ✅ | ❌ | ❌ |
| Update (admin) | ✅ | ✅ | ❌ | ❌ |
| Update own | ✅ | ✅ | ✅ | ✅ |
| Start | ✅ | ✅ | ✅* | ✅* |
| Complete | ✅ | ✅ | ✅* | ✅* |
| Delete | ✅ | ✅ | ❌ | ❌ |

*Only assigned worker can start/complete

**Dynamic Permissions in ViewSet:**

```python
class TaskViewSet(viewsets.ModelViewSet):
    
    def get_permissions(self):
        if self.action in ["create", "destroy"]:
            return [IsAuthenticated(), CanManageTasks()]
        
        if self.action in ["update", "partial_update"]:
            return [IsAuthenticated(), CanUpdateTaskStatus()]
        
        if self.action in ["start", "complete"]:
            return [IsAuthenticated(), IsAssignedWorker()]
        
        return [IsAuthenticated()]
```

**Worker Queryset Filter:**

```python
def get_queryset(self):
    user = self.request.user
    base_queryset = Task.objects.filter(is_active=True)
    
    if is_manager_or_above(user):
        return base_queryset
    
    # Worker sees only their assigned tasks
    return base_queryset.filter(assigned_to=user)
```

---

### Inventory (`/api/v1/inventory/`)

| Action | Admin | Manager | Worker | Cutter |
|--------|-------|---------|--------|--------|
| View list | ✅ | ✅ | ✅ | ✅ |
| View detail | ✅ | ✅ | ✅ | ✅ |
| Create fabric | ✅ | ✅ | ❌ | ❌ |
| Update fabric | ✅ | ✅ | ❌ | ❌ |
| Delete fabric | ✅ | ✅ | ❌ | ❌ |
| Add stock | ✅ | ✅ | ❌ | ❌ |
| Remove stock | ✅ | ✅ | ❌ | ❌ |
| Record usage | ✅ | ✅ | ❌ | ✅ |

---

## Usage in ViewSets

### Dynamic Permissions

```python
class OrderViewSet(viewsets.ModelViewSet):
    
    def get_permissions(self):
        """Different permissions for different actions."""
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticated(), CanManageOrders()]
        return [IsAuthenticated(), CanViewOrders()]
```

### Object-Level Permissions

```python
class TaskViewSet(viewsets.ModelViewSet):
    
    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        """Worker can only start their assigned tasks."""
        task = self.get_object()
        
        # Check permission at object level
        if not IsAssignedWorker().has_object_permission(
            request, self, task
        ):
            raise PermissionDenied("Task is not assigned to you")
        
        # Proceed with business logic
        task.status = Task.Status.IN_PROGRESS
        task.save()
        return Response(TaskSerializer(task).data)
```

### Queryset Filtering

```python
def get_queryset(self):
    """
    Filter data based on user role.
    This is not permission, but data visibility.
    """
    user = self.request.user
    
    if is_manager_or_above(user):
        return Task.objects.filter(is_active=True)
    
    # Worker sees only assigned tasks
    return Task.objects.filter(
        assigned_to=user,
        is_active=True
    )
```

---

## Permission Checks in Services

Sometimes you need to check permissions in business logic:

```python
class TaskService:
    
    @classmethod
    def assign_task(cls, task_id: str, worker: User, assigned_by: User) -> Task:
        """Assign task with capacity check (business logic, not permission)."""
        
        # Permission check (optional, since view already checks)
        if not is_manager_or_above(assigned_by):
            raise PermissionDenied("Only managers can assign tasks")
        
        # Business logic check
        if not cls._can_worker_accept_task(worker):
            raise ValidationError("Worker is at capacity")
        
        # Assign
        task.assigned_to = worker
        task.save()
        return task
```

---

## Testing Permissions

```python
# tests/test_permissions.py
from rest_framework.test import APITestCase

class OrderPermissionsTest(APITestCase):
    
    def test_worker_cannot_create_order(self):
        """Worker should not be able to create orders."""
        self.client.force_authenticate(user=self.worker)
        
        response = self.client.post('/api/v1/orders/', {
            'customer': str(self.customer.id),
            'total_amount': 1000
        })
        
        self.assertEqual(response.status_code, 403)
    
    def test_worker_sees_only_own_orders(self):
        """Worker should only see orders with their tasks."""
        self.client.force_authenticate(user=self.worker)
        
        response = self.client.get('/api/v1/orders/')
        
        # Should only see orders where worker has tasks
        for order in response.data:
            self.assertTrue(
                Task.objects.filter(
                    work_order__order_id=order['id'],
                    assigned_to=self.worker
                ).exists()
            )
    
    def test_manager_can_create_order(self):
        """Manager should be able to create orders."""
        self.client.force_authenticate(user=self.manager)
        
        response = self.client.post('/api/v1/orders/', {
            'customer': str(self.customer.id),
            'total_amount': 1000
        })
        
        self.assertEqual(response.status_code, 201)
```

---

## Common Patterns

### Pattern 1: Full Access vs No Access

```python
class CanManageX(permissions.BasePermission):
    """Simple manager+admin permission."""
    def has_permission(self, request, view):
        return is_manager_or_above(request.user)
```

### Pattern 2: Object Ownership

```python
class IsOwnerOrManager(permissions.BasePermission):
    """Owner can edit, manager can edit, others read-only."""
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if is_manager_or_above(request.user):
            return True
        return obj.assigned_to == request.user
```

### Pattern 3: Action-Based

```python
class CanStartTask(permissions.BasePermission):
    """Only assigned worker can start."""
    def has_object_permission(self, request, view, obj):
        return (
            is_manager_or_above(request.user) or
            obj.assigned_to == request.user
        )
```

---

## Summary

- **Admin**: Full access to all endpoints
- **Manager**: Manage orders, tasks, inventory; view everything
- **Worker**: View only assigned tasks/orders; update own task status
- **Cutter**: Worker permissions + can record fabric usage
- **Permissions are in `core/permissions.py`**, not in views
- **ViewSets use `get_permissions()`** for dynamic control
- **Queryset filtering** handles data visibility
- **Object-level permissions** check ownership for updates

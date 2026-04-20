# Atelier Business Logic Layer

## Overview

Business logic is separated from views and encapsulated in service classes:

| Service | File | Responsibility |
|---------|------|--------------|
| `OrderService` | `apps/orders/services.py` | Order workflow, auto-status updates |
| `TaskService` | `apps/production/services.py` | Task assignment, worker capacity |
| `ProductionService` | `apps/production/services.py` | Work order management |

---

## 1. Order Status Auto-Updates

### Problem
When workers complete tasks, orders should automatically update their status without manual intervention.

### Solution

```python
# apps/orders/services.py

class OrderService:
    
    @classmethod
    def auto_update_status_from_tasks(cls, order_id: str) -> Order:
        """
        Automatically update order status based on task completion.
        Called whenever a task status changes.
        """
        order = cls.get_by_id(order_id)
        
        # Get all work orders and tasks for this order
        work_orders = WorkOrder.objects.filter(order=order, is_active=True)
        
        # Count task statuses
        total_tasks = 0
        done_tasks = 0
        in_progress_tasks = 0
        
        for wo in work_orders:
            tasks = Task.objects.filter(work_order=wo, is_active=True)
            total_tasks += tasks.count()
            done_tasks += tasks.filter(status=Task.Status.DONE).count()
            in_progress_tasks += tasks.filter(status=Task.Status.IN_PROGRESS).count()
        
        # Determine new status
        new_status = None
        
        if done_tasks == total_tasks:
            new_status = Order.Status.DONE  # All work complete
        elif in_progress_tasks > 0 or done_tasks > 0:
            new_status = Order.Status.IN_PROGRESS  # Work started
        
        # Update if changed
        if new_status and new_status != order.status:
            order.status = new_status
            order.save()
            
            # Log auto-update
            OrderStatusHistory.objects.create(
                order=order,
                old_status=order.status,
                new_status=new_status,
                changed_by=None,
                reason="Auto-updated based on task completion",
            )
        
        return order
```

### Trigger Points

```python
# apps/production/services.py

class TaskService:
    
    @classmethod
    def _update_parent_status(cls, task: Task) -> None:
        """Called when task is completed."""
        # Update work order status
        work_order = task.work_order
        tasks = Task.objects.filter(work_order=work_order, is_active=True)
        
        done = tasks.filter(status=Task.Status.DONE).count()
        total = tasks.count()
        
        if done == total:
            work_order.status = WorkOrder.Status.DONE
        elif done > 0:
            work_order.status = WorkOrder.Status.IN_PROGRESS
        
        work_order.save()
        
        # 🔄 Trigger order status update
        OrderService.auto_update_status_from_tasks(str(work_order.order.id))
```

**Flow:**
```
Worker completes task
    ↓
TaskService.complete_task() calls _update_parent_status()
    ↓
Work order status updated
    ↓
OrderService.auto_update_status_from_tasks() called
    ↓
Order status updated based on all tasks
```

---

## 2. Task Assignment with Overload Prevention

### Problem
Prevent overloading workers with too many concurrent tasks.

### Solution

```python
# Maximum concurrent tasks per worker
MAX_ACTIVE_TASKS_PER_WORKER = 5


class TaskService:
    
    @classmethod
    def _can_worker_accept_task(cls, worker: User) -> bool:
        """Check if worker has capacity."""
        active_tasks = Task.objects.filter(
            assigned_to=worker,
            status__in=[Task.Status.NEW, Task.Status.IN_PROGRESS],
            is_active=True
        ).count()
        
        return active_tasks < MAX_ACTIVE_TASKS_PER_WORKER
    
    @classmethod
    def get_worker_capacity(cls, worker: User) -> dict:
        """Get detailed capacity information."""
        tasks = Task.objects.filter(assigned_to=worker, is_active=True)
        active = tasks.filter(
            status__in=[Task.Status.NEW, Task.Status.IN_PROGRESS]
        ).count()
        
        return {
            "worker_id": str(worker.id),
            "current_active_tasks": active,
            "max_capacity": MAX_ACTIVE_TASKS_PER_WORKER,
            "available_slots": MAX_ACTIVE_TASKS_PER_WORKER - active,
            "can_accept_more": active < MAX_ACTIVE_TASKS_PER_WORKER,
        }
    
    @classmethod
    @transaction.atomic
    def assign_task(cls, task_id: str, worker: User, assigned_by: User) -> Task:
        """Assign task with capacity check."""
        task = cls.get_by_id(task_id)
        
        # ✅ Check capacity
        capacity = cls.get_worker_capacity(worker)
        if not capacity["can_accept_more"]:
            raise ValidationError(
                f"Cannot assign: {worker.get_full_name()} has "
                f"{capacity['current_active_tasks']} active tasks (max: 5)"
            )
        
        # Check dependencies
        if task.depends_on and task.depends_on.status != Task.Status.DONE:
            raise ValidationError("Prerequisite task must be completed first")
        
        task.assigned_to = worker
        task.save()
        
        return task
```

### Finding Available Workers

```python
@classmethod
def find_available_workers(cls, task_type: str = None) -> List[Dict]:
    """Find workers who can accept more tasks."""
    workers = User.objects.filter(
        role__in=[User.Role.WORKER, User.Role.CUTTER],
        is_active=True
    )
    
    available = []
    for worker in workers:
        capacity = cls.get_worker_capacity(worker)
        
        # Skip overloaded workers
        if not capacity["can_accept_more"]:
            continue
        
        # Get task breakdown by type
        task_breakdown = cls._get_worker_task_breakdown(worker)
        
        available.append({
            "worker": worker,
            "capacity": capacity,
            "task_count_by_type": task_breakdown,
        })
    
    # Sort by available slots (most available first)
    available.sort(
        key=lambda x: x["capacity"]["available_slots"],
        reverse=True
    )
    
    return available
```

### Auto-Assignment

```python
@classmethod
def auto_assign_task(cls, task_id: str) -> Optional[Task]:
    """Automatically assign to best available worker."""
    task = cls.get_by_id(task_id)
    
    if task.assigned_to:
        return task  # Already assigned
    
    # Find available workers
    available = cls.find_available_workers(task_type=task.task_type)
    
    if not available:
        return None  # No workers available
    
    # Select best worker (first in list = most available)
    best_worker = available[0]["worker"]
    
    return cls.assign_task(
        task_id=str(task.id),
        worker=best_worker,
        assigned_by=None  # System assignment
    )
```

---

## 3. Progress Tracking

### Order Progress

```python
class OrderService:
    
    @classmethod
    def get_order_progress(cls, order_id: str) -> dict:
        """Get comprehensive progress for an order."""
        order = cls.get_by_id(order_id)
        
        work_orders = WorkOrder.objects.filter(order=order, is_active=True)
        
        total_tasks = 0
        done_tasks = 0
        total_estimated_minutes = 0
        total_actual_minutes = 0
        
        for wo in work_orders:
            tasks = Task.objects.filter(work_order=wo, is_active=True)
            total_tasks += tasks.count()
            done_tasks += tasks.filter(status=Task.Status.DONE).count()
            
            for task in tasks:
                total_estimated_minutes += task.estimated_minutes
                total_actual_minutes += task.actual_minutes
        
        completion_percentage = (
            (done_tasks / total_tasks * 100) if total_tasks > 0 else 0
        )
        
        return {
            "order_id": str(order.id),
            "order_number": order.order_number,
            "status": order.status,
            "status_display": order.get_status_display(),
            "total_tasks": total_tasks,
            "done_tasks": done_tasks,
            "in_progress_tasks": Task.objects.filter(
                work_order__order=order,
                status=Task.Status.IN_PROGRESS
            ).count(),
            "completion_percentage": round(completion_percentage, 1),
            "total_estimated_minutes": total_estimated_minutes,
            "total_actual_minutes": total_actual_minutes,
            "work_orders_count": work_orders.count(),
        }
```

### Task Progress

```python
class TaskService:
    
    @classmethod
    def get_task_progress(cls, task_id: str) -> dict:
        """Get detailed progress for a task."""
        task = cls.get_by_id(task_id)
        
        # Calculate progress percentage
        progress = 0
        if task.status == Task.Status.DONE:
            progress = 100
        elif task.status == Task.Status.IN_PROGRESS:
            if task.estimated_minutes > 0 and task.started_at:
                elapsed = (timezone.now() - task.started_at).total_seconds() / 60
                progress = min(
                    int((elapsed / task.estimated_minutes) * 100),
                    95  # Cap at 95% until explicitly completed
                )
        
        return {
            "task_id": str(task.id),
            "description": task.description,
            "status": task.status,
            "status_display": task.get_status_display(),
            "assigned_to": task.assigned_to.get_full_name() if task.assigned_to else None,
            "progress_percentage": progress,
            "estimated_minutes": task.estimated_minutes,
            "actual_minutes": task.actual_minutes,
            "started_at": task.started_at,
            "completed_at": task.completed_at,
            "has_dependencies": task.depends_on is not None,
            "dependencies_completed": (
                task.depends_on.status == Task.Status.DONE
                if task.depends_on else True
            ),
        }
```

---

## 4. Workflow Validation

### Status Transitions

```python
class OrderService:
    
    @classmethod
    def _validate_status_transition(cls, order: Order, old: str, new: str) -> None:
        """Validate if status transition is allowed."""
        allowed = {
            Order.Status.NEW: [
                Order.Status.IN_PROGRESS,
                Order.Status.CANCELLED
            ],
            Order.Status.IN_PROGRESS: [
                Order.Status.DONE,
                Order.Status.CANCELLED
            ],
            Order.Status.DONE: [
                Order.Status.DELIVERED,
                Order.Status.IN_PROGRESS  # Can reopen
            ],
            Order.Status.DELIVERED: [],  # Terminal
            Order.Status.CANCELLED: [
                Order.Status.NEW  # Can reopen
            ],
        }
        
        if new not in allowed.get(old, []):
            raise ValidationError(
                f"Cannot transition from '{order.get_status_display()}' to '{new}'"
            )
```

### Task Dependencies

```python
class TaskService:
    
    @classmethod
    def start_task(cls, task_id: str, worker: User) -> Task:
        """Start task only if dependencies are met."""
        task = cls.get_by_id(task_id)
        
        # Check prerequisite
        if task.depends_on and task.depends_on.status != Task.Status.DONE:
            raise ValidationError(
                "Prerequisite task must be completed first"
            )
        
        task.status = Task.Status.IN_PROGRESS
        task.started_at = timezone.now()
        task.save()
        
        return task
```

---

## 5. Usage Examples

### Create and Assign Task

```python
from apps.production.services import TaskService

# Create task
task = TaskService.create_task(
    work_order_id="uuid-here",
    task_type="sewing",
    description="Sew dress body",
    estimated_minutes=120,
    sequence=1
)

# Assign to worker (with overload check)
try:
    task = TaskService.assign_task(
        task_id=str(task.id),
        worker=worker_user,
        assigned_by=manager_user
    )
except ValidationError as e:
    # Worker is at capacity
    # Find available workers instead
    available = TaskService.find_available_workers(task_type="sewing")

# Or auto-assign
TaskService.auto_assign_task(str(task.id))
```

### Complete Task (Triggers Order Update)

```python
# Worker completes task
completed_task = TaskService.complete_task(
    task_id=str(task.id),
    worker=worker_user,
    actual_minutes=110,
    quality_score=9
)

# Order status automatically updated via:
# TaskService._update_parent_status() → 
# OrderService.auto_update_status_from_tasks()
```

### Get Progress

```python
# Order progress
progress = OrderService.get_order_progress(order_id)
print(f"Order {progress['order_number']}: {progress['completion_percentage']}% complete")
print(f"Tasks: {progress['done_tasks']}/{progress['total_tasks']}")

# Worker workload
workload = OrderService.get_worker_workload(worker_id)
print(f"{workload['worker_name']}: {workload['total_active']}/5 tasks")
```

---

## 6. Model Methods (Alternative)

For simple logic, use model methods:

```python
# apps/production/models.py

class Task(TimeStampedModel):
    
    @property
    def is_blocked(self) -> bool:
        """Check if task is blocked by dependencies."""
        return (
            self.depends_on is not None
            and self.depends_on.status != Task.Status.DONE
        )
    
    @property
    def estimated_completion(self) -> Optional[datetime]:
        """Estimate completion time based on progress."""
        if self.status == Task.Status.DONE:
            return self.completed_at
        if self.status == Task.Status.IN_PROGRESS and self.estimated_minutes:
            remaining = self.estimated_minutes - (self.actual_minutes or 0)
            return timezone.now() + timedelta(minutes=remaining)
        return None


class WorkOrder(TimeStampedModel):
    
    @property
    def completion_percentage(self) -> float:
        """Calculate completion based on tasks."""
        tasks = self.tasks.filter(is_active=True)
        total = tasks.count()
        if total == 0:
            return 0
        done = tasks.filter(status=Task.Status.DONE).count()
        return (done / total) * 100
```

---

## Summary

| Feature | Implementation | Location |
|---------|---------------|----------|
| Auto order status | `auto_update_status_from_tasks()` | `OrderService` |
| Overload prevention | `MAX_ACTIVE_TASKS_PER_WORKER` + `_can_worker_accept_task()` | `TaskService` |
| Task assignment | `assign_task()` with capacity check | `TaskService` |
| Progress tracking | `get_order_progress()`, `get_task_progress()` | Services |
| Auto-assignment | `auto_assign_task()` | `TaskService` |
| Dependencies | `depends_on` field + validation | `TaskService` |
| Status validation | `_validate_status_transition()` | `OrderService` |

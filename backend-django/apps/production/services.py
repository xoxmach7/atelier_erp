from decimal import Decimal
from typing import List, Optional, Dict

from django.db import transaction
from django.utils import timezone

from apps.production.models import WorkOrder, Task
from apps.users.models import User
from core.exceptions import NotFoundError, ValidationError


# Maximum concurrent tasks per worker (overload prevention)
MAX_ACTIVE_TASKS_PER_WORKER = 5


class TaskService:
    """Service layer for task assignment and workflow management."""

    @classmethod
    def get_by_id(cls, task_id: str) -> Task:
        """Get task by ID."""
        try:
            return Task.objects.get(id=task_id, is_active=True)
        except Task.DoesNotExist:
            raise NotFoundError(f"Task with id {task_id} not found")

    @classmethod
    def _can_worker_accept_task(cls, worker: User) -> bool:
        """Check if worker has capacity for new task (overload prevention)."""
        active_tasks = Task.objects.filter(
            assigned_to=worker,
            status__in=[Task.Status.NEW, Task.Status.IN_PROGRESS],
            is_active=True
        ).count()
        return active_tasks < MAX_ACTIVE_TASKS_PER_WORKER

    @classmethod
    def get_worker_capacity(cls, worker: User) -> dict:
        """Get detailed capacity info for a worker."""
        tasks = Task.objects.filter(
            assigned_to=worker,
            is_active=True
        )
        
        active = tasks.filter(status__in=[Task.Status.NEW, Task.Status.IN_PROGRESS]).count()
        
        return {
            "worker_id": str(worker.id),
            "worker_name": worker.get_full_name(),
            "current_active_tasks": active,
            "max_capacity": MAX_ACTIVE_TASKS_PER_WORKER,
            "available_slots": MAX_ACTIVE_TASKS_PER_WORKER - active,
            "can_accept_more": active < MAX_ACTIVE_TASKS_PER_WORKER
        }

    @classmethod
    @transaction.atomic
    def create_task(
        cls,
        work_order_id: str,
        task_type: str,
        description: str,
        estimated_minutes: int = 0,
        sequence: int = 1,
        assigned_to: Optional[User] = None,
        depends_on: Optional[Task] = None,
    ) -> Task:
        """Create a new task with optional assignment."""
        # Get work order
        try:
            work_order = WorkOrder.objects.get(id=work_order_id, is_active=True)
        except WorkOrder.DoesNotExist:
            raise NotFoundError(f"Work order with id {work_order_id} not found")
        
        # If assigning to worker, check capacity
        if assigned_to and not cls._can_worker_accept_task(assigned_to):
            raise ValidationError(
                f"Worker {assigned_to.get_full_name()} is at maximum capacity "
                f"({MAX_ACTIVE_TASKS_PER_WORKER} active tasks)"
            )
        
        # Check if dependencies are completed
        if depends_on and depends_on.status != Task.Status.DONE:
            raise ValidationError(
                f"Cannot create task: prerequisite task '{depends_on.description[:30]}' is not completed"
            )
        
        task = Task.objects.create(
            work_order=work_order,
            task_type=task_type,
            description=description,
            estimated_minutes=estimated_minutes,
            sequence=sequence,
            assigned_to=assigned_to,
            depends_on=depends_on,
            status=Task.Status.NEW,
        )
        
        # Update work order status if needed
        if work_order.status == WorkOrder.Status.NEW and assigned_to:
            work_order.status = WorkOrder.Status.IN_PROGRESS
            work_order.save()
        
        return task

    @classmethod
    @transaction.atomic
    def assign_task(cls, task_id: str, worker: User, assigned_by: User) -> Task:
        """Assign task to worker with capacity check."""
        task = cls.get_by_id(task_id)
        
        # Check if already assigned to same worker
        if task.assigned_to == worker:
            return task
        
        # Check worker capacity
        capacity = cls.get_worker_capacity(worker)
        if not capacity["can_accept_more"]:
            raise ValidationError(
                f"Cannot assign: {worker.get_full_name()} has "
                f"{capacity['current_active_tasks']} active tasks (max: {MAX_ACTIVE_TASKS_PER_WORKER})"
            )
        
        # Check if task can be assigned (dependencies)
        if task.depends_on and task.depends_on.status != Task.Status.DONE:
            raise ValidationError(
                f"Cannot assign: prerequisite task must be completed first"
            )
        
        task.assigned_to = worker
        task.save(update_fields=["assigned_to"])
        
        # Update work order status
        if task.work_order.status == WorkOrder.Status.NEW:
            task.work_order.status = WorkOrder.Status.IN_PROGRESS
            task.work_order.save()
        
        return task

    @classmethod
    @transaction.atomic
    def start_task(cls, task_id: str, worker: User) -> Task:
        """Worker starts working on task."""
        task = cls.get_by_id(task_id)
        
        # Verify assignment
        if task.assigned_to != worker:
            raise ValidationError("Task is not assigned to you")
        
        # Check dependencies
        if task.depends_on and task.depends_on.status != Task.Status.DONE:
            raise ValidationError("Prerequisite task must be completed first")
        
        # Update status
        task.status = Task.Status.IN_PROGRESS
        task.started_at = timezone.now()
        task.save()
        
        return task

    @classmethod
    @transaction.atomic
    def complete_task(
        cls,
        task_id: str,
        worker: User,
        actual_minutes: Optional[int] = None,
        quality_score: Optional[int] = None,
    ) -> Task:
        """Complete a task."""
        task = cls.get_by_id(task_id)
        
        # Verify assignment
        if task.assigned_to != worker:
            raise ValidationError("Task is not assigned to you")
        
        # Update task
        task.status = Task.Status.DONE
        task.completed_at = timezone.now()
        
        if actual_minutes is not None:
            task.actual_minutes = actual_minutes
        
        if quality_score is not None:
            task.quality_score = quality_score
        
        task.save()
        
        # Update work order and order status
        cls._update_parent_status(task)
        
        return task

    @classmethod
    def _update_parent_status(cls, task: Task) -> None:
        """Update parent work order and order status based on task completion."""
        from apps.orders.services import OrderService
        
        work_order = task.work_order
        
        # Check all tasks in work order
        tasks = Task.objects.filter(work_order=work_order, is_active=True)
        total = tasks.count()
        done = tasks.filter(status=Task.Status.DONE).count()
        
        # Update work order status
        if done == total:
            work_order.status = WorkOrder.Status.DONE
            work_order.actual_end = timezone.now()
        elif done > 0:
            work_order.status = WorkOrder.Status.IN_PROGRESS
        
        work_order.save()
        
        # Update order status
        OrderService.auto_update_status_from_tasks(str(work_order.order.id))

    @classmethod
    def reassign_task(
        cls,
        task_id: str,
        new_worker: User,
        reassigned_by: User,
        reason: str = ""
    ) -> Task:
        """Reassign task to different worker."""
        task = cls.get_by_id(task_id)
        
        old_worker = task.assigned_to
        
        # Check new worker capacity
        if not cls._can_worker_accept_task(new_worker):
            raise ValidationError(
                f"{new_worker.get_full_name()} is at maximum capacity"
            )
        
        task.assigned_to = new_worker
        task.save(update_fields=["assigned_to"])
        
        # Log reassignment (could add TaskHistory model)
        return task

    @classmethod
    def find_available_workers(
        cls,
        task_type: Optional[str] = None,
        exclude_overloaded: bool = True
    ) -> List[Dict]:
        """Find workers available for task assignment."""
        workers = User.objects.filter(
            role__in=[User.Role.WORKER, User.Role.CUTTER],
            is_active=True
        )
        
        results = []
        for worker in workers:
            capacity = cls.get_worker_capacity(worker)
            
            if exclude_overloaded and not capacity["can_accept_more"]:
                continue
            
            # Get current tasks summary
            tasks = Task.objects.filter(
                assigned_to=worker,
                status__in=[Task.Status.NEW, Task.Status.IN_PROGRESS],
                is_active=True
            )
            
            results.append({
                "worker": worker,
                "capacity": capacity,
                "task_count_by_type": cls._get_worker_task_breakdown(worker),
                "estimated_workload_hours": sum(
                    t.estimated_minutes for t in tasks
                ) / 60
            })
        
        # Sort by available slots (most available first)
        results.sort(
            key=lambda x: x["capacity"]["available_slots"],
            reverse=True
        )
        
        return results

    @classmethod
    def _get_worker_task_breakdown(cls, worker: User) -> Dict[str, int]:
        """Get count of tasks by type for a worker."""
        tasks = Task.objects.filter(
            assigned_to=worker,
            status__in=[Task.Status.NEW, Task.Status.IN_PROGRESS],
            is_active=True
        )
        
        breakdown = {}
        for task_type, label in Task.TaskType.choices:
            breakdown[task_type] = tasks.filter(task_type=task_type).count()
        
        return breakdown

    @classmethod
    def auto_assign_task(cls, task_id: str) -> Optional[Task]:
        """Automatically assign task to best available worker."""
        task = cls.get_by_id(task_id)
        
        if task.assigned_to:
            return task  # Already assigned
        
        # Find available workers
        available = cls.find_available_workers(task_type=task.task_type)
        
        if not available:
            return None  # No available workers
        
        # Select best worker (first in sorted list)
        best_worker = available[0]["worker"]
        
        return cls.assign_task(
            task_id=str(task.id),
            worker=best_worker,
            assigned_by=None  # System assignment
        )

    @classmethod
    def get_task_progress(cls, task_id: str) -> dict:
        """Get detailed progress for a task."""
        task = cls.get_by_id(task_id)
        
        # Calculate progress percentage based on time
        progress = 0
        if task.status == Task.Status.DONE:
            progress = 100
        elif task.status == Task.Status.IN_PROGRESS and task.estimated_minutes > 0:
            # Estimate based on elapsed time vs estimated time
            if task.started_at:
                elapsed = (timezone.now() - task.started_at).total_seconds() / 60
                progress = min(int((elapsed / task.estimated_minutes) * 100), 95)
        
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
            "dependencies_completed": task.depends_on.status == Task.Status.DONE if task.depends_on else True,
        }


class ProductionService:
    """Service for production/work order operations."""

    @classmethod
    def get_work_order_by_id(cls, work_order_id: str) -> WorkOrder:
        """Get work order by ID."""
        try:
            return WorkOrder.objects.get(id=work_order_id, is_active=True)
        except WorkOrder.DoesNotExist:
            raise NotFoundError(f"Work order with id {work_order_id} not found")

    @classmethod
    @transaction.atomic
    def update_work_order_status(
        cls,
        work_order_id: str,
        new_status: str,
        quantity_completed: Optional[float] = None,
        user=None,
    ) -> WorkOrder:
        """Update work order status."""
        work_order = cls.get_work_order_by_id(work_order_id)

        valid_statuses = [choice[0] for choice in WorkOrder.Status.choices]
        if new_status not in valid_statuses:
            raise ValidationError(f"Invalid status. Must be one of: {', '.join(valid_statuses)}")

        work_order.status = new_status

        # Update timestamps based on status
        if new_status == WorkOrder.Status.IN_PROGRESS and not work_order.actual_start:
            work_order.actual_start = timezone.now()
        elif new_status == WorkOrder.Status.COMPLETED:
            work_order.actual_end = timezone.now()
            if quantity_completed is not None:
                work_order.quantity_completed = Decimal(str(quantity_completed))

        work_order.save()

        # Update materials usage if completed
        if new_status == WorkOrder.Status.COMPLETED:
            cls._consume_materials(work_order)

        return work_order

    @classmethod
    def _consume_materials(cls, work_order: WorkOrder):
        """Consume materials when work order is completed."""
        from apps.inventory.models import StockMovement
        from apps.inventory.services import InventoryService

        for wom in work_order.work_order_materials.all():
            if wom.quantity_used > 0:
                InventoryService.update_stock(
                    product_id=str(wom.material.id),
                    quantity=float(wom.quantity_used),
                    movement_type=StockMovement.Type.OUT,
                    notes=f"Used in work order {work_order.work_order_number}",
                )

    @classmethod
    def get_production_stats(cls, start_date: Optional[str] = None, end_date: Optional[str] = None):
        """Get production statistics."""
        from django.db.models import Count, Sum

        queryset = WorkOrder.objects.filter(is_active=True)

        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)

        by_status = (
            queryset.values("status")
            .annotate(count=Count("id"), total_quantity=Sum("quantity_completed"))
        )

        return {
            "by_status": list(by_status),
            "total_orders": queryset.count(),
            "completed_quantity": queryset.filter(
                status=WorkOrder.Status.COMPLETED
            ).aggregate(total=Sum("quantity_completed"))["total"]
            or 0,
        }

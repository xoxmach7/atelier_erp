from decimal import Decimal
from typing import List, Optional

from django.db import transaction
from django.utils import timezone

from core.exceptions import NotFoundError, ValidationError
from apps.orders.models import Order, OrderItem, OrderStatusHistory
from apps.users.models import User


class OrderService:
    """Service layer for atelier order workflow business logic."""

    # Maximum active tasks per worker to prevent overload
    MAX_ACTIVE_TASKS_PER_WORKER = 5

    @classmethod
    def get_by_id(cls, order_id: str) -> Order:
        """Get order by ID."""
        try:
            return Order.objects.get(id=order_id, is_active=True)
        except Order.DoesNotExist:
            raise NotFoundError(f"Order with id {order_id} not found")

    @classmethod
    def _can_worker_accept_task(cls, worker: User) -> bool:
        """Check if worker has capacity for new task (overload prevention)."""
        from apps.production.models import Task
        
        active_tasks = Task.objects.filter(
            assigned_to=worker,
            status__in=[Task.Status.NEW, Task.Status.IN_PROGRESS],
            is_active=True
        ).count()
        
        return active_tasks < cls.MAX_ACTIVE_TASKS_PER_WORKER

    @classmethod
    def get_worker_workload(cls, worker_id: str) -> dict:
        """Get current workload for a worker."""
        from apps.production.models import Task
        
        try:
            worker = User.objects.get(id=worker_id, is_active=True)
        except User.DoesNotExist:
            raise NotFoundError(f"Worker with id {worker_id} not found")
        
        tasks = Task.objects.filter(
            assigned_to=worker,
            is_active=True
        )
        
        return {
            "worker_id": str(worker.id),
            "worker_name": worker.get_full_name(),
            "new_tasks": tasks.filter(status=Task.Status.NEW).count(),
            "in_progress_tasks": tasks.filter(status=Task.Status.IN_PROGRESS).count(),
            "done_tasks": tasks.filter(status=Task.Status.DONE).count(),
            "total_active": tasks.filter(status__in=[Task.Status.NEW, Task.Status.IN_PROGRESS]).count(),
            "capacity": cls.MAX_ACTIVE_TASKS_PER_WORKER,
            "has_capacity": cls._can_worker_accept_task(worker)
        }

    @classmethod
    @transaction.atomic
    def create_order(
        cls,
        customer_id: str,
        items: List[dict],
        manager: Optional[User] = None,
        **kwargs
    ) -> Order:
        """Create a new order with items."""
        from apps.customers.models import Customer

        try:
            customer = Customer.objects.get(id=customer_id, is_active=True)
        except Customer.DoesNotExist:
            raise NotFoundError(f"Customer with id {customer_id} not found")

        # Generate order number
        order_number = cls._generate_order_number()

        # Create order
        order = Order.objects.create(
            order_number=order_number,
            customer=customer,
            manager=manager,
            **kwargs
        )

        # Create order items
        total = Decimal("0")
        for item_data in items:
            item = OrderItem.objects.create(order=order, **item_data)
            total += item.total_price

        # Calculate totals with customer discount
        discount = Decimal("0")
        if customer.discount_percent > 0:
            discount = (total * customer.discount_percent) / 100

        order.subtotal = total
        order.discount_amount = discount
        order.total_amount = total - discount
        order.save()

        return order

    @classmethod
    @transaction.atomic
    def update_status(
        cls,
        order_id: str,
        new_status: str,
        changed_by: User,
        reason: str = "",
    ) -> Order:
        """Update order status with history tracking."""
        order = cls.get_by_id(order_id)

        if new_status not in [choice[0] for choice in Order.Status.choices]:
            raise ValidationError(f"Invalid status: {new_status}")

        old_status = order.status

        if old_status == new_status:
            return order

        # Validate status transition
        cls._validate_status_transition(order, old_status, new_status)

        # Update order
        order.status = new_status

        if new_status == Order.Status.DONE:
            order.completed_date = timezone.now()

        order.save()

        # Create history entry
        OrderStatusHistory.objects.create(
            order=order,
            old_status=old_status,
            new_status=new_status,
            changed_by=changed_by,
            reason=reason,
        )

        return order

    @classmethod
    def _validate_status_transition(cls, order: Order, old: str, new: str) -> None:
        """Validate if status transition is allowed."""
        # Define allowed transitions
        allowed = {
            Order.Status.NEW: [Order.Status.IN_PROGRESS, Order.Status.CANCELLED],
            Order.Status.IN_PROGRESS: [Order.Status.DONE, Order.Status.CANCELLED],
            Order.Status.DONE: [Order.Status.DELIVERED, Order.Status.IN_PROGRESS],
            Order.Status.DELIVERED: [],  # Terminal state
            Order.Status.CANCELLED: [Order.Status.NEW],  # Can reopen
        }
        
        if new not in allowed.get(old, []):
            raise ValidationError(
                f"Cannot transition from '{order.get_status_display()}' to '{new}'"
            )

    @classmethod
    def auto_update_status_from_tasks(cls, order_id: str) -> Order:
        """
        Automatically update order status based on task completion.
        Called when tasks are completed.
        """
        order = cls.get_by_id(order_id)
        
        # Get all related work orders and their tasks
        from apps.production.models import WorkOrder, Task
        
        work_orders = WorkOrder.objects.filter(order=order, is_active=True)
        
        if not work_orders.exists():
            return order
        
        # Check task statuses
        total_tasks = 0
        done_tasks = 0
        in_progress_tasks = 0
        
        for wo in work_orders:
            tasks = Task.objects.filter(work_order=wo, is_active=True)
            total_tasks += tasks.count()
            done_tasks += tasks.filter(status=Task.Status.DONE).count()
            in_progress_tasks += tasks.filter(status=Task.Status.IN_PROGRESS).count()
        
        # Determine new status based on task progress
        new_status = None
        
        if total_tasks == 0:
            return order
        
        if done_tasks == total_tasks:
            # All tasks done -> Order is done
            new_status = Order.Status.DONE
        elif in_progress_tasks > 0 or done_tasks > 0:
            # Some work in progress -> Order in progress
            new_status = Order.Status.IN_PROGRESS
        
        # Update if status changed
        if new_status and new_status != order.status:
            order.status = new_status
            if new_status == Order.Status.DONE:
                order.completed_date = timezone.now()
            order.save()
            
            # Create history entry for auto-update
            OrderStatusHistory.objects.create(
                order=order,
                old_status=order.status,
                new_status=new_status,
                changed_by=None,  # System update
                reason="Auto-updated based on task completion",
            )
        
        return order

    @classmethod
    def get_order_progress(cls, order_id: str) -> dict:
        """Get completion progress for an order."""
        from apps.production.models import WorkOrder, Task
        
        order = cls.get_by_id(order_id)
        
        # Get all tasks for this order
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
        
        completion_percentage = (done_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
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

    @classmethod
    @transaction.atomic
    def assign_masters(cls, order_id: str, master_ids: List[str]) -> Order:
        """Assign masters to order."""
        order = cls.get_by_id(order_id)

        masters = User.objects.filter(
            id__in=master_ids, role=User.Role.MASTER, is_active=True
        )

        order.masters.set(masters)
        return order

    @classmethod
    @transaction.atomic
    def add_payment(cls, order_id: str, amount: Decimal) -> Order:
        """Add payment to order."""
        order = cls.get_by_id(order_id)

        if amount <= 0:
            raise ValidationError("Payment amount must be positive")

        order.paid_amount += amount
        order.save(update_fields=["paid_amount"])

        return order

    @classmethod
    def get_orders_by_status(cls, status: Optional[str] = None):
        """Get orders filtered by status."""
        queryset = Order.objects.filter(is_active=True)
        if status:
            queryset = queryset.filter(status=status)
        return queryset

    @classmethod
    def get_overdue_orders(cls):
        """Get all overdue orders."""
        from django.utils import timezone

        return Order.objects.filter(
            deadline_date__lt=timezone.now(),
            status__in=[
                Order.Status.PENDING,
                Order.Status.CONFIRMED,
                Order.Status.IN_PROGRESS,
            ],
            is_active=True,
        )

    @classmethod
    def _generate_order_number(cls) -> str:
        """Generate unique order number."""
        from datetime import datetime

        prefix = datetime.now().strftime("%y%m%d")
        count = (
            Order.objects.filter(
                order_number__startswith=prefix, created_at__date=datetime.now().date()
            ).count()
            + 1
        )
        return f"{prefix}-{count:04d}"


class OrderAssignmentService:
    """Service for assigning work to workers with overload prevention."""

    @classmethod
    def find_available_workers(cls, task_type: str = None) -> List[User]:
        """Find workers who have capacity for new tasks."""
        from apps.production.models import Task
        
        # Get all active workers
        workers = User.objects.filter(
            role__in=[User.Role.WORKER, User.Role.CUTTER],
            is_active=True
        )
        
        available_workers = []
        
        for worker in workers:
            active_count = Task.objects.filter(
                assigned_to=worker,
                status__in=[Task.Status.NEW, Task.Status.IN_PROGRESS],
                is_active=True
            ).count()
            
            if active_count < OrderService.MAX_ACTIVE_TASKS_PER_WORKER:
                available_workers.append({
                    "worker": worker,
                    "active_tasks": active_count,
                    "available_slots": OrderService.MAX_ACTIVE_TASKS_PER_WORKER - active_count
                })
        
        # Sort by available slots (most available first)
        available_workers.sort(key=lambda x: x["available_slots"], reverse=True)
        
        return [w["worker"] for w in available_workers]

    @classmethod
    def suggest_worker_for_task(cls, task_type: str = None) -> Optional[User]:
        """Suggest best available worker based on workload and task type."""
        available = cls.find_available_workers(task_type)
        
        if not available:
            return None
        
        # For now, return worker with most available slots
        # Could be enhanced with skill matching, current workload, etc.
        return available[0] if available else None


class OrderItemService:
    """Service layer for order item operations."""

    @classmethod
    @transaction.atomic
    def update_status(
        cls, item_id: str, new_status: str, user: User
    ) -> OrderItem:
        """Update order item status and trigger order status update."""
        try:
            item = OrderItem.objects.get(id=item_id)
        except OrderItem.DoesNotExist:
            raise NotFoundError(f"Order item with id {item_id} not found")

        if new_status == OrderItem.Status.IN_PROGRESS and not item.started_at:
            item.started_at = timezone.now()
        elif new_status == OrderItem.Status.DONE and not item.completed_at:
            item.completed_at = timezone.now()

        old_status = item.status
        item.status = new_status
        item.save()

        # Trigger order status auto-update if item is assigned to an order
        if item.order:
            OrderService.auto_update_status_from_tasks(str(item.order.id))

        return item

    @classmethod
    def assign_to_worker(
        cls, item_id: str, worker: User, assigned_by: User
    ) -> OrderItem:
        """Assign order item to worker with capacity check."""
        item = cls.get_by_id(item_id)
        
        # Check worker capacity
        if not OrderService._can_worker_accept_task(worker):
            raise ValidationError(
                f"Worker {worker.get_full_name()} has reached maximum task limit"
            )
        
        item.assigned_to = worker
        item.save(update_fields=["assigned_to"])
        
        return item

    @classmethod
    def get_by_id(cls, item_id: str) -> OrderItem:
        """Get order item by ID."""
        try:
            return OrderItem.objects.get(id=item_id, is_active=True)
        except OrderItem.DoesNotExist:
            raise NotFoundError(f"Order item with id {item_id} not found")

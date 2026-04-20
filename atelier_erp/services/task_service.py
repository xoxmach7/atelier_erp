"""
Task Service
Lead management and task-to-order conversion
"""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4

from django.utils import timezone

from ..models import Task, TaskMeasurement, TaskHistory, Customer, Order
from ..constants import TaskFSMRules
from ..events import (
    TaskCreated, TaskConvertedToOrder, DomainEvent
)
from .exceptions import (
    TaskNotFoundError, TaskAlreadyConvertedError, InvalidTaskStatusTransition,
    TaskServiceError
)


class TaskService:
    """
    Service for managing tasks/leads.
    Handles the pre-order workflow from initial contact to conversion.
    """
    
    def __init__(self, unit_of_work):
        self.uow = unit_of_work
    
    def create_task(
        self,
        client_name: str,
        client_phone: str,
        client_address: Optional[Dict[str, str]] = None,
        customer_id: Optional[UUID] = None,
        source: str = 'other',
        description: str = "",
        client_wishes: str = "",
        preferred_date: Optional[date] = None,
        deadline: Optional[date] = None,
        priority: int = 1,
        assigned_designer_id: Optional[UUID] = None,
        task_number: str = None,
        created_by: Optional[UUID] = None
    ) -> Task:
        """
        Create new task (lead).
        
        Args:
            client_name: Name of potential client
            client_phone: Phone number
            client_address: Dict with city, street, building
            customer_id: UUID if already registered customer
            source: Lead source (phone, instagram, etc.)
            description: Initial description
            client_wishes: What client wants
            preferred_date: Preferred measurement date
            deadline: Hard deadline if any
            priority: 1-5 priority level
            assigned_designer_id: UUID of designer
            task_number: Unique task number (З-YYYY-NNN)
            created_by: UUID of creator
        
        Returns:
            Created Task
        """
        # Validate customer if provided
        if customer_id:
            try:
                Customer.objects.get(pk=customer_id, is_active=True)
            except Customer.DoesNotExist:
                raise TaskServiceError(f"Customer {customer_id} not found")
        
        # Create task
        task = Task.objects.create(
            task_number=task_number or self._generate_task_number(),
            client_name=client_name,
            client_phone=client_phone,
            client_address_city=client_address.get('city', '') if client_address else '',
            client_address_street=client_address.get('street', '') if client_address else '',
            client_address_building=client_address.get('building', '') if client_address else '',
            customer_id=customer_id,
            source=source,
            description=description,
            client_wishes=client_wishes,
            preferred_date=preferred_date,
            deadline=deadline,
            priority=priority,
            assigned_designer_id=assigned_designer_id,
            status=Task.Status.LEAD,
            created_by_id=created_by
        )
        
        # Create initial history
        TaskHistory.objects.create(
            task=task,
            action='created',
            new_value='lead',
            performed_by_id=created_by,
            notes='Task created'
        )
        
        # Emit event
        self.uow.register_event(TaskCreated(
            task_id=task.id,
            task_number=task.task_number,
            client_name=client_name,
            client_phone=client_phone,
            source=source,
            created_by=created_by
        ))
        
        return task
    
    def assign_designer(
        self,
        task_id: UUID,
        designer_id: UUID,
        assigned_by: Optional[UUID] = None
    ) -> Task:
        """
        Assign designer to task.
        
        INVARIANT: Designer must have designer role (checked at view level)
        """
        task = self._get_task_for_update(task_id)
        
        # INVARIANT: Cannot modify converted tasks
        if task.status == Task.Status.CONVERTED:
            raise TaskAlreadyConvertedError(f"Task {task_id} already converted to order")
        
        old_designer = task.assigned_designer_id
        
        task.assigned_designer_id = designer_id
        task.save(update_fields=['assigned_designer_id', 'updated_at'])
        
        # Log history
        TaskHistory.objects.create(
            task=task,
            action='designer_assigned',
            old_value=str(old_designer) if old_designer else None,
            new_value=str(designer_id),
            performed_by_id=assigned_by,
            notes='Designer assigned'
        )
        
        return task
    
    def schedule_measurement(
        self,
        task_id: UUID,
        measurement_date: date,
        scheduled_by: Optional[UUID] = None
    ) -> Task:
        """
        Schedule measurement for task.
        Transition: LEAD → MEASUREMENT_SCHEDULED
        """
        task = self._get_task_for_update(task_id)
        
        self._validate_transition(task, Task.Status.MEASUREMENT_SCHEDULED)
        
        old_status = task.status
        task.status = Task.Status.MEASUREMENT_SCHEDULED
        task.preferred_date = measurement_date
        task.save(update_fields=['status', 'preferred_date', 'updated_at'])
        
        self._log_status_change(task, old_status, task.status, scheduled_by, f"Scheduled for {measurement_date}")
        
        return task
    
    def add_measurement(
        self,
        task_id: UUID,
        room_name: str,
        window_name: str = "",
        width_cm: int = 0,
        height_cm: int = 0,
        depth_cm: Optional[int] = None,
        ceiling_height_cm: Optional[int] = None,
        mounting_type: str = "",
        selected_fabric_id: Optional[UUID] = None,
        selected_cornice_type: str = "",
        measured_by: Optional[UUID] = None
    ) -> TaskMeasurement:
        """
        Add measurement to task.
        Also transitions status: MEASUREMENT_SCHEDULED → MEASUREMENT_DONE
        """
        task = self._get_task_for_update(task_id)
        
        # Create measurement
        measurement = TaskMeasurement.objects.create(
            task=task,
            room_name=room_name,
            window_name=window_name,
            width_cm=width_cm,
            height_cm=height_cm,
            depth_cm=depth_cm,
            ceiling_height_cm=ceiling_height_cm,
            mounting_type=mounting_type,
            selected_fabric_id=selected_fabric_id,
            selected_cornice_type=selected_cornice_type,
            measured_by_id=measured_by
        )
        
        # Auto-transition status
        if task.status == Task.Status.MEASUREMENT_SCHEDULED:
            old_status = task.status
            task.status = Task.Status.MEASUREMENT_DONE
            task.save(update_fields=['status', 'updated_at'])
            self._log_status_change(task, old_status, task.status, measured_by, f"Measured {room_name}")
        
        return measurement
    
    def start_quoting(self, task_id: UUID, started_by: Optional[UUID] = None) -> Task:
        """
        Start quoting process.
        Transition: MEASUREMENT_DONE → QUOTING
        """
        task = self._get_task_for_update(task_id)
        
        self._validate_transition(task, Task.Status.QUOTING)
        
        old_status = task.status
        task.status = Task.Status.QUOTING
        task.save(update_fields=['status', 'updated_at'])
        
        self._log_status_change(task, old_status, task.status, started_by, "Quoting started")
        
        return task
    
    def send_quote(self, task_id: UUID, quote_id: UUID, sent_by: Optional[UUID] = None) -> Task:
        """
        Mark quote as sent to customer.
        Transition: QUOTING → QUOTE_SENT
        """
        task = self._get_task_for_update(task_id)
        
        self._validate_transition(task, Task.Status.QUOTE_SENT)
        
        old_status = task.status
        task.status = Task.Status.QUOTE_SENT
        task.save(update_fields=['status', 'updated_at'])
        
        self._log_status_change(task, old_status, task.status, sent_by, f"Quote {quote_id} sent")
        
        return task
    
    def convert_to_order(
        self,
        task_id: UUID,
        order_id: UUID,
        converted_by: Optional[UUID] = None
    ) -> Task:
        """
        Convert task to order.
        
        INVARIANT: Task must have at least one quote.
        INVARIANT: Task must be in QUOTE_SENT status.
        
        Args:
            task_id: UUID of task to convert
            order_id: UUID of created order
            converted_by: UUID of user
        
        Returns:
            Updated Task
        """
        task = self._get_task_for_update(task_id)
        
        # Check if already converted
        if task.status == Task.Status.CONVERTED:
            raise TaskAlreadyConvertedError(f"Task {task_id} already converted")
        
        # INVARIANT: Must have at least one quote
        if not task.quotes.exists():
            raise TaskServiceError("Cannot convert task without quotes")
        
        # FSM validation
        self._validate_transition(task, Task.Status.CONVERTED)
        
        old_status = task.status
        
        # Update task
        task.status = Task.Status.CONVERTED
        task.converted_to_order_id = order_id
        task.converted_at = timezone.now()
        task.save(update_fields=['status', 'converted_to_order', 'converted_at', 'updated_at'])
        
        # Log history
        self._log_status_change(task, old_status, task.status, converted_by, f"Converted to order {order_id}")
        
        # Emit event
        self.uow.register_event(TaskConvertedToOrder(
            task_id=task.id,
            order_id=order_id,
            order_number=task.converted_to_order.order_number if task.converted_to_order else ""
        ))
        
        return task
    
    def mark_lost(
        self,
        task_id: UUID,
        reason: str,
        marked_by: Optional[UUID] = None
    ) -> Task:
        """
        Mark task as lost opportunity.
        Can reactivate later.
        """
        task = self._get_task_for_update(task_id)
        
        self._validate_transition(task, Task.Status.LOST)
        
        old_status = task.status
        task.status = Task.Status.LOST
        task.save(update_fields=['status', 'updated_at'])
        
        self._log_status_change(task, old_status, task.status, marked_by, f"Lost: {reason}")
        
        return task
    
    def reactivate_task(
        self,
        task_id: UUID,
        reason: str,
        activated_by: Optional[UUID] = None
    ) -> Task:
        """
        Reactivate lost or postponed task.
        Transition: LOST/POSTPONED → LEAD
        """
        task = self._get_task_for_update(task_id)
        
        if task.status not in (Task.Status.LOST, Task.Status.POSTPONED):
            raise TaskServiceError(f"Cannot reactivate task in status {task.status}")
        
        old_status = task.status
        task.status = Task.Status.LEAD
        task.save(update_fields=['status', 'updated_at'])
        
        self._log_status_change(task, old_status, task.status, activated_by, f"Reactivated: {reason}")
        
        return task
    
    def postpone_task(
        self,
        task_id: UUID,
        reason: str,
        postponed_by: Optional[UUID] = None
    ) -> Task:
        """
        Postpone task (client wants to think/delay).
        """
        task = self._get_task_for_update(task_id)
        
        self._validate_transition(task, Task.Status.POSTPONED)
        
        old_status = task.status
        task.status = Task.Status.POSTPONED
        task.save(update_fields=['status', 'updated_at'])
        
        self._log_status_change(task, old_status, task.status, postponed_by, f"Postponed: {reason}")
        
        return task
    
    def delete_task(
        self,
        task_id: UUID,
        deleted_by: Optional[UUID] = None
    ):
        """
        Delete task.
        INVARIANT: Can only delete tasks in LEAD, LOST, or POSTPONED status.
        """
        task = self._get_task_for_update(task_id)
        
        # INVARIANT: Can only delete in specific states
        if task.status not in (Task.Status.LEAD, Task.Status.LOST, Task.Status.POSTPONED):
            raise TaskServiceError(
                f"Cannot delete task in status {task.status}. "
                "Only LEAD, LOST, or POSTPONED tasks can be deleted."
            )
        
        # Cancel any active reservations
        for reservation in task.fabric_reservations.filter(status='active'):
            from ..models import Fabric
            fabric = reservation.fabric
            fabric.reserved_meters -= reservation.reserved_meters
            fabric.save(update_fields=['reserved_meters', 'updated_at'])
            
            reservation.status = 'cancelled'
            reservation.cancelled_reason = 'Task deleted'
            reservation.cancelled_at = timezone.now()
            reservation.save(update_fields=['status', 'cancelled_reason', 'cancelled_at'])
        
        task.delete()
    
    # ============================================
    # HELPER METHODS
    # ============================================
    
    def _get_task_for_update(self, task_id: UUID) -> Task:
        """Get task with lock for update"""
        try:
            return Task.objects.select_for_update().get(pk=task_id)
        except Task.DoesNotExist:
            raise TaskNotFoundError(f"Task {task_id} not found")
    
    def _validate_transition(self, task: Task, new_status: str):
        """Validate FSM transition"""
        if not TaskFSMRules.can_transition(task.status, new_status):
            raise InvalidTaskStatusTransition(
                task.status,
                new_status,
                TaskFSMRules.get_allowed_transitions(task.status)
            )
    
    def _log_status_change(
        self,
        task: Task,
        old_status: str,
        new_status: str,
        changed_by: Optional[UUID],
        notes: str
    ):
        """Log status change to history"""
        TaskHistory.objects.create(
            task=task,
            action='status_changed',
            old_value=old_status,
            new_value=new_status,
            performed_by_id=changed_by,
            notes=notes
        )
    
    def _generate_task_number(self) -> str:
        """Generate unique task number З-YYYY-NNN"""
        import re
        from datetime import datetime
        
        year = datetime.now().year
        
        # Get latest task number for this year
        latest = Task.objects.filter(
            task_number__regex=f'^З-{year}-\\d{{3}}$'
        ).order_by('-task_number').first()
        
        if latest:
            match = re.match(rf'^З-{year}-(\d{{3}})$', latest.task_number)
            if match:
                seq = int(match.group(1)) + 1
            else:
                seq = 1
        else:
            seq = 1
        
        return f"З-{year}-{seq:03d}"

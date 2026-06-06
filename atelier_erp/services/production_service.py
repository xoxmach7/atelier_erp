"""
Production Service
Manages production assignments and seamstress workflow
"""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID

from django.contrib.auth import get_user_model
from django.utils import timezone

from ..models import ProductionAssignment, ProductionLog, SeamstressPayment, Order
from ..constants import ProductionConfig
from .exceptions import (
    ProductionServiceError, SeamstressNotFoundError, AssignmentNotFoundError,
    InvalidProductionStatusTransition
)

User = get_user_model()

class ProductionService:
    """
    Service for managing production workflow.
    
    Handles:
    - Assigning orders to seamstresses
    - Tracking production status
    - Calculating payments
    - Managing deadlines
    """
    
    def __init__(self, unit_of_work):
        self.uow = unit_of_work
    
    # ============================================
    # ASSIGNMENT
    # ============================================
    
    def create_assignment(
        self,
        order_id: UUID,
        seamstress_id: UUID,
        deadline: Optional[date] = None,
        complexity: str = 'medium',
        priority: int = 1,
        base_amount: Optional[Decimal] = None,
        created_by: Optional[UUID] = None
    ) -> ProductionAssignment:
        """
        Create production assignment for order.
        
        Args:
            order_id: Order to assign
            seamstress_id: User ID of seamstress
            deadline: Completion deadline
            complexity: low/medium/high
            priority: 1-5 priority level
            base_amount: Override base payment amount
            created_by: User creating assignment
        
        Returns:
            ProductionAssignment
        """
        # Validate order exists and is in correct status
        try:
            order = Order.objects.get(pk=order_id)
        except Order.DoesNotExist:
            raise ProductionServiceError(f"Order {order_id} not found")
        
        # Validate seamstress
        try:
            seamstress = User.objects.get(pk=seamstress_id)
            # Check role - would be checked against groups or role field
            # if not seamstress.groups.filter(name='Seamstress').exists():
            #     raise SeamstressNotFoundError(f"User {seamstress_id} is not a seamstress")
        except User.DoesNotExist:
            raise SeamstressNotFoundError(f"Seamstress {seamstress_id} not found")
        
        # Calculate payment
        if base_amount is None:
            base_amount = ProductionConfig.BASE_RATES.get(complexity, Decimal('8000'))
        
        multiplier = ProductionConfig.COMPLEXITY_MULTIPLIERS.get(complexity, Decimal('1.0'))
        complexity_bonus = base_amount * (multiplier - Decimal('1.0'))
        total_payment = base_amount + complexity_bonus
        
        # Create assignment
        assignment = ProductionAssignment.objects.create(
            order_id=order_id,
            assigned_to_id=seamstress_id,
            status=ProductionAssignment.Status.ASSIGNED,
            complexity=complexity,
            priority=priority,
            deadline=deadline,
            base_payment=base_amount,
            complexity_bonus=complexity_bonus,
            total_payment=total_payment,
            created_by_id=created_by
        )
        
        # Log creation
        ProductionLog.objects.create(
            assignment=assignment,
            old_status='',
            new_status=assignment.status,
            changed_by_id=created_by,
            notes='Assignment created'
        )
        
        
        return assignment
    
    def reassign_to_seamstress(
        self,
        assignment_id: UUID,
        new_seamstress_id: UUID,
        reassigned_by: Optional[UUID] = None
    ) -> ProductionAssignment:
        """
        Reassign order to different seamstress.
        """
        assignment = self._get_assignment_for_update(assignment_id)
        
        old_seamstress = assignment.assigned_to_id
        
        assignment.assigned_to_id = new_seamstress_id
        assignment.save(update_fields=['assigned_to', 'updated_at'])
        
        ProductionLog.objects.create(
            assignment=assignment,
            old_status=assignment.status,
            new_status=assignment.status,
            changed_by_id=reassigned_by,
            notes=f'Reassigned from {old_seamstress} to {new_seamstress_id}'
        )
        
        return assignment
    
    # ============================================
    # STATUS MANAGEMENT
    # ============================================
    
    def update_status(
        self,
        assignment_id: UUID,
        new_status: str,
        changed_by: Optional[UUID] = None,
        notes: str = ""
    ) -> ProductionAssignment:
        """
        Update production status.
        
        Valid sequence: assigned → materials_prepared → cutting → 
                        sewing → quality_check → ready
        
        Args:
            assignment_id: UUID of assignment
            new_status: New status
            changed_by: User making change
            notes: Optional notes
        """
        assignment = self._get_assignment_for_update(assignment_id)
        
        # Validate status transition
        self._validate_status_transition(assignment.status, new_status)
        
        old_status = assignment.status
        
        # Update status
        assignment.status = new_status
        
        # Update timestamps based on status
        if new_status == ProductionAssignment.Status.CUTTING and not assignment.started_at:
            assignment.started_at = timezone.now()
        
        if new_status == ProductionAssignment.Status.READY:
            assignment.completed_at = timezone.now()
        
        assignment.save(update_fields=['status', 'started_at', 'completed_at', 'updated_at'])
        
        # Log change
        ProductionLog.objects.create(
            assignment=assignment,
            old_status=old_status,
            new_status=new_status,
            changed_by_id=changed_by,
            notes=notes
        )
        
        
        return assignment
    
    def start_work(self, assignment_id: UUID, started_by: Optional[UUID] = None) -> ProductionAssignment:
        """
        Mark as cutting (work started).
        """
        return self.update_status(
            assignment_id,
            ProductionAssignment.Status.CUTTING,
            started_by,
            "Work started"
        )
    
    def mark_sewing(self, assignment_id: UUID, marked_by: Optional[UUID] = None) -> ProductionAssignment:
        """
        Mark as sewing.
        """
        return self.update_status(
            assignment_id,
            ProductionAssignment.Status.SEWING,
            marked_by,
            "Sewing in progress"
        )
    
    def quality_check(self, assignment_id: UUID, passed: bool, checked_by: Optional[UUID] = None) -> ProductionAssignment:
        """
        Pass/fail quality check.
        If failed, returns for revision.
        """
        if passed:
            return self.update_status(
                assignment_id,
                ProductionAssignment.Status.QUALITY_CHECK,
                checked_by,
                "Quality check passed"
            )
        else:
            return self.update_status(
                assignment_id,
                ProductionAssignment.Status.RETURNED,
                checked_by,
                "Quality check failed - returned for revision"
            )
    
    def mark_ready(self, assignment_id: UUID, marked_by: Optional[UUID] = None) -> ProductionAssignment:
        """
        Mark as ready for installation.
        This completes production.
        """
        return self.update_status(
            assignment_id,
            ProductionAssignment.Status.READY,
            marked_by,
            "Production completed, ready for installation"
        )
    
    def return_for_revision(
        self,
        assignment_id: UUID,
        reason: str,
        returned_by: Optional[UUID] = None
    ) -> ProductionAssignment:
        """
        Return order to seamstress for revision.
        """
        return self.update_status(
            assignment_id,
            ProductionAssignment.Status.RETURNED,
            returned_by,
            f"Returned: {reason}"
        )
    
    def resume_after_revision(
        self,
        assignment_id: UUID,
        resumed_by: Optional[UUID] = None
    ) -> ProductionAssignment:
        """
        Resume work after revision.
        Returns to appropriate status in workflow.
        """
        # Determine where to return in workflow
        assignment = self._get_assignment_for_update(assignment_id)
        
        # Default to sewing status
        return self.update_status(
            assignment_id,
            ProductionAssignment.Status.SEWING,
            resumed_by,
            "Resumed after revision"
        )
    
    # ============================================
    # PAYMENT MANAGEMENT
    # ============================================
    
    def create_payment_record(
        self,
        assignment_id: UUID,
        calculated_by: Optional[UUID] = None
    ) -> SeamstressPayment:
        """
        Create payment record for completed work.
        Called when work is marked ready.
        """
        assignment = ProductionAssignment.objects.select_related('assigned_to').get(
            pk=assignment_id
        )
        
        # Check if already exists
        existing = SeamstressPayment.objects.filter(assignment_id=assignment_id).first()
        if existing:
            return existing
        
        payment = SeamstressPayment.objects.create(
            assignment=assignment,
            seamstress_id=assignment.assigned_to_id,
            base_amount=assignment.base_payment,
            complexity_bonus=assignment.complexity_bonus,
            total_amount=assignment.total_payment,
            status=SeamstressPayment.Status.PENDING
        )
        
        return payment
    
    def mark_payment_paid(
        self,
        payment_id: UUID,
        paid_by: Optional[UUID] = None
    ) -> SeamstressPayment:
        """
        Mark seamstress payment as paid.
        """
        try:
            payment = SeamstressPayment.objects.get(pk=payment_id)
        except SeamstressPayment.DoesNotExist:
            raise ProductionServiceError(f"Payment {payment_id} not found")
        
        if payment.status != SeamstressPayment.Status.PENDING:
            raise ProductionServiceError(f"Cannot mark payment in status {payment.status}")
        
        payment.status = SeamstressPayment.Status.PAID
        payment.paid_at = timezone.now()
        payment.paid_by_id = paid_by
        payment.save(update_fields=['status', 'paid_at', 'paid_by', 'updated_at'])
        
        return payment
    
    def calculate_bulk_payments(
        self,
        start_date: date,
        end_date: date
    ) -> List[Dict[str, Any]]:
        """
        Calculate all pending payments for date range.
        For payroll processing.
        """
        assignments = ProductionAssignment.objects.filter(
            status=ProductionAssignment.Status.READY,
            completed_at__date__gte=start_date,
            completed_at__date__lte=end_date
        ).select_related('assigned_to', 'order')
        
        payments = []
        for assignment in assignments:
            # Get or create payment record
            payment, created = SeamstressPayment.objects.get_or_create(
                assignment=assignment,
                defaults={
                    'seamstress_id': assignment.assigned_to_id,
                    'base_amount': assignment.base_payment,
                    'complexity_bonus': assignment.complexity_bonus,
                    'total_amount': assignment.total_payment,
                    'status': SeamstressPayment.Status.PENDING
                }
            )
            
            payments.append({
                'payment_id': payment.id,
                'seamstress_id': assignment.assigned_to_id,
                'seamstress_name': assignment.assigned_to.get_full_name() if assignment.assigned_to else '',
                'order_number': assignment.order.order_number,
                'completed_at': assignment.completed_at,
                'base_amount': payment.base_amount,
                'bonus': payment.complexity_bonus,
                'total': payment.total_amount,
                'status': payment.status
            })
        
        return payments
    
    # ============================================
    # QUERIES
    # ============================================
    
    def get_workload_for_seamstress(
        self,
        seamstress_id: UUID,
        status_filter: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Get current workload for a seamstress.
        """
        if status_filter is None:
            status_filter = [
                ProductionAssignment.Status.ASSIGNED,
                ProductionAssignment.Status.MATERIALS_PREPARED,
                ProductionAssignment.Status.CUTTING,
                ProductionAssignment.Status.SEWING,
                ProductionAssignment.Status.QUALITY_CHECK,
                ProductionAssignment.Status.RETURNED
            ]
        
        assignments = ProductionAssignment.objects.filter(
            assigned_to_id=seamstress_id,
            status__in=status_filter
        ).select_related('order', 'order__customer')
        
        by_status = {}
        for status in status_filter:
            by_status[status] = [
                {
                    'assignment_id': a.id,
                    'order_number': a.order.order_number,
                    'customer': a.order.customer.full_name,
                    'deadline': a.deadline,
                    'priority': a.priority,
                    'complexity': a.complexity,
                    'payment_due': a.total_payment
                }
                for a in assignments if a.status == status
            ]
        
        total_payment_pending = sum(
            a.total_payment for a in assignments
        )
        
        overdue = [a for a in assignments if a.deadline and a.deadline < timezone.now().date()]
        
        return {
            'seamstress_id': seamstress_id,
            'active_assignments': len(assignments),
            'by_status': by_status,
            'total_payment_pending': total_payment_pending,
            'overdue_count': len(overdue),
            'overdue_orders': [
                {
                    'order_number': a.order.order_number,
                    'deadline': a.deadline,
                    'days_overdue': (timezone.now().date() - a.deadline).days
                }
                for a in overdue
            ]
        }
    
    def get_production_queue(
        self,
        status: Optional[str] = None,
        priority_min: int = 1
    ) -> List[Dict[str, Any]]:
        """
        Get production queue for management.
        """
        assignments = ProductionAssignment.objects.select_related(
            'order', 'order__customer', 'assigned_to'
        )
        
        if status:
            assignments = assignments.filter(status=status)
        
        if priority_min > 1:
            assignments = assignments.filter(priority__gte=priority_min)
        
        assignments = assignments.order_by('-priority', 'deadline', 'created_at')
        
        return [
            {
                'assignment_id': a.id,
                'order_number': a.order.order_number,
                'customer': a.order.customer.full_name,
                'seamstress': a.assigned_to.get_full_name() if a.assigned_to else 'Unassigned',
                'status': a.status,
                'complexity': a.complexity,
                'priority': a.priority,
                'deadline': a.deadline,
                'started_at': a.started_at,
                'progress_days': (timezone.now() - a.started_at).days if a.started_at else 0
            }
            for a in assignments
        ]
    
    # ============================================
    # HELPER METHODS
    # ============================================
    
    def _get_assignment_for_update(self, assignment_id: UUID) -> ProductionAssignment:
        """Get assignment with lock"""
        try:
            return ProductionAssignment.objects.select_for_update().get(pk=assignment_id)
        except ProductionAssignment.DoesNotExist:
            raise AssignmentNotFoundError(f"Assignment {assignment_id} not found")
    
    def _validate_status_transition(self, from_status: str, to_status: str):
        """Validate status is in allowed sequence"""
        sequence = ProductionConfig.STATUS_SEQUENCE
        
        if from_status == to_status:
            return  # Self-transition allowed
        
        # Check special transitions
        special_transitions = {
            ProductionAssignment.Status.QUALITY_CHECK: [
                ProductionAssignment.Status.READY,
                ProductionAssignment.Status.RETURNED
            ],
            ProductionAssignment.Status.RETURNED: [
                ProductionAssignment.Status.SEWING,
                ProductionAssignment.Status.CUTTING
            ]
        }
        
        if from_status in special_transitions:
            if to_status in special_transitions[from_status]:
                return
        
        # Check sequence
        if from_status not in sequence:
            raise InvalidProductionStatusTransition(
                f"Unknown status: {from_status}"
            )
        
        from_idx = sequence.index(from_status)
        
        # Can only move forward in sequence (or to special states)
        if to_status not in sequence:
            raise InvalidProductionStatusTransition(
                f"Invalid target status: {to_status}"
            )
        
        to_idx = sequence.index(to_status)
        
        if to_idx <= from_idx:
            raise InvalidProductionStatusTransition(
                f"Cannot move backwards: {from_status} → {to_status}"
            )

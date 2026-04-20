"""
Payment Service
Handles payment processing, validation, and reconciliation
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, Any, List
from uuid import UUID

from django.utils import timezone

from ..models import Payment, Order
from ..events import OrderPaymentReceived, DomainEvent
from .exceptions import (
    PaymentServiceError, InvalidPaymentAmount, DuplicatePaymentError,
    PaymentNotFoundError
)


class PaymentService:
    """
    Service for payment operations.
    
    Handles:
    - Payment recording with idempotency
    - Prepayment/full payment validation
    - External payment gateway integration hooks
    - Reconciliation
    """
    
    def __init__(self, unit_of_work):
        self.uow = unit_of_work
    
    def record_payment(
        self,
        order_id: UUID,
        amount: Decimal,
        payment_type: str,
        payment_method: str,
        idempotency_key: Optional[str] = None,
        external_transaction_id: Optional[str] = None,
        received_by: Optional[UUID] = None,
        notes: str = ""
    ) -> Payment:
        """
        Record a payment with idempotency protection.
        
        Args:
            order_id: Order being paid
            amount: Payment amount
            payment_type: prepayment/final/additional
            payment_method: cash/card/transfer/kaspi
            idempotency_key: Key for duplicate detection
            external_transaction_id: From payment gateway
            received_by: User recording payment
            notes: Additional notes
        
        Returns:
            Payment record
        
        Raises:
            DuplicatePaymentError: If idempotency key already exists
            InvalidPaymentAmount: If amount invalid
        """
        # Validate amount
        if amount <= 0:
            raise InvalidPaymentAmount("Payment amount must be positive")
        
        # Check idempotency
        if idempotency_key:
            existing = Payment.objects.filter(
                idempotency_key=idempotency_key
            ).first()
            
            if existing:
                # Return existing payment (idempotent)
                return existing
        
        # Get order
        try:
            order = Order.objects.get(pk=order_id)
        except Order.DoesNotExist:
            raise PaymentServiceError(f"Order {order_id} not found")
        
        # Validate against order total
        current_paid = order.paid_amount
        if current_paid + amount > order.total_amount:
            raise InvalidPaymentAmount(
                f"Payment would exceed order total. "
                f"Remaining: {order.total_amount - current_paid}"
            )
        
        # Create payment
        payment = Payment.objects.create(
            order_id=order_id,
            amount=amount,
            payment_type=payment_type,
            payment_method=payment_method,
            idempotency_key=idempotency_key or "",
            external_transaction_id=external_transaction_id or "",
            received_by_id=received_by,
            received_at=timezone.now(),
            notes=notes
        )
        
        # Update order paid amount
        order.paid_amount += amount
        order.save(update_fields=['paid_amount', 'updated_at'])
        
        # Emit event
        self.uow.register_event(OrderPaymentReceived(
            order_id=order_id,
            payment_id=payment.id,
            amount=str(amount),
            payment_type=payment_type,
            is_fully_paid=order.paid_amount >= order.total_amount
        ))
        
        return payment
    
    def record_prepayment(
        self,
        order_id: UUID,
        amount: Decimal,
        payment_method: str,
        **kwargs
    ) -> Payment:
        """
        Record prepayment (50%+ of total).
        """
        return self.record_payment(
            order_id=order_id,
            amount=amount,
            payment_type=Payment.PaymentType.PREPAYMENT,
            payment_method=payment_method,
            **kwargs
        )
    
    def record_final_payment(
        self,
        order_id: UUID,
        amount: Decimal,
        payment_method: str,
        **kwargs
    ) -> Payment:
        """
        Record final payment (remaining balance).
        """
        return self.record_payment(
            order_id=order_id,
            amount=amount,
            payment_type=Payment.PaymentType.FINAL,
            payment_method=payment_method,
            **kwargs
        )
    
    def process_external_payment(
        self,
        order_id: UUID,
        gateway: str,
        transaction_data: Dict[str, Any]
    ) -> Payment:
        """
        Process payment from external gateway (Kaspi, etc.).
        
        Args:
            order_id: Order ID
            gateway: Gateway name (kaspi, etc.)
            transaction_data: Gateway-specific transaction info
        
        Returns:
            Payment record
        """
        # Extract data based on gateway
        if gateway.lower() == 'kaspi':
            amount = Decimal(str(transaction_data.get('amount', 0)))
            external_id = transaction_data.get('transaction_id', '')
            # Kaspi webhook signature verification would happen here
        else:
            raise PaymentServiceError(f"Unsupported gateway: {gateway}")
        
        # Use external_id as idempotency key
        return self.record_payment(
            order_id=order_id,
            amount=amount,
            payment_type=Payment.PaymentType.PREPAYMENT,  # Default for external
            payment_method=Payment.PaymentMethod.KASPI,
            idempotency_key=f"{gateway}:{external_id}",
            external_transaction_id=external_id,
            notes=f"Via {gateway}"
        )
    
    def void_payment(
        self,
        payment_id: UUID,
        reason: str,
        voided_by: Optional[UUID] = None
    ) -> Payment:
        """
        Void a payment (admin only).
        Adjusts order paid amount.
        
        INVARIANT: Cannot void if order is completed.
        """
        try:
            payment = Payment.objects.select_related('order').get(pk=payment_id)
        except Payment.DoesNotExist:
            raise PaymentNotFoundError(f"Payment {payment_id} not found")
        
        order = payment.order
        
        # Check order status
        if order.status == Order.Status.COMPLETED:
            raise PaymentServiceError("Cannot void payment on completed order")
        
        # Update order paid amount
        order.paid_amount -= payment.amount
        if order.paid_amount < 0:
            order.paid_amount = Decimal('0')
        order.save(update_fields=['paid_amount', 'updated_at'])
        
        # Mark payment as cancelled (soft delete)
        # In practice, you might want a separate status or keep for audit
        payment.notes = f"[VOIDED: {reason}] {payment.notes}"
        payment.save(update_fields=['notes'])
        
        return payment
    
    def reconcile_payments(
        self,
        order_id: UUID
    ) -> Dict[str, Any]:
        """
        Reconcile payment totals for order.
        
        Returns:
            Dict with expected vs actual totals
        """
        try:
            order = Order.objects.get(pk=order_id)
        except Order.DoesNotExist:
            raise PaymentServiceError(f"Order {order_id} not found")
        
        payments = Payment.objects.filter(order_id=order_id)
        
        prepayments = payments.filter(payment_type=Payment.PaymentType.PREPAYMENT).aggregate(
            total=models.Sum('amount')
        )['total'] or Decimal('0')
        
        finals = payments.filter(payment_type=Payment.PaymentType.FINAL).aggregate(
            total=models.Sum('amount')
        )['total'] or Decimal('0')
        
        additional = payments.filter(payment_type=Payment.PaymentType.ADDITIONAL).aggregate(
            total=models.Sum('amount')
        )['total'] or Decimal('0')
        
        calculated_total = prepayments + finals + additional
        
        return {
            'order_total': order.total_amount,
            'order_paid': order.paid_amount,
            'calculated_total': calculated_total,
            'discrepancy': order.paid_amount - calculated_total,
            'prepayments': prepayments,
            'finals': finals,
            'additional': additional,
            'payment_count': payments.count(),
            'is_reconciled': order.paid_amount == calculated_total
        }
    
    def get_payment_summary(
        self,
        order_id: UUID
    ) -> Dict[str, Any]:
        """
        Get payment summary for order.
        """
        try:
            order = Order.objects.get(pk=order_id)
        except Order.DoesNotExist:
            raise PaymentServiceError(f"Order {order_id} not found")
        
        payments = Payment.objects.filter(order_id=order_id).order_by('-received_at')
        
        required_prepayment = order.total_amount * Decimal('0.5')
        prepayment_received = payments.filter(
            payment_type=Payment.PaymentType.PREPAYMENT
        ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0')
        
        return {
            'order_total': order.total_amount,
            'paid_amount': order.paid_amount,
            'remaining': order.total_amount - order.paid_amount,
            'is_fully_paid': order.paid_amount >= order.total_amount,
            'required_prepayment': required_prepayment,
            'prepayment_received': prepayment_received,
            'prepayment_satisfied': prepayment_received >= required_prepayment,
            'payments': [
                {
                    'id': p.id,
                    'amount': p.amount,
                    'type': p.payment_type,
                    'method': p.payment_method,
                    'received_at': p.received_at
                }
                for p in payments
            ]
        }
    
    def get_outstanding_payments(
        self,
        min_remaining: Decimal = Decimal('0.01')
    ) -> List[Dict[str, Any]]:
        """
        Get orders with outstanding payments.
        
        Returns:
            List of orders with payment info
        """
        from django.db.models import F
        
        orders = Order.objects.annotate(
            remaining=F('total_amount') - F('paid_amount')
        ).filter(
            remaining__gt=min_remaining,
            status__in=[
                Order.Status.APPROVED,
                Order.Status.PREPAYMENT_RECEIVED,
                Order.Status.FABRIC_RESERVED,
                Order.Status.PRODUCTION,
                Order.Status.READY,
                Order.Status.INSTALLATION
            ]
        ).order_by('-remaining')
        
        return [
            {
                'order_id': o.id,
                'order_number': o.order_number,
                'customer_name': o.customer.full_name,
                'total': o.total_amount,
                'paid': o.paid_amount,
                'remaining': o.remaining,
                'status': o.status
            }
            for o in orders
        ]

# Import models at end to avoid circular imports
from django.db import models

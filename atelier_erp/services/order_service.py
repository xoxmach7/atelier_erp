"""
Order Service
Core business logic for order lifecycle management
Implements strict FSM and inventory integration
"""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID, uuid4

from django.db import models
from django.utils import timezone

from ..models import Order, OrderItem, Customer, Measurement, Payment, Quote
from ..constants import OrderFSMRules, FinancialConfig
from ..events import (
    OrderCreated, OrderStatusChanged, OrderConfirmed, OrderMaterialsReserved,
    OrderProductionStarted, OrderCompleted, OrderCancelled, OrderPaymentReceived,
    DomainEvent, EventMetadata
)
from .exceptions import (
    OrderNotFoundError, InvalidOrderStatusTransition, OrderValidationError,
    OrderCannotBeModified, OrderCancellationError, OrderNotPaidError,
    InsufficientStockError
)


class OrderService:
    """
    Service for managing order lifecycle.
    
    All state changes go through this service to ensure:
    - FSM transitions are valid
    - Business rules are enforced
    - Events are emitted
    - Inventory is properly managed
    """
    
    def __init__(self, unit_of_work, inventory_service=None):
        self.uow = unit_of_work
        self.inventory = inventory_service
    
    # ============================================
    # ORDER CREATION
    # ============================================
    
    def create_order(
        self,
        customer_id: UUID,
        order_number: str,
        installation_address: Optional[Dict[str, str]] = None,
        items: Optional[List[Dict[str, Any]]] = None,
        measurements: Optional[List[Dict[str, Any]]] = None,
        quote_id: Optional[UUID] = None,
        notes: str = "",
        created_by: Optional[UUID] = None,
        planned_completion: Optional[str] = None
    ) -> Order:
        """
        Create new order in DRAFT status.
        
        Args:
            customer_id: UUID of customer
            order_number: Unique order number (О-YYYY-NNN format)
            installation_address: Dict with city, street, building, apartment, notes
            items: List of order items (optional at creation)
            measurements: List of measurements (optional at creation)
            quote_id: Reference to approved quote (optional)
            notes: Order notes
            created_by: UUID of creating user
            planned_completion: Planned completion date (optional, ISO format string)
        
        Returns:
            Created Order
        
        Raises:
            OrderValidationError: If validation fails
        """
        # Validate customer exists
        try:
            customer = Customer.objects.get(pk=customer_id, is_active=True)
        except Customer.DoesNotExist:
            raise OrderValidationError(f"Customer {customer_id} not found or inactive")
        
        # Validate order number format
        if not self._validate_order_number(order_number):
            raise OrderValidationError(f"Invalid order number format: {order_number}")
        
        # Check order number uniqueness
        if Order.objects.filter(order_number=order_number).exists():
            raise OrderValidationError(f"Order number {order_number} already exists")
        
        # Calculate total from items if provided
        total_amount = Decimal('0')
        order_items_data = []
        
        if items:
            for item_data in items:
                item_total = self._calculate_item_total(item_data)
                total_amount += item_total
                order_items_data.append({
                    **item_data,
                    'total_price': item_total
                })
        
        # Create order
        order = Order.objects.create(
            order_number=order_number,
            customer=customer,
            status=Order.Status.DRAFT,
            total_amount=total_amount,
            quote_id=quote_id,
            notes=notes,
            created_by_id=created_by,
            planned_completion=planned_completion,
            **self._parse_address(installation_address or {})
        )
        
        # Create order items
        if order_items_data:
            for item_data in order_items_data:
                OrderItem.objects.create(
                    order=order,
                    **self._parse_item_data(item_data)
                )
        
        # Create measurements
        if measurements:
            for measurement_data in measurements:
                Measurement.objects.create(
                    order=order,
                    **measurement_data
                )
        
        # Emit event
        self.uow.register_event(OrderCreated(
            metadata=EventMetadata(
                event_id=uuid4(),
                timestamp=timezone.now(),
                user_id=created_by
            ),
            order_id=order.id,
            order_number=order_number,
            customer_id=customer_id,
            customer_name=customer.full_name,
            total_amount=total_amount,
            created_by=created_by
        ))
        
        return order
    
    def create_order_from_quote(
        self,
        quote_id: UUID,
        order_number: str,
        installation_address: Optional[Dict[str, str]] = None,
        notes: str = "",
        created_by: Optional[UUID] = None
    ) -> Order:
        """
        Create order from approved quote.
        This is the standard flow for converting a quote to an order.
        """
        try:
            quote = Quote.objects.select_related('customer').get(
                pk=quote_id,
                status=Quote.Status.APPROVED
            )
        except Quote.DoesNotExist:
            raise OrderValidationError(f"Quote {quote_id} not found or not approved")
        
        # Copy items from quote
        items = []
        for quote_item in quote.items.all():
            items.append({
                'item_type': 'fabric' if quote_item.fabric else 'cornice' if quote_item.cornice else 'service',
                'fabric_id': quote_item.fabric_id,
                'cornice_id': quote_item.cornice_id,
                'quantity': quote_item.fabric_meters if quote_item.fabric else 1,
                'unit_price': quote_item.fabric.price_per_meter if quote_item.fabric else Decimal('0'),
                'total_price': quote_item.line_total,
                'sewing_type': quote_item.sewing_type,
                'window_width_cm': quote_item.window_width_cm,
                'window_height_cm': quote_item.window_height_cm,
                'folds_count': quote_item.folds_count,
            })
        
        # Use quote customer and default address
        customer_id = quote.customer_id
        
        return self.create_order(
            customer_id=customer_id,
            order_number=order_number,
            installation_address=installation_address,
            items=items,
            quote_id=quote_id,
            notes=notes,
            created_by=created_by
        )
    
    # ============================================
    # CONFIRM ORDER (APPROVE QUOTE)
    # ============================================
    
    def confirm_order(
        self,
        order_id: UUID,
        confirmed_by: Optional[UUID] = None
    ) -> Order:
        """
        Confirm order (customer approved quote).
        Transition: QUOTED → APPROVED
        
        Args:
            order_id: UUID of order
            confirmed_by: UUID of user confirming
        
        Returns:
            Updated Order
        """
        order = self._get_order_for_update(order_id)
        
        # FSM validation
        self._validate_transition(order, Order.Status.APPROVED)
        
        old_status = order.status
        
        # Update status
        order.status = Order.Status.APPROVED
        order.save(update_fields=['status', 'updated_at'])
        
        # Create history entry
        self._create_status_history(order, old_status, order.status, confirmed_by, "Customer approved quote")
        
        # Emit events
        self.uow.register_event(OrderStatusChanged(
            order_id=order.id,
            old_status=old_status,
            new_status=order.status,
            changed_by=str(confirmed_by) if confirmed_by else None,
            reason="Customer approved quote"
        ))
        
        self.uow.register_event(OrderConfirmed(
            order_id=order.id,
            customer_id=order.customer_id,
            quote_id=order.quote_id
        ))
        
        return order
    
    # ============================================
    # RESERVE MATERIALS
    # ============================================
    
    def reserve_materials(
        self,
        order_id: UUID,
        fabric_reservations: Optional[List[Dict[str, Any]]] = None,
        skip_inventory_check: bool = False,
        reserved_by: Optional[UUID] = None
    ) -> Tuple[Order, List[Any]]:
        """
        Reserve materials for order.
        Required before production can start.
        
        Transition: APPROVED/PREPAYMENT_RECEIVED → FABRIC_RESERVED
        
        Args:
            order_id: UUID of order
            fabric_reservations: List of {fabric_id, meters} to reserve
                                 If None, reserves based on order items
            skip_inventory_check: If True, doesn't check availability (for admin override)
            reserved_by: UUID of user
        
        Returns:
            Tuple of (updated Order, list of reservations)
        
        Raises:
            InsufficientStockError: If not enough inventory
        """
        if not self.inventory:
            raise OrderValidationError("Inventory service required for material reservation")
        
        order = self._get_order_for_update(order_id)
        
        # FSM: Can reserve from APPROVED or PREPAYMENT_RECEIVED
        if order.status not in (Order.Status.APPROVED, Order.Status.PREPAYMENT_RECEIVED):
            raise InvalidOrderStatusTransition(
                order.status,
                Order.Status.FABRIC_RESERVED,
                OrderFSMRules.get_allowed_transitions(order.status)
            )
        
        # Determine what to reserve
        if fabric_reservations is None:
            # Auto-reserve from order items
            fabric_items = self._extract_fabric_items(order)
        else:
            fabric_items = fabric_reservations
        
        # Check availability
        if not skip_inventory_check:
            availability = self.inventory.check_bulk_availability(fabric_items)
            unavailable = [
                item for item in fabric_items 
                if not availability.get(item['fabric_id'])
            ]
            if unavailable:
                raise InsufficientStockError(
                    item_name="Multiple fabrics",
                    requested=0,
                    available=0
                )
        
        # Acquire locks and reserve
        from .unit_of_work import LockManager
        lock_keys = [(item['fabric_id'], item['meters']) for item in fabric_items]
        
        # Reserve all fabrics
        reservations = self.inventory.reserve_fabrics_for_order(
            order_id=order_id,
            fabric_items=fabric_items,
            reserved_by=reserved_by
        )
        
        # Also allocate cornices (immediate deduction)
        cornice_items = self._extract_cornice_items(order)
        for item in cornice_items:
            self.inventory.allocate_cornice(
                cornice_id=item['cornice_id'],
                order_id=order_id,
                quantity=item['quantity']
            )
        
        old_status = order.status
        
        # Update order status
        order.status = Order.Status.FABRIC_RESERVED
        order.save(update_fields=['status', 'updated_at'])
        
        # Create history
        self._create_status_history(order, old_status, order.status, reserved_by, "Materials reserved")
        
        # Emit events
        self.uow.register_event(OrderStatusChanged(
            order_id=order.id,
            old_status=old_status,
            new_status=order.status,
            changed_by=str(reserved_by) if reserved_by else None,
            reason="Materials reserved"
        ))
        
        self.uow.register_event(OrderMaterialsReserved(
            order_id=order.id,
            fabric_reservations=[
                {
                    'fabric_id': r.fabric_id,
                    'reserved_meters': str(r.reserved_meters),
                    'reservation_id': r.id
                }
                for r in reservations
            ],
            cornice_allocations=[
                {
                    'cornice_id': item['cornice_id'],
                    'quantity': item['quantity']
                }
                for item in cornice_items
            ]
        ))
        
        return order, reservations
    
    # ============================================
    # START PRODUCTION
    # ============================================
    
    def start_production(
        self,
        order_id: UUID,
        assigned_to: Optional[UUID] = None,
        deadline: Optional[date] = None,
        complexity: str = 'medium',
        started_by: Optional[UUID] = None
    ) -> Order:
        """
        Start production on order.
        Converts reservations to actual deductions.
        
        Transition: FABRIC_RESERVED → PRODUCTION
        
        INVARIANT: Materials must be reserved before production starts
        
        Args:
            order_id: UUID of order
            assigned_to: UUID of seamstress
            deadline: Production deadline
            complexity: Complexity level (low/medium/high)
            started_by: UUID of user
        
        Returns:
            Updated Order
        """
        if not self.inventory:
            raise OrderValidationError("Inventory service required")
        
        order = self._get_order_for_update(order_id)
        
        # FSM validation
        self._validate_transition(order, Order.Status.PRODUCTION)
        
        # INVARIANT: Must be in FABRIC_RESERVED status
        if order.status != Order.Status.FABRIC_RESERVED:
            raise OrderValidationError(
                f"Cannot start production from status {order.status}. "
                "Materials must be reserved first."
            )
        
        # Check for active reservations
        active_reservations = order.fabric_reservations.filter(
            status='active'
        ).count()
        
        if active_reservations == 0:
            raise OrderValidationError(
                "No active material reservations found. "
                "Reserve materials before starting production."
            )
        
        # Convert all reservations to deductions
        converted = self.inventory.convert_all_reservations(order_id)
        
        if not converted:
            raise OrderValidationError("Failed to convert material reservations")
        
        old_status = order.status
        
        # Update order status
        order.status = Order.Status.PRODUCTION
        order.save(update_fields=['status', 'updated_at'])
        
        # Create production assignment
        from ..models import ProductionAssignment
        assignment = ProductionAssignment.objects.create(
            order=order,
            assigned_to_id=assigned_to,
            deadline=deadline,
            complexity=complexity,
            status=ProductionAssignment.Status.ASSIGNED,
            created_by_id=started_by
        )
        
        # Create history
        self._create_status_history(
            order, old_status, order.status, started_by, 
            f"Production started, assigned to {assigned_to}"
        )
        
        # Emit events
        self.uow.register_event(OrderStatusChanged(
            order_id=order.id,
            old_status=old_status,
            new_status=order.status,
            changed_by=str(started_by) if started_by else None,
            reason="Production started"
        ))
        
        self.uow.register_event(OrderProductionStarted(
            order_id=order.id,
            assigned_to=assigned_to,
            deadline=deadline.isoformat() if deadline else None
        ))
        
        return order
    
    # ============================================
    # COMPLETE ORDER
    # ============================================
    
    def complete_order(
        self,
        order_id: UUID,
        installation_date: Optional[date] = None,
        completed_by: Optional[UUID] = None
    ) -> Order:
        """
        Complete order.
        INVARIANT: Must be fully paid to complete.
        
        Transition: INSTALLATION → COMPLETED
        
        Args:
            order_id: UUID of order
            installation_date: Date of installation
            completed_by: UUID of user
        
        Returns:
            Updated Order
        
        Raises:
            OrderNotPaidError: If order not fully paid
        """
        order = self._get_order_for_update(order_id)
        
        # FSM validation
        self._validate_transition(order, Order.Status.COMPLETED)
        
        # INVARIANT: Must be fully paid
        if not order.is_fully_paid:
            raise OrderNotPaidError(
                f"Cannot complete order: not fully paid. "
                f"Remaining: {order.remaining_amount}"
            )
        
        # INVARIANT: Must be in INSTALLATION status
        if order.status != Order.Status.INSTALLATION:
            raise InvalidOrderStatusTransition(
                order.status,
                Order.Status.COMPLETED,
                OrderFSMRules.get_allowed_transitions(order.status)
            )
        
        old_status = order.status
        
        # Update order
        order.status = Order.Status.COMPLETED
        order.actual_completion = timezone.now().date()
        if installation_date:
            order.installation_date = installation_date
        order.save(update_fields=['status', 'actual_completion', 'installation_date', 'updated_at'])
        
        # Create history
        self._create_status_history(order, old_status, order.status, completed_by, "Order completed")
        
        # Emit events
        self.uow.register_event(OrderStatusChanged(
            order_id=order.id,
            old_status=old_status,
            new_status=order.status,
            changed_by=str(completed_by) if completed_by else None,
            reason="Order completed"
        ))
        
        self.uow.register_event(OrderCompleted(
            order_id=order.id,
            customer_id=order.customer_id,
            completion_date=order.actual_completion.isoformat(),
            total_amount=str(order.total_amount),
            total_paid=str(order.paid_amount)
        ))
        
        return order
    
    # ============================================
    # CANCEL ORDER
    # ============================================
    
    def cancel_order(
        self,
        order_id: UUID,
        reason: str,
        cancelled_by: Optional[UUID] = None,
        force: bool = False
    ) -> Order:
        """
        Cancel order.
        Returns inventory to stock.
        
        INVARIANT: Cannot cancel COMPLETED orders.
        INVARIANT: Cannot cancel already CANCELLED orders.
        
        Transition: Any (except COMPLETED/CANCELLED) → CANCELLED
        
        Args:
            order_id: UUID of order
            reason: Reason for cancellation
            cancelled_by: UUID of user
            force: If True, allows cancelling even with payments (requires admin)
        
        Returns:
            Updated Order
        """
        if not reason:
            raise OrderValidationError("Cancellation reason is required")
        
        if not self.inventory:
            raise OrderValidationError("Inventory service required")
        
        order = self._get_order_for_update(order_id)
        
        # INVARIANT: Cannot cancel completed orders
        if order.status == Order.Status.COMPLETED:
            raise OrderCancellationError("Cannot cancel completed orders")
        
        # INVARIANT: Cannot cancel already cancelled orders
        if order.status == Order.Status.CANCELLED:
            raise OrderCancellationError("Order is already cancelled")
        
        # Check for payments (unless force=True)
        if order.paid_amount > 0 and not force:
            raise OrderCancellationError(
                f"Cannot cancel order with payments ({order.paid_amount}). "
                "Use force=True for admin override or process refund first."
            )
        
        old_status = order.status
        inventory_to_release = []
        
        # Release reservations
        if old_status in (Order.Status.FABRIC_RESERVED, Order.Status.PREPAYMENT_RECEIVED):
            self.inventory.release_all_reservations(order_id)
            
            for item in order.items.all():
                if item.fabric_id and item.quantity:
                    inventory_to_release.append({
                        'type': 'fabric',
                        'id': item.fabric_id,
                        'quantity': str(item.quantity)
                    })
        
        # Return deducted stock (if in production or beyond)
        if old_status in (Order.Status.PRODUCTION, Order.Status.READY, 
                          Order.Status.INSTALLATION):
            for item in order.items.all():
                if item.fabric_id and item.quantity:
                    self.inventory.return_fabric_stock(
                        fabric_id=item.fabric_id,
                        order_id=order_id,
                        quantity=item.quantity
                    )
                    inventory_to_release.append({
                        'type': 'fabric',
                        'id': item.fabric_id,
                        'quantity': str(item.quantity)
                    })
                
                if item.cornice_id and item.quantity:
                    self.inventory.return_cornice_stock(
                        cornice_id=item.cornice_id,
                        order_id=order_id,
                        quantity=int(item.quantity)
                    )
                    inventory_to_release.append({
                        'type': 'cornice',
                        'id': item.cornice_id,
                        'quantity': str(int(item.quantity))
                    })
        
        # Update order
        order.status = Order.Status.CANCELLED
        order.save(update_fields=['status', 'updated_at'])
        
        # Create history
        self._create_status_history(order, old_status, order.status, cancelled_by, reason)
        
        # Emit events
        self.uow.register_event(OrderStatusChanged(
            order_id=order.id,
            old_status=old_status,
            new_status=order.status,
            changed_by=str(cancelled_by) if cancelled_by else None,
            reason=reason
        ))
        
        self.uow.register_event(OrderCancelled(
            order_id=order.id,
            reason=reason,
            cancelled_by=str(cancelled_by) if cancelled_by else None,
            inventory_to_release=inventory_to_release
        ))
        
        return order
    
    # ============================================
    # ADDITIONAL STATUS TRANSITIONS
    # ============================================
    
    def transition_status(
        self,
        order_id: UUID,
        new_status: str,
        changed_by: Optional[UUID] = None,
        notes: str = ""
    ) -> Order:
        """
        Generic status transition with FSM validation.
        Use for simpler transitions without business logic.
        """
        order = self._get_order_for_update(order_id)
        
        # Validate transition
        self._validate_transition(order, new_status)
        
        old_status = order.status
        
        order.status = new_status
        order.save(update_fields=['status', 'updated_at'])
        
        self._create_status_history(order, old_status, new_status, changed_by, notes)
        
        self.uow.register_event(OrderStatusChanged(
            metadata=EventMetadata(
                event_id=uuid4(),
                timestamp=timezone.now(),
                user_id=changed_by
            ),
            order_id=order.id,
            order_number=order.order_number,
            old_status=old_status,
            new_status=new_status,
            changed_by=changed_by,
            reason=notes
        ))
        
        return order
    
    def record_payment(
        self,
        order_id: UUID,
        amount: Decimal,
        payment_type: str,
        payment_method: str,
        received_by: Optional[UUID] = None,
        idempotency_key: Optional[str] = None,
        external_transaction_id: Optional[str] = None,
        notes: str = ""
    ) -> Tuple[Order, Payment]:
        """
        Record payment on order.
        May trigger status transitions (e.g., APPROVED → PREPAYMENT_RECEIVED).
        """
        order = self._get_order_for_update(order_id)
        
        # Validate amount
        if amount <= 0:
            raise OrderValidationError("Payment amount must be positive")
        
        # Check for duplicate (idempotency)
        if idempotency_key:
            existing = Payment.objects.filter(idempotency_key=idempotency_key).first()
            if existing:
                # Return existing payment without error (idempotent)
                return order, existing
        
        # Check overpayment
        new_total = order.paid_amount + amount
        if new_total > order.total_amount:
            raise OrderValidationError(
                f"Payment would exceed order total. "
                f"Remaining: {order.total_amount - order.paid_amount}"
            )
        
        # Create payment
        payment = Payment.objects.create(
            order=order,
            amount=amount,
            payment_type=payment_type,
            payment_method=payment_method,
            received_by_id=received_by,
            received_at=timezone.now(),
            idempotency_key=idempotency_key or "",
            external_transaction_id=external_transaction_id or "",
            notes=notes
        )
        
        # Update order paid amount
        order.paid_amount = models.F('paid_amount') + amount
        order.save(update_fields=['paid_amount', 'updated_at'])
        order.refresh_from_db()
        
        # Check for automatic status transition
        # If prepayment received, move to PREPAYMENT_RECEIVED
        if payment_type == Payment.PaymentType.PREPAYMENT and order.status == Order.Status.APPROVED:
            min_prepayment = order.total_amount * FinancialConfig.MIN_PREPAYMENT_PERCENT
            if order.paid_amount >= min_prepayment:
                self.transition_status(
                    order_id=order_id,
                    new_status=Order.Status.PREPAYMENT_RECEIVED,
                    changed_by=received_by,
                    notes=f"Prepayment received: {amount}"
                )
        
        # Emit event
        self.uow.register_event(OrderPaymentReceived(
            order_id=order.id,
            payment_id=payment.id,
            amount=str(amount),
            payment_type=payment_type,
            is_fully_paid=order.is_fully_paid
        ))
        
        return order, payment
    
    # ============================================
    # HELPER METHODS
    # ============================================
    
    def _get_order_for_update(self, order_id: UUID) -> Order:
        """Get order with lock for update"""
        try:
            return Order.objects.select_for_update().get(pk=order_id)
        except Order.DoesNotExist:
            raise OrderNotFoundError(f"Order {order_id} not found")
    
    def _validate_transition(self, order: Order, new_status: str):
        """Validate FSM transition"""
        if not OrderFSMRules.can_transition(order.status, new_status):
            raise InvalidOrderStatusTransition(
                order.status,
                new_status,
                OrderFSMRules.get_allowed_transitions(order.status)
            )
    
    def _create_status_history(
        self,
        order: Order,
        old_status: str,
        new_status: str,
        changed_by: Optional[UUID],
        notes: str
    ):
        """Create status history entry"""
        from ..models import OrderStatusHistory
        
        changed_by_name = None
        if changed_by:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.get(pk=changed_by)
                changed_by_name = user.get_full_name() or user.username
            except User.DoesNotExist:
                pass
        
        OrderStatusHistory.objects.create(
            order=order,
            old_status=old_status,
            new_status=new_status,
            changed_by_id=changed_by,
            changed_by_name=changed_by_name or "",
            notes=notes
        )
    
    def _parse_address(self, address: Dict[str, str]) -> Dict[str, str]:
        """Parse address dict to model fields"""
        return {
            'installation_address_city': address.get('city', ''),
            'installation_address_street': address.get('street', ''),
            'installation_address_building': address.get('building', ''),
            'installation_address_apartment': address.get('apartment', ''),
            'installation_address_notes': address.get('notes', ''),
        }
    
    def _parse_item_data(self, item_data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse order item data"""
        return {
            'item_type': item_data.get('item_type', 'fabric'),
            'fabric_id': item_data.get('fabric_id'),
            'cornice_id': item_data.get('cornice_id'),
            'service_id': item_data.get('service_id'),
            'quantity': item_data.get('quantity', Decimal('0')),
            'unit_price': item_data.get('unit_price', Decimal('0')),
            'total_price': item_data.get('total_price', Decimal('0')),
            'sewing_type': item_data.get('sewing_type', ''),
            'window_width_cm': item_data.get('window_width_cm'),
            'window_height_cm': item_data.get('window_height_cm'),
            'folds_count': item_data.get('folds_count', 0),
            'notes': item_data.get('notes', ''),
        }
    
    def _calculate_item_total(self, item_data: Dict[str, Any]) -> Decimal:
        """Calculate total for an item"""
        quantity = Decimal(str(item_data.get('quantity', 0)))
        unit_price = Decimal(str(item_data.get('unit_price', 0)))
        return quantity * unit_price
    
    def _extract_fabric_items(self, order: Order) -> List[Dict[str, Any]]:
        """Extract fabric items from order for reservation"""
        items = []
        for item in order.items.filter(item_type='fabric', fabric__isnull=False):
            items.append({
                'fabric_id': item.fabric_id,
                'meters': item.quantity
            })
        return items
    
    def _extract_cornice_items(self, order: Order) -> List[Dict[str, Any]]:
        """Extract cornice items from order for allocation"""
        items = []
        for item in order.items.filter(item_type='cornice', cornice__isnull=False):
            items.append({
                'cornice_id': item.cornice_id,
                'quantity': int(item.quantity)
            })
        return items
    
    @staticmethod
    def _validate_order_number(order_number: str) -> bool:
        """Validate order number format О-YYYY-NNN"""
        import re
        return bool(re.match(r'^О-\d{4}-\d{3}$', order_number))

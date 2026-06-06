"""
Order Service
Core business logic for order lifecycle management
Implements strict FSM and inventory integration
"""

import logging
from datetime import date, datetime
from decimal import Decimal

logger = logging.getLogger(__name__)
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID, uuid4

from django.db import models
from django.utils import timezone

from ..models import Order, OrderItem, Customer, Measurement, Payment, Quote, OrderMaterial
from ..constants import OrderFSMRules, FinancialConfig
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
        
        # Create order with NEW status for MVP workflow
        # Legacy DRAFT status is preserved for old tests but new orders use NEW
        order = Order.objects.create(
            order_number=order_number,
            customer=customer,
            status=Order.Status.NEW,
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

        P0: Each QuoteItem becomes 1 or 2 OrderItems:
        - Main fabric item (always if fabric exists), total_price = fabric_cost
        - Tulle fabric item (separate if tulle_fabric exists), total_price = tulle_cost
        Room/window context is preserved for production clarity.

        TODO Sprint 2+: Later split sewing/cornice/installation into separate
        execution/service items. For now, their costs stay in QuoteItem line_total
        and are not distributed to fabric/tulle OrderItems.
        """
        try:
            quote = Quote.objects.select_related('customer').prefetch_related('items').get(
                pk=quote_id,
                status=Quote.Status.APPROVED
            )
        except Quote.DoesNotExist:
            raise OrderValidationError(f"Quote {quote_id} not found or not approved")

        # Build items from quote items
        # Each quote_item can produce multiple order_items (fabric + tulle)
        items = []
        for quote_item in quote.items.all():
            base_context = {
                'room_name': quote_item.room_name,
                'window_name': quote_item.window_name,
                'window_width_cm': quote_item.window_width_cm,
                'window_height_cm': quote_item.window_height_cm,
                'folds_count': quote_item.folds_count,
                'sewing_type': quote_item.sewing_type,
            }

            # 1. Main fabric item (curtain / портьера)
            # P0: total_price = fabric_cost (no artificial split of sewing/etc.)
            if quote_item.fabric:
                items.append({
                    'item_type': 'fabric',
                    'fabric_id': quote_item.fabric_id,
                    'quantity': quote_item.fabric_meters,
                    'unit_price': quote_item.fabric.price_per_meter if quote_item.fabric else Decimal('0'),
                    'total_price': quote_item.fabric_cost,  # P0: exact fabric cost, no split
                    **base_context,
                    'notes': f"Основная ткань для {quote_item.window_name or 'окна'}",
                })

            # 2. Tulle fabric item (тюль) - separate OrderItem if exists
            # P0: total_price = tulle_cost (no artificial split of sewing/etc.)
            if quote_item.tulle_fabric:
                items.append({
                    'item_type': 'fabric',
                    'fabric_id': quote_item.tulle_fabric_id,
                    'quantity': quote_item.tulle_meters,
                    'unit_price': quote_item.tulle_fabric.price_per_meter if quote_item.tulle_fabric else Decimal('0'),
                    'total_price': quote_item.tulle_cost,  # P0: exact tulle cost, no split
                    **base_context,
                    'notes': f"Тюль для {quote_item.window_name or 'окна'}",
                })

            # 3. Cornice-only item (if no fabric but cornice exists)
            if quote_item.cornice and not quote_item.fabric:
                items.append({
                    'item_type': 'cornice',
                    'cornice_id': quote_item.cornice_id,
                    'quantity': 1,
                    'unit_price': quote_item.cornice_cost,
                    'total_price': quote_item.cornice_cost,
                    **base_context,
                    'notes': f"Карниз для {quote_item.window_name or 'окна'}",
                })

            # TODO Sprint 2+: Create separate OrderItems for:
            # - Sewing service (when sewing workflow is implemented)
            # - Installation service (when installation workflow is implemented)
            # - Additional services
            # For now, these costs stay in Quote financial totals.

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
        
        # Update order with cancellation info
        from django.utils import timezone
        order.status = Order.Status.CANCELLED
        order.cancel_reason = reason
        order.cancelled_at = timezone.now()
        order.cancelled_by_id = cancelled_by
        order.save(update_fields=['status', 'cancel_reason', 'cancelled_at', 'cancelled_by', 'updated_at'])
        
        # Create history
        self._create_status_history(order, old_status, order.status, cancelled_by, reason)
        
        
        
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
        
        
        return order
    
    def transition_status_mvp(
        self,
        order_id: UUID,
        new_status: str,
        changed_by: Optional[UUID] = None,
        notes: str = ""
    ) -> Order:
        """
        Status transition with MVP workflow business rules.
        Encapsulates all validation previously in the view layer.
        """
        from ..models import Quote, OrderCompletionAct
        from ..constants import MaterialReadiness, ProductionStage, HandoverStage

        order = self._get_order_for_update(order_id)

        # Cannot modify cancelled order
        if order.status == Order.Status.CANCELLED:
            raise OrderValidationError(
                "Нельзя изменить статус отменённого заказа.",
                code="cancelled_order"
            )

        # Cannot modify completed order
        if order.status == Order.Status.COMPLETED:
            raise OrderValidationError(
                "Нельзя изменить статус завершённого заказа.",
                code="completed_order"
            )

        # Check for accepted quote and order items for in_work transition
        if new_status == Order.Status.IN_WORK:
            has_accepted_quote = (
                (order.quote and order.quote.status == Quote.Status.APPROVED) or
                order.related_quotes.filter(status=Quote.Status.APPROVED).exists()
            )
            if not has_accepted_quote:
                raise OrderValidationError(
                    "Сначала примите КП и сформируйте позиции заказа.",
                    code="quote_not_accepted"
                )
            if order.items.count() == 0:
                raise OrderValidationError(
                    "Сначала сформируйте позиции заказа из КП.",
                    code="no_order_items"
                )

        # Cannot start production without materials and order items
        if new_status == Order.Status.IN_PRODUCTION:
            if order.material_readiness == MaterialReadiness.NOT_READY:
                raise OrderValidationError(
                    "Нельзя начать производство: материалы не обеспечены.",
                    code="material_not_ready"
                )
            if order.items.count() == 0:
                raise OrderValidationError(
                    "Сначала сформируйте позиции заказа из КП.",
                    code="no_order_items"
                )

        # Cannot mark ready if production not done
        if new_status == Order.Status.READY:
            if order.production_stage != ProductionStage.DONE:
                raise OrderValidationError(
                    "Нельзя отметить готовность: производство не завершено.",
                    code="production_not_done"
                )

        # Cannot complete if production not done, handover not done, no signed act, no photos, or not paid
        if new_status == Order.Status.COMPLETED:
            if order.production_stage != ProductionStage.DONE:
                raise OrderValidationError(
                    "Нельзя завершить заказ: производство не завершено.",
                    code="production_not_done"
                )
            if order.handover_stage not in [HandoverStage.DONE, HandoverStage.NOT_REQUIRED]:
                raise OrderValidationError(
                    "Нельзя завершить заказ: установка/выдача не завершена.",
                    code="handover_not_done"
                )
            if not order.photo_reports.filter(is_active=True).exists():
                raise OrderValidationError(
                    "Нельзя завершить заказ: требуется хотя бы один фотоотчёт.",
                    code="photo_report_required"
                )
            try:
                act = order.completion_act
                if not act.is_active or act.status != OrderCompletionAct.Status.SIGNED:
                    raise OrderValidationError(
                        "Нельзя завершить заказ: требуется подписанный АВР.",
                        code="signed_act_required"
                    )
            except OrderCompletionAct.DoesNotExist:
                raise OrderValidationError(
                    "Нельзя завершить заказ: требуется подписанный АВР.",
                    code="act_required"
                )
            balance_due = order.total_amount - order.paid_amount
            if balance_due > 0:
                exc = OrderValidationError(
                    f"Нельзя завершить заказ: требуется оплата {balance_due}.",
                    code="payment_required"
                )
                exc.balance_due = balance_due
                raise exc

        # Create materials from approved quote when transitioning to in_work
        if new_status == Order.Status.IN_WORK:
            try:
                order = self._get_order_for_update(order_id)
                self.create_materials_from_quote(order)
                order = self._get_order_for_update(order_id)
                self.recalculate_material_readiness(order)
            except Exception:
                pass

        return self.transition_status(
            order_id=order_id,
            new_status=new_status,
            changed_by=changed_by,
            notes=notes
        )

    def create_materials_from_quote(self, order: Order) -> None:
        """
        Create OrderMaterial records from approved quote items.
        Skips if materials already exist for this order.
        """
        if order.materials.exists():
            return

        approved_quote = order.related_quotes.filter(status=Quote.Status.APPROVED).order_by('-created_at').first()
        if not approved_quote:
            logger.warning(f"Order {order.id} ({order.order_number}): no approved quote found, materials not created")
            return

        materials_to_create = []
        for item in approved_quote.items.all():
            if item.fabric and item.fabric_meters and item.fabric_meters > 0:
                materials_to_create.append(OrderMaterial(
                    order=order,
                    name=item.fabric.name or 'Ткань',
                    material_type='fabric',
                    quantity=item.fabric_meters,
                    unit='м',
                    status=OrderMaterial.Status.TO_BUY,
                    source_quote_item=item,
                ))
            if item.tulle_fabric and item.tulle_meters and item.tulle_meters > 0:
                materials_to_create.append(OrderMaterial(
                    order=order,
                    name=item.tulle_fabric.name or 'Тюль',
                    material_type='tulle',
                    quantity=item.tulle_meters,
                    unit='м',
                    status=OrderMaterial.Status.TO_BUY,
                    source_quote_item=item,
                ))
            if item.cornice and item.cornice_length_m and item.cornice_length_m > 0:
                materials_to_create.append(OrderMaterial(
                    order=order,
                    name=item.cornice.name or 'Карниз',
                    material_type='cornice',
                    quantity=item.cornice_length_m,
                    unit='м',
                    status=OrderMaterial.Status.TO_BUY,
                    source_quote_item=item,
                ))

        if materials_to_create:
            OrderMaterial.objects.bulk_create(materials_to_create)

    def recalculate_material_readiness(self, order: Order) -> None:
        """
        Recalculate order.material_readiness based on OrderMaterial statuses.
        All READY => ready, all TO_BUY => not_ready, mixed => partially_ready
        """
        if not order.materials.exists():
            order.material_readiness = MaterialReadiness.NOT_READY
            order.save(update_fields=['material_readiness'])
            return

        statuses = set(order.materials.values_list('status', flat=True))

        if statuses == {OrderMaterial.Status.READY}:
            order.material_readiness = MaterialReadiness.READY
        elif statuses == {OrderMaterial.Status.TO_BUY}:
            order.material_readiness = MaterialReadiness.NOT_READY
        else:
            order.material_readiness = MaterialReadiness.PARTIALLY_READY

        order.save(update_fields=['material_readiness'])

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
        
        
        return order, payment
    
    # ============================================
    # EXECUTION STAGE MANAGEMENT (delegates to OrderExecutionService)
    # ============================================
    
    def change_material_readiness(
        self,
        order_id: UUID,
        material_readiness: str,
        changed_by: Optional[UUID] = None,
        notes: str = ""
    ) -> Tuple[Order, List[str]]:
        """
        Change order material readiness state.
        Delegates to OrderExecutionService.
        
        Args:
            order_id: UUID of order
            material_readiness: New readiness state (not_ready/partially_ready/ready)
            changed_by: UUID of user making change
            notes: Optional notes
        
        Returns:
            Tuple of (updated_order, warnings)
        """
        from .order_execution_service import OrderExecutionService
        
        order = self._get_order_for_update(order_id)
        exec_service = OrderExecutionService(order_service=self)
        
        return exec_service.change_material_readiness(
            order=order,
            material_readiness=material_readiness,
            changed_by=changed_by,
            notes=notes
        )
    
    def change_production_stage(
        self,
        order_id: UUID,
        production_stage: str,
        changed_by: Optional[UUID] = None,
        notes: str = ""
    ) -> Order:
        """
        Change order production stage.
        Delegates to OrderExecutionService.
        
        Args:
            order_id: UUID of order
            production_stage: New stage (not_started/cutting/sewing/quality_check/done)
            changed_by: UUID of user making change
            notes: Optional notes
        
        Returns:
            Updated order
        """
        from .order_execution_service import OrderExecutionService
        
        order = self._get_order_for_update(order_id)
        exec_service = OrderExecutionService(order_service=self)
        
        return exec_service.change_production_stage(
            order=order,
            production_stage=production_stage,
            changed_by=changed_by,
            notes=notes
        )
    
    def change_handover_stage(
        self,
        order_id: UUID,
        handover_stage: str,
        changed_by: Optional[UUID] = None,
        notes: str = ""
    ) -> Tuple[Order, bool]:
        """
        Change order handover stage.
        Delegates to OrderExecutionService.
        
        Args:
            order_id: UUID of order
            handover_stage: New stage (not_required/pending/scheduled/in_progress/done)
            changed_by: UUID of user making change
            notes: Optional notes
        
        Returns:
            Tuple of (updated_order, can_auto_complete)
            can_auto_complete is True if handover is done AND fully paid
        """
        from .order_execution_service import OrderExecutionService
        
        order = self._get_order_for_update(order_id)
        exec_service = OrderExecutionService(order_service=self)
        
        return exec_service.change_handover_stage(
            order=order,
            handover_stage=handover_stage,
            changed_by=changed_by,
            notes=notes
        )
    
    def get_order_workflow_summary(self, order_id: UUID) -> Dict[str, Any]:
        """
        Get complete workflow summary for an order.
        Delegates to OrderExecutionService.
        
        Args:
            order_id: UUID of order
        
        Returns:
            Dict with status_info, payment_info, material_info, production_info,
            handover_info, blockers, and warnings
        """
        from .order_execution_service import OrderExecutionService
        
        order = self._get_order_for_update(order_id)
        exec_service = OrderExecutionService(order_service=self)
        
        return exec_service.get_order_workflow_summary(order)
    
    def get_available_order_actions(self, order_id: UUID) -> List[Dict[str, Any]]:
        """
        Get available actions for current order state.
        Delegates to OrderExecutionService.
        
        Args:
            order_id: UUID of order
        
        Returns:
            List of action dicts with action, label, description, required, disabled_reason
        """
        from .order_execution_service import OrderExecutionService
        
        order = self._get_order_for_update(order_id)
        exec_service = OrderExecutionService(order_service=self)
        
        return exec_service.get_available_order_actions(order)
    
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
        """Parse order item data with room/window context"""
        return {
            'item_type': item_data.get('item_type', 'fabric'),
            'fabric_id': item_data.get('fabric_id'),
            'cornice_id': item_data.get('cornice_id'),
            'service_id': item_data.get('service_id'),
            'quantity': item_data.get('quantity', Decimal('0')),
            'unit_price': item_data.get('unit_price', Decimal('0')),
            'total_price': item_data.get('total_price', Decimal('0')),
            # Room/window context from QuoteItem
            'room_name': item_data.get('room_name', ''),
            'window_name': item_data.get('window_name', ''),
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

"""
Service Layer Tests - Business Logic
"""

import pytest
from decimal import Decimal
from uuid import uuid4

from atelier_erp.models import Order, Fabric, FabricReservation
from atelier_erp.services import (
    OrderService, InventoryService, PaymentService,
    TaskService, UnitOfWork
)
from atelier_erp.services.exceptions import (
    OrderNotFoundError, InvalidOrderStatusTransition,
    InsufficientStockError, InvalidPaymentAmount
)


@pytest.mark.django_db
class TestOrderService:
    """Order lifecycle tests"""
    
    def test_create_order(self, unit_of_work, customer):
        """Test order creation"""
        service = OrderService(unit_of_work)
        
        with unit_of_work.atomic():
            order = service.create_order(
                customer_id=customer.id,
                order_number='О-2024-TEST',
                items=[]
            )
        
        assert order.status == Order.Status.DRAFT
        assert order.customer == customer
    
    def test_invalid_status_transition(self, unit_of_work, draft_order):
        """Test invalid FSM transition rejected"""
        service = OrderService(unit_of_work)
        
        with pytest.raises(InvalidOrderStatusTransition):
            with unit_of_work.atomic():
                service.update_status(
                    order_id=draft_order.id,
                    new_status=Order.Status.COMPLETED,
                    changed_by='test'
                )
    
    def test_valid_status_transition(self, unit_of_work, draft_order):
        """Test valid FSM transition"""
        service = OrderService(unit_of_work)
        
        with unit_of_work.atomic():
            service.update_status(
                order_id=draft_order.id,
                new_status=Order.Status.APPROVED,
                changed_by='test'
            )
        
        draft_order.refresh_from_db()
        assert draft_order.status == Order.Status.APPROVED
    
    def test_complete_without_payment_fails(self, unit_of_work, confirmed_order):
        """Test cannot complete unpaid order"""
        service = OrderService(unit_of_work)
        
        with pytest.raises(Exception):  # OrderNotPaidError
            with unit_of_work.atomic():
                service.complete_order(
                    order_id=confirmed_order.id,
                    completed_by=None
                )


@pytest.mark.django_db
class TestInventoryService:
    """Inventory management tests"""
    
    def test_reserve_fabric_success(self, unit_of_work, fabric, draft_order):
        """Test successful fabric reservation"""
        service = InventoryService(unit_of_work)
        initial_available = fabric.available_meters
        
        with unit_of_work.atomic():
            reservation = service.reserve_fabric(
                fabric_id=fabric.id,
                order_id=draft_order.id,
                meters=Decimal('10.00'),
                reserved_by=None
            )
        
        fabric.refresh_from_db()
        assert fabric.reserved_meters == Decimal('10.00')
        assert fabric.available_meters == initial_available - Decimal('10.00')
        assert reservation.status == FabricReservation.Status.ACTIVE
    
    def test_reserve_insufficient_stock_fails(self, unit_of_work, fabric, draft_order):
        """Test reservation with insufficient stock fails"""
        service = InventoryService(unit_of_work)
        
        with pytest.raises(InsufficientStockError):
            with unit_of_work.atomic():
                service.reserve_fabric(
                    fabric_id=fabric.id,
                    order_id=draft_order.id,
                    meters=Decimal('100.00'),  # More than available
                    reserved_by=None
                )
    
    def test_release_reservation_restores_stock(self, unit_of_work, fabric, draft_order):
        """Test releasing reservation restores stock"""
        service = InventoryService(unit_of_work)
        
        # First reserve
        with unit_of_work.atomic():
            reservation = service.reserve_fabric(
                fabric_id=fabric.id,
                order_id=draft_order.id,
                meters=Decimal('10.00'),
                reserved_by=None
            )
        
        initial_available = fabric.available_meters
        
        # Then release
        with unit_of_work.atomic():
            service.cancel_reservation(
                reservation_id=reservation.id,
                reason='test cancel'
            )
        
        fabric.refresh_from_db()
        assert fabric.reserved_meters == Decimal('0.00')
    
    def test_low_stock_detection(self, unit_of_work, low_stock_fabric):
        """Test low stock detection"""
        service = InventoryService(unit_of_work)
        
        low_stock = service.detect_low_stock(threshold=Decimal('10.00'))
        fabric_ids = [f.id for f in low_stock]
        
        assert low_stock_fabric.id in fabric_ids


@pytest.mark.django_db
class TestPaymentService:
    """Payment processing tests"""
    
    def test_record_payment_success(self, unit_of_work, confirmed_order):
        """Test successful payment recording"""
        service = PaymentService(unit_of_work)
        
        with unit_of_work.atomic():
            payment = service.record_payment(
                order_id=confirmed_order.id,
                amount=Decimal('25000.00'),
                payment_type='prepayment',
                payment_method='cash',
                received_by=None
            )
        
        assert payment.amount == Decimal('25000.00')
        assert payment.payment_type == 'prepayment'
    
    def test_overpayment_rejected(self, unit_of_work, confirmed_order):
        """Test overpayment is rejected"""
        service = PaymentService(unit_of_work)
        
        with pytest.raises(InvalidPaymentAmount):
            with unit_of_work.atomic():
                service.record_payment(
                    order_id=confirmed_order.id,
                    amount=Decimal('100000.00'),  # More than order total
                    payment_type='final',
                    payment_method='cash',
                    received_by=None
                )
    
    def test_duplicate_payment_prevented(self, unit_of_work, confirmed_order):
        """Test duplicate payment is prevented"""
        service = PaymentService(unit_of_work)
        
        # First payment
        with unit_of_work.atomic():
            service.record_payment(
                order_id=confirmed_order.id,
                amount=Decimal('10000.00'),
                payment_type='prepayment',
                payment_method='cash',
                received_by=None,
                reference_number='REF-001'
            )
        
        # Duplicate payment with same reference
        with pytest.raises(Exception):  # DuplicatePaymentError
            with unit_of_work.atomic():
                service.record_payment(
                    order_id=confirmed_order.id,
                    amount=Decimal('10000.00'),
                    payment_type='prepayment',
                    payment_method='cash',
                    received_by=None,
                    reference_number='REF-001'  # Same reference
                )


@pytest.mark.django_db
class TestTaskService:
    """Task management tests"""
    
    def test_create_task(self, unit_of_work):
        """Test task creation"""
        service = TaskService(unit_of_work)
        
        with unit_of_work.atomic():
            task = service.create_task(
                client_name='Тест Клиент',
                client_phone='+7 777 000 0000',
                source='website',
                description='Тестовая задача'
            )
        
        assert task.status == 'lead'
        assert task.client_name == 'Тест Клиент'
    
    def test_task_conversion(self, unit_of_work, task, customer):
        """Test task to order conversion"""
        service = TaskService(unit_of_work)
        
        with unit_of_work.atomic():
            order = service.convert_to_order(
                task_id=task.id,
                customer_id=customer.id
            )
        
        task.refresh_from_db()
        assert task.status == 'converted'
        assert task.converted_to_order == order


@pytest.mark.django_db
class TestUnitOfWork:
    """Transaction and event tests"""
    
    def test_events_dispatched_on_commit(self, unit_of_work, fabric, draft_order):
        """Test events dispatched after successful commit"""
        from atelier_erp.events import FabricReserved
        
        service = InventoryService(unit_of_work)
        
        with unit_of_work.atomic():
            service.reserve_fabric(
                fabric_id=fabric.id,
                order_id=draft_order.id,
                meters=Decimal('5.00'),
                reserved_by=None
            )
        
        # Events should be dispatched
        # (In real test, would verify event handler called)
    
    def test_events_cleared_on_rollback(self, unit_of_work, fabric, draft_order):
        """Test events not dispatched on rollback"""
        service = InventoryService(unit_of_work)
        
        try:
            with unit_of_work.atomic():
                service.reserve_fabric(
                    fabric_id=fabric.id,
                    order_id=draft_order.id,
                    meters=Decimal('5.00'),
                    reserved_by=None
                )
                raise Exception('Force rollback')
        except Exception:
            pass
        
        fabric.refresh_from_db()
        # Reservation should not exist
        assert fabric.reserved_meters == Decimal('0.00')


@pytest.mark.django_db
class TestOrderExecutionService:
    """Order execution workflow tests"""
    
    def test_cancel_active_order(self, draft_order):
        """Test cancelling an active order"""
        from atelier_erp.services.order_execution_service import OrderExecutionService
        from atelier_erp.services.exceptions import OrderValidationError
        
        service = OrderExecutionService()
        
        cancelled_order = service.cancel_order(
            order=draft_order,
            reason="Клиент отказался",
            user=None
        )
        
        assert cancelled_order.status == Order.Status.CANCELLED
        assert cancelled_order.cancel_reason == "Клиент отказался"
        assert cancelled_order.cancelled_at is not None
    
    def test_cannot_cancel_completed_order(self, completed_order):
        """Test cannot cancel completed order"""
        from atelier_erp.services.order_execution_service import OrderExecutionService
        from atelier_erp.services.exceptions import OrderValidationError
        
        service = OrderExecutionService()
        
        with pytest.raises(OrderValidationError) as exc_info:
            service.cancel_order(
                order=completed_order,
                reason="Пытаемся отменить завершённый",
                user=None
            )
        
        assert "завершённый" in str(exc_info.value) or "completed" in str(exc_info.value).lower()
    
    def test_cannot_cancel_already_cancelled(self, cancelled_order):
        """Test cannot cancel already cancelled order"""
        from atelier_erp.services.order_execution_service import OrderExecutionService
        from atelier_erp.services.exceptions import OrderValidationError
        
        service = OrderExecutionService()
        
        with pytest.raises(OrderValidationError) as exc_info:
            service.cancel_order(
                order=cancelled_order,
                reason="Повторная отмена",
                user=None
            )
        
        assert "уже отменён" in str(exc_info.value) or "already" in str(exc_info.value).lower()
    
    def test_cancel_requires_reason(self, draft_order):
        """Test cancel requires non-empty reason"""
        from atelier_erp.services.order_execution_service import OrderExecutionService
        from atelier_erp.services.exceptions import OrderValidationError
        
        service = OrderExecutionService()
        
        with pytest.raises(OrderValidationError) as exc_info:
            service.cancel_order(
                order=draft_order,
                reason="",
                user=None
            )
        
        assert "Причина" in str(exc_info.value) or "reason" in str(exc_info.value).lower()
    
    def test_cancel_sets_cancelled_by(self, draft_order, admin_user):
        """Test cancel sets cancelled_by if user provided"""
        from atelier_erp.services.order_execution_service import OrderExecutionService
        
        service = OrderExecutionService()
        
        cancelled_order = service.cancel_order(
            order=draft_order,
            reason="Тест отмены",
            user=admin_user
        )
        
        assert cancelled_order.cancelled_by == admin_user


@pytest.mark.django_db
class TestOrderExecutionServiceMaterialReadiness:
    """Tests for OrderExecutionService.change_material_readiness method"""
    
    @pytest.fixture
    def service(self):
        from atelier_erp.services.order_execution_service import OrderExecutionService
        return OrderExecutionService()
    
    @pytest.fixture
    def customer(self):
        from atelier_erp.models import Customer
        return Customer.objects.create(
            full_name="Тест Клиент",
            phone="+77001234567"
        )
    
    @pytest.fixture
    def draft_order(self, customer):
        from atelier_erp.models import Order
        return Order.objects.create(
            customer=customer,
            status=Order.Status.NEW,
            total_amount=Decimal("100000.00"),
            material_readiness="not_ready"
        )
    
    @pytest.fixture
    def in_production_order(self, customer):
        from atelier_erp.models import Order
        return Order.objects.create(
            customer=customer,
            status=Order.Status.IN_PRODUCTION,
            total_amount=Decimal("100000.00"),
            material_readiness="partially_ready"
        )
    
    @pytest.fixture
    def completed_order(self, customer):
        from atelier_erp.models import Order
        return Order.objects.create(
            customer=customer,
            status=Order.Status.COMPLETED,
            total_amount=Decimal("100000.00"),
            material_readiness="ready"
        )
    
    @pytest.fixture
    def cancelled_order(self, customer):
        from atelier_erp.models import Order
        return Order.objects.create(
            customer=customer,
            status=Order.Status.CANCELLED,
            total_amount=Decimal("100000.00"),
            material_readiness="not_ready"
        )
    
    def test_can_change_material_readiness_in_in_production(self, service, in_production_order):
        """Test that material_readiness can be changed in in_production status"""
        order, warnings = service.change_material_readiness(
            order=in_production_order,
            material_readiness="ready"
        )
        
        assert order.material_readiness == 'ready'
        in_production_order.refresh_from_db()
        assert in_production_order.material_readiness == 'ready'
    
    def test_can_change_material_readiness_to_not_ready_in_production(self, service, in_production_order):
        """Test that material_readiness can be changed to not_ready even in production"""
        in_production_order.material_readiness = 'ready'
        in_production_order.save()
        
        order, warnings = service.change_material_readiness(
            order=in_production_order,
            material_readiness="not_ready"
        )
        
        assert order.material_readiness == 'not_ready'
        assert len(warnings) == 0  # not_ready doesn't generate warnings, only partially_ready does
    
    def test_can_change_material_readiness_in_new_status(self, service, draft_order):
        """Test that material_readiness can be changed in NEW status"""
        order, warnings = service.change_material_readiness(
            order=draft_order,
            material_readiness="partially_ready"
        )
        
        assert order.material_readiness == 'partially_ready'
        draft_order.refresh_from_db()
        assert draft_order.material_readiness == 'partially_ready'
    
    def test_cannot_change_material_readiness_for_completed_order(self, service, completed_order):
        """Test that material_readiness cannot be changed for completed order"""
        from atelier_erp.services.exceptions import OrderValidationError
        
        with pytest.raises(OrderValidationError) as exc_info:
            service.change_material_readiness(
                order=completed_order,
                material_readiness="not_ready"
            )
        
        assert "Cannot modify completed order" in str(exc_info.value)
    
    def test_cannot_change_material_readiness_for_cancelled_order(self, service, cancelled_order):
        """Test that material_readiness cannot be changed for cancelled order"""
        from atelier_erp.services.exceptions import OrderValidationError
        
        with pytest.raises(OrderValidationError) as exc_info:
            service.change_material_readiness(
                order=cancelled_order,
                material_readiness="ready"
            )
        
        assert "Cannot modify cancelled order" in str(exc_info.value)
    
    def test_returns_warning_for_partial_readiness(self, service, draft_order):
        """Test that partial readiness returns a warning"""
        order, warnings = service.change_material_readiness(
            order=draft_order,
            material_readiness="partially_ready"
        )
        
        assert len(warnings) > 0
        assert any("частично" in w.lower() for w in warnings)
    
    def test_can_change_to_ready_in_in_production(self, service, in_production_order):
        """Test changing material_readiness to ready during production"""
        order, warnings = service.change_material_readiness(
            order=in_production_order,
            material_readiness="ready"
        )
        
        assert order.material_readiness == 'ready'
        assert len(warnings) == 0


@pytest.mark.django_db
class TestOrderItemGenerationService:
    """Tests for OrderItemGenerationService"""
    
    @pytest.fixture
    def service(self):
        from atelier_erp.services import OrderItemGenerationService
        return OrderItemGenerationService()
    
    @pytest.fixture
    def customer(self):
        from atelier_erp.models import Customer
        return Customer.objects.create(
            full_name="Тест Клиент",
            phone="+77001234567"
        )
    
    @pytest.fixture
    def fabric(self):
        from decimal import Decimal
        from atelier_erp.models import Fabric
        return Fabric.objects.create(
            name="Бархат",
            hanger_number="VEL-001",
            supplier="Test Supplier",
            price_per_meter=Decimal("5000.00")
        )
    
    @pytest.fixture
    def quote_with_items(self, customer, fabric):
        from atelier_erp.models import Quote, QuoteItem
        quote = Quote.objects.create(
            customer=customer,
            status=Quote.Status.APPROVED,
            total=Decimal("50000.00"),
            quote_number='КП-2024-001'
        )
        QuoteItem.objects.create(
            quote=quote,
            room_name="Гостиная",
            window_width_cm=150,
            window_height_cm=200,
            fabric=fabric,
            fabric_meters=Decimal("4.5"),
            fabric_cost=Decimal("22500.00"),
            supply_mode="purchase_local",
            sewing_type="Сложный",
            sewing_cost=Decimal("2500.00"),
            accessories_cost=Decimal("0.00"),
            line_total=Decimal("25000.00")
        )
        QuoteItem.objects.create(
            quote=quote,
            room_name="Спальня",
            window_width_cm=120,
            window_height_cm=180,
            fabric=fabric,
            fabric_meters=Decimal("3.5"),
            fabric_cost=Decimal("17500.00"),
            supply_mode="in_stock",
            sewing_type="Стандарт",
            sewing_cost=Decimal("2500.00"),
            accessories_cost=Decimal("0.00"),
            line_total=Decimal("20000.00")
        )
        return quote
    
    @pytest.fixture
    def empty_quote(self, customer):
        from atelier_erp.models import Quote
        return Quote.objects.create(
            customer=customer,
            status=Quote.Status.APPROVED,
            total=Decimal("0.00"),
            quote_number='КП-2024-002'
        )
    
    @pytest.fixture
    def draft_order(self, customer, quote_with_items):
        from atelier_erp.models import Order
        return Order.objects.create(
            customer=customer,
            quote=quote_with_items,
            status=Order.Status.NEW,
            total_amount=Decimal("50000.00")
        )
    
    @pytest.fixture
    def completed_order(self, customer, quote_with_items):
        from atelier_erp.models import Order
        return Order.objects.create(
            customer=customer,
            quote=quote_with_items,
            status=Order.Status.COMPLETED,
            total_amount=Decimal("50000.00")
        )
    
    @pytest.fixture
    def cancelled_order(self, customer, quote_with_items):
        from atelier_erp.models import Order
        return Order.objects.create(
            customer=customer,
            quote=quote_with_items,
            status=Order.Status.CANCELLED,
            total_amount=Decimal("50000.00")
        )
    
    def test_generate_order_items_from_quote(self, service, draft_order, quote_with_items, fabric):
        """Test generating OrderItems from QuoteItems"""
        created_items = service.generate_order_items_from_quote(
            order=draft_order,
            quote=quote_with_items
        )
        
        assert len(created_items) == 2
        draft_order.refresh_from_db()
        assert draft_order.items.count() == 2
        
        # Check first item mapping (OrderItem fields differ from QuoteItem)
        first_item = draft_order.items.first()
        assert first_item.item_type == 'fabric'
        assert first_item.fabric == fabric
        assert first_item.window_width_cm == 150
        assert first_item.window_height_cm == 200
        assert first_item.total_price == Decimal("25000.00")
    
    def test_does_not_create_duplicates(self, service, draft_order, quote_with_items):
        """Test that duplicate generation is prevented"""
        from atelier_erp.services.exceptions import OrderValidationError
        
        # First generation
        service.generate_order_items_from_quote(order=draft_order, quote=quote_with_items)
        
        # Second generation should fail
        with pytest.raises(OrderValidationError) as exc_info:
            service.generate_order_items_from_quote(order=draft_order, quote=quote_with_items)
        
        assert "already has" in str(exc_info.value).lower()
    
    def test_forbidden_for_completed_order(self, service, completed_order, quote_with_items):
        """Test that generation is forbidden for completed orders"""
        from atelier_erp.services.exceptions import OrderValidationError
        
        with pytest.raises(OrderValidationError) as exc_info:
            service.generate_order_items_from_quote(order=completed_order, quote=quote_with_items)
        
        assert "completed" in str(exc_info.value).lower()
    
    def test_forbidden_for_cancelled_order(self, service, cancelled_order, quote_with_items):
        """Test that generation is forbidden for cancelled orders"""
        from atelier_erp.services.exceptions import OrderValidationError
        
        with pytest.raises(OrderValidationError) as exc_info:
            service.generate_order_items_from_quote(order=cancelled_order, quote=quote_with_items)
        
        assert "cancelled" in str(exc_info.value).lower()
    
    def test_validation_prevents_empty_quote(self, service, draft_order, empty_quote):
        """Test that validation prevents generation from empty quote"""
        from atelier_erp.services.exceptions import OrderValidationError
        
        # Update order to link empty quote
        draft_order.quote = empty_quote
        draft_order.save()
        
        with pytest.raises(OrderValidationError) as exc_info:
            service.generate_order_items_from_quote(order=draft_order, quote=empty_quote)
        
        assert "no items" in str(exc_info.value).lower()
    
    def test_order_items_count_equals_quote_items_count(self, service, draft_order, quote_with_items):
        """Test that generated items count equals quote items count"""
        created_items = service.generate_order_items_from_quote(
            order=draft_order,
            quote=quote_with_items
        )
        
        assert len(created_items) == quote_with_items.items.count()

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

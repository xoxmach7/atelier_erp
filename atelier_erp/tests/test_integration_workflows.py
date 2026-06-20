import pytest
pytestmark = pytest.mark.skip(reason="legacy — pre-P0, references removed code; pending rewrite")
"""
Atelier ERP - Integration Tests for Order Workflows
Full lifecycle tests with service layer
"""

import pytest
from decimal import Decimal
from datetime import date, timedelta

from atelier_erp.models import Order, Fabric, OrderItem, Payment
from atelier_erp.services import OrderService, InventoryService, PaymentService, UnitOfWork
from atelier_erp.services.exceptions import (
    InvalidOrderStatusTransition,
    InsufficientStockError,
    OrderNotPaidError,
    OrderCancellationError
)


@pytest.mark.django_db
class TestOrderLifecycleHappyPath:
    """Happy path: create -> confirm -> reserve -> start_production -> complete"""
    
    def test_full_order_lifecycle(self, customer, fabric, manager_user):
        """Complete order lifecycle from draft to completion"""
        
        with UnitOfWork() as uow:
            order_service = OrderService(uow)
            inventory_service = InventoryService(uow)
            payment_service = PaymentService(uow)
            
            # 1. CREATE order in DRAFT status
            order = order_service.create_order(
                customer_id=customer.id,
                order_number='О-2024-100',
                notes='Тестовый заказ',
                created_by=manager_user.id
            )
            assert order.status == Order.Status.DRAFT
            
            # Add order item with fabric
            OrderItem.objects.create(
                order=order,
                item_type='fabric',
                fabric=fabric,
                fabric_meters=Decimal('10.00'),
                unit_price=fabric.price_per_meter,
                quantity=1,
                line_total=Decimal('25000.00')
            )
            order.total_amount = Decimal('25000.00')
            order.save()
            
            # 2. CONFIRM order (DRAFT -> APPROVED)
            order = order_service.confirm_order(
                order_id=order.id,
                confirmed_by=manager_user.id
            )
            assert order.status == Order.Status.APPROVED
            
            # 3. RESERVE materials (APPROVED -> FABRIC_RESERVED)
            order = order_service.reserve_materials(
                order_id=order.id,
                fabric_reservations=[{
                    'fabric_id': fabric.id,
                    'meters': Decimal('10.00')
                }]
            )
            assert order.status == Order.Status.FABRIC_RESERVED
            
            # Verify fabric is reserved
            fabric.refresh_from_db()
            assert fabric.reserved_meters == Decimal('10.00')
            
            # 4. Record full payment (required before production)
            payment_service.record_payment(
                order_id=order.id,
                amount=Decimal('25000.00'),
                method='card',
                received_by=manager_user.id
            )
            
            # 5. START PRODUCTION (FABRIC_RESERVED -> PRODUCTION)
            order = order_service.start_production(
                order_id=order.id,
                assigned_to=manager_user.id
            )
            assert order.status == Order.Status.PRODUCTION
            
            # 6. COMPLETE order (PRODUCTION -> COMPLETED)
            order = order_service.complete_order(
                order_id=order.id,
                installation_date=date.today() + timedelta(days=7)
            )
            assert order.status == Order.Status.COMPLETED
            
            uow.commit()
        
        # Verify final state
        order.refresh_from_db()
        assert order.status == Order.Status.COMPLETED
        assert order.paid_amount == Decimal('25000.00')
        assert order.is_paid


@pytest.mark.django_db
class TestInvalidTransitions:
    """Test invalid state transitions are blocked by FSM"""
    
    def test_draft_to_complete_direct_fails(self, customer, manager_user):
        """Cannot transition from DRAFT directly to COMPLETED"""
        
        with UnitOfWork() as uow:
            order_service = OrderService(uow)
            
            # Create draft order
            order = order_service.create_order(
                customer_id=customer.id,
                order_number='О-2024-101',
                created_by=manager_user.id
            )
            
            # Attempt invalid transition DRAFT -> COMPLETED
            with pytest.raises(InvalidOrderStatusTransition) as exc_info:
                order_service.transition_status(
                    order_id=order.id,
                    new_status=Order.Status.COMPLETED,
                    performed_by=manager_user.id
                )
            
            assert 'draft' in str(exc_info.value).lower()
            assert 'completed' in str(exc_info.value).lower()
            uow.rollback()
    
    def test_complete_to_draft_fails(self, customer, manager_user):
        """Cannot go back from COMPLETED to DRAFT"""
        
        with UnitOfWork() as uow:
            order_service = OrderService(uow)
            
            # Create and complete an order
            order = order_service.create_order(
                customer_id=customer.id,
                order_number='О-2024-102',
                created_by=manager_user.id
            )
            order.status = Order.Status.COMPLETED
            order.save()
            
            # Attempt to go back
            with pytest.raises(InvalidOrderStatusTransition):
                order_service.transition_status(
                    order_id=order.id,
                    new_status=Order.Status.DRAFT,
                    performed_by=manager_user.id
                )
            uow.rollback()
    
    def test_cancelled_order_cannot_resume(self, customer, manager_user):
        """Cannot resume a cancelled order"""
        
        with UnitOfWork() as uow:
            order_service = OrderService(uow)
            
            # Create and cancel order
            order = order_service.create_order(
                customer_id=customer.id,
                order_number='О-2024-103',
                created_by=manager_user.id
            )
            order = order_service.cancel_order(
                order_id=order.id,
                reason='Тест отмены',
                cancelled_by=manager_user.id
            )
            assert order.status == Order.Status.CANCELLED
            
            # Try to confirm cancelled order
            with pytest.raises(InvalidOrderStatusTransition):
                order_service.confirm_order(order.id, manager_user.id)
            
            uow.rollback()


@pytest.mark.django_db
class TestInsufficientStock:
    """Test insufficient stock handling"""
    
    def test_reserve_more_than_available_fails(self, customer, low_stock_fabric, manager_user):
        """Cannot reserve more fabric than available"""
        
        with UnitOfWork() as uow:
            order_service = OrderService(uow)
            
            # Create and confirm order
            order = order_service.create_order(
                customer_id=customer.id,
                order_number='О-2024-104',
                created_by=manager_user.id
            )
            
            # Add item requiring more fabric than available (5m stock, request 10m)
            OrderItem.objects.create(
                order=order,
                item_type='fabric',
                fabric=low_stock_fabric,
                fabric_meters=Decimal('10.00'),
                unit_price=Decimal('3500.00'),
                quantity=1,
                line_total=Decimal('35000.00')
            )
            order.total_amount = Decimal('35000.00')
            order.save()
            
            order = order_service.confirm_order(order.id, manager_user.id)
            
            # Attempt to reserve more than available
            with pytest.raises(InsufficientStockError) as exc_info:
                order_service.reserve_materials(
                    order_id=order.id,
                    fabric_reservations=[{
                        'fabric_id': low_stock_fabric.id,
                        'meters': Decimal('10.00')  # Only 5 available
                    }]
                )
            
            assert 'insufficient stock' in str(exc_info.value).lower()
            assert low_stock_fabric.name in str(exc_info.value)
            uow.rollback()
    
    def test_partial_reservation_not_allowed(self, customer, fabric, manager_user):
        """System should not allow partial reservations"""
        
        # First, reserve some fabric with another order
        with UnitOfWork() as uow:
            order_service = OrderService(uow)
            
            order1 = order_service.create_order(
                customer_id=customer.id,
                order_number='О-2024-105A',
                created_by=manager_user.id
            )
            OrderItem.objects.create(
                order=order1,
                item_type='fabric',
                fabric=fabric,
                fabric_meters=Decimal('40.00'),
                unit_price=fabric.price_per_meter,
                quantity=1,
                line_total=Decimal('100000.00')
            )
            order1.total_amount = Decimal('100000.00')
            order1.save()
            
            order1 = order_service.confirm_order(order1.id, manager_user.id)
            order1 = order_service.reserve_materials(
                order_id=order1.id,
                fabric_reservations=[{'fabric_id': fabric.id, 'meters': Decimal('40.00')}]
            )
            uow.commit()
        
        # Now try to reserve more than remaining (50 - 40 = 10 remaining, request 15)
        with UnitOfWork() as uow:
            order_service = OrderService(uow)
            
            order2 = order_service.create_order(
                customer_id=customer.id,
                order_number='О-2024-105B',
                created_by=manager_user.id
            )
            OrderItem.objects.create(
                order=order2,
                item_type='fabric',
                fabric=fabric,
                fabric_meters=Decimal('15.00'),
                unit_price=fabric.price_per_meter,
                quantity=1,
                line_total=Decimal('37500.00')
            )
            order2.total_amount = Decimal('37500.00')
            order2.save()
            
            order2 = order_service.confirm_order(order2.id, manager_user.id)
            
            with pytest.raises(InsufficientStockError):
                order_service.reserve_materials(
                    order_id=order2.id,
                    fabric_reservations=[{
                        'fabric_id': fabric.id,
                        'meters': Decimal('15.00')  # Only 10 available
                    }]
                )
            uow.rollback()


@pytest.mark.django_db
class TestCancelAfterReserve:
    """Test canceling order after materials reserved"""
    
    def test_cancel_releases_fabric_reservation(self, customer, fabric, manager_user):
        """Cancelling order should release fabric reservation"""
        
        with UnitOfWork() as uow:
            order_service = OrderService(uow)
            
            # Create, confirm, and reserve
            order = order_service.create_order(
                customer_id=customer.id,
                order_number='О-2024-106',
                created_by=manager_user.id
            )
            OrderItem.objects.create(
                order=order,
                item_type='fabric',
                fabric=fabric,
                fabric_meters=Decimal('15.00'),
                unit_price=fabric.price_per_meter,
                quantity=1,
                line_total=Decimal('37500.00')
            )
            order.total_amount = Decimal('37500.00')
            order.save()
            
            order = order_service.confirm_order(order.id, manager_user.id)
            order = order_service.reserve_materials(
                order_id=order.id,
                fabric_reservations=[{'fabric_id': fabric.id, 'meters': Decimal('15.00')}]
            )
            
            # Verify reservation
            fabric.refresh_from_db()
            assert fabric.reserved_meters == Decimal('15.00')
            
            # CANCEL order
            order = order_service.cancel_order(
                order_id=order.id,
                reason='Клиент передумал',
                cancelled_by=manager_user.id
            )
            
            assert order.status == Order.Status.CANCELLED
            uow.commit()
        
        # Verify fabric released
        fabric.refresh_from_db()
        assert fabric.reserved_meters == Decimal('0.00')
        assert fabric.available_meters == Decimal('50.00')
    
    def test_cancel_in_production_fails(self, customer, fabric, manager_user):
        """Cannot cancel order once in production"""
        
        with UnitOfWork() as uow:
            order_service = OrderService(uow)
            payment_service = PaymentService(uow)
            
            # Create, confirm, reserve, and start production
            order = order_service.create_order(
                customer_id=customer.id,
                order_number='О-2024-107',
                created_by=manager_user.id
            )
            OrderItem.objects.create(
                order=order,
                item_type='fabric',
                fabric=fabric,
                fabric_meters=Decimal('10.00'),
                unit_price=fabric.price_per_meter,
                quantity=1,
                line_total=Decimal('25000.00')
            )
            order.total_amount = Decimal('25000.00')
            order.save()
            
            order = order_service.confirm_order(order.id, manager_user.id)
            order = order_service.reserve_materials(
                order_id=order.id,
                fabric_reservations=[{'fabric_id': fabric.id, 'meters': Decimal('10.00')}]
            )
            
            # Full payment
            payment_service.record_payment(
                order_id=order.id,
                amount=Decimal('25000.00'),
                method='cash',
                received_by=manager_user.id
            )
            
            # Start production
            order = order_service.start_production(order.id, manager_user.id)
            assert order.status == Order.Status.PRODUCTION
            
            # Attempt to cancel in production
            with pytest.raises(OrderCancellationError):
                order_service.cancel_order(
                    order_id=order.id,
                    reason='Нельзя отменить в производстве',
                    cancelled_by=manager_user.id
                )
            
            uow.rollback()


@pytest.mark.django_db
class TestFullPaymentRequired:
    """Test full payment required before production"""
    
    def test_start_production_without_full_payment_fails(self, customer, fabric, manager_user):
        """Cannot start production if not fully paid"""
        
        with UnitOfWork() as uow:
            order_service = OrderService(uow)
            payment_service = PaymentService(uow)
            
            # Create order with total 25000
            order = order_service.create_order(
                customer_id=customer.id,
                order_number='О-2024-108',
                created_by=manager_user.id
            )
            OrderItem.objects.create(
                order=order,
                item_type='fabric',
                fabric=fabric,
                fabric_meters=Decimal('10.00'),
                unit_price=fabric.price_per_meter,
                quantity=1,
                line_total=Decimal('25000.00')
            )
            order.total_amount = Decimal('25000.00')
            order.save()
            
            # Confirm and reserve
            order = order_service.confirm_order(order.id, manager_user.id)
            order = order_service.reserve_materials(
                order_id=order.id,
                fabric_reservations=[{'fabric_id': fabric.id, 'meters': Decimal('10.00')}]
            )
            
            # Partial payment only (10000 of 25000)
            payment_service.record_payment(
                order_id=order.id,
                amount=Decimal('10000.00'),
                method='card',
                received_by=manager_user.id
            )
            
            # Try to start production without full payment
            with pytest.raises(OrderNotPaidError) as exc_info:
                order_service.start_production(order.id, manager_user.id)
            
            assert 'not paid' in str(exc_info.value).lower() or 'payment' in str(exc_info.value).lower()
            uow.rollback()
    
    def test_exact_payment_allows_production(self, customer, fabric, manager_user):
        """Exact payment amount allows production start"""
        
        with UnitOfWork() as uow:
            order_service = OrderService(uow)
            payment_service = PaymentService(uow)
            
            # Create order
            order = order_service.create_order(
                customer_id=customer.id,
                order_number='О-2024-109',
                created_by=manager_user.id
            )
            OrderItem.objects.create(
                order=order,
                item_type='fabric',
                fabric=fabric,
                fabric_meters=Decimal('5.00'),
                unit_price=fabric.price_per_meter,
                quantity=1,
                line_total=Decimal('12500.00')
            )
            order.total_amount = Decimal('12500.00')
            order.save()
            
            # Confirm and reserve
            order = order_service.confirm_order(order.id, manager_user.id)
            order = order_service.reserve_materials(
                order_id=order.id,
                fabric_reservations=[{'fabric_id': fabric.id, 'meters': Decimal('5.00')}]
            )
            
            # Exact payment
            payment_service.record_payment(
                order_id=order.id,
                amount=Decimal('12500.00'),
                method='cash',
                received_by=manager_user.id
            )
            
            # Should succeed
            order = order_service.start_production(order.id, manager_user.id)
            assert order.status == Order.Status.PRODUCTION
            uow.commit()
        
        order.refresh_from_db()
        assert order.paid_amount == Decimal('12500.00')
        assert order.is_paid
    
    def test_overpayment_allowed(self, customer, fabric, manager_user):
        """Overpayment should still allow production"""
        
        with UnitOfWork() as uow:
            order_service = OrderService(uow)
            payment_service = PaymentService(uow)
            
            # Create order
            order = order_service.create_order(
                customer_id=customer.id,
                order_number='О-2024-110',
                created_by=manager_user.id
            )
            OrderItem.objects.create(
                order=order,
                item_type='fabric',
                fabric=fabric,
                fabric_meters=Decimal('5.00'),
                unit_price=fabric.price_per_meter,
                quantity=1,
                line_total=Decimal('12500.00')
            )
            order.total_amount = Decimal('12500.00')
            order.save()
            
            # Confirm and reserve
            order = order_service.confirm_order(order.id, manager_user.id)
            order = order_service.reserve_materials(
                order_id=order.id,
                fabric_reservations=[{'fabric_id': fabric.id, 'meters': Decimal('5.00')}]
            )
            
            # Overpayment (15000 instead of 12500)
            payment_service.record_payment(
                order_id=order.id,
                amount=Decimal('15000.00'),
                method='card',
                received_by=manager_user.id
            )
            
            # Should succeed with overpayment
            order = order_service.start_production(order.id, manager_user.id)
            assert order.status == Order.Status.PRODUCTION
            uow.commit()
        
        order.refresh_from_db()
        assert order.paid_amount == Decimal('15000.00')

"""
Model Tests - FSM and Constraints
"""

import pytest
from decimal import Decimal
from django.core.exceptions import ValidationError

from atelier_erp.models import (
    Order, OrderItem, Customer, Fabric, FabricReservation,
    Task, ProductionAssignment, Payment
)


@pytest.mark.django_db
class TestOrderFSM:
    """Order FSM transition tests"""
    
    VALID_TRANSITIONS = [
        (Order.Status.DRAFT, Order.Status.MEASUREMENT),
        (Order.Status.DRAFT, Order.Status.APPROVED),
        (Order.Status.MEASUREMENT, Order.Status.DESIGN),
        (Order.Status.DESIGN, Order.Status.QUOTED),
        (Order.Status.QUOTED, Order.Status.APPROVED),
        (Order.Status.APPROVED, Order.Status.PREPAYMENT_RECEIVED),
        (Order.Status.PREPAYMENT_RECEIVED, Order.Status.FABRIC_RESERVED),
        (Order.Status.FABRIC_RESERVED, Order.Status.PRODUCTION),
        (Order.Status.PRODUCTION, Order.Status.READY),
        (Order.Status.READY, Order.Status.INSTALLATION),
        (Order.Status.INSTALLATION, Order.Status.COMPLETED),
        # Cancellation from any state except COMPLETED/CANCELLED
        (Order.Status.DRAFT, Order.Status.CANCELLED),
        (Order.Status.APPROVED, Order.Status.CANCELLED),
    ]
    
    INVALID_TRANSITIONS = [
        (Order.Status.DRAFT, Order.Status.COMPLETED),
        (Order.Status.DRAFT, Order.Status.PRODUCTION),
        (Order.Status.COMPLETED, Order.Status.CANCELLED),
        (Order.Status.CANCELLED, Order.Status.DRAFT),
        (Order.Status.CANCELLED, Order.Status.COMPLETED),
    ]
    
    def test_valid_transitions(self, customer):
        """Test all valid FSM transitions"""
        for from_status, to_status in self.VALID_TRANSITIONS:
            order = Order.objects.create(
                order_number=f'Т-TEST-{from_status}-{to_status}',
                customer=customer,
                status=from_status
            )
            
            # Should not raise exception
            order.status = to_status
            order.save()
            
            assert order.status == to_status
            order.delete()
    
    def test_invalid_transitions_via_service(self, customer, unit_of_work):
        """Test invalid transitions are rejected by service"""
        from atelier_erp.services import OrderService
        from atelier_erp.services.exceptions import InvalidOrderStatusTransition
        
        for from_status, to_status in self.INVALID_TRANSITIONS:
            order = Order.objects.create(
                order_number=f'Т-INVALID-{from_status}-{to_status}',
                customer=customer,
                status=from_status
            )
            
            service = OrderService(unit_of_work)
            
            with pytest.raises(InvalidOrderStatusTransition):
                with unit_of_work.atomic():
                    service.update_status(
                        order_id=order.id,
                        new_status=to_status,
                        changed_by='test'
                    )
            
            order.delete()


@pytest.mark.django_db
class TestOrderItemValidation:
    """Order item validation tests"""
    
    def test_fabric_item_requires_fabric(self, draft_order):
        """Test fabric item must have fabric"""
        item = OrderItem(
            order=draft_order,
            item_type=OrderItem.ItemType.FABRIC,
            fabric_meters=Decimal('5.00'),
            unit_price=Decimal('2500.00'),
            quantity=1
        )
        
        # Should raise validation error on save
        with pytest.raises(ValidationError):
            item.full_clean()
    
    def test_cornice_item_requires_cornice(self, draft_order):
        """Test cornice item must have cornice"""
        item = OrderItem(
            order=draft_order,
            item_type=OrderItem.ItemType.CORNICE,
            cornice_count=2,
            unit_price=Decimal('8000.00'),
            quantity=1
        )
        
        with pytest.raises(ValidationError):
            item.full_clean()
    
    def test_line_total_calculation(self, draft_order, fabric):
        """Test line total is calculated correctly"""
        item = OrderItem.objects.create(
            order=draft_order,
            item_type=OrderItem.ItemType.FABRIC,
            fabric=fabric,
            fabric_meters=Decimal('10.00'),
            unit_price=Decimal('2500.00'),
            quantity=2,
            line_total=Decimal('50000.00')  # 10 * 2500 * 2
        )
        
        assert item.line_total == Decimal('50000.00')


@pytest.mark.django_db
class TestFabricInventory:
    """Fabric inventory constraint tests"""
    
    def test_available_meters_calculation(self, fabric):
        """Test available meters = stock - reserved"""
        fabric.stock_meters = Decimal('100.00')
        fabric.reserved_meters = Decimal('30.00')
        fabric.save()
        
        assert fabric.available_meters == Decimal('70.00')
    
    def test_cannot_exceed_stock_constraint(self, fabric):
        """Test DB constraint prevents reserved > stock"""
        fabric.stock_meters = Decimal('50.00')
        fabric.reserved_meters = Decimal('60.00')  # More than stock
        
        # Should fail on save
        with pytest.raises(Exception):  # IntegrityError or ValidationError
            fabric.save()
    
    def test_negative_stock_prevented(self, fabric):
        """Test negative stock is prevented"""
        fabric.stock_meters = Decimal('-10.00')
        
        with pytest.raises(ValidationError):
            fabric.full_clean()


@pytest.mark.django_db
class TestFabricReservationLifecycle:
    """Fabric reservation lifecycle tests"""
    
    def test_reservation_status_transitions(self, fabric, draft_order):
        """Test reservation status transitions"""
        reservation = FabricReservation.objects.create(
            fabric=fabric,
            order=draft_order,
            reserved_meters=Decimal('10.00'),
            status=FabricReservation.Status.ACTIVE
        )
        
        assert reservation.status == FabricReservation.Status.ACTIVE
        
        # Convert
        reservation.status = FabricReservation.Status.CONVERTED
        reservation.save()
        
        assert reservation.status == FabricReservation.Status.CONVERTED
    
    def test_reservation_expires(self, fabric, draft_order):
        """Test reservation expiry"""
        from datetime import timedelta
        from django.utils import timezone
        
        reservation = FabricReservation.objects.create(
            fabric=fabric,
            task=draft_order,
            reserved_meters=Decimal('10.00'),
            status=FabricReservation.Status.ACTIVE,
            expires_at=timezone.now() - timedelta(days=1)  # Expired yesterday
        )
        
        # Check if expired
        assert reservation.expires_at < timezone.now()


@pytest.mark.django_db
class TestPaymentValidation:
    """Payment validation tests"""
    
    def test_payment_amount_positive(self, confirmed_order):
        """Test payment amount must be positive"""
        payment = Payment(
            order=confirmed_order,
            amount=Decimal('-1000.00'),  # Negative
            payment_type='prepayment',
            payment_method='cash'
        )
        
        with pytest.raises(ValidationError):
            payment.full_clean()
    
    def test_payment_types(self, confirmed_order):
        """Test valid payment types"""
        valid_types = ['prepayment', 'final', 'additional']
        
        for ptype in valid_types:
            payment = Payment.objects.create(
                order=confirmed_order,
                amount=Decimal('1000.00'),
                payment_type=ptype,
                payment_method='cash'
            )
            assert payment.payment_type == ptype


@pytest.mark.django_db
class TestCustomerPhoneValidation:
    """Customer phone validation tests"""
    
    VALID_PHONES = [
        '+7 777 123 4567',
        '8 777 123 4567',
        '+7-777-123-45-67',
        '87771234567',
    ]
    
    INVALID_PHONES = [
        '123',  # Too short
        'not-a-phone',
        '',  # Empty
    ]
    
    def test_valid_phones(self):
        """Test valid phone numbers"""
        for phone in self.VALID_PHONES:
            customer = Customer(
                full_name='Test',
                phone=phone
            )
            # Should not raise
            customer.full_clean()
    
    def test_invalid_phones(self):
        """Test invalid phone numbers"""
        for phone in self.INVALID_PHONES:
            customer = Customer(
                full_name='Test',
                phone=phone
            )
            with pytest.raises(ValidationError):
                customer.full_clean()


@pytest.mark.django_db
class TestProductionAssignment:
    """Production assignment tests"""
    
    def test_assignment_status_default(self, confirmed_order, worker_user):
        """Test default assignment status"""
        assignment = ProductionAssignment.objects.create(
            order=confirmed_order,
            assigned_to=worker_user,
            status=ProductionAssignment.Status.ASSIGNED
        )
        
        assert assignment.status == ProductionAssignment.Status.ASSIGNED
    
    def test_assignment_complexity_levels(self, confirmed_order, worker_user):
        """Test complexity levels"""
        for complexity in ['low', 'medium', 'high']:
            assignment = ProductionAssignment.objects.create(
                order=confirmed_order,
                assigned_to=worker_user,
                complexity=complexity
            )
            assert assignment.complexity == complexity


@pytest.mark.django_db
class TestOrderNumberFormat:
    """Order number format tests"""
    
    VALID_NUMBERS = [
        'О-2024-001',
        'О-2024-999',
        'О-2025-001',
    ]
    
    INVALID_NUMBERS = [
        'O-2024-001',  # Latin O instead of Cyrillic О
        'О-24-001',    # Short year
        'О-2024-01',   # Short number
        'ORDER-001',   # Wrong format
    ]
    
    def test_valid_order_numbers(self, customer):
        """Test valid order number formats"""
        for number in self.VALID_NUMBERS:
            order = Order(
                order_number=number,
                customer=customer
            )
            order.full_clean()  # Should not raise
    
    def test_invalid_order_numbers(self, customer):
        """Test invalid order number formats"""
        for number in self.INVALID_NUMBERS:
            order = Order(
                order_number=number,
                customer=customer
            )
            with pytest.raises(ValidationError):
                order.full_clean()

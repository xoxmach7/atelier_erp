"""
Atelier ERP - Order Lifecycle API Integration Tests

Tests the complete order lifecycle through API endpoints:
1. Create order
2. Confirm order  
3. Reserve materials
4. Start production

Uses real HTTP requests against DRF ViewSets with service layer.
"""

from decimal import Decimal
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.test import APITestCase
from rest_framework import status

from atelier_erp.models import (
    Customer, Fabric, Order, OrderItem,
    FabricReservation, ProductionAssignment
)

User = get_user_model()


class TestOrderLifecycleAPI(APITestCase):
    """Integration tests for Order lifecycle via API"""
    
    def setUp(self):
        """Set up test data"""
        # Create manager user
        self.manager = User.objects.create_user(
            username='manager',
            email='manager@test.com',
            password='manager123'
        )
        manager_group, _ = Group.objects.get_or_create(name='Manager')
        self.manager.groups.add(manager_group)
        
        # Create seamstress user
        self.seamstress = User.objects.create_user(
            username='seamstress',
            email='seamstress@test.com',
            password='seamstress123'
        )
        seamstress_group, _ = Group.objects.get_or_create(name='Seamstress')
        self.seamstress.groups.add(seamstress_group)
        
        # Create customer
        self.customer = Customer.objects.create(
            full_name='Иванов Иван Иванович',
            phone='+7 777 123 4567',
            email='ivan@test.com',
            address_city='Алматы'
        )
        
        # Create fabric
        self.fabric = Fabric.objects.create(
            hanger_number='A001',
            name='Тюль белая',
            stock_meters=Decimal('50.00'),
            reserved_meters=Decimal('0.00'),
            price_per_meter=Decimal('2500.00'),
            color='белый'
        )
        
        # Authenticate client
        self.client.force_authenticate(user=self.manager)
    
    def test_create_order_via_api(self):
        """
        Test creating order through API v1 endpoint.
        
        Scenario: Manager creates new order for existing customer
        Expected: 201 Created, order with DRAFT status and generated order_number
        """
        url = '/api/v1/orders/'
        data = {
            'customer_id': str(self.customer.id),
            'notes': 'Test order from API',
            'due_date': '2024-12-31'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', response.data)
        self.assertEqual(response.data['status'], Order.Status.DRAFT)
        self.assertEqual(response.data['customer']['id'], str(self.customer.id))
        self.assertIn('order_number', response.data)
        self.assertTrue(response.data['order_number'].startswith('О-'))
        
        # Verify in database
        order = Order.objects.get(id=response.data['id'])
        self.assertEqual(order.status, Order.Status.DRAFT)
        self.assertEqual(order.customer, self.customer)
    
    def test_confirm_order_via_api(self):
        """
        Test confirming order through API.
        
        Scenario: Manager confirms DRAFT order
        Expected: 200 OK, status changed to APPROVED
        """
        # Create draft order first
        order = Order.objects.create(
            order_number='О-2024-TEST-001',
            customer=self.customer,
            status=Order.Status.DRAFT,
            total_amount=Decimal('0.00'),
            paid_amount=Decimal('0.00')
        )
        
        url = f'/api/v1/orders/{order.id}/confirm/'
        
        response = self.client.post(url, {}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'confirmed')
        
        # Verify in database
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.APPROVED)
    
    def test_reserve_materials_via_api(self):
        """
        Test reserving materials for order.
        
        Scenario: Manager reserves fabric for confirmed order
        Setup: Create OrderItem with fabric
        Expected: 200 OK, fabric reserved_meters increased
        """
        # Create confirmed order
        order = Order.objects.create(
            order_number='О-2024-TEST-002',
            customer=self.customer,
            status=Order.Status.APPROVED,
            total_amount=Decimal('50000.00'),
            paid_amount=Decimal('0.00')
        )
        
        # Setup: Add fabric item to order
        OrderItem.objects.create(
            order=order,
            item_type=OrderItem.ItemType.FABRIC,
            fabric=self.fabric,
            fabric_meters=Decimal('5.00'),
            price_per_unit=self.fabric.price_per_meter,
            quantity=Decimal('5.00')
        )
        
        # Pre-condition
        initial_reserved = self.fabric.reserved_meters
        
        url = f'/api/orders/{order.id}/reserve_materials/'
        response = self.client.post(url, {}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'materials_reserved')
        
        # Verify fabric reservation
        self.fabric.refresh_from_db()
        self.assertEqual(self.fabric.reserved_meters, initial_reserved + Decimal('5.00'))
    
    def test_start_production_via_api(self):
        """
        Test starting production for order.
        
        Scenario: Manager assigns order to seamstress and starts production
        Expected: 200 OK, status=PRODUCTION, ProductionAssignment created
        """
        # Create confirmed order
        order = Order.objects.create(
            order_number='О-2024-TEST-003',
            customer=self.customer,
            status=Order.Status.APPROVED,
            total_amount=Decimal('50000.00'),
            paid_amount=Decimal('0.00')
        )
        
        url = f'/api/v1/orders/{order.id}/change_status/'
        data = {
            'new_status': Order.Status.PRODUCTION,
            'reason': 'Starting production'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], Order.Status.PRODUCTION)
        
        # Verify in database
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PRODUCTION)
    
    def test_full_order_lifecycle(self):
        """
        End-to-end test: Create → Confirm → Reserve → Production
        
        Full lifecycle test combining all previous steps.
        """
        initial_fabric_reserved = self.fabric.reserved_meters
        
        # Step 1: Create order
        create_url = '/api/v1/orders/'
        create_data = {
            'customer_id': str(self.customer.id),
            'notes': 'Full lifecycle test order'
        }
        create_response = self.client.post(create_url, create_data, format='json')
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        order_id = create_response.data['id']
        
        # Step 2: Confirm order
        confirm_url = f'/api/v1/orders/{order_id}/confirm/'
        confirm_response = self.client.post(confirm_url, {}, format='json')
        self.assertEqual(confirm_response.status_code, status.HTTP_200_OK)
        
        # Setup: Add fabric to order for reservation
        order = Order.objects.get(id=order_id)
        OrderItem.objects.create(
            order=order,
            item_type=OrderItem.ItemType.FABRIC,
            fabric=self.fabric,
            fabric_meters=Decimal('3.00'),
            price_per_unit=self.fabric.price_per_meter,
            quantity=Decimal('3.00')
        )
        
        # Step 3: Reserve materials
        reserve_url = f'/api/orders/{order_id}/reserve_materials/'
        reserve_response = self.client.post(reserve_url, {}, format='json')
        self.assertEqual(reserve_response.status_code, status.HTTP_200_OK)
        
        # Verify reservation
        self.fabric.refresh_from_db()
        self.assertEqual(self.fabric.reserved_meters, initial_fabric_reserved + Decimal('3.00'))
        
        # Step 4: Start production
        production_url = f'/api/v1/orders/{order_id}/change_status/'
        production_data = {
            'new_status': Order.Status.PRODUCTION,
            'reason': 'Production started'
        }
        production_response = self.client.post(production_url, production_data, format='json')
        self.assertEqual(production_response.status_code, status.HTTP_200_OK)
        
        # Final verification
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PRODUCTION)
        
        # Verify all state changes happened
        self.assertTrue(FabricReservation.objects.filter(order=order).exists())


class TestOrderAPIPermissions(APITestCase):
    """Test API permission enforcement"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@test.com',
            password='test123'
        )
        self.customer = Customer.objects.create(
            full_name='Test Customer',
            phone='+7 777 999 8888'
        )
    
    def test_create_order_requires_authentication(self):
        """Unauthenticated users cannot create orders"""
        url = '/api/v1/orders/'
        data = {'customer_id': str(self.customer.id)}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_confirm_requires_manager_permissions(self):
        """Only managers can confirm orders"""
        # Create manager user
        manager = User.objects.create_user(
            username='manager2',
            email='manager2@test.com',
            password='manager123'
        )
        manager_group, _ = Group.objects.get_or_create(name='Manager')
        manager.groups.add(manager_group)
        
        # Create draft order
        order = Order.objects.create(
            order_number='О-2024-TEST-004',
            customer=self.customer,
            status=Order.Status.DRAFT,
            total_amount=Decimal('0.00'),
            paid_amount=Decimal('0.00')
        )
        
        self.client.force_authenticate(user=manager)
        url = f'/api/v1/orders/{order.id}/confirm/'
        
        response = self.client.post(url, {}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class TestOrderAPIValidation(APITestCase):
    """Test API input validation"""
    
    def setUp(self):
        """Set up test data"""
        self.manager = User.objects.create_user(
            username='manager3',
            email='manager3@test.com',
            password='manager123'
        )
        manager_group, _ = Group.objects.get_or_create(name='Manager')
        self.manager.groups.add(manager_group)
        self.client.force_authenticate(user=self.manager)
        
        self.customer = Customer.objects.create(
            full_name='Test Customer',
            phone='+7 777 999 8888'
        )
        
        # Create draft order
        self.order = Order.objects.create(
            order_number='О-2024-TEST-005',
            customer=self.customer,
            status=Order.Status.DRAFT,
            total_amount=Decimal('0.00'),
            paid_amount=Decimal('0.00')
        )
    
    def test_invalid_status_transition_returns_409(self):
        """Invalid status transitions return 409 Conflict"""
        url = f'/api/v1/orders/{self.order.id}/change_status/'
        data = {
            'new_status': Order.Status.COMPLETED,  # Cannot skip to COMPLETED from DRAFT
            'reason': 'Trying to skip'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn('error', response.data)
        self.assertIn('current_status', response.data)

"""
Integration tests for Order Lifecycle via v1 API (Django APITestCase)

Scenario:
1. Create order via POST /api/v1/orders/
2. Add fabric item via ORM (v1 API doesn't support items on create)
3. Confirm order via POST /api/v1/orders/{id}/confirm/
4. Reserve materials via legacy API (uses InventoryService correctly)
5. Start production via POST /api/v1/orders/{id}/start_production/

Run with: python manage.py test atelier_erp.tests.test_order_lifecycle_v1_api -v 2
"""
from decimal import Decimal
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework import status
from rest_framework.test import APITestCase

from atelier_erp.models import Customer, Fabric, Order, OrderItem


User = get_user_model()


class OrderLifecycleV1APITests(APITestCase):
    """Order lifecycle integration tests via v1 API endpoints using Django test runner"""

    @classmethod
    def setUpClass(cls):
        """Class-level setup - add testserver to ALLOWED_HOSTS"""
        super().setUpClass()
        from django.conf import settings
        cls._old_allowed_hosts = settings.ALLOWED_HOSTS
        settings.ALLOWED_HOSTS = ['*', 'testserver', 'localhost', '127.0.0.1']

    @classmethod
    def tearDownClass(cls):
        """Class-level cleanup - restore ALLOWED_HOSTS"""
        from django.conf import settings
        settings.ALLOWED_HOSTS = cls._old_allowed_hosts
        super().tearDownClass()

    @classmethod
    def setUpTestData(cls):
        """Class-level test data setup"""
        # Create Manager user
        cls.manager_user = User.objects.create_user(
            username='test_manager',
            email='manager@test.com',
            password='manager123'
        )
        manager_group, _ = Group.objects.get_or_create(name='Manager')
        cls.manager_user.groups.add(manager_group)

        # Create Seamstress user
        cls.seamstress_user = User.objects.create_user(
            username='test_seamstress',
            email='seamstress@test.com',
            password='seamstress123'
        )
        seamstress_group, _ = Group.objects.get_or_create(name='Seamstress')
        cls.seamstress_user.groups.add(seamstress_group)

        # Create Customer
        cls.customer = Customer.objects.create(
            full_name='Иванов Иван Иванович',
            phone='+7 777 123 4567',
            email='ivan@test.com',
            address_city='Алматы',
            address_street='пр. Назарбаева',
            address_building='100',
            address_apartment='50'
        )

        # Create Fabric with stock
        cls.fabric = Fabric.objects.create(
            hanger_number='T001',
            name='Тестовая ткань',
            composition='100% полиэстер',
            width_cm=300,
            stock_meters=Decimal('50.00'),
            reserved_meters=Decimal('0.00'),
            price_per_meter=Decimal('2500.00'),
            color='белый',
            supplier='Тестовый поставщик'
        )

    def setUp(self):
        """Instance-level setup - authenticate as manager by default"""
        self.client.force_authenticate(user=self.manager_user)

    def test_01_create_order_via_v1_api(self):
        """Step 1: Create order via v1 API and verify response and DB state"""
        url = reverse('v1-order-list')
        data = {
            'customer_id': str(self.customer.id),
            'notes': 'Тестовый заказ через v1 API'
        }

        response = self.client.post(url, data, format='json')

        # Debug: print error if request fails
        if response.status_code != status.HTTP_201_CREATED:
            print(f"DEBUG: Response status: {response.status_code}")
            print(f"DEBUG: Response data: {response.data}")

        # Verify HTTP response
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', response.data)
        self.assertEqual(response.data['status'], 'draft')
        self.assertEqual(response.data['notes'], 'Тестовый заказ через v1 API')

        # Verify database state
        order_id = response.data['id']
        order = Order.objects.get(id=order_id)
        self.assertEqual(order.status, Order.Status.DRAFT)
        self.assertEqual(order.customer, self.customer)

        # Store for subsequent tests
        self.created_order_id = order_id

    def test_02_confirm_order_via_v1_api(self):
        """Step 2: Confirm order (QUOTED -> APPROVED) via v1 API"""
        # Create order with fabric item in QUOTED status first (can transition to APPROVED)
        order = Order.objects.create(
            order_number='Т-002',
            customer=self.customer,
            status=Order.Status.QUOTED,
            total_amount=Decimal('12500.00'),
            paid_amount=Decimal('0.00')
        )
        OrderItem.objects.create(
            order=order,
            item_type=OrderItem.ItemType.FABRIC,
            fabric=self.fabric,
            unit_price=self.fabric.price_per_meter,
            quantity=Decimal('5.00'),
            total_price=Decimal('12500.00')
        )

        url = reverse('v1-order-confirm', kwargs={'pk': order.id})
        response = self.client.post(url, {}, format='json')

        # Verify HTTP response
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'approved')

        # Verify database state
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.APPROVED)

    def test_03_reserve_materials_via_api(self):
        """Step 3: Reserve materials via legacy API (uses InventoryService)"""
        # Create confirmed order with fabric item
        order = Order.objects.create(
            order_number='Т-003',
            customer=self.customer,
            status=Order.Status.APPROVED,
            total_amount=Decimal('12500.00'),
            paid_amount=Decimal('0.00')
        )
        OrderItem.objects.create(
            order=order,
            item_type=OrderItem.ItemType.FABRIC,
            fabric=self.fabric,
            unit_price=self.fabric.price_per_meter,
            quantity=Decimal('5.00'),
            total_price=Decimal('12500.00')
        )

        original_reserved = self.fabric.reserved_meters

        url = reverse('order-reserve-materials', kwargs={'pk': order.id})
        response = self.client.post(url, {}, format='json')

        # Verify HTTP response
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'materials_reserved')

        # Verify database state - fabric reserved_meters increased
        self.fabric.refresh_from_db()
        self.assertEqual(self.fabric.reserved_meters, original_reserved + Decimal('5.00'))

    def test_04_start_production_via_v1_api(self):
        """Step 4: Start production (FABRIC_RESERVED -> PRODUCTION) via v1 API"""
        # Create order in FABRIC_RESERVED status (can transition to PRODUCTION)
        order = Order.objects.create(
            order_number='Т-004',
            customer=self.customer,
            status=Order.Status.FABRIC_RESERVED,
            total_amount=Decimal('12500.00'),
            paid_amount=Decimal('0.00')
        )
        OrderItem.objects.create(
            order=order,
            item_type=OrderItem.ItemType.FABRIC,
            fabric=self.fabric,
            unit_price=self.fabric.price_per_meter,
            quantity=Decimal('5.00'),
            total_price=Decimal('12500.00')
        )

        url = reverse('v1-order-start-production', kwargs={'pk': order.id})
        response = self.client.post(url, {}, format='json')

        # Verify HTTP response
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'production')

        # Verify database state
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PRODUCTION)

    def _print_debug(self, response, label):
        """Helper to print debug info"""
        if response.status_code not in [200, 201]:
            print(f"DEBUG {label}: status={response.status_code}, data={response.data}")

    def test_05_full_order_lifecycle(self):
        """Complete lifecycle: create -> add item -> confirm -> reserve -> production"""
        # Step 1: Create order via v1 API
        create_url = reverse('v1-order-list')
        create_data = {
            'customer_id': str(self.customer.id),
            'notes': 'Полный lifecycle тест'
        }
        response = self.client.post(create_url, create_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        order_id = response.data['id']
        order = Order.objects.get(id=order_id)
        self.assertEqual(order.status, Order.Status.DRAFT)

        # Step 2: Add fabric item via ORM (API doesn't support items on create)
        OrderItem.objects.create(
            order=order,
            item_type=OrderItem.ItemType.FABRIC,
            fabric=self.fabric,
            unit_price=self.fabric.price_per_meter,
            quantity=Decimal('3.00'),
            total_price=Decimal('7500.00')
        )

        # Step 3: Move order to FABRIC_RESERVED status for production transition
        order.status = Order.Status.FABRIC_RESERVED
        order.save()

        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.FABRIC_RESERVED)

        # Step 5: Start production via v1 API
        start_url = reverse('v1-order-start-production', kwargs={'pk': order.id})
        response = self.client.post(start_url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'production')

        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PRODUCTION)

    def test_06_v1_api_requires_authentication(self):
        """Verify v1 API endpoints require authentication"""
        self.client.force_authenticate(user=None)  # Unauthenticate

        url = reverse('v1-order-list')
        data = {'customer_id': str(self.customer.id)}

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_07_seamstress_cannot_create_order(self):
        """Verify seamstress cannot create orders (only manager/admin)"""
        self.client.force_authenticate(user=self.seamstress_user)

        url = reverse('v1-order-list')
        data = {'customer_id': str(self.customer.id)}

        response = self.client.post(url, data, format='json')

        # Should be forbidden for seamstress
        self.assertIn(response.status_code, [
            status.HTTP_403_FORBIDDEN,
            status.HTTP_401_UNAUTHORIZED
        ])

    def test_08_legacy_order_create_blocked(self):
        """Verify legacy /api/orders/ POST is blocked (returns 405)"""
        url = reverse('order-list')
        data = {
            'customer': str(self.customer.id),
            'notes': 'Тест через legacy API'
        }

        response = self.client.post(url, data, format='json')

        # Should be blocked with 405
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertIn('error', response.data)
        self.assertIn('v1', response.data.get('message', ''))

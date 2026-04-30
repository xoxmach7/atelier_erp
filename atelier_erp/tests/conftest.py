"""
Pytest fixtures for Atelier ERP tests
"""

import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

from atelier_erp.models import (
    Customer, Fabric, Cornice, Service, Order, OrderItem,
    Task, ProductionAssignment
)
from atelier_erp.services import UnitOfWork

User = get_user_model()


@pytest.fixture
def unit_of_work():
    """Fresh UnitOfWork instance"""
    return UnitOfWork()


@pytest.fixture
def admin_user(db):
    """Admin user fixture"""
    user = User.objects.create_superuser(
        username='admin',
        email='admin@test.com',
        password='admin123'
    )
    return user


@pytest.fixture
def manager_user(db):
    """Manager user fixture"""
    user = User.objects.create_user(
        username='manager',
        email='manager@test.com',
        password='manager123'
    )
    group, _ = Group.objects.get_or_create(name='Manager')
    user.groups.add(group)
    return user


@pytest.fixture
def worker_user(db):
    """Worker user fixture"""
    user = User.objects.create_user(
        username='worker',
        email='worker@test.com',
        password='worker123'
    )
    group, _ = Group.objects.get_or_create(name='Worker')
    user.groups.add(group)
    return user


@pytest.fixture
def customer(db):
    """Test customer fixture"""
    return Customer.objects.create(
        full_name='Иванов Иван Иванович',
        phone='+7 777 123 4567',
        email='ivan@test.com',
        address_city='Алматы',
        address_street='пр. Назарбаева',
        address_building='100',
        address_apartment='50'
    )


@pytest.fixture
def fabric(db):
    """Test fabric fixture"""
    return Fabric.objects.create(
        hanger_number='A001',
        name='Тюль белая',
        composition='100% полиэстер',
        width_cm=300,
        stock_meters=Decimal('50.00'),
        reserved_meters=Decimal('0.00'),
        price_per_meter=Decimal('2500.00'),
        color='белый',
        supplier='Ткани Казахстан'
    )


@pytest.fixture
def low_stock_fabric(db):
    """Low stock fabric fixture"""
    return Fabric.objects.create(
        hanger_number='A002',
        name='Штора синяя',
        stock_meters=Decimal('5.00'),
        reserved_meters=Decimal('0.00'),
        price_per_meter=Decimal('3500.00'),
        color='синий'
    )


@pytest.fixture
def cornice(db):
    """Test cornice fixture"""
    return Cornice.objects.create(
        sku='C001',
        name='Карниз потолочный 2м',
        type='потолочный',
        material='алюминий',
        color='белый',
        length_cm=200,
        stock_count=10,
        price=Decimal('8000.00')
    )


@pytest.fixture
def service(db):
    """Test service fixture"""
    return Service.objects.create(
        name='Пошив штор',
        description='Базовый пошив',
        unit='meter',
        price_per_unit=Decimal('2000.00')
    )


@pytest.fixture
def draft_order(db, customer):
    """Draft order fixture"""
    return Order.objects.create(
        order_number='О-2024-001',
        customer=customer,
        status=Order.Status.DRAFT,
        total_amount=Decimal('0.00'),
        paid_amount=Decimal('0.00')
    )


@pytest.fixture
def confirmed_order(db, customer):
    """Confirmed order fixture"""
    return Order.objects.create(
        order_number='О-2024-002',
        customer=customer,
        status=Order.Status.APPROVED,
        total_amount=Decimal('50000.00'),
        paid_amount=Decimal('25000.00')
    )


@pytest.fixture
def completed_order(db, customer):
    """Completed order fixture"""
    return Order.objects.create(
        order_number='О-2024-COMPLETED',
        customer=customer,
        status=Order.Status.COMPLETED,
        total_amount=Decimal('50000.00'),
        paid_amount=Decimal('50000.00')
    )


@pytest.fixture
def cancelled_order(db, customer):
    """Cancelled order fixture"""
    from django.utils import timezone
    return Order.objects.create(
        order_number='О-2024-CANCELLED',
        customer=customer,
        status=Order.Status.CANCELLED,
        total_amount=Decimal('50000.00'),
        paid_amount=Decimal('0.00'),
        cancel_reason='Тестовая отмена',
        cancelled_at=timezone.now()
    )


@pytest.fixture
def task(db):
    """Test task fixture"""
    return Task.objects.create(
        task_number='З-2024-001',
        client_name='Петров Петр',
        client_phone='+7 777 999 8888',
        source='instagram',
        description='Нужны шторы в гостиную',
        status=Task.Status.LEAD,
        priority='normal'
    )


@pytest.fixture
def api_client():
    """DRF API client"""
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def authenticated_client(api_client, manager_user):
    """Authenticated API client"""
    api_client.force_authenticate(user=manager_user)
    return api_client


@pytest.fixture
def seamstress_user(db):
    """Seamstress user fixture"""
    user = User.objects.create_user(
        username='seamstress',
        email='seamstress@test.com',
        password='seamstress123'
    )
    group, _ = Group.objects.get_or_create(name='Seamstress')
    user.groups.add(group)
    return user


@pytest.fixture
def order_with_fabric_item(db, confirmed_order, fabric):
    """Confirmed order with fabric item for reservation tests"""
    from atelier_erp.models import OrderItem
    OrderItem.objects.create(
        order=confirmed_order,
        item_type=OrderItem.ItemType.FABRIC,
        fabric=fabric,
        fabric_meters=Decimal('5.00'),
        price_per_unit=fabric.price_per_meter,
        quantity=Decimal('5.00')
    )
    return confirmed_order

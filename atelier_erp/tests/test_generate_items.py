"""
Test generate-items-from-quote endpoint
to reproduce and verify the import error fix.
"""

import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model

from atelier_erp.models import Order, OrderItem, Customer, Fabric, Quote, QuoteItem
from atelier_erp.constants import ProductionStage


User = get_user_model()


@pytest.mark.django_db
class TestGenerateItemsFromQuote:
    """Tests for generate-items-from-quote endpoint"""

    @pytest.fixture
    def api_client(self):
        from rest_framework.test import APIClient
        return APIClient()

    @pytest.fixture
    def authenticated_client(self, api_client, user):
        api_client.force_authenticate(user=user)
        return api_client

    @pytest.fixture
    def user(self):
        return User.objects.create_superuser(
            username='testuser_gen',
            password='testpass',
            first_name='Test',
            last_name='User'
        )

    @pytest.fixture
    def customer(self):
        return Customer.objects.create(
            full_name='Generate Test Customer',
            phone='+77007778899'
        )

    @pytest.fixture
    def fabric(self):
        return Fabric.objects.create(
            name='Generate Test Fabric',
            hanger_number='GEN001',
            width_cm=300,
            stock_meters=Decimal('100.00'),
            price_per_meter=Decimal('2000.00')
        )

    @pytest.fixture
    def order(self, customer):
        return Order.objects.create(
            order_number='О-GEN-001',
            customer=customer,
            status=Order.Status.NEW,
            total_amount=Decimal('15000.00'),
            paid_amount=Decimal('5000.00')
        )

    @pytest.fixture
    def approved_quote(self, customer, user, fabric):
        quote = Quote.objects.create(
            quote_number='КП-2026-888',
            customer=customer,
            status=Quote.Status.APPROVED,
            total=Decimal('15000.00'),
            created_by=user
        )
        QuoteItem.objects.create(
            quote=quote,
            room_name='Гостиная',
            fabric=fabric,
            fabric_meters=Decimal('4.00'),
            fabric_cost=Decimal('8000.00'),
            sewing_type='Шторы',
            sewing_cost=Decimal('4000.00'),
            accessories_cost=Decimal('1000.00'),
            cornice_cost=Decimal('2000.00'),
            line_total=Decimal('15000.00'),
            window_width_cm=150,
            window_height_cm=200,
            folds_count=2
        )
        return quote

    def test_generate_items_from_approved_quote_endpoint(
        self, authenticated_client, order, approved_quote
    ):
        """
        Test generate-items-from-quote endpoint.
        Should create OrderItems from approved quote.
        """
        # Link quote to order
        order.quote = approved_quote
        order.save()

        # Verify initial state
        assert OrderItem.objects.filter(order=order).count() == 0

        # Call endpoint
        response = authenticated_client.post(
            f'/api/v1/orders/{order.id}/generate-items-from-quote/',
            {},
            format='json'
        )

        # Check response
        assert response.status_code in [200, 201], \
            f"Expected success, got {response.status_code}: {response.data if hasattr(response, 'data') else response.content}"

        # Verify OrderItem created
        items = OrderItem.objects.filter(order=order)
        assert items.count() >= 1

        # Verify fabric copied
        item = items.first()
        assert item.fabric is not None
        assert item.sewing_type == 'Шторы'

    def test_unapproved_quote_returns_400(
        self, authenticated_client, order, approved_quote, user
    ):
        """
        Test that unapproved quote returns 400 error.
        """
        # Create draft (unapproved) quote
        draft_quote = Quote.objects.create(
            quote_number='КП-2026-777',
            customer=approved_quote.customer,
            status=Quote.Status.DRAFT,
            total=Decimal('15000.00'),
            created_by=user
        )
        QuoteItem.objects.create(
            quote=draft_quote,
            room_name='Спальня',
            fabric=approved_quote.items.first().fabric,
            fabric_meters=Decimal('3.00'),
            fabric_cost=Decimal('6000.00'),
            sewing_type='Шторы',
            sewing_cost=Decimal('3000.00'),
            accessories_cost=Decimal('500.00'),
            cornice_cost=Decimal('1000.00'),
            line_total=Decimal('10500.00'),
            window_width_cm=120,
            window_height_cm=180,
            folds_count=2
        )

        order.source_quote = draft_quote
        order.save()

        response = authenticated_client.post(
            f'/api/v1/orders/{order.id}/generate-items-from-quote/',
            {},
            format='json'
        )

        assert response.status_code == 400
        # Should mention quote not accepted/unapproved

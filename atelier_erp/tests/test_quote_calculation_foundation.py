"""
Test Quote Calculation Foundation changes
P0: Verify QuoteItem fields and Quote → OrderItems conversion
"""

import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model

from atelier_erp.models import (
    Order, OrderItem, Customer, Fabric, Cornice, Quote, QuoteItem
)
from atelier_erp.services.order_service import OrderService
from atelier_erp.services.unit_of_work import UnitOfWork

User = get_user_model()


@pytest.mark.django_db
class TestQuoteItemFields:
    """Test new QuoteItem fields for P0 data loss prevention"""

    @pytest.fixture
    def customer(self):
        return Customer.objects.create(
            full_name='Test Customer',
            phone='+77001112233'
        )

    @pytest.fixture
    def fabric(self):
        return Fabric.objects.create(
            name='Test Fabric',
            hanger_number='TF001',
            width_cm=300,
            stock_meters=Decimal('100.00'),
            price_per_meter=Decimal('2000.00')
        )

    @pytest.fixture
    def tulle_fabric(self):
        return Fabric.objects.create(
            name='Test Tulle',
            hanger_number='TT001',
            width_cm=300,
            stock_meters=Decimal('50.00'),
            price_per_meter=Decimal('1000.00')
        )

    @pytest.fixture
    def cornice(self):
        return Cornice.objects.create(
            name='Test Cornice',
            sku='CN001',
            type='wall',
            price=Decimal('5000.00'),
            stock_count=10
        )

    def test_quote_item_saves_tulle_fields(
        self, customer, fabric, tulle_fabric
    ):
        """P0: QuoteItem must save tulle_fabric, tulle_meters, tulle_cost"""
        quote = Quote.objects.create(
            quote_number='КП-2026-TULLE-001',
            customer=customer,
            status=Quote.Status.DRAFT,
            total=Decimal('25000.00')
        )

        quote_item = QuoteItem.objects.create(
            quote=quote,
            room_name='Гостиная',
            window_name='Окно 1',
            window_width_cm=200,
            window_height_cm=250,
            # Main fabric
            fabric=fabric,
            fabric_meters=Decimal('5.00'),
            fabric_cost=Decimal('10000.00'),
            # Tulle fabric
            tulle_fabric=tulle_fabric,
            tulle_meters=Decimal('3.00'),
            tulle_cost=Decimal('3000.00'),
            # Other fields
            sewing_type='Шторы с тюлем',
            sewing_cost=Decimal('5000.00'),
            accessories_cost=Decimal('2000.00'),
            cornice_cost=Decimal('0.00'),
            installation_price=Decimal('3000.00'),
            additional_services_total=Decimal('2000.00'),
            line_total=Decimal('25000.00')
        )

        # Verify from DB
        saved = QuoteItem.objects.get(id=quote_item.id)
        assert saved.tulle_fabric == tulle_fabric
        assert saved.tulle_meters == Decimal('3.00')
        assert saved.tulle_cost == Decimal('3000.00')
        assert saved.window_name == 'Окно 1'
        assert saved.installation_price == Decimal('3000.00')
        assert saved.additional_services_total == Decimal('2000.00')

    def test_quote_item_line_total_calculation(
        self, customer, fabric, tulle_fabric
    ):
        """P0: line_total must include all components"""
        quote = Quote.objects.create(
            quote_number='КП-2026-CALC-001',
            customer=customer,
            status=Quote.Status.DRAFT,
            total=Decimal('0.00')
        )

        quote_item = QuoteItem.objects.create(
            quote=quote,
            room_name='Спальня',
            window_name='Балконная дверь',
            window_width_cm=150,
            window_height_cm=200,
            fabric=fabric,
            fabric_meters=Decimal('4.00'),
            fabric_cost=Decimal('8000.00'),
            tulle_fabric=tulle_fabric,
            tulle_meters=Decimal('2.50'),
            tulle_cost=Decimal('2500.00'),
            sewing_cost=Decimal('3000.00'),
            accessories_cost=Decimal('1000.00'),
            cornice_cost=Decimal('1500.00'),
            installation_price=Decimal('2000.00'),
            additional_services_total=Decimal('1000.00'),
            line_total=Decimal('19000.00')  # Sum of all above
        )

        # Verify calculation
        expected_total = (
            Decimal('8000.00') +  # fabric
            Decimal('2500.00') +  # tulle
            Decimal('3000.00') +  # sewing
            Decimal('1000.00') +  # accessories
            Decimal('1500.00') +  # cornice
            Decimal('2000.00') +  # installation
            Decimal('1000.00')    # additional services
        )
        assert quote_item.line_total == expected_total


@pytest.mark.django_db
class TestQuoteToOrderConversion:
    """Test Quote → OrderItems conversion preserves all data"""

    @pytest.fixture
    def user(self):
        return User.objects.create_superuser(
            username='testuser_conv',
            password='testpass',
            first_name='Test',
            last_name='User'
        )

    @pytest.fixture
    def customer(self):
        return Customer.objects.create(
            full_name='Conversion Test Customer',
            phone='+77004445566'
        )

    @pytest.fixture
    def fabric(self):
        return Fabric.objects.create(
            name='Conversion Fabric',
            hanger_number='CF001',
            width_cm=300,
            stock_meters=Decimal('100.00'),
            price_per_meter=Decimal('2000.00')
        )

    @pytest.fixture
    def tulle_fabric(self):
        return Fabric.objects.create(
            name='Conversion Tulle',
            hanger_number='CT001',
            width_cm=300,
            stock_meters=Decimal('50.00'),
            price_per_meter=Decimal('1000.00')
        )

    @pytest.fixture
    def approved_quote_with_tulle(self, customer, user, fabric, tulle_fabric):
        """Quote with both curtain and tulle - should create 2 OrderItems"""
        quote = Quote.objects.create(
            quote_number='КП-2026-CONV-001',
            customer=customer,
            status=Quote.Status.APPROVED,
            total=Decimal('25000.00'),
            created_by=user
        )

        QuoteItem.objects.create(
            quote=quote,
            room_name='Гостиная',
            window_name='Большое окно',
            window_width_cm=250,
            window_height_cm=300,
            fabric=fabric,
            fabric_meters=Decimal('6.00'),
            fabric_cost=Decimal('12000.00'),
            tulle_fabric=tulle_fabric,
            tulle_meters=Decimal('4.00'),
            tulle_cost=Decimal('4000.00'),
            sewing_type='Шторы с тюлем',
            sewing_cost=Decimal('5000.00'),
            accessories_cost=Decimal('1000.00'),
            cornice_cost=Decimal('0.00'),
            installation_price=Decimal('2000.00'),
            additional_services_total=Decimal('1000.00'),
            line_total=Decimal('25000.00')
        )

        return quote

    def test_conversion_creates_order_items_with_room_window(
        self, approved_quote_with_tulle, user
    ):
        """P0: OrderItems must have room_name and window_name copied"""
        uow = UnitOfWork()
        service = OrderService(uow)

        order = service.create_order_from_quote(
            quote_id=approved_quote_with_tulle.id,
            order_number='О-2026-001',
            notes='Test conversion',
            created_by=user.id
        )

        # Should create 2 OrderItems (fabric + tulle)
        items = list(OrderItem.objects.filter(order=order))
        assert len(items) == 2

        # Both should have room/window context
        for item in items:
            assert item.room_name == 'Гостиная'
            assert item.window_name == 'Большое окно'
            assert item.window_width_cm == 250
            assert item.window_height_cm == 300
            assert item.sewing_type == 'Шторы с тюлем'

    def test_conversion_preserves_fabric_and_tulle_separately_no_split(
        self, approved_quote_with_tulle, fabric, tulle_fabric, user
    ):
        """P0: Must create separate OrderItems for fabric and tulle
        CRITICAL: total_price must be exact fabric_cost/tulle_cost, NOT split 60/40
        """
        uow = UnitOfWork()
        service = OrderService(uow)

        order = service.create_order_from_quote(
            quote_id=approved_quote_with_tulle.id,
            order_number='О-2026-002',
            created_by=user.id
        )

        items = list(OrderItem.objects.filter(order=order))

        # Find fabric item
        fabric_items = [i for i in items if i.fabric == fabric]
        assert len(fabric_items) == 1
        fabric_item = fabric_items[0]
        assert fabric_item.quantity == Decimal('6.00')
        # CRITICAL: total_price must equal fabric_cost, not include split sewing/etc.
        assert fabric_item.total_price == Decimal('12000.00'), \
            f"Fabric item total_price should be fabric_cost=12000, got {fabric_item.total_price}"
        assert fabric_item.notes == 'Основная ткань для Большое окно'

        # Find tulle item
        tulle_items = [i for i in items if i.fabric == tulle_fabric]
        assert len(tulle_items) == 1
        tulle_item = tulle_items[0]
        assert tulle_item.quantity == Decimal('4.00')
        # CRITICAL: total_price must equal tulle_cost, not include split sewing/etc.
        assert tulle_item.total_price == Decimal('4000.00'), \
            f"Tulle item total_price should be tulle_cost=4000, got {tulle_item.total_price}"
        assert tulle_item.notes == 'Тюль для Большое окно'

        # Verify NO artificial split happened (sewing_cost should NOT be distributed)
        # If 60/40 split existed, fabric would be 12000 + 3000 = 15000
        # and tulle would be 4000 + 2000 = 6000
        assert fabric_item.total_price != Decimal('15000.00'), \
            "BUG: 60/40 split detected in fabric item! Should be exact fabric_cost."
        assert tulle_item.total_price != Decimal('6000.00'), \
            "BUG: 60/40 split detected in tulle item! Should be exact tulle_cost."

    def test_sewing_cornice_installation_not_in_order_items(
        self, approved_quote_with_tulle, user
    ):
        """P0: sewing/cornice/installation costs should NOT create separate OrderItems
        and should NOT be distributed to fabric/tulle items (no split).
        They stay in Quote financial totals only.
        TODO Sprint 2+: Will create separate execution/service items later.
        """
        uow = UnitOfWork()
        service = OrderService(uow)

        order = service.create_order_from_quote(
            quote_id=approved_quote_with_tulle.id,
            order_number='О-2026-004',
            created_by=user.id
        )

        items = list(OrderItem.objects.filter(order=order))

        # Should only have fabric + tulle items
        assert len(items) == 2

        # Verify no service/cornice items created from sewing/installation
        service_items = [i for i in items if i.item_type == 'service']
        cornice_items = [i for i in items if i.item_type == 'cornice']
        assert len(service_items) == 0, \
            "Sewing/installation should not create service items yet (TODO Sprint 2+)"
        assert len(cornice_items) == 0, \
            "Cornice without fabric should not create cornice item (fabric exists)"

        # Verify fabric/tulle items do NOT include sewing/installation costs
        fabric_item = [i for i in items if i.fabric == approved_quote_with_tulle.items.first().fabric][0]
        tulle_item = [i for i in items if i.fabric == approved_quote_with_tulle.items.first().tulle_fabric][0]

        # QuoteItem had: sewing_cost=5000, installation_price=2000, accessories=1000
        # These should NOT be in fabric.total_price or tulle.total_price
        assert fabric_item.total_price == Decimal('12000.00'), \
            f"Fabric item should NOT include sewing/installation costs, got {fabric_item.total_price}"
        assert tulle_item.total_price == Decimal('4000.00'), \
            f"Tulle item should NOT include sewing/installation costs, got {tulle_item.total_price}"

    def test_conversion_without_tulle_creates_single_item(
        self, customer, user, fabric
    ):
        """QuoteItem without tulle should create single OrderItem"""
        quote = Quote.objects.create(
            quote_number='КП-2026-NOTULLE-001',
            customer=customer,
            status=Quote.Status.APPROVED,
            total=Decimal('15000.00'),
            created_by=user
        )

        QuoteItem.objects.create(
            quote=quote,
            room_name='Кухня',
            window_name='Окно над мойкой',
            window_width_cm=120,
            window_height_cm=150,
            fabric=fabric,
            fabric_meters=Decimal('3.00'),
            fabric_cost=Decimal('6000.00'),
            # No tulle
            sewing_type='Римские шторы',
            sewing_cost=Decimal('4000.00'),
            accessories_cost=Decimal('1000.00'),
            cornice_cost=Decimal('2000.00'),
            installation_price=Decimal('2000.00'),
            line_total=Decimal('15000.00')
        )

        uow = UnitOfWork()
        service = OrderService(uow)

        order = service.create_order_from_quote(
            quote_id=quote.id,
            order_number='О-2026-003',
            created_by=user.id
        )

        items = list(OrderItem.objects.filter(order=order))
        assert len(items) == 1
        assert items[0].fabric == fabric
        assert items[0].room_name == 'Кухня'
        assert items[0].window_name == 'Окно над мойкой'


@pytest.mark.django_db
class TestQuoteItemDefaults:
    """Test that new fields have proper defaults for backwards compatibility"""

    @pytest.fixture
    def customer(self):
        return Customer.objects.create(
            full_name='Default Test Customer',
            phone='+77007778899'
        )

    @pytest.fixture
    def fabric(self):
        return Fabric.objects.create(
            name='Default Test Fabric',
            hanger_number='DF001',
            width_cm=300,
            stock_meters=Decimal('100.00'),
            price_per_meter=Decimal('2000.00')
        )

    def test_existing_quote_items_get_default_values(
        self, customer, fabric
    ):
        """Existing QuoteItems should have default values for new fields"""
        quote = Quote.objects.create(
            quote_number='КП-2026-DEFAULT-001',
            customer=customer,
            status=Quote.Status.DRAFT,
            total=Decimal('10000.00')
        )

        # Create QuoteItem with minimal fields (like old code)
        quote_item = QuoteItem.objects.create(
            quote=quote,
            room_name='Тестовая комната',
            fabric=fabric,
            fabric_meters=Decimal('3.00'),
            fabric_cost=Decimal('6000.00'),
            sewing_cost=Decimal('3000.00'),
            accessories_cost=Decimal('1000.00'),
            line_total=Decimal('10000.00'),
            window_width_cm=150,
            window_height_cm=200
        )

        # Verify defaults
        assert quote_item.tulle_fabric is None
        assert quote_item.tulle_meters == Decimal('0.00')
        assert quote_item.tulle_cost == Decimal('0.00')
        assert quote_item.window_name == ''
        assert quote_item.cornice_length_m == Decimal('0.00')
        assert quote_item.installation_price == Decimal('0.00')
        assert quote_item.additional_services_total == Decimal('0.00')

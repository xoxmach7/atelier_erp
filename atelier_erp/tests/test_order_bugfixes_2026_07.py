"""
Регрессии по багам, найденным на пилоте (телефон, 2026-07-13):

- Bug#4: update_quote падал 'select_for_update cannot be used outside of a
  transaction' при «Скачать КП» (mobile сначала зовёт updateQuote).
- Bug#1/#2: экран деталей заказа не показывал замеры, дату замера и адрес,
  т.к. execution-summary не отдавал их на верхнем уровне.
"""

import pytest
from decimal import Decimal
from datetime import date
from django.test import TestCase
from django.contrib.auth import get_user_model

from atelier_erp.models import Order, Customer, Fabric, Measurement, Quote
from atelier_erp.services.quote_service import QuoteService
from atelier_erp.services.order_execution_service import OrderExecutionService

User = get_user_model()


@pytest.mark.django_db
class TestQuoteUpdateTransaction(TestCase):
    """Bug#4: update_quote должен работать без внешней транзакции."""

    def setUp(self):
        self.customer = Customer.objects.create(full_name="C", phone="+70000000001")
        self.order = Order.objects.create(customer=self.customer, order_number="О-2024-900")
        self.service = QuoteService(unit_of_work=None)

    def test_update_quote_without_outer_transaction(self):
        quote = self.service.create_quote_for_order(
            order_id=self.order.id,
            items=[{'room_name': 'Зал', 'window_name': 'Окно 1', 'line_total': Decimal('1000')}],
            quote_number="КП-2024-900",
        )
        # Раньше здесь падало select_for_update outside transaction.
        updated = self.service.update_quote(
            quote_id=quote.id,
            installation_cost=Decimal('500'),
            items=[{'room_name': 'Зал', 'window_name': 'Окно 1', 'line_total': Decimal('2000')}],
        )
        assert updated.installation_cost == Decimal('500')
        assert updated.subtotal == Decimal('2000')
        assert updated.total == Decimal('2500')


@pytest.mark.django_db
class TestExecutionSummaryTopLevel(TestCase):
    """Bug#1/#2: верхний уровень execution-summary для мобильного экрана."""

    def setUp(self):
        self.customer = Customer.objects.create(full_name="C2", phone="+70000000002")
        self.order = Order.objects.create(
            customer=self.customer,
            order_number="О-2024-901",
            measurement_date=date(2026, 7, 13),
            installation_address_city="Алматы",
            installation_address_street="ул. Абая 1",
        )
        self.fabric = Fabric.objects.create(
            name="Бархат", hanger_number="B-9", price_per_meter=Decimal('1500'), width_cm=280
        )
        Measurement.objects.create(
            order=self.order, room_name="Гостиная", window_name="Окно 1",
            width_cm=300, height_cm=250, curtain_fabric=self.fabric, curtain_meters=Decimal('6.6'),
        )

    def test_summary_exposes_measurements_date_address(self):
        summary = OrderExecutionService().get_order_execution_summary(self.order)
        assert summary['measurement_date'] == '2026-07-13'
        assert summary['installation_address'] == 'Алматы, ул. Абая 1'
        assert len(summary['measurements']) == 1
        m = summary['measurements'][0]
        assert m['room_name'] == 'Гостиная'
        assert m['width_cm'] == 300

    def test_measurement_materials_ready_flag(self):
        """Склад отмечает готовность материалов по каждому окну."""
        m = Measurement.objects.get(order=self.order)
        assert m.materials_ready is False

        summary = OrderExecutionService().get_order_execution_summary(self.order)
        assert summary['measurements'][0]['materials_ready'] is False

        m.materials_ready = True
        m.save(update_fields=['materials_ready'])

        summary = OrderExecutionService().get_order_execution_summary(self.order)
        assert summary['measurements'][0]['materials_ready'] is True

    def test_summary_exposes_card_fields(self):
        """Карточка заказа в мобилке: клиент/создан/дизайнер/статус/завершение."""
        summary = OrderExecutionService().get_order_execution_summary(self.order)
        assert summary['customer']['full_name'] == 'C2'
        assert summary['created_at'] is not None
        assert 'designer_name' in summary          # пусто, если ответственный не назначен
        assert summary['status_label']
        assert 'planned_completion' in summary

"""
OrderItem.room_name/window_name должны копироваться из QuoteItem при генерации.

Раньше комната/окно оседали только внутри составной строки `notes`
("Зал / Окно 1 / standard"), а собственные поля `OrderItem.room_name`/
`window_name` оставались пустыми. Из-за этого веб не мог сопоставить
позицию с исходным замером (сопоставление по room_name+window_name —
см. ItemRow.matchedMeasurement на фронте), и позиция после утверждения
КП навсегда открывала урезанную форму редактирования вместо формы замера.
"""

import importlib
import pytest
from decimal import Decimal
from django.apps import apps as real_apps
from django.test import TestCase

from atelier_erp.models import Customer, Order, OrderItem, Quote, QuoteItem, Service
from atelier_erp.services.order_item_generation_service import OrderItemGenerationService

_backfill_module = importlib.import_module(
    "atelier_erp.migrations.0031_backfill_order_item_room_window"
)


@pytest.mark.django_db
class TestOrderItemRoomWindowPropagation(TestCase):
    def setUp(self):
        self.customer = Customer.objects.create(full_name="RW", phone="+70000000099")
        self.order = Order.objects.create(
            customer=self.customer, order_number="О-2024-950", status=Order.Status.NEW,
        )
        self.quote = Quote.objects.create(
            order=self.order, customer=self.customer, quote_number="КП-2024-950",
            status=Quote.Status.APPROVED, total=Decimal('5000'),
        )
        self.service = OrderItemGenerationService()

    def test_room_and_window_name_copied_onto_order_item(self):
        QuoteItem.objects.create(
            quote=self.quote, room_name="Спальня", window_name="Окно 2",
            window_width_cm=200, window_height_cm=150,
            sewing_type="standard", line_total=Decimal('5000'),
        )

        items = self.service.generate_order_items_from_quote(order=self.order, quote=self.quote)

        assert len(items) == 1
        item = items[0]
        assert item.room_name == "Спальня"
        assert item.window_name == "Окно 2"
        # notes больше не дублирует комнату/окно — только тип пошива/сложность.
        assert "Спальня" not in item.notes
        assert "Окно 2" not in item.notes
        assert item.notes == "standard"


@pytest.mark.django_db
class TestBackfillOrderItemRoomWindow(TestCase):
    """Migration 0031: доматчивание уже существующих «сломанных» позиций."""

    def setUp(self):
        self.customer = Customer.objects.create(full_name="BF", phone="+70000000098")
        self.order = Order.objects.create(
            customer=self.customer, order_number="О-2024-951", status=Order.Status.IN_WORK,
        )
        self.quote = Quote.objects.create(
            order=self.order, customer=self.customer, quote_number="КП-2024-951",
            status=Quote.Status.APPROVED, total=Decimal('5000'),
        )
        self.service_ref = Service.objects.create(name="Услуга по КП", unit="window", price_per_unit=Decimal('0'))

    def _broken_item(self, width, height, price):
        return OrderItem.objects.create(
            order=self.order, item_type=OrderItem.ItemType.SERVICE, service=self.service_ref,
            quantity=1, unit_price=price, total_price=price,
            room_name='', window_name='',
            window_width_cm=width, window_height_cm=height,
        )

    def test_unique_match_backfills_room_and_window(self):
        QuoteItem.objects.create(
            quote=self.quote, room_name="Кухня", window_name="Окно 1",
            window_width_cm=180, window_height_cm=140, line_total=Decimal('3000'),
        )
        item = self._broken_item(180, 140, Decimal('3000'))

        _backfill_module.backfill_room_window(real_apps, None)

        item.refresh_from_db()
        assert item.room_name == "Кухня"
        assert item.window_name == "Окно 1"

    def test_ambiguous_match_is_left_untouched(self):
        """Два QuoteItem с одинаковыми размерами/ценой — не гадаем, пропускаем."""
        QuoteItem.objects.create(
            quote=self.quote, room_name="Кухня", window_name="Окно 1",
            window_width_cm=180, window_height_cm=140, line_total=Decimal('3000'),
        )
        QuoteItem.objects.create(
            quote=self.quote, room_name="Зал", window_name="Окно 2",
            window_width_cm=180, window_height_cm=140, line_total=Decimal('3000'),
        )
        item = self._broken_item(180, 140, Decimal('3000'))

        _backfill_module.backfill_room_window(real_apps, None)

        item.refresh_from_db()
        assert item.room_name == ''
        assert item.window_name == ''

    def test_already_populated_items_are_not_touched(self):
        QuoteItem.objects.create(
            quote=self.quote, room_name="Кухня", window_name="Окно 1",
            window_width_cm=180, window_height_cm=140, line_total=Decimal('3000'),
        )
        item = OrderItem.objects.create(
            order=self.order, item_type=OrderItem.ItemType.SERVICE, service=self.service_ref,
            quantity=1, unit_price=Decimal('3000'), total_price=Decimal('3000'),
            room_name="Уже заполнено", window_name="Окно 9",
            window_width_cm=180, window_height_cm=140,
        )

        _backfill_module.backfill_room_window(real_apps, None)

        item.refresh_from_db()
        assert item.room_name == "Уже заполнено"
        assert item.window_name == "Окно 9"

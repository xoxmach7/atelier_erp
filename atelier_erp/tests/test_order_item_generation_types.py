"""
Генерация позиций заказа из КП: тип позиции по ссылке строки КП.

Раньше тип был захардкожен как 'fabric', поэтому строка КП без ткани
(чистая услуга — установка электрокарниза, демонтаж, доставка) роняла
генерацию на constraint orderitem_valid_reference.
"""

import pytest
from decimal import Decimal
from django.test import TestCase

from atelier_erp.models import (
    Order, Customer, Quote, QuoteItem, OrderItem, Fabric, Cornice, Service,
)
from atelier_erp.services.order_item_generation_service import OrderItemGenerationService


@pytest.mark.django_db
class TestOrderItemTypeResolution(TestCase):
    def setUp(self):
        self.customer = Customer.objects.create(full_name="S", phone="+70000000030")
        self.order = Order.objects.create(
            customer=self.customer, order_number="О-2024-940", status=Order.Status.NEW,
        )
        self.quote = Quote.objects.create(
            order=self.order, customer=self.customer, quote_number="КП-2024-940",
            status=Quote.Status.APPROVED, total=Decimal('5000'),
        )
        self.service = OrderItemGenerationService()

    def _quote_item(self, **kwargs):
        return QuoteItem.objects.create(
            quote=self.quote, room_name="Зал", window_name="Окно 1",
            window_width_cm=300, window_height_cm=250,
            line_total=Decimal('5000'), **kwargs
        )

    def _generate(self):
        return self.service.generate_order_items_from_quote(order=self.order, quote=self.quote)

    def test_pure_service_line_does_not_crash(self):
        """Установка электрокарниза без ткани и карниза — раньше падало."""
        self._quote_item(sewing_type="Установка электрокарниза")

        items = self._generate()

        assert len(items) == 1
        item = items[0]
        assert item.item_type == OrderItem.ItemType.SERVICE
        assert item.fabric is None and item.cornice is None
        assert item.service is not None
        assert item.service.name == "Установка электрокарниза"
        # Цена живёт на позиции заказа, а не в справочнике услуг.
        assert item.total_price == Decimal('5000')
        assert item.service.price_per_unit == Decimal('0.00')

    def test_cornice_line_becomes_cornice_item(self):
        cornice = Cornice.objects.create(
            sku="EC-940", name="Электрокарниз", type="electric", price=Decimal('12000'),
        )
        self._quote_item(cornice=cornice)

        items = self._generate()

        assert items[0].item_type == OrderItem.ItemType.CORNICE
        assert items[0].cornice == cornice
        assert items[0].fabric is None

    def test_fabric_line_still_becomes_fabric_item(self):
        fabric = Fabric.objects.create(
            name="Лён", hanger_number="L-940",
            price_per_meter=Decimal('1000'), width_cm=280,
        )
        self._quote_item(fabric=fabric)

        items = self._generate()

        assert items[0].item_type == OrderItem.ItemType.FABRIC
        assert items[0].fabric == fabric

    def test_fabric_wins_over_cornice_on_same_line(self):
        """Смешанная строка остаётся тканевой — поведение не меняем."""
        fabric = Fabric.objects.create(
            name="Бархат", hanger_number="B-940",
            price_per_meter=Decimal('2000'), width_cm=280,
        )
        cornice = Cornice.objects.create(
            sku="K-940", name="Карниз", type="profile", price=Decimal('5000'),
        )
        self._quote_item(fabric=fabric, cornice=cornice)

        items = self._generate()

        assert items[0].item_type == OrderItem.ItemType.FABRIC

    def test_service_without_sewing_type_gets_generic_name(self):
        self._quote_item()

        items = self._generate()

        assert items[0].item_type == OrderItem.ItemType.SERVICE
        assert items[0].service.name == "Услуга по КП"

    def test_service_dictionary_entry_is_reused_not_duplicated(self):
        """Повторная генерация не должна плодить записи справочника."""
        self._quote_item(sewing_type="Демонтаж")
        self._generate()

        second_order = Order.objects.create(
            customer=self.customer, order_number="О-2024-941", status=Order.Status.NEW,
        )
        second_quote = Quote.objects.create(
            order=second_order, customer=self.customer, quote_number="КП-2024-941",
            status=Quote.Status.APPROVED, total=Decimal('1000'),
        )
        QuoteItem.objects.create(
            quote=second_quote, room_name="Кухня", window_name="Окно 2",
            window_width_cm=200, window_height_cm=200,
            line_total=Decimal('1000'), sewing_type="Демонтаж",
        )
        self.service.generate_order_items_from_quote(order=second_order, quote=second_quote)

        assert Service.objects.filter(name="Демонтаж").count() == 1

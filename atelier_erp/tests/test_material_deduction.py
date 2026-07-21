"""
Списание материалов со склада при формировании позиций заказа (2026-07-21).

До этого изменения InventoryItem.quantity не двигался вообще — принятие КП
никак не влияло на остаток на экране «Материалы». Проверяем: списание при
генерации позиций (идемпотентно — повторная генерация не списывает дважды),
возврат на склад при отмене заказа, клип на 0 при нехватке остатка.
"""
from decimal import Decimal

from django.contrib.auth.models import Group
from django.contrib.auth import get_user_model
from django.test import TestCase
import pytest

from atelier_erp.models import (
    Customer, Order, Quote, QuoteItem, Fabric, InventoryItem, Measurement,
    MaterialDeduction,
)
from atelier_erp.roles import Roles
from atelier_erp.services.order_item_generation_service import OrderItemGenerationService
from atelier_erp.services.order_execution_service import OrderExecutionService
from atelier_erp.services.material_deduction_service import (
    deduct_materials_for_order, return_materials_for_order,
)
from atelier_erp.services.inventory_fabric_sync import sync_fabric_from_inventory_item

User = get_user_model()


def _setup_order_with_measurement(customer, number, curtain_qty=None, cornice_qty=None, hardware_qty=None):
    order = Order.objects.create(customer=customer, order_number=number)

    curtain_stock = InventoryItem.objects.create(
        name=f"Ткань {number}", category=InventoryItem.Category.FABRIC,
        unit=InventoryItem.Unit.METER, quantity=Decimal('50'), price_per_unit=Decimal('1000'),
    )
    sync_fabric_from_inventory_item(curtain_stock)  # обычно вызывается из InventoryItemViewSet
    curtain_fabric = Fabric.objects.get(source_item=curtain_stock)

    cornice_stock = InventoryItem.objects.create(
        name=f"Карниз {number}", category=InventoryItem.Category.CORNICE,
        unit=InventoryItem.Unit.METER, quantity=Decimal('20'), price_per_unit=Decimal('500'),
    )
    hardware_stock = InventoryItem.objects.create(
        name=f"Фурнитура {number}", category=InventoryItem.Category.ACCESSORY,
        unit=InventoryItem.Unit.PIECE, quantity=Decimal('30'), price_per_unit=Decimal('100'),
    )

    measurement = Measurement.objects.create(
        order=order, room_name="Гостиная", window_name="Гостиная",
        width_cm=300, height_cm=250,
        curtain_fabric=curtain_fabric, curtain_meters=curtain_qty or Decimal('8'),
        cornice_item=cornice_stock, cornice_quantity=cornice_qty or Decimal('3'),
        hardware_item=hardware_stock, hardware_quantity=hardware_qty or Decimal('10'),
    )

    quote = Quote.objects.create(
        order=order, customer=customer, quote_number=f"КП-{number}",
        status=Quote.Status.APPROVED, total=Decimal('20000'),
    )
    QuoteItem.objects.create(
        quote=quote, room_name="Гостиная", window_name="Гостиная",
        window_width_cm=300, window_height_cm=250, fabric=curtain_fabric,
        line_total=Decimal('20000'),
    )
    return order, quote, measurement, curtain_stock, cornice_stock, hardware_stock


@pytest.mark.django_db
class TestMaterialDeductionOnItemGeneration(TestCase):
    def setUp(self):
        self.customer = Customer.objects.create(full_name="MatDed", phone="+70000000040")

    def test_generating_items_deducts_stock_for_all_material_kinds(self):
        order, quote, measurement, curtain_stock, cornice_stock, hardware_stock = (
            _setup_order_with_measurement(self.customer, "О-2026-940")
        )
        OrderItemGenerationService().generate_order_items_from_quote(order, quote)

        curtain_stock.refresh_from_db()
        cornice_stock.refresh_from_db()
        hardware_stock.refresh_from_db()
        assert curtain_stock.quantity == Decimal('42.00')   # 50 - 8
        assert cornice_stock.quantity == Decimal('17.00')   # 20 - 3
        assert hardware_stock.quantity == Decimal('20.00')  # 30 - 10
        assert MaterialDeduction.objects.filter(order=order).count() == 3

    def test_regenerating_items_does_not_deduct_twice(self):
        order, quote, measurement, curtain_stock, cornice_stock, hardware_stock = (
            _setup_order_with_measurement(self.customer, "О-2026-941")
        )
        OrderItemGenerationService().generate_order_items_from_quote(order, quote)
        OrderItemGenerationService().generate_order_items_from_quote(order, quote, force=True)

        curtain_stock.refresh_from_db()
        assert curtain_stock.quantity == Decimal('42.00')  # списано один раз, не два
        assert MaterialDeduction.objects.filter(order=order, reversed_at__isnull=True).count() == 3

    def test_deduction_clips_at_zero_when_stock_insufficient(self):
        order, quote, measurement, curtain_stock, cornice_stock, hardware_stock = (
            _setup_order_with_measurement(self.customer, "О-2026-942", curtain_qty=Decimal('1000'))
        )
        OrderItemGenerationService().generate_order_items_from_quote(order, quote)

        curtain_stock.refresh_from_db()
        assert curtain_stock.quantity == Decimal('0.00')

    def test_fabric_without_source_item_is_skipped(self):
        """Каталожная запись без живой позиции склада — списывать нечего."""
        order = Order.objects.create(customer=self.customer, order_number="О-2026-943")
        catalog_only_fabric = Fabric.objects.create(
            name="Старый каталог", hanger_number="OLD-1", price_per_meter=Decimal('500'),
        )
        Measurement.objects.create(
            order=order, room_name="Кухня", window_name="Кухня",
            width_cm=200, height_cm=200,
            curtain_fabric=catalog_only_fabric, curtain_meters=Decimal('5'),
        )
        deduct_materials_for_order(order)
        assert MaterialDeduction.objects.filter(order=order).count() == 0


@pytest.mark.django_db
class TestMaterialReturnOnCancellation(TestCase):
    def setUp(self):
        self.customer = Customer.objects.create(full_name="MatRet", phone="+70000000041")
        self.owner = User.objects.create_user(username="owner_matret", password="x")
        group, _ = Group.objects.get_or_create(name=Roles.OWNER)
        self.owner.groups.add(group)

    def test_cancelling_order_returns_deducted_stock(self):
        order, quote, measurement, curtain_stock, cornice_stock, hardware_stock = (
            _setup_order_with_measurement(self.customer, "О-2026-944")
        )
        OrderItemGenerationService().generate_order_items_from_quote(order, quote)
        curtain_stock.refresh_from_db()
        assert curtain_stock.quantity == Decimal('42.00')

        OrderExecutionService().cancel_order(order=order, reason="Клиент отказался", user=self.owner)

        curtain_stock.refresh_from_db()
        cornice_stock.refresh_from_db()
        hardware_stock.refresh_from_db()
        assert curtain_stock.quantity == Decimal('50.00')
        assert cornice_stock.quantity == Decimal('20.00')
        assert hardware_stock.quantity == Decimal('30.00')
        assert not MaterialDeduction.objects.filter(order=order, reversed_at__isnull=True).exists()

    def test_cancelling_order_without_deductions_does_not_crash(self):
        order = Order.objects.create(customer=self.customer, order_number="О-2026-945")
        cancelled = OrderExecutionService().cancel_order(order=order, reason="Тест", user=self.owner)
        assert cancelled.status == Order.Status.CANCELLED

    def test_double_return_is_a_no_op(self):
        """return_materials_for_order дважды подряд не должен вернуть материал вдвойне."""
        order, quote, measurement, curtain_stock, cornice_stock, hardware_stock = (
            _setup_order_with_measurement(self.customer, "О-2026-946")
        )
        OrderItemGenerationService().generate_order_items_from_quote(order, quote)

        return_materials_for_order(order)
        return_materials_for_order(order)

        curtain_stock.refresh_from_db()
        assert curtain_stock.quantity == Decimal('50.00')

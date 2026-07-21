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
from rest_framework.test import APIClient

User = get_user_model()


def _setup_order_with_measurement(
    customer, number, curtain_qty=None, cornice_qty=None, hardware_qty=None, measurement_quantity=None,
):
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
        quantity=measurement_quantity or 1,
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

    def test_deduction_scales_with_measurement_quantity(self):
        """
        2026-07-21: Measurement.quantity — сколько одинаковых изделий по
        этому окну; curtain_meters/cornice_quantity/hardware_quantity — расход
        на ОДНО изделие. Списание обязано умножаться на quantity, как и цена
        (window_price_breakdown) — раньше не умножалось вообще.
        """
        order, quote, measurement, curtain_stock, cornice_stock, hardware_stock = (
            _setup_order_with_measurement(self.customer, "О-2026-949", measurement_quantity=2)
        )
        OrderItemGenerationService().generate_order_items_from_quote(order, quote)

        curtain_stock.refresh_from_db()
        cornice_stock.refresh_from_db()
        hardware_stock.refresh_from_db()
        assert curtain_stock.quantity == Decimal('34.00')   # 50 - 8*2
        assert cornice_stock.quantity == Decimal('14.00')   # 20 - 3*2
        assert hardware_stock.quantity == Decimal('10.00')  # 30 - 10*2

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


@pytest.mark.django_db
class TestMaterialReturnOnLastItemDeletion(TestCase):
    """
    2026-07-21: владелец удалил все позиции заказа вручную (не через отмену
    заказа) — материал должен вернуться на склад, но не возвращался вообще,
    manage_item DELETE не знал ни про какое списание.
    """

    def setUp(self):
        self.customer = Customer.objects.create(full_name="MatDelLast", phone="+70000000042")
        self.owner = User.objects.create_user(username="owner_matdel", password="x")
        group, _ = Group.objects.get_or_create(name=Roles.OWNER)
        self.owner.groups.add(group)
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def test_deleting_last_item_returns_stock(self):
        order, quote, measurement, curtain_stock, cornice_stock, hardware_stock = (
            _setup_order_with_measurement(self.customer, "О-2026-947")
        )
        OrderItemGenerationService().generate_order_items_from_quote(order, quote)
        curtain_stock.refresh_from_db()
        assert curtain_stock.quantity == Decimal('42.00')

        item = order.items.get()
        resp = self.client.delete(f'/api/v1/orders/{order.id}/items/{item.id}/')
        assert resp.status_code == 204, resp.content

        curtain_stock.refresh_from_db()
        cornice_stock.refresh_from_db()
        hardware_stock.refresh_from_db()
        assert curtain_stock.quantity == Decimal('50.00')
        assert cornice_stock.quantity == Decimal('20.00')
        assert hardware_stock.quantity == Decimal('30.00')
        assert not MaterialDeduction.objects.filter(order=order, reversed_at__isnull=True).exists()

    def test_deleting_one_of_several_items_returns_only_its_own_stock(self):
        """
        2026-07-21: списание теперь привязано к конкретной позиции
        (MaterialDeduction.order_item) — удаление ОДНОЙ позиции возвращает
        именно её долю, даже если в заказе остаются другие. Раньше возврат
        срабатывал только когда позиций не оставалось вообще.
        """
        order, quote, measurement, curtain_stock, cornice_stock, hardware_stock = (
            _setup_order_with_measurement(self.customer, "О-2026-948")
        )
        # Вторая позиция без своих материалов — просто чтобы после удаления
        # первой у заказа осталась хотя бы одна.
        QuoteItem.objects.create(
            quote=quote, room_name="Спальня", window_name="Спальня",
            window_width_cm=200, window_height_cm=200,
            fabric=None, line_total=Decimal('5000'), sewing_type='service',
        )
        OrderItemGenerationService().generate_order_items_from_quote(order, quote)
        curtain_stock.refresh_from_db()
        assert curtain_stock.quantity == Decimal('42.00')

        item = order.items.filter(room_name="Гостиная").get()
        resp = self.client.delete(f'/api/v1/orders/{order.id}/items/{item.id}/')
        assert resp.status_code == 204, resp.content

        curtain_stock.refresh_from_db()
        assert curtain_stock.quantity == Decimal('50.00')  # вернулось, хотя вторая позиция осталась
        assert order.items.count() == 1


@pytest.mark.django_db
class TestMaterialDeductionFollowsItemQuantityChange(TestCase):
    """
    2026-07-21: владелец увеличил количество позиции через степпер в карточке
    заказа (PATCH .../items/{id}/ quantity) — материал списался только на
    старое количество и никак не подстраивался под новое.
    """

    def setUp(self):
        self.customer = Customer.objects.create(full_name="MatQtyChange", phone="+70000000043")
        self.owner = User.objects.create_user(username="owner_matqty", password="x")
        group, _ = Group.objects.get_or_create(name=Roles.OWNER)
        self.owner.groups.add(group)
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def test_increasing_item_quantity_deducts_more_stock(self):
        order, quote, measurement, curtain_stock, cornice_stock, hardware_stock = (
            _setup_order_with_measurement(self.customer, "О-2026-950")
        )
        OrderItemGenerationService().generate_order_items_from_quote(order, quote)
        curtain_stock.refresh_from_db()
        assert curtain_stock.quantity == Decimal('42.00')  # 50 - 8

        item = order.items.get()
        resp = self.client.patch(
            f'/api/v1/orders/{order.id}/items/{item.id}/', {'quantity': 2}, format='json',
        )
        assert resp.status_code == 200, resp.content

        curtain_stock.refresh_from_db()
        cornice_stock.refresh_from_db()
        hardware_stock.refresh_from_db()
        assert curtain_stock.quantity == Decimal('34.00')   # 50 - 8*2
        assert cornice_stock.quantity == Decimal('14.00')   # 20 - 3*2
        assert hardware_stock.quantity == Decimal('10.00')  # 30 - 10*2

    def test_decreasing_item_quantity_returns_stock(self):
        order, quote, measurement, curtain_stock, cornice_stock, hardware_stock = (
            _setup_order_with_measurement(self.customer, "О-2026-951", measurement_quantity=2)
        )
        OrderItemGenerationService().generate_order_items_from_quote(order, quote)
        curtain_stock.refresh_from_db()
        assert curtain_stock.quantity == Decimal('34.00')  # 50 - 8*2

        item = order.items.get()
        assert item.quantity == 1  # OrderItem.quantity не связан с Measurement.quantity при генерации
        # Эмулируем реальный сценарий: сначала подняли до 2 (как в замере), потом откатили на 1.
        self.client.patch(f'/api/v1/orders/{order.id}/items/{item.id}/', {'quantity': 2}, format='json')
        self.client.patch(f'/api/v1/orders/{order.id}/items/{item.id}/', {'quantity': 1}, format='json')

        curtain_stock.refresh_from_db()
        assert curtain_stock.quantity == Decimal('34.00')  # вернулись туда же, откуда начали

    def test_item_without_matching_deduction_does_not_crash(self):
        """Позиция без списанного материала (услуга без ткани) — PATCH quantity не должен падать."""
        order = Order.objects.create(customer=self.customer, order_number="О-2026-952")
        quote = Quote.objects.create(
            order=order, customer=self.customer, quote_number="КП-2026-952",
            status=Quote.Status.APPROVED, total=Decimal('5000'),
        )
        QuoteItem.objects.create(
            quote=quote, room_name="Прихожая", window_name="Прихожая",
            window_width_cm=100, window_height_cm=100,
            fabric=None, line_total=Decimal('5000'), sewing_type='service',
        )
        OrderItemGenerationService().generate_order_items_from_quote(order, quote)
        item = order.items.get()

        resp = self.client.patch(
            f'/api/v1/orders/{order.id}/items/{item.id}/', {'quantity': 3}, format='json',
        )
        assert resp.status_code == 200, resp.content

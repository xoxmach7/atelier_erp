"""
Автопродвижение статуса заказа по событиям.

Проверяем и что переход происходит, и — не менее важно — что автоматика молчит
там, где переход запрещён, не роняя основную операцию (приём платежа, отметку
готовности материалов).

См. docs/superpowers/specs/2026-07-18-status-automation-design.md
"""

import pytest
from decimal import Decimal
from django.test import TestCase

from atelier_erp.models import Order, Customer, Quote, QuoteItem, OrderItem, Fabric, OrderStatusHistory, Measurement
from atelier_erp.services.exceptions import OrderValidationError
from atelier_erp.constants import MaterialReadiness, ProductionStage
from atelier_erp.services.status_automation import auto_advance
from atelier_erp.services.order_execution_service import OrderExecutionService
from atelier_erp.services.payment_service import PaymentService
from atelier_erp.services.order_item_generation_service import OrderItemGenerationService
from atelier_erp.services.order_service import OrderService


def _order(customer, number, **kwargs):
    return Order.objects.create(customer=customer, order_number=number, **kwargs)


def _item(order):
    """
    Позиция заказа: без неё FSM не пускает в производство.
    Тип fabric с реальной тканью — constraint orderitem_valid_reference требует,
    чтобы ссылка соответствовала item_type.
    """
    fabric = Fabric.objects.create(
        name="Лён", hanger_number=f"L-{order.order_number[-3:]}",
        price_per_meter=Decimal('1000'), width_cm=280,
    )
    return OrderItem.objects.create(
        order=order, item_type=OrderItem.ItemType.FABRIC, fabric=fabric,
        room_name="Зал", window_name="Окно 1",
        quantity=Decimal('1'), unit_price=Decimal('1000'), total_price=Decimal('1000'),
    )


@pytest.mark.django_db
class TestAutoAdvanceGuards(TestCase):
    """Базовые гарантии: не бросает, не трогает терминальные статусы."""

    def setUp(self):
        self.customer = Customer.objects.create(full_name="A", phone="+70000000020")

    def test_returns_false_when_transition_forbidden(self):
        order = _order(self.customer, "О-2024-920", status=Order.Status.NEW)
        # in_work требует одобренного КП и позиций — их нет.
        assert auto_advance(order, Order.Status.IN_WORK, "тест") is False
        order.refresh_from_db()
        assert order.status == Order.Status.NEW

    def test_never_touches_completed_order(self):
        order = _order(self.customer, "О-2024-921", status=Order.Status.COMPLETED)
        assert auto_advance(order, Order.Status.IN_WORK, "тест") is False
        order.refresh_from_db()
        assert order.status == Order.Status.COMPLETED

    def test_never_touches_cancelled_order(self):
        order = _order(self.customer, "О-2024-922", status=Order.Status.CANCELLED)
        assert auto_advance(order, Order.Status.IN_WORK, "тест") is False

    def test_noop_when_already_in_target(self):
        order = _order(self.customer, "О-2024-923", status=Order.Status.IN_WORK)
        before = OrderStatusHistory.objects.filter(order=order).count()
        assert auto_advance(order, Order.Status.IN_WORK, "тест") is False
        assert OrderStatusHistory.objects.filter(order=order).count() == before


@pytest.mark.django_db
class TestMaterialsReadyStartsProduction(TestCase):
    def setUp(self):
        self.customer = Customer.objects.create(full_name="B", phone="+70000000021")
        self.order = _order(self.customer, "О-2024-924", status=Order.Status.IN_WORK)
        _item(self.order)

    def test_materials_ready_moves_to_production(self):
        order, _ = OrderExecutionService().change_material_readiness(
            order=self.order, material_readiness=MaterialReadiness.READY,
        )
        order.refresh_from_db()
        assert order.status == Order.Status.IN_PRODUCTION

    def test_partial_readiness_does_not_move(self):
        order, _ = OrderExecutionService().change_material_readiness(
            order=self.order, material_readiness=MaterialReadiness.PARTIALLY_READY,
        )
        order.refresh_from_db()
        assert order.status == Order.Status.IN_WORK

    def test_materials_ready_in_wrong_status_does_not_move(self):
        """Из new материалы не должны утаскивать заказ в производство."""
        other = _order(self.customer, "О-2024-925", status=Order.Status.NEW)
        OrderExecutionService().change_material_readiness(
            order=other, material_readiness=MaterialReadiness.READY,
        )
        other.refresh_from_db()
        assert other.status == Order.Status.NEW


@pytest.mark.django_db
class TestProductionDoneMakesReady(TestCase):
    def test_production_done_moves_straight_to_on_installation(self):
        """
        2026-07-20: ready -> on_installation тоже автоматизирован — раньше
        требовал ручного клика владельца ("назначение бригады"), но никакого
        решения там не было (монтажник уже мог действовать по заказу в ready).
        Пошив закончен -> заказ сразу у монтажника, без промежуточного шага.
        """
        customer = Customer.objects.create(full_name="C", phone="+70000000022")
        order = _order(customer, "О-2024-926", status=Order.Status.IN_PRODUCTION)
        OrderExecutionService().change_production_stage(
            order=order, production_stage=ProductionStage.DONE,
        )
        order.refresh_from_db()
        assert order.status == Order.Status.ON_INSTALLATION


@pytest.mark.django_db
class TestProductionDoneRequiresAllWindowsSewn(TestCase):
    """
    2026-07-21: раньше «все окна отмечены швеёй» проверялось только на
    мобилке (кнопка «Завершить пошив» отключена, пока не отмечены все
    изделия) — сам API это принимал без проверки. Дублируем инвариант на
    сервере, чтобы он не зависел от конкретного клиента (веб/curl могли
    закрыть пошив в обход мобильного гейта).
    """

    def setUp(self):
        self.customer = Customer.objects.create(full_name="E", phone="+70000000030")
        self.order = _order(self.customer, "О-2024-930", status=Order.Status.IN_PRODUCTION)

    def test_blocks_when_not_all_windows_sewn(self):
        Measurement.objects.create(order=self.order, room_name="Зал", width_cm=300, height_cm=250, sewing_done=True)
        Measurement.objects.create(order=self.order, room_name="Спальня", width_cm=200, height_cm=220, sewing_done=False)

        with self.assertRaises(OrderValidationError):
            OrderExecutionService().change_production_stage(
                order=self.order, production_stage=ProductionStage.DONE,
            )
        self.order.refresh_from_db()
        assert self.order.status == Order.Status.IN_PRODUCTION

    def test_allows_when_all_windows_sewn(self):
        Measurement.objects.create(order=self.order, room_name="Зал", width_cm=300, height_cm=250, sewing_done=True)
        Measurement.objects.create(order=self.order, room_name="Спальня", width_cm=200, height_cm=220, sewing_done=True)

        OrderExecutionService().change_production_stage(
            order=self.order, production_stage=ProductionStage.DONE,
        )
        self.order.refresh_from_db()
        assert self.order.status == Order.Status.ON_INSTALLATION

    def test_no_measurements_does_not_block(self):
        """Заказ без замеров (услуги без окон) — гейт применять не к чему."""
        OrderExecutionService().change_production_stage(
            order=self.order, production_stage=ProductionStage.DONE,
        )
        self.order.refresh_from_db()
        assert self.order.status == Order.Status.ON_INSTALLATION


@pytest.mark.django_db
class TestItemsGeneratedStartsWork(TestCase):
    def test_generating_items_from_approved_quote_moves_to_in_work(self):
        customer = Customer.objects.create(full_name="D", phone="+70000000023")
        order = _order(customer, "О-2024-927", status=Order.Status.NEW)
        quote = Quote.objects.create(
            order=order, customer=customer, quote_number="КП-2024-927",
            status=Quote.Status.APPROVED, total=Decimal('1000'),
        )
        # Обычная тканевая строка КП. Строки без ткани (чистые услуги) тоже
        # поддерживаются — см. test_order_item_generation_types.py.
        fabric = Fabric.objects.create(
            name="Хлопок", hanger_number="H-927",
            price_per_meter=Decimal('900'), width_cm=280,
        )
        QuoteItem.objects.create(
            quote=quote, room_name="Зал", window_name="Окно 1",
            window_width_cm=300, window_height_cm=250, fabric=fabric,
            line_total=Decimal('1000'),
        )

        OrderItemGenerationService().generate_order_items_from_quote(order=order, quote=quote)

        order.refresh_from_db()
        assert order.status == Order.Status.IN_WORK

    def test_generating_items_syncs_order_total_amount(self):
        """
        2026-07-20: order.total_amount раньше не выставлялся при генерации
        позиций и оставался 0 — заказ на 20000 не мог собрать оплату и
        навсегда застревал в on_installation (FSM не пускает оттуда в
        completed напрямую, а balance_due=0 не пускал в waiting_final_payment).
        Берём quote.total (включает installation_cost/delivery/скидку), а не
        сумму позиций — она их не содержит.
        """
        customer = Customer.objects.create(full_name="E", phone="+70000000028")
        order = _order(customer, "О-2024-931", status=Order.Status.NEW)
        quote = Quote.objects.create(
            order=order, customer=customer, quote_number="КП-2024-931",
            status=Quote.Status.APPROVED, subtotal=Decimal('15000'),
            installation_cost=Decimal('5000'), total=Decimal('20000'),
        )
        fabric = Fabric.objects.create(
            name="Бархат", hanger_number="H-931",
            price_per_meter=Decimal('900'), width_cm=280,
        )
        QuoteItem.objects.create(
            quote=quote, room_name="Зал", window_name="Окно 1",
            window_width_cm=300, window_height_cm=250, fabric=fabric,
            line_total=Decimal('15000'),
        )

        OrderItemGenerationService().generate_order_items_from_quote(order=order, quote=quote)

        order.refresh_from_db()
        assert order.total_amount == Decimal('20000')

    def test_history_marks_transition_as_automatic(self):
        """Автопереход должен быть отличим от ручного при разборе."""
        customer = Customer.objects.create(full_name="E", phone="+70000000024")
        order = _order(customer, "О-2024-928", status=Order.Status.IN_PRODUCTION)
        OrderExecutionService().change_production_stage(
            order=order, production_stage=ProductionStage.DONE,
        )
        notes = OrderStatusHistory.objects.filter(
            order=order, new_status=Order.Status.READY,
        ).values_list('notes', flat=True)
        assert any('[авто]' in (n or '') for n in notes)


@pytest.mark.django_db
class TestFinalPaymentCompletesOrder(TestCase):
    def setUp(self):
        self.customer = Customer.objects.create(full_name="F", phone="+70000000025")

    def test_payment_does_not_crash_when_completion_blocked(self):
        """
        Главная гарантия: заказ нельзя завершить без АВР и фотоотчёта, но
        приём платежа обязан пройти, а не упасть из-за этого.
        """
        order = _order(
            self.customer, "О-2024-929",
            status=Order.Status.WAITING_FINAL_PAYMENT,
            total_amount=Decimal('1000'),
        )
        payment = PaymentService(unit_of_work=None).record_payment(
            order_id=order.id, amount=Decimal('1000'),
            payment_type='final', payment_method='cash',
        )
        assert payment.amount == Decimal('1000')
        order.refresh_from_db()
        assert order.paid_amount == Decimal('1000')
        # Завершение заблокировано инвариантами — статус не изменился.
        assert order.status == Order.Status.WAITING_FINAL_PAYMENT

    def test_full_prepayment_early_does_not_complete_order(self):
        """100% предоплата в in_work не должна закрывать несшитый заказ."""
        order = _order(
            self.customer, "О-2024-930",
            status=Order.Status.IN_WORK, total_amount=Decimal('500'),
        )
        PaymentService(unit_of_work=None).record_payment(
            order_id=order.id, amount=Decimal('500'),
            payment_type='prepayment', payment_method='cash',
        )
        order.refresh_from_db()
        assert order.status == Order.Status.IN_WORK

    def test_completing_order_sets_actual_completion(self):
        """
        2026-07-21: actual_completion объявлялся на модели, но реально
        проставлялся только в неиспользуемом legacy-методе complete_order —
        нужен для грейс-периода видимости завершённого заказа у исполнителей
        (role_scope._active_or_overdue_q). transition_status — единственное
        реальное место, где статус меняется на completed.
        """
        order = _order(
            self.customer, "О-2024-932",
            status=Order.Status.WAITING_FINAL_PAYMENT,
        )
        assert order.actual_completion is None

        OrderService(unit_of_work=None).transition_status(
            order_id=order.id, new_status=Order.Status.COMPLETED,
        )
        order.refresh_from_db()
        assert order.actual_completion is not None

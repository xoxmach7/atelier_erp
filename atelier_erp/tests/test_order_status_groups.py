"""
Группы статусов заказа для фильтр-пилюль (?status_group=).

Проверяем именно раскладку группа→статусы и «просрочен» как производное
состояние — это единственное место, где она задана, и мобилка на неё опирается.
"""

import pytest
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone

from atelier_erp.models import Order, Customer
from atelier_erp.api.v1.filters import OrderFilterSet


def _filter(group):
    fs = OrderFilterSet(
        data={'status_group': group},
        queryset=Order.objects.all(),
    )
    return list(fs.qs)


@pytest.mark.django_db
class TestOrderStatusGroups(TestCase):
    def setUp(self):
        self.customer = Customer.objects.create(full_name="G", phone="+70000000010")
        today = timezone.localtime(timezone.now()).date()

        def mk(number, status, planned=None):
            return Order.objects.create(
                customer=self.customer, order_number=number,
                status=status, planned_completion=planned,
            )

        self.new = mk("О-2024-910", Order.Status.NEW)
        self.in_work = mk("О-2024-911", Order.Status.IN_WORK)
        self.in_production = mk("О-2024-912", Order.Status.IN_PRODUCTION)
        self.waiting_pay = mk("О-2024-913", Order.Status.WAITING_FINAL_PAYMENT)
        self.done = mk("О-2024-914", Order.Status.COMPLETED, today - timedelta(days=5))
        self.late = mk("О-2024-915", Order.Status.IN_WORK, today - timedelta(days=1))

    def test_in_work_group_covers_active_stages(self):
        got = _filter('in_work')
        assert self.in_work in got
        assert self.in_production in got
        assert self.new not in got
        assert self.done not in got

    def test_waiting_group_is_new_plus_final_payment(self):
        got = _filter('waiting')
        assert self.new in got
        assert self.waiting_pay in got
        assert self.in_work not in got

    def test_completed_group(self):
        got = _filter('completed')
        assert got == [self.done]

    def test_overdue_excludes_closed_orders(self):
        got = _filter('overdue')
        assert self.late in got
        # Дедлайн прошёл, но заказ завершён — не «горит».
        assert self.done not in got

    def test_unknown_group_returns_nothing(self):
        assert _filter('чепуха') == []

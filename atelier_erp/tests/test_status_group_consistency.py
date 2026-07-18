"""
Список заказов и карточка заказа должны показывать один и тот же статус.

Симптом с пилота: в списке заказ «Просрочен», а внутри — «Новый» или
«Ожидает финальной оплаты». Список брал подпись из ui_badge, карточка — сырой
status_label. Наружу должны выходить ровно четыре группы.
"""

import pytest
from decimal import Decimal
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone

from atelier_erp.models import Order, Customer
from atelier_erp.api.v1.serializers import compute_ui_badge
from atelier_erp.api.v1.status_groups import get_status_group_label, GROUP_LABELS
from atelier_erp.services.order_execution_service import OrderExecutionService

ALLOWED = {'В работе', 'Ожидание', 'Завершён', 'Просрочен'}


@pytest.mark.django_db
class TestStatusGroupConsistency(TestCase):
    def setUp(self):
        self.customer = Customer.objects.create(full_name="SG", phone="+70000000070")
        self.today = timezone.localtime(timezone.now()).date()

    def _order(self, number, status, planned=None):
        return Order.objects.create(
            customer=self.customer, order_number=number,
            status=status, planned_completion=planned,
            total_amount=Decimal('1000'),
        )

    def test_only_four_labels_ever_shown(self):
        for i, status in enumerate(Order.Status.values):
            order = self._order(f"О-2024-98{i}", status)
            assert compute_ui_badge(order)['label'] in ALLOWED, status
            assert get_status_group_label(order) in ALLOWED, status

    def test_no_raw_status_names_leak(self):
        """«Новый» и «Ожидает финальной оплаты» не должны показываться."""
        assert 'Новый' not in GROUP_LABELS.values()
        assert set(GROUP_LABELS.values()) == ALLOWED

    def test_list_and_detail_agree_on_overdue_order(self):
        """Ровно тот случай с пилота: в списке «Просрочен», внутри — «Новый»."""
        order = self._order(
            "О-2024-990", Order.Status.NEW, planned=self.today - timedelta(days=3),
        )
        list_label = compute_ui_badge(order)['label']
        summary = OrderExecutionService().get_order_execution_summary(order)

        assert list_label == 'Просрочен'
        assert summary['status_group_label'] == 'Просрочен'
        assert list_label == summary['status_group_label']

    def test_overdue_does_not_apply_to_closed_orders(self):
        order = self._order(
            "О-2024-991", Order.Status.COMPLETED, planned=self.today - timedelta(days=30),
        )
        assert compute_ui_badge(order)['label'] == 'Завершён'
        summary = OrderExecutionService().get_order_execution_summary(order)
        assert summary['status_group_label'] == 'Завершён'

    def test_waiting_final_payment_matches_between_views(self):
        order = self._order("О-2024-992", Order.Status.WAITING_FINAL_PAYMENT)
        summary = OrderExecutionService().get_order_execution_summary(order)
        assert compute_ui_badge(order)['label'] == 'Ожидание'
        assert summary['status_group_label'] == 'Ожидание'

"""
POST /api/v1/payments/ раньше уходил через дефолтный ModelViewSet.create,
который создавал строку Payment мимо PaymentService.record_payment —
order.paid_amount никогда не рос, и заказ не мог закрыть оплату.
Найдено при сквозном прогоне воркфлоу new -> completed через реальные API
2026-07-20. См. CLAUDE.md.
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework import status
from rest_framework.test import APITestCase

from atelier_erp.models import Customer, Order
from atelier_erp.roles import Roles

User = get_user_model()


class PaymentApiUpdatesOrderTests(APITestCase):
    def setUp(self):
        self.customer = Customer.objects.create(full_name='Платёж Тест', phone='+7 700 555 1122')
        self.owner = User.objects.create_user(username='owner_pay', password='x')
        group, _ = Group.objects.get_or_create(name=Roles.OWNER)
        self.owner.groups.add(group)
        self.order = Order.objects.create(
            order_number='О-2026-931',
            customer=self.customer,
            status=Order.Status.WAITING_FINAL_PAYMENT,
            total_amount=Decimal('20000.00'),
            paid_amount=Decimal('0.00'),
        )

    def test_payment_creation_updates_order_paid_amount(self):
        self.client.force_authenticate(user=self.owner)
        resp = self.client.post('/api/v1/payments/', {
            'order': str(self.order.id),
            'amount': '20000.00',
            'payment_type': 'final',
            'payment_method': 'cash',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)

        self.order.refresh_from_db()
        self.assertEqual(self.order.paid_amount, Decimal('20000.00'))

    def test_full_payment_auto_completes_waiting_order(self):
        """Полная оплата из waiting_final_payment должна закрывать заказ (при
        выполненных остальных условиях — тут их нет, поэтому статус не
        меняется, но paid_amount обязан обновиться в любом случае."""
        self.client.force_authenticate(user=self.owner)
        resp = self.client.post('/api/v1/payments/', {
            'order': str(self.order.id),
            'amount': '20000.00',
            'payment_type': 'final',
            'payment_method': 'cash',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.order.refresh_from_db()
        self.assertEqual(self.order.paid_amount, self.order.total_amount)

    def test_payment_exceeding_balance_rejected(self):
        self.client.force_authenticate(user=self.owner)
        resp = self.client.post('/api/v1/payments/', {
            'order': str(self.order.id),
            'amount': '99999.00',
            'payment_type': 'final',
            'payment_method': 'cash',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.order.refresh_from_db()
        self.assertEqual(self.order.paid_amount, Decimal('0.00'))

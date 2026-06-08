"""
MVP-тесты жизненного цикла заказа через v1 API.

Переписаны под актуальную модель статусов (new → in_work → in_production →
ready → on_installation → waiting_final_payment → completed) и бизнес-гарды
transition_status_mvp. Старые тесты опирались на легаси-статусы (draft/quoted/
approved) и устаревшую семантику confirm — удалены.

Запуск: python manage.py test atelier_erp.tests.test_order_lifecycle_v1_api -v 2
"""
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from atelier_erp.models import Customer, Order
from atelier_erp.roles import Roles

User = get_user_model()


class OrderMvpLifecycleV1ApiTests(APITestCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._hosts = settings.ALLOWED_HOSTS
        settings.ALLOWED_HOSTS = ['*', 'testserver', 'localhost', '127.0.0.1']

    @classmethod
    def tearDownClass(cls):
        settings.ALLOWED_HOSTS = cls._hosts
        super().tearDownClass()

    def setUp(self):
        self.customer = Customer.objects.create(
            full_name='Тест Клиент', phone='+7 700 000 0000', address_city='Алматы',
        )
        self.owner = self._user('owner_lc', Roles.OWNER)
        self.designer = self._user('designer_lc', Roles.DESIGNER)
        self.seamstress = self._user('seam_lc', Roles.SEAMSTRESS)

    def _user(self, username, role):
        user = User.objects.create_user(username=username, password='x')
        group, _ = Group.objects.get_or_create(name=role)
        user.groups.add(group)
        return user

    def _make_order(self, number='О-2026-777', status_value=Order.Status.NEW):
        return Order.objects.create(
            order_number=number,
            customer=self.customer,
            status=status_value,
            total_amount=Decimal('10000.00'),
            paid_amount=Decimal('0.00'),
        )

    def _change_status_url(self, order):
        return f'/api/v1/orders/{order.id}/change-status/'

    # ── Контракт создания ───────────────────────────────────────────────
    def test_create_order_returns_new_status(self):
        self.client.force_authenticate(user=self.owner)
        resp = self.client.post(reverse('v1-order-list'), {'customer_id': str(self.customer.id)}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['status'], Order.Status.NEW)

    def test_unauthenticated_returns_401(self):
        resp = self.client.get(reverse('v1-order-list'))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_seamstress_cannot_create_order(self):
        self.client.force_authenticate(user=self.seamstress)
        resp = self.client.post(reverse('v1-order-list'), {'customer_id': str(self.customer.id)}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    # ── Гарды перехода статуса (MVP) ────────────────────────────────────
    def test_in_work_requires_accepted_quote(self):
        order = self._make_order()
        self.client.force_authenticate(user=self.owner)
        resp = self.client.post(self._change_status_url(order), {'status': Order.Status.IN_WORK}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data.get('code'), 'quote_not_accepted')

    def test_in_production_requires_materials(self):
        order = self._make_order()
        self.client.force_authenticate(user=self.owner)
        resp = self.client.post(self._change_status_url(order), {'status': Order.Status.IN_PRODUCTION}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(resp.data.get('code'), ['material_not_ready', 'no_order_items'])

    def test_invalid_transition_returns_409(self):
        order = self._make_order()
        self.client.force_authenticate(user=self.owner)
        # new → on_installation не разрешён FSM (и не покрыт гардами) → 409
        resp = self.client.post(self._change_status_url(order), {'status': Order.Status.ON_INSTALLATION}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)

    def test_change_status_requires_auth(self):
        order = self._make_order()
        resp = self.client.post(self._change_status_url(order), {'status': Order.Status.IN_WORK}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class UIBadgeTests(APITestCase):
    """Тесты поля ui_badge в OrderListSerializer."""

    def setUp(self):
        from atelier_erp.models import Customer, Order
        from decimal import Decimal
        from datetime import date, timedelta
        self.customer = Customer.objects.create(
            full_name='Badge Test', phone='+7 700 000 9999', address_city='Алматы')
        self.Order = Order
        self.Decimal = Decimal
        self.date = date
        self.timedelta = timedelta

    def _order(self, status, material_readiness=None, planned_completion=None, number_suffix='999'):
        from atelier_erp.services.numbering import next_number
        from atelier_erp.constants import MaterialReadiness
        kwargs = dict(
            order_number=next_number('order'),
            customer=self.customer,
            status=status,
            total_amount=self.Decimal('1000'),
            paid_amount=self.Decimal('0'),
        )
        if material_readiness:
            kwargs['material_readiness'] = material_readiness
        if planned_completion:
            kwargs['planned_completion'] = planned_completion
        return self.Order.objects.create(**kwargs)

    def _badge(self, order):
        from atelier_erp.api.v1.serializers import compute_ui_badge
        return compute_ui_badge(order)

    def test_new_order_is_gray(self):
        o = self._order(self.Order.Status.NEW)
        self.assertEqual(self._badge(o)['color'], 'gray')

    def test_completed_is_gray(self):
        o = self._order(self.Order.Status.COMPLETED)
        self.assertEqual(self._badge(o)['color'], 'gray')

    def test_in_work_with_materials_ready_is_green(self):
        from atelier_erp.constants import MaterialReadiness
        o = self._order(self.Order.Status.IN_WORK, material_readiness=MaterialReadiness.READY)
        self.assertEqual(self._badge(o)['color'], 'green')

    def test_in_work_without_materials_is_yellow(self):
        from atelier_erp.constants import MaterialReadiness
        o = self._order(self.Order.Status.IN_WORK, material_readiness=MaterialReadiness.NOT_READY)
        badge = self._badge(o)
        self.assertEqual(badge['color'], 'yellow')
        self.assertIn('материал', badge['label'].lower())

    def test_waiting_final_payment_is_yellow(self):
        o = self._order(self.Order.Status.WAITING_FINAL_PAYMENT)
        badge = self._badge(o)
        self.assertEqual(badge['color'], 'yellow')
        self.assertIn('оплат', badge['label'].lower())

    def test_in_production_is_green(self):
        o = self._order(self.Order.Status.IN_PRODUCTION)
        self.assertEqual(self._badge(o)['color'], 'green')

    def test_overdue_is_red_and_overrides_green(self):
        from atelier_erp.constants import MaterialReadiness
        yesterday = self.date.today() - self.timedelta(days=1)
        o = self._order(self.Order.Status.IN_WORK,
                        material_readiness=MaterialReadiness.READY,
                        planned_completion=yesterday)
        self.assertEqual(self._badge(o)['color'], 'red')

    def test_completed_overdue_deadline_is_gray_not_red(self):
        """Завершённый заказ с просроченным дедлайном — серый, не красный."""
        yesterday = self.date.today() - self.timedelta(days=1)
        o = self._order(self.Order.Status.COMPLETED, planned_completion=yesterday)
        self.assertEqual(self._badge(o)['color'], 'gray')

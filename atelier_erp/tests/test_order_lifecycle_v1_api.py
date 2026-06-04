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

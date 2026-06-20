"""
Тесты свежих фич v1 (2026-06) + закрытых RBAC-дыр.

Покрывают:
- КП: ровно одно на заказ (повторное создание перезаписывает);
- Удаление заказа (DELETE) — только владелец;
- Отмена заказа (cancel) — только владелец (дизайнер не может через API);
- Смена статуса (change-status) — только owner/designer;
- Дашборд — только владелец, отдаёт срез по дизайнерам;
- material_readiness присутствует в списке заказов (складская таблица).

Запуск: python manage.py test atelier_erp.tests.test_v1_features_2026 -v 2
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from atelier_erp.models import Customer, Order, Quote
from atelier_erp.roles import Roles

User = get_user_model()


class FeatureTestsBase(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        from django.conf import settings
        cls._old_hosts = settings.ALLOWED_HOSTS
        settings.ALLOWED_HOSTS = ['*', 'testserver', 'localhost', '127.0.0.1']

    @classmethod
    def tearDownClass(cls):
        from django.conf import settings
        settings.ALLOWED_HOSTS = cls._old_hosts
        super().tearDownClass()

    @classmethod
    def setUpTestData(cls):
        cls.customer = Customer.objects.create(
            full_name='Тест Клиент', phone='+7 700 000 0000', address_city='Алматы',
        )
        cls.order = Order.objects.create(
            order_number='О-2026-001', customer=cls.customer,
            status=Order.Status.NEW,
            total_amount=Decimal('100000.00'), paid_amount=Decimal('0.00'),
        )

    def _user(self, username, role_name):
        u = User.objects.create_user(username=username, password='x')
        if role_name:
            g, _ = Group.objects.get_or_create(name=role_name)
            u.groups.add(g)
        return u

    def _as(self, role_name, username=None):
        u = self._user(username or role_name.lower(), role_name)
        self.client.force_authenticate(user=u)
        return u

    def _order_detail_url(self, order=None):
        base = reverse('v1-order-list')  # /api/v1/orders/
        return f"{base}{(order or self.order).id}/"


class QuoteOverwriteTests(FeatureTestsBase):
    def _create_quote(self):
        payload = {
            'order_id': str(self.order.id),
            'items': [{
                'room_name': 'Гостиная', 'window_name': 'Окно 1',
                'window_width_cm': 100, 'window_height_cm': 150,
                'line_total': 50000,
            }],
        }
        return self.client.post(reverse('v1-quote-list'), payload, format='json')

    def test_quote_is_overwritten_one_per_order(self):
        self._as(Roles.DESIGNER)
        r1 = self._create_quote()
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)
        r2 = self._create_quote()
        self.assertEqual(r2.status_code, status.HTTP_201_CREATED)
        # Ровно одно КП на заказ
        self.assertEqual(Quote.objects.filter(order=self.order).count(), 1)
        resp = self.client.get(reverse('v1-quote-list') + f'?order={self.order.id}')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.data
        results = data['results'] if isinstance(data, dict) and 'results' in data else data
        self.assertEqual(len(results), 1)


class OrderDeleteRbacTests(FeatureTestsBase):
    def test_owner_can_delete_order(self):
        self._as(Roles.OWNER)
        resp = self.client.delete(self._order_detail_url())
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Order.objects.filter(pk=self.order.pk).exists())

    def test_designer_cannot_delete_order(self):
        self._as(Roles.DESIGNER)
        resp = self.client.delete(self._order_detail_url())
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Order.objects.filter(pk=self.order.pk).exists())

    def test_warehouse_cannot_delete_order(self):
        self._as(Roles.WAREHOUSE)
        resp = self.client.delete(self._order_detail_url())
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class OrderCancelRbacTests(FeatureTestsBase):
    def _cancel_url(self):
        return self._order_detail_url() + 'cancel/'

    def test_designer_cannot_cancel_via_api(self):
        self._as(Roles.DESIGNER)
        resp = self.client.post(self._cancel_url(), {'reason': 'тест'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_warehouse_cannot_cancel(self):
        self._as(Roles.WAREHOUSE)
        resp = self.client.post(self._cancel_url(), {'reason': 'тест'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_cancel(self):
        self._as(Roles.OWNER)
        resp = self.client.post(self._cancel_url(), {'reason': 'клиент отказался'}, format='json')
        self.assertNotEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class ChangeStatusRbacTests(FeatureTestsBase):
    def _cs_url(self):
        return self._order_detail_url() + 'change-status/'

    def test_warehouse_cannot_change_status(self):
        self._as(Roles.WAREHOUSE)
        resp = self.client.post(self._cs_url(), {'status': Order.Status.IN_WORK}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_not_forbidden_on_change_status(self):
        self._as(Roles.OWNER)
        resp = self.client.post(self._cs_url(), {'status': Order.Status.IN_WORK}, format='json')
        # может быть 200/400/409 по бизнес-правилам, но НЕ 403
        self.assertNotEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class DashboardRbacTests(FeatureTestsBase):
    def test_owner_sees_dashboard_with_designers(self):
        self._as(Roles.OWNER)
        resp = self.client.get(reverse('v1-dashboard'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('designers', resp.data)
        self.assertIn('orders', resp.data)

    def test_designer_cannot_see_dashboard(self):
        self._as(Roles.DESIGNER)
        resp = self.client.get(reverse('v1-dashboard'))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_warehouse_cannot_see_dashboard(self):
        self._as(Roles.WAREHOUSE)
        resp = self.client.get(reverse('v1-dashboard'))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class OrderListMaterialReadinessTests(FeatureTestsBase):
    def test_list_includes_material_readiness(self):
        self._as(Roles.OWNER)
        resp = self.client.get(reverse('v1-order-list'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data['results'] if isinstance(resp.data, dict) and 'results' in resp.data else resp.data
        self.assertTrue(len(results) >= 1)
        self.assertIn('material_readiness', results[0])
        self.assertIn('material_readiness_label', results[0])

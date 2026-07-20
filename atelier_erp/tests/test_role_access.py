"""
Тесты ролевого доступа к заказам (P0).

Проверяют:
- полный список заказов видят только Owner и Designer;
- Warehouse/Seamstress/Installer видят только свой операционный срез;
- непривилегированные роли не видят финансовых полей заказа;
- пользователь без роли не видит ничего (default deny).

Запуск: python manage.py test atelier_erp.tests.test_role_access -v 2
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from atelier_erp.models import Customer, Order
from atelier_erp.roles import Roles

User = get_user_model()


def _results(response):
    """Достаёт список объектов из (возможно) пагинированного ответа."""
    data = response.data
    if isinstance(data, dict) and 'results' in data:
        return data['results']
    return data


class OrderRoleAccessTests(APITestCase):

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
        # По заказу на каждый ключевой статус
        cls.statuses = [
            Order.Status.NEW,
            Order.Status.IN_WORK,
            Order.Status.IN_PRODUCTION,
            Order.Status.READY,
            Order.Status.ON_INSTALLATION,
            Order.Status.WAITING_FINAL_PAYMENT,
            Order.Status.COMPLETED,
        ]
        for i, st in enumerate(cls.statuses, start=1):
            Order.objects.create(
                order_number=f'О-2026-{i:03d}',
                customer=cls.customer,
                status=st,
                total_amount=Decimal('10000.00'),
                paid_amount=Decimal('1000.00'),
            )
        cls.total_orders = len(cls.statuses)

    def _user_with_role(self, username, role_name):
        user = User.objects.create_user(username=username, password='x')
        if role_name:
            group, _ = Group.objects.get_or_create(name=role_name)
            user.groups.add(group)
        return user

    def _list_statuses(self, user):
        self.client.force_authenticate(user=user)
        resp = self.client.get(reverse('v1-order-list'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        return resp, [o['status'] for o in _results(resp)]

    def test_owner_sees_all_orders(self):
        user = self._user_with_role('owner1', Roles.OWNER)
        resp, statuses = self._list_statuses(user)
        self.assertEqual(len(statuses), self.total_orders)

    def test_designer_sees_all_orders(self):
        user = self._user_with_role('designer1', Roles.DESIGNER)
        _, statuses = self._list_statuses(user)
        self.assertEqual(len(statuses), self.total_orders)

    def test_warehouse_sees_only_its_slice(self):
        user = self._user_with_role('wh1', Roles.WAREHOUSE)
        _, statuses = self._list_statuses(user)
        allowed = {Order.Status.IN_WORK, Order.Status.IN_PRODUCTION, Order.Status.READY}
        self.assertTrue(set(statuses).issubset(allowed))
        self.assertEqual(len(statuses), 3)

    def test_seamstress_sees_only_in_production(self):
        user = self._user_with_role('sw1', Roles.SEAMSTRESS)
        _, statuses = self._list_statuses(user)
        self.assertEqual(set(statuses), {Order.Status.IN_PRODUCTION})

    def test_installer_sees_only_its_slice(self):
        user = self._user_with_role('inst1', Roles.INSTALLER)
        _, statuses = self._list_statuses(user)
        allowed = {
            Order.Status.NEW, Order.Status.IN_WORK, Order.Status.IN_PRODUCTION,
            Order.Status.READY, Order.Status.ON_INSTALLATION, Order.Status.WAITING_FINAL_PAYMENT,
        }
        self.assertTrue(set(statuses).issubset(allowed))
        self.assertNotIn(Order.Status.COMPLETED, statuses)
        self.assertNotIn(Order.Status.CANCELLED, statuses)

    def test_user_without_role_sees_nothing(self):
        user = self._user_with_role('nobody', None)
        _, statuses = self._list_statuses(user)
        self.assertEqual(statuses, [])

    def test_warehouse_does_not_see_financial_fields(self):
        user = self._user_with_role('wh2', Roles.WAREHOUSE)
        resp, _ = self._list_statuses(user)
        rows = _results(resp)
        self.assertTrue(rows, 'ожидались заказы в срезе склада')
        for row in rows:
            self.assertNotIn('total_amount', row)
            self.assertNotIn('paid_amount', row)
            self.assertNotIn('balance_due', row)

    def test_owner_sees_financial_fields(self):
        user = self._user_with_role('owner2', Roles.OWNER)
        resp, _ = self._list_statuses(user)
        rows = _results(resp)
        self.assertTrue(rows)
        self.assertIn('total_amount', rows[0])


class ActionRBACTests(APITestCase):
    """
    Тесты RBAC на action-эндпоинтах (P3: добавлены permissions).
    Проверяют что роли не могут вызывать чужие операции.
    """

    @classmethod
    def setUpTestData(cls):
        from django.conf import settings
        settings.ALLOWED_HOSTS = ['*', 'testserver', 'localhost', '127.0.0.1']

        cls.customer = Customer.objects.create(
            full_name='RBAC Test', phone='+7 700 111 0000', address_city='Алматы',
        )
        cls.order_new = Order.objects.create(
            order_number='О-2026-901', customer=cls.customer,
            status=Order.Status.NEW, total_amount=Decimal('100000'),
        )
        cls.order_in_work = Order.objects.create(
            order_number='О-2026-902', customer=cls.customer,
            status=Order.Status.IN_WORK, total_amount=Decimal('100000'),
        )
        cls.order_in_production = Order.objects.create(
            order_number='О-2026-903', customer=cls.customer,
            status=Order.Status.IN_PRODUCTION, total_amount=Decimal('100000'),
        )

    def _make_user(self, username, role_name):
        user = User.objects.create_user(username=username, password='pass')
        if role_name:
            group, _ = Group.objects.get_or_create(name=role_name)
            user.groups.add(group)
        self.client.force_authenticate(user=user)
        return user

    def _url(self, order, action):
        return f'/api/v1/orders/{order.id}/{action}/'

    # --- cancel ---

    def test_seamstress_cannot_cancel_order(self):
        self._make_user('sw_cancel', Roles.SEAMSTRESS)
        resp = self.client.post(self._url(self.order_in_production, 'cancel'), {'reason': 'test'})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_warehouse_cannot_cancel_order(self):
        self._make_user('wh_cancel', Roles.WAREHOUSE)
        resp = self.client.post(self._url(self.order_in_work, 'cancel'), {'reason': 'test'})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_installer_cannot_cancel_order(self):
        self._make_user('inst_cancel', Roles.INSTALLER)
        resp = self.client.post(self._url(self.order_in_work, 'cancel'), {'reason': 'test'})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_cancel_order(self):
        self._make_user('owner_cancel', Roles.OWNER)
        resp = self.client.post(self._url(self.order_in_work, 'cancel'), {'reason': 'Тест отмены'})
        # 200 or 400 (business rule) — but NOT 403
        self.assertNotEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    # --- change-material-readiness ---

    def test_seamstress_cannot_change_material_readiness(self):
        self._make_user('sw_mat', Roles.SEAMSTRESS)
        resp = self.client.post(
            self._url(self.order_in_work, 'change-material-readiness'),
            {'material_readiness': 'ready'}
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_installer_cannot_change_material_readiness(self):
        self._make_user('inst_mat', Roles.INSTALLER)
        resp = self.client.post(
            self._url(self.order_in_work, 'change-material-readiness'),
            {'material_readiness': 'ready'}
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_warehouse_can_change_material_readiness(self):
        self._make_user('wh_mat', Roles.WAREHOUSE)
        resp = self.client.post(
            self._url(self.order_in_work, 'change-material-readiness'),
            {'material_readiness': 'ready'}
        )
        self.assertNotEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    # --- change-production-stage ---

    def test_warehouse_cannot_change_production_stage(self):
        self._make_user('wh_prod', Roles.WAREHOUSE)
        resp = self.client.post(
            self._url(self.order_in_production, 'change-production-stage'),
            {'production_stage': 'done'}
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_installer_cannot_change_production_stage(self):
        self._make_user('inst_prod', Roles.INSTALLER)
        resp = self.client.post(
            self._url(self.order_in_production, 'change-production-stage'),
            {'production_stage': 'done'}
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_seamstress_can_change_production_stage(self):
        self._make_user('sw_prod', Roles.SEAMSTRESS)
        resp = self.client.post(
            self._url(self.order_in_production, 'change-production-stage'),
            {'production_stage': 'sewing'}
        )
        self.assertNotEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    # --- accept (new → in_work) ---

    def test_warehouse_cannot_accept_order(self):
        self._make_user('wh_accept', Roles.WAREHOUSE)
        resp = self.client.post(self._url(self.order_new, 'accept'))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_seamstress_cannot_accept_order(self):
        self._make_user('sw_accept', Roles.SEAMSTRESS)
        resp = self.client.post(self._url(self.order_new, 'accept'))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_installer_cannot_accept_order(self):
        self._make_user('inst_accept', Roles.INSTALLER)
        resp = self.client.post(self._url(self.order_new, 'accept'))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class ExecutorCannotEnumerateDirectoriesTests(APITestCase):
    """
    Исполнители не выгружают справочники целиком.

    Лиды (`/v1/tasks/`) и клиентская база (`/v1/customers/`) стояли под голым
    IsAuthenticated: склад, цех и монтаж могли вычитать все лиды и всех клиентов
    тенанта с телефонами и почтой. Ни один экран этих ролей туда не ходит —
    приведено к таблице ролей (владелец/дизайнер).
    """

    def setUp(self):
        self.customer = Customer.objects.create(
            full_name='Клиент Справочник', phone='+70000000088',
        )

    def _client_for(self, role, username):
        group, _ = Group.objects.get_or_create(name=role)
        user = User.objects.create_user(username=username, password='pwd12345')
        user.groups.add(group)
        self.client.force_authenticate(user=user)
        return user

    def test_executors_cannot_list_customers(self):
        for role in (Roles.WAREHOUSE, Roles.SEAMSTRESS, Roles.INSTALLER):
            with self.subTest(role=role):
                self._client_for(role, f'dir_cust_{role}')
                resp = self.client.get('/api/v1/customers/')
                self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_executors_cannot_list_tasks(self):
        for role in (Roles.WAREHOUSE, Roles.SEAMSTRESS, Roles.INSTALLER):
            with self.subTest(role=role):
                self._client_for(role, f'dir_task_{role}')
                resp = self.client.get('/api/v1/tasks/')
                self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_designer_keeps_access(self):
        """Сужение не должно задеть тех, кто ведёт клиентов и лиды."""
        self._client_for(Roles.DESIGNER, 'dir_designer')
        self.assertEqual(self.client.get('/api/v1/customers/').status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get('/api/v1/tasks/').status_code, status.HTTP_200_OK)

    def test_owner_keeps_access(self):
        self._client_for(Roles.OWNER, 'dir_owner')
        self.assertEqual(self.client.get('/api/v1/customers/').status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get('/api/v1/tasks/').status_code, status.HTTP_200_OK)

"""
P1-тесты: отзыв токенов (logout/blacklist), throttling логина, атомарная нумерация.
Закрепляют изменения P1. Запуск: python manage.py test atelier_erp.tests.test_p1_security_numbering -v 2
"""
from datetime import datetime
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from atelier_erp.models import Customer, Order, NumberSequence
from atelier_erp.services.numbering import next_number

User = get_user_model()


class _HostPatchMixin:
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._hosts = settings.ALLOWED_HOSTS
        settings.ALLOWED_HOSTS = ['*', 'testserver', 'localhost', '127.0.0.1']

    @classmethod
    def tearDownClass(cls):
        settings.ALLOWED_HOSTS = cls._hosts
        super().tearDownClass()


class TokenLifecycleTests(_HostPatchMixin, APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username='tok_user', password='secret-pass-123')

    def test_logout_blacklists_refresh(self):
        # 1. логин
        resp = self.client.post(reverse('token_obtain_pair'),
                                {'username': 'tok_user', 'password': 'secret-pass-123'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        access = resp.data['access']
        refresh = resp.data['refresh']

        # 2. серверный logout (отзыв refresh)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        out = self.client.post(reverse('logout'), {'refresh': refresh}, format='json')
        self.assertEqual(out.status_code, status.HTTP_205_RESET_CONTENT)

        # 3. отозванный refresh больше не работает
        self.client.credentials()
        ref = self.client.post(reverse('token_refresh'), {'refresh': refresh}, format='json')
        self.assertEqual(ref.status_code, status.HTTP_401_UNAUTHORIZED)


class LoginThrottleTests(_HostPatchMixin, APITestCase):
    def setUp(self):
        cache.clear()
        User.objects.create_user(username='thr_user', password='secret-pass-123')

    def test_login_throttled_after_limit(self):
        url = reverse('token_obtain_pair')
        # лимит login = 5/min: первые 5 проходят (как 401 на неверный пароль), 6-й -> 429
        statuses = []
        for _ in range(6):
            r = self.client.post(url, {'username': 'thr_user', 'password': 'wrong'}, format='json')
            statuses.append(r.status_code)
        self.assertEqual(statuses[-1], status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertNotIn(status.HTTP_429_TOO_MANY_REQUESTS, statuses[:5])


class NumberingTests(APITestCase):
    def setUp(self):
        self.customer = Customer.objects.create(
            full_name='Тест', phone='+7 700 000 0000', address_city='Алматы')
        self.year = datetime.now().year

    def _make_order(self, number):
        return Order.objects.create(
            order_number=number, customer=self.customer, status=Order.Status.NEW,
            total_amount=Decimal('1000'), paid_amount=Decimal('0'))

    def test_sequential_unique(self):
        n1 = next_number('order')
        n2 = next_number('order')
        self.assertNotEqual(n1, n2)
        self.assertTrue(n1.startswith(f'О-{self.year}-'))
        self.assertEqual(int(n1.split('-')[-1]) + 1, int(n2.split('-')[-1]))

    def test_continues_from_existing_max(self):
        # существующий заказ с номером ...-005 -> следующий должен быть ...-006
        self._make_order(f'О-{self.year}-005')
        nxt = next_number('order')
        self.assertEqual(nxt, f'О-{self.year}-006')

    def test_sequence_row_increments(self):
        next_number('order')
        seq = NumberSequence.objects.get(prefix='О', year=self.year)
        self.assertGreaterEqual(seq.last_value, 1)

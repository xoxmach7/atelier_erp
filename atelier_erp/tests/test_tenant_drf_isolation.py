"""
Регрессия на баг 2026-07-25: TenantMiddleware резолвил тенант ДО того, как DRF
успевал распознать пользователя по JWT — межателье-изоляция была фикцией для
всего API (request.tenant/ContextVar всегда "нет тенанта" для любого
JWT-запроса). Исправлено патчем APIView.perform_authentication в
atelier_erp/tenant_drf.py. Этот файл проверяет исправление на уровне
реального HTTP-запроса (force_authenticate), а не только на уровне ORM
(test_tenant_manager.py проверяет ORM отдельно, вручную выставляя ContextVar —
он бы не поймал этот баг, т.к. не идёт через DRF-цикл аутентификации).

Запуск: python manage.py test atelier_erp.tests.test_tenant_drf_isolation -v 2
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from atelier_erp.models import Customer, Tenant, TenantMembership
from atelier_erp.roles import Roles

User = get_user_model()


def _results(response):
    data = response.data
    if isinstance(data, dict) and 'results' in data:
        return data['results']
    return data


class TenantIsolationOverHttpTests(APITestCase):

    @classmethod
    def setUpTestData(cls):
        Group.objects.get_or_create(name=Roles.OWNER)

        cls.tenant_a = Tenant.objects.create(name='Ателье А', slug='tenant-a-http')
        cls.tenant_b = Tenant.objects.create(name='Ателье Б', slug='tenant-b-http')

        Customer.objects.create(full_name='Клиент А', phone='+77770000001', tenant=cls.tenant_a)
        Customer.objects.create(full_name='Клиент Б', phone='+77770000002', tenant=cls.tenant_b)
        Customer.objects.create(full_name='Легаси клиент', phone='+77770000003', tenant=None)

        cls.owner_a = User.objects.create_user(username='http_owner_a', password='x')
        cls.owner_a.groups.add(Group.objects.get(name=Roles.OWNER))
        TenantMembership.objects.create(user=cls.owner_a, tenant=cls.tenant_a)

        cls.owner_b = User.objects.create_user(username='http_owner_b', password='x')
        cls.owner_b.groups.add(Group.objects.get(name=Roles.OWNER))
        TenantMembership.objects.create(user=cls.owner_b, tenant=cls.tenant_b)

        cls.superuser = User.objects.create_superuser(username='http_root', password='x', email='r@r.com')

        cls.legacy_owner = User.objects.create_user(username='http_legacy_owner', password='x')
        cls.legacy_owner.groups.add(Group.objects.get(name=Roles.OWNER))
        # Намеренно без TenantMembership — воспроизводит текущее состояние прод-аккаунтов.

    def _names(self, user):
        self.client.force_authenticate(user=user)
        resp = self.client.get(reverse('v1-customer-list'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        return sorted(c['full_name'] for c in _results(resp))

    def test_owner_sees_only_own_tenant(self):
        self.assertEqual(self._names(self.owner_a), ['Клиент А'])

    def test_other_owner_isolated(self):
        self.assertEqual(self._names(self.owner_b), ['Клиент Б'])

    def test_superuser_without_membership_sees_everything(self):
        self.assertEqual(self._names(self.superuser), ['Клиент А', 'Клиент Б', 'Легаси клиент'])

    def test_legacy_user_without_membership_sees_only_legacy_data(self):
        # Обратная совместимость: пилотные аккаунты без TenantMembership
        # (текущее состояние прода) не должны сломаться после фикса —
        # они как видели только легаси-данные с tenant=None, так и видят.
        self.assertEqual(self._names(self.legacy_owner), ['Легаси клиент'])

    def test_owner_a_cannot_read_tenant_b_customer_by_id(self):
        customer_b = Customer.objects.get(full_name='Клиент Б')
        self.client.force_authenticate(user=self.owner_a)
        resp = self.client.get(reverse('v1-customer-detail', args=[customer_b.id]))
        self.assertIn(resp.status_code, (status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN))

    def test_new_customer_created_by_owner_a_gets_tenant_a(self):
        self.client.force_authenticate(user=self.owner_a)
        resp = self.client.post(reverse('v1-customer-list'), {
            'full_name': 'Новый клиент А', 'phone': '+77770000099',
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        created = Customer.objects.get(full_name='Новый клиент А')
        self.assertEqual(created.tenant_id, self.tenant_a.id)

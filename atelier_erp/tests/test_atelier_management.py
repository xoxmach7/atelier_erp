"""
Тесты экрана "Ателье" (/api/v1/ateliers/) — создание нового ателье вместе с
первым сотрудником-владельцем, доступно только платформенному админу
(Django is_superuser), не Owner конкретного ателье.

Запуск: python manage.py test atelier_erp.tests.test_atelier_management -v 2
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from atelier_erp.models import Tenant, TenantMembership
from atelier_erp.roles import Roles

User = get_user_model()


class AtelierManagementPermissionTests(APITestCase):

    @classmethod
    def setUpTestData(cls):
        Group.objects.get_or_create(name=Roles.OWNER)
        cls.owner = User.objects.create_user(username='atelier_owner', password='x')
        cls.owner.groups.add(Group.objects.get(name=Roles.OWNER))
        cls.superuser = User.objects.create_superuser(username='platform_root', password='x', email='r@r.com')

    def test_regular_owner_cannot_list_ateliers(self):
        self.client.force_authenticate(user=self.owner)
        resp = self.client.get(reverse('v1-atelier-list'))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_regular_owner_cannot_create_atelier(self):
        self.client.force_authenticate(user=self.owner)
        resp = self.client.post(reverse('v1-atelier-list'), {
            'name': 'Чужое ателье', 'owner_username': 'sneaky_owner',
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_superuser_can_list_ateliers(self):
        self.client.force_authenticate(user=self.superuser)
        resp = self.client.get(reverse('v1-atelier-list'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


class AtelierManagementCreateTests(APITestCase):

    @classmethod
    def setUpTestData(cls):
        Group.objects.get_or_create(name=Roles.OWNER)
        cls.superuser = User.objects.create_superuser(username='platform_root2', password='x', email='r@r.com')

    def setUp(self):
        self.client.force_authenticate(user=self.superuser)

    def test_create_atelier_creates_tenant_and_owner_with_membership(self):
        resp = self.client.post(reverse('v1-atelier-list'), {
            'name': 'Новое ателье',
            'owner_username': 'new_atelier_owner',
            'owner_first_name': 'Иван',
            'owner_last_name': 'Иванов',
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertIn('slug', resp.data)
        self.assertEqual(resp.data['employee_count'], 1)
        self.assertIn('generated_password', resp.data['owner'])

        tenant = Tenant.objects.get(name='Новое ателье')
        owner_user = User.objects.get(username='new_atelier_owner')
        self.assertTrue(owner_user.groups.filter(name=Roles.OWNER).exists())
        self.assertEqual(TenantMembership.objects.get(user=owner_user).tenant_id, tenant.id)
        self.assertTrue(owner_user.check_password(resp.data['owner']['generated_password']))

    def test_slug_auto_generated_from_name_when_omitted(self):
        resp = self.client.post(reverse('v1-atelier-list'), {
            'name': 'Ателье Артель',
            'owner_username': 'artel_owner',
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertTrue(resp.data['slug'])

    def test_duplicate_slug_gets_suffixed_not_rejected(self):
        Tenant.objects.create(name='Существующее', slug='dup-slug')
        resp = self.client.post(reverse('v1-atelier-list'), {
            'name': 'Второе', 'slug': 'dup-slug', 'owner_username': 'dup_owner',
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertNotEqual(resp.data['slug'], 'dup-slug')

    def test_missing_name_rejected(self):
        resp = self.client.post(reverse('v1-atelier-list'), {'owner_username': 'x'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data['code'], 'name_required')

    def test_missing_owner_username_rejected(self):
        resp = self.client.post(reverse('v1-atelier-list'), {'name': 'Ателье без владельца'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data['code'], 'owner_username_required')
        self.assertFalse(Tenant.objects.filter(name='Ателье без владельца').exists())

    def test_duplicate_owner_username_rejected(self):
        User.objects.create_user(username='taken_owner_name', password='x')
        resp = self.client.post(reverse('v1-atelier-list'), {
            'name': 'Ателье', 'owner_username': 'taken_owner_name',
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data['code'], 'username_taken')


class SuperuserStaffAcrossTenantsTests(APITestCase):
    """Платформенный админ добавляет/смотрит сотрудников уже существующего
    ателье через /api/v1/staff-management/ (тот же эндпоинт, что у Owner),
    передавая tenant_id явно."""

    @classmethod
    def setUpTestData(cls):
        for role in Roles.ALL:
            Group.objects.get_or_create(name=role)
        cls.superuser = User.objects.create_superuser(username='platform_root3', password='x', email='r@r.com')
        cls.tenant = Tenant.objects.create(name='Целевое ателье', slug='target-atelier')
        cls.other_tenant = Tenant.objects.create(name='Другое ателье', slug='other-atelier')

        cls.member = User.objects.create_user(username='target_member', password='x')
        cls.member.groups.add(Group.objects.get(name=Roles.WAREHOUSE))
        TenantMembership.objects.create(user=cls.member, tenant=cls.tenant)

        cls.other_member = User.objects.create_user(username='other_member', password='x')
        cls.other_member.groups.add(Group.objects.get(name=Roles.WAREHOUSE))
        TenantMembership.objects.create(user=cls.other_member, tenant=cls.other_tenant)

    def setUp(self):
        self.client.force_authenticate(user=self.superuser)

    def test_list_scoped_to_tenant_id_query_param(self):
        resp = self.client.get(reverse('v1-staff-management-list'), {'tenant_id': str(self.tenant.id)})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        usernames = {row['username'] for row in resp.data}
        self.assertIn('target_member', usernames)
        self.assertNotIn('other_member', usernames)

    def test_create_requires_tenant_id_for_superuser(self):
        resp = self.client.post(reverse('v1-staff-management-list'), {
            'username': 'no_tenant_specified', 'role': Roles.SEAMSTRESS,
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data['code'], 'tenant_id_required')

    def test_create_with_explicit_tenant_id_attaches_membership(self):
        resp = self.client.post(reverse('v1-staff-management-list'), {
            'username': 'added_by_superuser', 'role': Roles.SEAMSTRESS, 'tenant_id': str(self.tenant.id),
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        user = User.objects.get(username='added_by_superuser')
        self.assertEqual(TenantMembership.objects.get(user=user).tenant_id, self.tenant.id)

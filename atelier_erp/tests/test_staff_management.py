"""
Тесты CRUD "Сотрудники" (/api/v1/staff-management/) — создание, смена роли,
деактивация/реактивация. Доступ — только Owner.

Запуск: python manage.py test atelier_erp.tests.test_staff_management -v 2
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from atelier_erp.roles import Roles

User = get_user_model()


def _make_user(username, role=None):
    user = User.objects.create_user(username=username, password='pass12345')
    if role:
        group, _ = Group.objects.get_or_create(name=role)
        user.groups.add(group)
    return user


class StaffManagementPermissionTests(APITestCase):

    @classmethod
    def setUpTestData(cls):
        for role in Roles.ALL:
            Group.objects.get_or_create(name=role)
        cls.owner = _make_user('owner1', Roles.OWNER)
        cls.designer = _make_user('designer1', Roles.DESIGNER)

    def test_non_owner_cannot_list_staff(self):
        self.client.force_authenticate(user=self.designer)
        resp = self.client.get(reverse('v1-staff-management-list'))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_owner_cannot_create_staff(self):
        self.client.force_authenticate(user=self.designer)
        resp = self.client.post(reverse('v1-staff-management-list'), {
            'username': 'new_hire', 'role': Roles.WAREHOUSE,
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_cannot_access(self):
        resp = self.client.get(reverse('v1-staff-management-list'))
        self.assertIn(resp.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))


class StaffManagementCRUDTests(APITestCase):

    @classmethod
    def setUpTestData(cls):
        for role in Roles.ALL:
            Group.objects.get_or_create(name=role)
        cls.owner = _make_user('owner_main', Roles.OWNER)

    def setUp(self):
        self.client.force_authenticate(user=self.owner)

    def test_list_includes_role_and_active_flag(self):
        _make_user('warehouse1', Roles.WAREHOUSE)
        resp = self.client.get(reverse('v1-staff-management-list'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        usernames = {row['username']: row for row in resp.data}
        self.assertIn('warehouse1', usernames)
        self.assertEqual(usernames['warehouse1']['role'], Roles.WAREHOUSE)
        self.assertTrue(usernames['warehouse1']['is_active'])

    def test_create_generates_password_and_assigns_group(self):
        resp = self.client.post(reverse('v1-staff-management-list'), {
            'username': 'new_seamstress',
            'first_name': 'Анна',
            'last_name': 'Швея',
            'role': Roles.SEAMSTRESS,
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn('generated_password', resp.data)
        self.assertTrue(len(resp.data['generated_password']) >= 8)

        user = User.objects.get(username='new_seamstress')
        self.assertTrue(user.groups.filter(name=Roles.SEAMSTRESS).exists())
        self.assertTrue(user.check_password(resp.data['generated_password']))

    def test_create_rejects_invalid_role(self):
        resp = self.client.post(reverse('v1-staff-management-list'), {
            'username': 'someone', 'role': 'NotARole',
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data['code'], 'invalid_role')

    def test_create_rejects_duplicate_username(self):
        _make_user('taken_name', Roles.WAREHOUSE)
        resp = self.client.post(reverse('v1-staff-management-list'), {
            'username': 'taken_name', 'role': Roles.INSTALLER,
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data['code'], 'username_taken')

    def test_change_role_moves_user_to_new_group_only(self):
        user = _make_user('flexible', Roles.WAREHOUSE)
        resp = self.client.patch(reverse('v1-staff-management-detail', args=[user.id]), {
            'role': Roles.INSTALLER,
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertFalse(user.groups.filter(name=Roles.WAREHOUSE).exists())
        self.assertTrue(user.groups.filter(name=Roles.INSTALLER).exists())

    def test_deactivate_sets_is_active_false(self):
        user = _make_user('to_deactivate', Roles.DESIGNER)
        resp = self.client.delete(reverse('v1-staff-management-detail', args=[user.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertFalse(user.is_active)

    def test_reactivate_via_patch(self):
        user = _make_user('paused', Roles.DESIGNER)
        user.is_active = False
        user.save()
        resp = self.client.patch(reverse('v1-staff-management-detail', args=[user.id]), {
            'is_active': True,
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.is_active)

    def test_cannot_deactivate_self(self):
        resp = self.client.delete(reverse('v1-staff-management-detail', args=[self.owner.id]))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data['code'], 'cannot_deactivate_self')
        self.owner.refresh_from_db()
        self.assertTrue(self.owner.is_active)

    def test_cannot_change_own_role_away_from_owner(self):
        resp = self.client.patch(reverse('v1-staff-management-detail', args=[self.owner.id]), {
            'role': Roles.WAREHOUSE,
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data['code'], 'cannot_change_own_role')
        self.owner.refresh_from_db()
        self.assertTrue(self.owner.groups.filter(name=Roles.OWNER).exists())

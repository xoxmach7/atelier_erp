"""
Тесты на self-service смену пароля (POST /api/auth/change-password/).
Раньше кнопка "Сменить пароль" на /settings была заглушкой-alert — этот
эндпоинт реализует саму фичу.

Запуск: python manage.py test atelier_erp.tests.test_change_password -v 2
"""
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class ChangePasswordTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='pwd_test_user', password='OldPass123!')
        self.url = reverse('change_password')

    def test_requires_authentication(self):
        resp = self.client.post(self.url, {'current_password': 'x', 'new_password': 'y'})
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_fields_rejected(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(self.url, {'current_password': 'OldPass123!'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data['code'], 'missing_fields')

    def test_wrong_current_password_rejected(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(self.url, {
            'current_password': 'WrongPass',
            'new_password': 'NewStrongPass456!',
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data['code'], 'invalid_current_password')
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('OldPass123!'))

    def test_weak_new_password_rejected(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(self.url, {
            'current_password': 'OldPass123!',
            'new_password': '123',
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data['code'], 'weak_password')
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('OldPass123!'))

    def test_successful_change(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(self.url, {
            'current_password': 'OldPass123!',
            'new_password': 'NewStrongPass456!',
        })
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NewStrongPass456!'))
        self.assertFalse(self.user.check_password('OldPass123!'))

    def test_cannot_change_another_users_password(self):
        other = User.objects.create_user(username='other_user', password='OtherPass123!')
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(self.url, {
            'current_password': 'OldPass123!',
            'new_password': 'NewStrongPass456!',
        })
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        other.refresh_from_db()
        self.assertTrue(other.check_password('OtherPass123!'))

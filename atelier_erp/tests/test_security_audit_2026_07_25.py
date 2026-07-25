"""
Тесты на пункты security-аудита (docs/security-audit/J1-consolidated-overview.md),
закрытые 2026-07-25: #8 (Owner получал все Django-permissions), #9 (admin/DRF
browsable login без throttle), #12 (403/401 нигде не логировались), #19
(browsable HTML API DRF был включён в проде без явного решения).

Запуск: python manage.py test atelier_erp.tests.test_security_audit_2026_07_25 -v 2
"""
import logging
import uuid
from io import StringIO

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core.cache import cache
from django.core.management import call_command
from django.http import HttpResponse
from django.test import RequestFactory, TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from atelier_erp.login_throttle import LoginThrottleMiddleware
from atelier_erp.roles import Roles

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


class SeedGroupsOwnerPermissionTests(APITestCase):
    """#8: Owner больше не получает все Django Permission объекты — латентная
    эскалация, если когда-либо у обычного Owner-аккаунта окажется is_staff=True."""

    def test_seed_groups_does_not_grant_any_permissions_to_owner(self):
        call_command('seed_groups', stdout=StringIO())
        owner_group = Group.objects.get(name=Roles.OWNER)
        self.assertEqual(owner_group.permissions.count(), 0)

    def test_seed_groups_creates_all_canonical_roles(self):
        call_command('seed_groups', stdout=StringIO())
        for role in Roles.ALL:
            self.assertTrue(Group.objects.filter(name=role).exists())

    def test_migration_strips_preexisting_owner_permissions(self):
        # Симулирует прод-состояние ДО фикса: у Owner уже накоплены все permissions.
        owner_group, _ = Group.objects.get_or_create(name=Roles.OWNER)
        owner_group.permissions.set(Permission.objects.all())
        self.assertGreater(owner_group.permissions.count(), 0)

        import importlib
        from django.apps import apps as django_apps
        migration_module = importlib.import_module('atelier_erp.migrations.0034_strip_owner_group_permissions')
        migration_module.strip_owner_permissions(django_apps, None)

        owner_group.refresh_from_db()
        self.assertEqual(owner_group.permissions.count(), 0)


class LoginThrottleMiddlewareTests(TestCase):
    """#9: /admin/login/ и /api/auth/login/ (DRF browsable) не были покрыты
    никаким лимитом попыток — ScopedRateThrottle работает только внутри DRF-view.

    Тестируется на уровне самого middleware (RequestFactory + фиктивный
    get_response), а не через self.client — реальный Django admin login
    рендерит HTML-шаблон, а тестовый раннер этого проекта (Django 4.2 на
    Python 3.14) падает при копировании RequestContext внутри
    инструментированного рендера шаблонов (несовместимость версий, не
    связанная с этой фичей) — изоляция от неё дополнительно делает тест
    более сфокусированным именно на логике throttle, а не на admin-view.
    """

    def setUp(self):
        cache.clear()
        self.factory = RequestFactory()
        self.middleware = LoginThrottleMiddleware(get_response=lambda request: HttpResponse('ok'))

    def test_admin_login_throttled_after_limit(self):
        statuses = []
        for _ in range(6):
            request = self.factory.post('/admin/login/', {'username': 'x', 'password': 'wrong'})
            statuses.append(self.middleware(request).status_code)
        self.assertEqual(statuses[-1], 429)
        self.assertNotIn(429, statuses[:5])

    def test_drf_browsable_login_throttled_after_limit(self):
        statuses = []
        for _ in range(6):
            request = self.factory.post('/api/auth/login/', {'username': 'x', 'password': 'wrong'})
            statuses.append(self.middleware(request).status_code)
        self.assertEqual(statuses[-1], 429)
        self.assertNotIn(429, statuses[:5])

    def test_get_requests_not_throttled(self):
        # GET (просто открыть страницу логина) не должен считаться попыткой входа.
        for _ in range(10):
            request = self.factory.get('/admin/login/')
            self.assertNotEqual(self.middleware(request).status_code, 429)

    def test_throttle_is_per_path_not_shared(self):
        # 5 неудачных попыток на /admin/login/ не должны блокировать /api/auth/login/.
        for _ in range(5):
            request = self.factory.post('/admin/login/', {'username': 'x', 'password': 'wrong'})
            self.middleware(request)
        request = self.factory.post('/api/auth/login/', {'username': 'x', 'password': 'wrong'})
        self.assertNotEqual(self.middleware(request).status_code, 429)

    def test_unrelated_paths_are_not_throttled_at_all(self):
        for _ in range(20):
            request = self.factory.post('/api/v1/orders/', {})
            self.assertNotEqual(self.middleware(request).status_code, 429)


class AccessDeniedLoggingTests(_HostPatchMixin, APITestCase):
    """#12: отказы 401/403 нигде не логировались — расследовать брутфорс/
    попытки несанкционированного доступа постфактум было нечем."""

    @classmethod
    def setUpTestData(cls):
        Group.objects.get_or_create(name=Roles.DESIGNER)
        cls.designer = User.objects.create_user(username='designer_audit', password='x')
        cls.designer.groups.add(Group.objects.get(name=Roles.DESIGNER))
        Group.objects.get_or_create(name=Roles.OWNER)
        cls.owner = User.objects.create_user(username='owner_audit', password='x')
        cls.owner.groups.add(Group.objects.get(name=Roles.OWNER))

    def test_403_is_logged(self):
        self.client.force_authenticate(user=self.designer)
        with self.assertLogs('atelier_erp.api.exception_handler', level='WARNING') as logs:
            resp = self.client.get(reverse('v1-staff-management-list'))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(any('designer_audit' in msg and '403' in msg for msg in logs.output))

    def test_401_is_logged(self):
        with self.assertLogs('atelier_erp.api.exception_handler', level='WARNING') as logs:
            resp = self.client.get(reverse('v1-staff-management-list'))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(any('anonymous' in msg and '401' in msg for msg in logs.output))

    def test_404_is_not_logged_as_access_denied(self):
        # 404 на несуществующий заказ у пользователя, которому эндпоинт вообще
        # разрешён (Owner) — не должно попадать в лог отказов в доступе,
        # только 401/403 — это ДРУГОЙ класс проблемы (не найдено, не отказано).
        self.client.force_authenticate(user=self.owner)
        logger = logging.getLogger('atelier_erp.api.exception_handler')
        with self.assertRaises(AssertionError):
            with self.assertLogs(logger, level='WARNING'):
                resp = self.client.get(reverse('v1-order-detail', args=[uuid.uuid4()]))
                self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


class BrowsableApiDisabledInProdTests(APITestCase):
    """#19: DRF browsable HTML API (формы для запросов прямо в браузере) было
    включено по умолчанию и никогда не отключалось в проде осознанно — лишняя
    поверхность атаки, фронт всегда ходит за JSON."""

    @classmethod
    def setUpTestData(cls):
        Group.objects.get_or_create(name=Roles.OWNER)
        cls.owner = User.objects.create_user(username='owner_renderer_audit', password='x')
        cls.owner.groups.add(Group.objects.get(name=Roles.OWNER))

    def test_json_renderer_always_available(self):
        self.assertIn(
            'rest_framework.renderers.JSONRenderer',
            settings.REST_FRAMEWORK['DEFAULT_RENDERER_CLASSES'],
        )

    def test_browsable_renderer_matches_debug_env_var(self):
        # DEFAULT_RENDERER_CLASSES вычисляется один раз при импорте settings.py
        # по значению env var DEBUG на момент старта процесса (не per-request).
        # settings.DEBUG сам по себе не годится как эталон в тесте: тестовый
        # раннер Django принудительно выставляет settings.DEBUG=False на время
        # прогона (даже если реальный .env держит DEBUG=True для локальной
        # разработки) — сверяемся с тем же источником, что читает settings.py.
        import os
        debug_env = os.environ.get('DEBUG', 'False').lower() == 'true'
        renderers = settings.REST_FRAMEWORK['DEFAULT_RENDERER_CLASSES']
        if debug_env:
            self.assertIn('rest_framework.renderers.BrowsableAPIRenderer', renderers)
        else:
            self.assertNotIn('rest_framework.renderers.BrowsableAPIRenderer', renderers)

    def test_api_response_is_plain_json_not_html_form(self):
        self.client.force_authenticate(user=self.owner)
        resp = self.client.get(reverse('v1-staff-management-list'))
        self.assertIn('application/json', resp['Content-Type'])

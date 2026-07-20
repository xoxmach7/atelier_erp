"""
ensure_superuser раньше безусловно перезаписывал пароль на каждом вызове
(вызывается в CMD контейнера при каждом деплое) — ручная смена пароля через
/admin/ откатывалась следующим redeploy. Найдено в security-аудите
2026-07-20 (B2/C1/F1). Теперь пароль не трогается при повторных вызовах,
кроме явного --force-password.
"""
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings

User = get_user_model()


@override_settings()
class EnsureSuperuserTests(TestCase):
    def setUp(self):
        self.env_patch = {
            'SUPERUSER_USERNAME': 'admin_test',
            'SUPERUSER_PASSWORD': 'first-password-123',
            'SUPERUSER_EMAIL': 'admin@test.local',
        }

    def _call(self, env, **kwargs):
        import os
        old = {k: os.environ.get(k) for k in env}
        os.environ.update(env)
        try:
            call_command('ensure_superuser', **kwargs)
        finally:
            for k, v in old.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v

    def test_creates_superuser_on_first_call(self):
        self._call(self.env_patch)
        user = User.objects.get(username='admin_test')
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.check_password('first-password-123'))

    def test_second_call_does_not_reset_manually_changed_password(self):
        self._call(self.env_patch)
        user = User.objects.get(username='admin_test')
        user.set_password('manually-rotated-password')
        user.save()

        # Redeploy: ensure_superuser вызывается снова с прежним SUPERUSER_PASSWORD.
        self._call(self.env_patch)

        user.refresh_from_db()
        self.assertTrue(user.check_password('manually-rotated-password'))
        self.assertFalse(user.check_password('first-password-123'))

    def test_force_password_flag_resets_password(self):
        self._call(self.env_patch)
        user = User.objects.get(username='admin_test')
        user.set_password('manually-rotated-password')
        user.save()

        self._call(self.env_patch, force_password=True)

        user.refresh_from_db()
        self.assertTrue(user.check_password('first-password-123'))

    def test_repairs_flags_without_touching_password(self):
        self._call(self.env_patch)
        user = User.objects.get(username='admin_test')
        user.set_password('manually-rotated-password')
        user.is_staff = False
        user.is_superuser = False
        user.save()

        self._call(self.env_patch)

        user.refresh_from_db()
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.check_password('manually-rotated-password'))

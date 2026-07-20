"""
Management command to ensure a superuser exists.
Safe to run on every deploy — idempotent, but see note below on password.

Usage: python manage.py ensure_superuser [--force-password]

Required env vars:
  SUPERUSER_USERNAME  (default: admin)
  SUPERUSER_PASSWORD  — required, skips if not set
  SUPERUSER_EMAIL     (default: admin@sheber.kz)
"""

import os
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User


class Command(BaseCommand):
    help = 'Ensure a superuser exists (idempotent, safe to run on every deploy)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force-password',
            action='store_true',
            help='Reset password to SUPERUSER_PASSWORD even if the account already exists.',
        )

    def handle(self, *args, **options):
        username = os.environ.get('SUPERUSER_USERNAME', 'admin')
        password = os.environ.get('SUPERUSER_PASSWORD')
        email = os.environ.get('SUPERUSER_EMAIL', 'admin@sheber.kz')

        if not password:
            self.stdout.write(self.style.WARNING(
                'SUPERUSER_PASSWORD not set — skipping ensure_superuser'
            ))
            return

        user, created = User.objects.get_or_create(
            username=username,
            defaults={'email': email, 'is_staff': True, 'is_superuser': True},
        )

        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f'Superuser "{username}" created'))
            return

        # Раньше пароль перезаписывался безусловно на КАЖДОМ деплое — если
        # его меняли вручную через /admin/ (например, в рамках ротации),
        # следующий redeploy молча откатывал его на значение из env
        # (security-аудит 2026-07-20, B2/C1/F1). Теперь по умолчанию только
        # чиним флаги is_staff/is_superuser (могли случайно снять) и
        # оставляем пароль как есть; принудительный сброс — явным флагом.
        update_fields = []
        if not user.is_staff:
            user.is_staff = True
            update_fields.append('is_staff')
        if not user.is_superuser:
            user.is_superuser = True
            update_fields.append('is_superuser')

        if options['force_password']:
            user.set_password(password)
            update_fields.append('password')

        if update_fields:
            user.save(update_fields=update_fields)
            self.stdout.write(self.style.SUCCESS(
                f'Superuser "{username}" already exists — updated: {", ".join(update_fields)}'
            ))
        else:
            self.stdout.write(self.style.SUCCESS(f'Superuser "{username}" already exists — no changes'))

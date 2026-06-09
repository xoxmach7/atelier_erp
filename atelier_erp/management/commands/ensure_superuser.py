"""
Management command to ensure a superuser exists.
Reads credentials from env vars — safe to run on every deploy.

Usage: python manage.py ensure_superuser

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
        else:
            # Update password and flags in case they changed
            user.set_password(password)
            user.is_staff = True
            user.is_superuser = True
            user.save()
            self.stdout.write(self.style.SUCCESS(f'Superuser "{username}" already exists — password updated'))

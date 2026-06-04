"""
Management command to create default user groups for Atelier ERP.

Имена групп берутся из единого реестра atelier_erp.roles.Roles, чтобы они
гарантированно совпадали с проверками в api/permissions.py и фронтом.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission

from atelier_erp.roles import Roles


class Command(BaseCommand):
    help = 'Create default user groups for Atelier ERP'

    def handle(self, *args, **options):
        for group_name in Roles.ALL:
            group, created = Group.objects.get_or_create(name=group_name)
            status = 'Created' if created else 'Exists'
            description = Roles.DESCRIPTIONS.get(group_name, '')
            self.stdout.write(f'{status}: {group_name} — {description}')

            # Владелец/админ получает все модельные права (для admin-сайта и
            # DjangoModelPermissions). Доступ к API всё равно ограничен кастомными
            # permission-классами и срезом get_queryset.
            if group_name == Roles.OWNER:
                group.permissions.set(Permission.objects.all())
                self.stdout.write('  -> All permissions added')

        self.stdout.write(self.style.SUCCESS('\nAll role groups ready.'))
        self.stdout.write('Run: python manage.py seed_pilot --atelier "Name" to create pilot accounts')

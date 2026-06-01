"""
Management command to create default user groups for Atelier ERP MVP
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission


MVP_GROUPS = {
    'Admin': {'description': 'Full system access', 'all_permissions': True},
    'Manager': {'description': 'Owner/manager — full order management'},
    'Designer': {'description': 'Designer/measurer — orders, measurements, quotes'},
    'Warehouse': {'description': 'Warehouse — material readiness'},
    'Seamstress': {'description': 'Production/seamstress — sewing queue'},
    'Installer': {'description': 'Installer — installation/handover queue'},
    'Finance': {'description': 'Finance — payments'},
}


class Command(BaseCommand):
    help = 'Create default user groups for Atelier ERP MVP'

    def handle(self, *args, **options):
        for group_name, data in MVP_GROUPS.items():
            group, created = Group.objects.get_or_create(name=group_name)
            status = 'Created' if created else 'Exists'
            self.stdout.write(f'{status}: {group_name} — {data["description"]}')

            if data.get('all_permissions'):
                group.permissions.set(Permission.objects.all())
                self.stdout.write(f'  → All permissions added')

        self.stdout.write(self.style.SUCCESS('\nAll MVP groups ready.'))
        self.stdout.write('Run: python manage.py seed_pilot --atelier "Name" to create pilot accounts')

"""
Management command to create default user groups
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission


class Command(BaseCommand):
    help = 'Create default user groups for Atelier ERP'

    def handle(self, *args, **options):
        groups_data = {
            'Admin': {
                'description': 'Full system access',
                'permissions': [],  # All permissions
            },
            'Manager': {
                'description': 'Order management, customer management',
                'permissions': [
                    'view_order', 'add_order', 'change_order', 'delete_order',
                    'view_customer', 'add_customer', 'change_customer',
                    'view_fabric', 'change_fabric',
                    'view_productionassignment', 'change_productionassignment',
                    'view_payment', 'add_payment',
                    'view_task', 'change_task',
                ],
            },
            'Worker': {
                'description': 'Read access, task updates',
                'permissions': [
                    'view_order',
                    'view_customer',
                    'view_fabric',
                    'view_task', 'change_task',
                    'view_productionassignment',
                ],
            },
            'Seamstress': {
                'description': 'Production work, own assignments only',
                'permissions': [
                    'view_order',
                    'view_fabric',
                    'view_productionassignment',
                ],
            },
        }
        
        for group_name, data in groups_data.items():
            group, created = Group.objects.get_or_create(name=group_name)
            
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created group: {group_name}'))
            else:
                self.stdout.write(f'Group already exists: {group_name}')
            
            # For Admin, add all permissions
            if group_name == 'Admin':
                all_perms = Permission.objects.all()
                group.permissions.set(all_perms)
                self.stdout.write(f'  → Added all {all_perms.count()} permissions')
            else:
                # Add specific permissions
                for perm_codename in data['permissions']:
                    try:
                        perm = Permission.objects.get(codename=perm_codename)
                        group.permissions.add(perm)
                    except Permission.DoesNotExist:
                        self.stdout.write(self.style.WARNING(f'  → Permission not found: {perm_codename}'))
        
        self.stdout.write(self.style.SUCCESS('\nAll groups created successfully!'))

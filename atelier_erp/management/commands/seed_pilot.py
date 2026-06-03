"""
Management command to create pilot atelier accounts.
Usage: python manage.py seed_pilot --atelier "Sheber Atelier" --reset
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User, Group
import random
import string

from atelier_erp.roles import Roles


def rand_password(n=12):
    chars = string.ascii_letters + string.digits
    return ''.join(random.choices(chars, k=n))


# Имена групп берутся из единого реестра Roles (канонично).
PILOT_ROLES = [
    ('owner',       Roles.OWNER,      'Владелец',   'owner'),
    ('designer',    Roles.DESIGNER,   'Дизайнер',   'designer'),
    ('warehouse',   Roles.WAREHOUSE,  'Склад',       'warehouse'),
    ('seamstress',  Roles.SEAMSTRESS, 'Швея',        'seamstress'),
    ('installer',   Roles.INSTALLER,  'Установщик',  'installer'),
]


class Command(BaseCommand):
    help = 'Create pilot atelier user accounts'

    def add_arguments(self, parser):
        parser.add_argument('--atelier', type=str, default='pilot', help='Atelier name prefix for usernames')
        parser.add_argument('--reset', action='store_true', help='Delete existing pilot users before creating')

    def handle(self, *args, **options):
        prefix = options['atelier'].lower().replace(' ', '_')[:12]

        if options['reset']:
            deleted = User.objects.filter(username__startswith=f'{prefix}_').delete()
            self.stdout.write(f'Deleted {deleted[0]} existing pilot users')

        self.stdout.write(self.style.SUCCESS(f'\n=== Pilot accounts for: {options["atelier"]} ===\n'))
        self.stdout.write(f'{"Username":<25} {"Password":<15} {"Group":<12} {"Role"}')
        self.stdout.write('-' * 70)

        for username_suffix, group_name, display, role in PILOT_ROLES:
            username = f'{prefix}_{username_suffix}'
            password = rand_password()

            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'first_name': display,
                    'last_name': options['atelier'],
                    'is_active': True,
                }
            )
            if created or options['reset']:
                user.set_password(password)
                user.save()
            else:
                password = '(existing — use reset to regenerate)'

            try:
                group = Group.objects.get(name=group_name)
                user.groups.clear()
                user.groups.add(group)
            except Group.DoesNotExist:
                self.stdout.write(self.style.WARNING(f'  Group {group_name} not found — run seed_groups first'))

            self.stdout.write(f'{username:<25} {password:<15} {group_name:<12} {display}')

        self.stdout.write(self.style.SUCCESS(f'\nDone! Share these credentials with the pilot atelier.'))
        self.stdout.write('\nSetup commands:')
        self.stdout.write(f'  python manage.py seed_groups')
        self.stdout.write(f'  python manage.py seed_pilot --atelier "{options["atelier"]}"')
        self.stdout.write(f'  python manage.py seed_demo_workflow --reset-demo')

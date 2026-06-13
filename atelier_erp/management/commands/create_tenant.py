"""
Management command: создать тенант и привязать всех существующих пользователей и данные.

Использование:
    python manage.py create_tenant --name="Ателье Шебер" --slug="sheber"

Что делает:
    1. Создаёт Tenant (если не существует)
    2. Создаёт TenantMembership для ВСЕХ активных пользователей без тенанта
    3. Проставляет tenant FK на всех существующих Order, Customer,
       Measurement, ProductionAssignment, SeamstressPayment, NumberSequence
"""

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from django.db import transaction


class Command(BaseCommand):
    help = 'Создать тенант и мигрировать все существующие данные на него'

    def add_arguments(self, parser):
        parser.add_argument('--name', required=True, help='Название ателье')
        parser.add_argument('--slug', required=True, help='Slug тенанта (латиница, уникальный)')
        parser.add_argument('--dry-run', action='store_true', help='Показать что будет сделано без сохранения')

    def handle(self, *args, **options):
        from atelier_erp.models import (
            Tenant, TenantMembership,
            Order, Customer, Measurement,
            ProductionAssignment, SeamstressPayment, NumberSequence,
        )

        name = options['name']
        slug = options['slug']
        dry_run = options['dry_run']

        if dry_run:
            self.stdout.write(self.style.WARNING('=== DRY RUN — изменения не сохраняются ==='))

        with transaction.atomic():
            # 1. Создать или найти тенант
            tenant, created = Tenant.objects.get_or_create(
                slug=slug,
                defaults={'name': name, 'is_active': True},
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'✓ Тенант создан: {tenant.name} (slug={slug})'))
            else:
                self.stdout.write(f'  Тенант уже существует: {tenant.name} (id={tenant.id})')

            # 2. Привязать всех пользователей без тенанта
            users_without_tenant = User.objects.filter(
                is_active=True
            ).exclude(
                tenant_membership__isnull=False
            )
            memberships_created = 0
            for user in users_without_tenant:
                if not dry_run:
                    TenantMembership.objects.get_or_create(user=user, defaults={'tenant': tenant})
                memberships_created += 1
                self.stdout.write(f'  + Membership: {user.username}')
            self.stdout.write(self.style.SUCCESS(
                f'✓ Привязано пользователей: {memberships_created}'
            ))

            # 3. Проставить tenant на все существующие данные
            models_to_migrate = [
                (Order,                'заказов'),
                (Customer,             'клиентов'),
                (Measurement,          'замеров'),
                (ProductionAssignment, 'назначений производства'),
                (SeamstressPayment,    'выплат швей'),
                (NumberSequence,       'счётчиков нумерации'),
            ]

            for Model, label in models_to_migrate:
                qs = Model.objects.filter(tenant__isnull=True)
                count = qs.count()
                if count > 0:
                    if not dry_run:
                        qs.update(tenant=tenant)
                    self.stdout.write(self.style.SUCCESS(
                        f'✓ Обновлено {count} {label}'
                    ))
                else:
                    self.stdout.write(f'  {label.capitalize()}: нечего мигрировать')

            if dry_run:
                transaction.set_rollback(True)
                self.stdout.write(self.style.WARNING('=== DRY RUN завершён — откат транзакции ==='))
            else:
                self.stdout.write(self.style.SUCCESS(
                    f'\n✅ Тенант "{name}" готов. id={tenant.id}'
                ))

"""
Data migration: создать дефолтный тенант 'sheber' и привязать
все существующие данные и пользователей к нему.

Запускается автоматически при railway deploy / manage.py migrate.
Безопасна для повторного запуска (идемпотентна).
"""

from django.db import migrations


def create_default_tenant(apps, schema_editor):
    Tenant = apps.get_model('atelier_erp', 'Tenant')
    TenantMembership = apps.get_model('atelier_erp', 'TenantMembership')
    User = apps.get_model('auth', 'User')

    Order = apps.get_model('atelier_erp', 'Order')
    Customer = apps.get_model('atelier_erp', 'Customer')
    ProductionAssignment = apps.get_model('atelier_erp', 'ProductionAssignment')
    SeamstressPayment = apps.get_model('atelier_erp', 'SeamstressPayment')
    NumberSequence = apps.get_model('atelier_erp', 'NumberSequence')

    # Создать дефолтный тенант (идемпотентно)
    tenant, _ = Tenant.objects.get_or_create(
        slug='sheber',
        defaults={'name': 'Sheber Atelier', 'is_active': True},
    )

    # Привязать всех активных пользователей без тенанта
    for user in User.objects.filter(is_active=True):
        TenantMembership.objects.get_or_create(
            user=user,
            defaults={'tenant': tenant},
        )

    # Проставить tenant на все данные без него
    # Measurement не имеет прямого tenant FK (изолирована через Order)
    for Model in [Order, Customer, ProductionAssignment, SeamstressPayment, NumberSequence]:
        Model.objects.filter(tenant__isnull=True).update(tenant=tenant)


def reverse_default_tenant(apps, schema_editor):
    # Реверс — просто очищаем tenant на всех записях дефолтного тенанта
    Tenant = apps.get_model('atelier_erp', 'Tenant')
    try:
        tenant = Tenant.objects.get(slug='sheber')
        tenant.delete()
    except Tenant.DoesNotExist:
        pass


class Migration(migrations.Migration):

    dependencies = [
        ('atelier_erp', '0018_tenant_tenantmembership_customer_tenant_and_more'),
    ]

    operations = [
        migrations.RunPython(create_default_tenant, reverse_default_tenant),
    ]

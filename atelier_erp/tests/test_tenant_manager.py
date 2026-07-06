from django.test import TestCase

from atelier_erp.models import Customer, Tenant
from atelier_erp.tenant_context import ALL_TENANTS, set_current_tenant_id, reset_current_tenant_id


class TenantManagerTests(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(name='Ателье А', slug='atelier-a')
        self.tenant_b = Tenant.objects.create(name='Ателье Б', slug='atelier-b')

        self.customer_a = Customer.objects.create(
            full_name='Клиент А', phone='+79990000001', tenant=self.tenant_a
        )
        self.customer_b = Customer.objects.create(
            full_name='Клиент Б', phone='+79990000002', tenant=self.tenant_b
        )
        self.customer_none = Customer.objects.create(
            full_name='Клиент без тенанта', phone='+79990000003', tenant=None
        )

    def test_filters_by_current_tenant(self):
        token = set_current_tenant_id(self.tenant_a.id)
        try:
            names = set(Customer.objects.values_list('full_name', flat=True))
        finally:
            reset_current_tenant_id(token)
        self.assertEqual(names, {'Клиент А'})

    def test_other_tenant_isolated(self):
        token = set_current_tenant_id(self.tenant_b.id)
        try:
            names = set(Customer.objects.values_list('full_name', flat=True))
        finally:
            reset_current_tenant_id(token)
        self.assertEqual(names, {'Клиент Б'})

    def test_no_tenant_context_shows_null_tenant_rows(self):
        token = set_current_tenant_id(None)
        try:
            names = set(Customer.objects.values_list('full_name', flat=True))
        finally:
            reset_current_tenant_id(token)
        self.assertEqual(names, {'Клиент без тенанта'})

    def test_all_tenants_sentinel_shows_everything(self):
        token = set_current_tenant_id(ALL_TENANTS)
        try:
            names = set(Customer.objects.values_list('full_name', flat=True))
        finally:
            reset_current_tenant_id(token)
        self.assertEqual(names, {'Клиент А', 'Клиент Б', 'Клиент без тенанта'})

    def test_unfiltered_manager_still_available_for_admin(self):
        # Явный «сырой» доступ без tenant-фильтра — нужен для админки/миграций данных.
        token = set_current_tenant_id(self.tenant_a.id)
        try:
            count = Customer.all_tenants.count()
        finally:
            reset_current_tenant_id(token)
        self.assertEqual(count, 3)

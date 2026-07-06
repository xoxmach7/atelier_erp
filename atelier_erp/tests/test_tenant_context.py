from django.test import TestCase
from atelier_erp.tenant_context import (
    ALL_TENANTS,
    get_current_tenant_id,
    set_current_tenant_id,
    reset_current_tenant_id,
)


class TenantContextTests(TestCase):
    def test_default_is_all_tenants(self):
        # Нетронутый ContextVar (management-команда/Celery/shell — middleware
        # не запускался) должен означать «без ограничения по tenant», а не
        # «только tenant=None» — см. docstring tenant_context.py.
        self.assertEqual(get_current_tenant_id(), ALL_TENANTS)

    def test_set_and_get(self):
        token = set_current_tenant_id(42)
        try:
            self.assertEqual(get_current_tenant_id(), 42)
        finally:
            reset_current_tenant_id(token)
        self.assertEqual(get_current_tenant_id(), ALL_TENANTS)

    def test_superuser_sentinel_bypasses_filter(self):
        token = set_current_tenant_id('__ALL__')
        try:
            self.assertEqual(get_current_tenant_id(), '__ALL__')
        finally:
            reset_current_tenant_id(token)

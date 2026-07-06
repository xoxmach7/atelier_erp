from django.test import TestCase
from atelier_erp.tenant_context import get_current_tenant_id, set_current_tenant_id, reset_current_tenant_id


class TenantContextTests(TestCase):
    def test_default_is_none(self):
        self.assertIsNone(get_current_tenant_id())

    def test_set_and_get(self):
        token = set_current_tenant_id(42)
        try:
            self.assertEqual(get_current_tenant_id(), 42)
        finally:
            reset_current_tenant_id(token)
        self.assertIsNone(get_current_tenant_id())

    def test_superuser_sentinel_bypasses_filter(self):
        token = set_current_tenant_id('__ALL__')
        try:
            self.assertEqual(get_current_tenant_id(), '__ALL__')
        finally:
            reset_current_tenant_id(token)

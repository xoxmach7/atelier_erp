from django.apps import AppConfig
from django.db.models.signals import post_save, post_delete


class AtelierErpConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'atelier_erp'
    verbose_name = 'Atelier ERP'
    
    def ready(self):
        # Import signal handlers
        import atelier_erp.signals  # noqa

        # Патч DRF-аутентификации: правильный момент резолва tenant для JWT-
        # запросов — см. docstring atelier_erp/tenant_drf.py.
        from atelier_erp.tenant_drf import patch_drf_authentication
        patch_drf_authentication()

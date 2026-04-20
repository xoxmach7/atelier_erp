from django.apps import AppConfig
from django.db.models.signals import post_save, post_delete


class AtelierErpConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'atelier_erp'
    verbose_name = 'Atelier ERP'
    
    def ready(self):
        # Import signal handlers
        import atelier_erp.signals  # noqa

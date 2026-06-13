"""
Утилиты для изоляции данных по тенантам.

TenantModelMixin — добавлять к ViewSet'ам, которые работают с тенант-изолированными
моделями. Автоматически:
  - фильтрует queryset по request.tenant
  - проставляет tenant при create
"""

from __future__ import annotations
from rest_framework.exceptions import PermissionDenied


class TenantModelMixin:
    """Mixin для DRF ViewSet — изолирует данные по тенанту."""

    tenant_field = 'tenant'   # имя FK-поля на модели

    def get_queryset(self):
        qs = super().get_queryset()
        tenant = getattr(self.request, 'tenant', None)

        # Суперюзер без тенанта — видит всё (Railway shell, admin панель)
        if self.request.user.is_superuser and tenant is None:
            return qs

        # Обычный юзер без тенанта — пустой результат (graceful degradation,
        # не 403, чтобы фронт не ломался до запуска create_tenant/0019)
        if tenant is None:
            return qs.none()

        return qs.filter(**{self.tenant_field: tenant})

    def perform_create(self, serializer):
        tenant = getattr(self.request, 'tenant', None)

        # Суперюзер без тенанта может создавать (Railway shell)
        if self.request.user.is_superuser and tenant is None:
            serializer.save()
            return

        if tenant is None:
            raise PermissionDenied(
                'Tenant not assigned. Run: manage.py create_tenant --name=... --slug=...'
            )
        serializer.save(**{self.tenant_field: tenant})


class TenantViaOrderMixin(TenantModelMixin):
    """
    Для моделей без прямого tenant FK, у которых есть order → Order.tenant.
    Используется для Payment, Quote, Measurement.
    get_queryset фильтрует по order__tenant=request.tenant.
    perform_create не проставляет tenant — он уже задан через order.
    """
    tenant_field = 'order__tenant'

    def perform_create(self, serializer):
        tenant = getattr(self.request, 'tenant', None)
        if self.request.user.is_superuser and tenant is None:
            serializer.save()
            return
        if tenant is None:
            raise PermissionDenied(
                'Tenant not assigned. Run: manage.py create_tenant --name=... --slug=...'
            )
        # Не проставляем tenant напрямую — он уже есть в order
        serializer.save()

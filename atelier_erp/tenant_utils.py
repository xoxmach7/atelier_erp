"""
Утилиты для изоляции данных по тенантам.

TenantModelMixin — добавлять к ViewSet'ам, которые работают с тенант-изолированными
моделями. Автоматически:
  - фильтрует queryset по request.tenant
  - проставляет tenant при create
"""

from __future__ import annotations


class TenantModelMixin:
    """Mixin для DRF ViewSet — изолирует данные по тенанту."""

    tenant_field = 'tenant'   # имя FK-поля на модели

    def _current_tenant(self):
        """Текущий тенант запроса как КОНКРЕТНОЕ значение (Tenant | None).

        request.tenant — это SimpleLazyObject. Проверка `is None` на нём всегда
        ложна (это обёртка, а не None), а если положить ленивый объект, обёртывающий
        None, в FK — Django падает с ValueError → 500. `or None` форсит вычисление
        обёртки и приводит «ленивый None» к настоящему None.
        """
        return getattr(self.request, 'tenant', None) or None

    def get_queryset(self):
        qs = super().get_queryset()
        tenant = self._current_tenant()

        # Суперюзер без тенанта — видит всё (Railway shell, admin панель)
        if self.request.user.is_superuser and tenant is None:
            return qs

        # Тенанты ещё не настроены (single-tenant режим): данные живут с tenant=None,
        # поэтому показываем их (фильтр по None), а не прячем всё.
        if tenant is None:
            return qs.filter(**{self.tenant_field: None})

        return qs.filter(**{self.tenant_field: tenant})

    def perform_create(self, serializer):
        tenant = self._current_tenant()

        # Нет тенанта (тенанты ещё не настроены / пользователь без membership) —
        # single-tenant режим: сохраняем с tenant=None, как существующие данные,
        # вместо падения 500/403. Полную привязку включим при setup мультитенантности.
        if tenant is None:
            serializer.save()
            return
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
        # tenant берётся из связанного order, отдельно не проставляем.
        serializer.save()

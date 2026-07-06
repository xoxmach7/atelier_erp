"""
Утилиты для изоляции данных по тенантам.

TenantModelMixin — добавлять к ViewSet'ам, которые работают с тенант-изолированными
моделями. Автоматически:
  - фильтрует queryset по request.tenant
  - проставляет tenant при create
"""

from __future__ import annotations

from django.db import models

from atelier_erp.tenant_context import ALL_TENANTS, get_current_tenant_id


class TenantModelMixin:
    """Mixin для DRF ViewSet — изолирует данные по тенанту.

    С введением TenantManager (см. TenantManagerMixin ниже) фильтрация
    ЧТЕНИЯ для моделей с прямым tenant FK (Customer, Order, Task,
    InventoryItem, ProductionAssignment, SeamstressPayment) теперь
    происходит УЖЕ на уровне ORM-менеджера — Model.objects.all() сам по
    себе безопасен. Вызов scope_to_tenant() в get_queryset() ViewSet'а для
    этих моделей остаётся как ВТОРАЯ ЛИНИЯ ЗАЩИТЫ (defense in depth), а не
    дублирующая ручная фильтрация по недосмотру — не удалять его при
    рефакторинге.

    Для моделей БЕЗ прямого tenant FK (Payment, Quote, Measurement — см.
    TenantViaOrderMixin ниже) TenantManager не применяется вообще (у них
    нет поля tenant, только order__tenant), поэтому для них
    scope_to_tenant() — ЕДИНСТВЕННАЯ защита чтения, а не второй уровень.

    perform_create() остаётся единственным местом, которое проставляет
    tenant при создании для моделей с прямым FK — это ORM-менеджер сделать
    не может (менеджер видит только уже сохранённые строки, чтение, не запись).
    """

    tenant_field = 'tenant'   # имя FK-поля на модели

    def _current_tenant(self):
        """Текущий тенант запроса как КОНКРЕТНОЕ значение (Tenant | None).

        request.tenant — это SimpleLazyObject. Проверка `is None` на нём всегда
        ложна (это обёртка, а не None), а если положить ленивый объект, обёртывающий
        None, в FK — Django падает с ValueError → 500. `or None` форсит вычисление
        обёртки и приводит «ленивый None» к настоящему None.
        """
        return getattr(self.request, 'tenant', None) or None

    def scope_to_tenant(self, qs):
        """Явно применить tenant-фильтр к произвольному queryset.

        ВАЖНО: если ViewSet переопределяет get_queryset() своим методом
        (нужно для ролевой фильтрации — см. OrderViewSet, CustomerViewSet
        и т.д.), Python MRO НЕ вызывает get_queryset() миксина автоматически —
        переопределение в дочернем классе полностью его перекрывает.
        Раньше это приводило к тому, что тенант-фильтрация тихо не применялась
        нигде, кроме вьюсетов без своего get_queryset (например InventoryItemViewSet).

        Использовать: в конце собственного get_queryset() дочернего класса
        оборачивать финальный (уже отфильтрованный по роли/query-параметрам)
        qs через `return self.scope_to_tenant(qs)`.
        """
        tenant = self._current_tenant()

        # Суперюзер без тенанта — видит всё (Railway shell, админка)
        if self.request.user.is_superuser and tenant is None:
            return qs

        # Тенанты ещё не настроены (single-tenant режим): данные живут с tenant=None,
        # поэтому показываем их (фильтр по None), а не прячем всё.
        if tenant is None:
            return qs.filter(**{self.tenant_field: None})

        return qs.filter(**{self.tenant_field: tenant})

    def get_queryset(self):
        """Используется только вьюсетами, которые НЕ переопределяют get_queryset
        сами (например InventoryItemViewSet). Вьюсеты с ролевой логикой
        должны вызывать self.scope_to_tenant(...) явно в конце своего метода."""
        return self.scope_to_tenant(super().get_queryset())

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


class TenantManager(models.Manager):
    """
    Менеджер модели, фильтрующий по текущему tenant (из ContextVar).

    Используется как ОСНОВНОЙ менеджер (`objects`) на моделях с прямым
    полем `tenant`. Это защита на уровне ORM: `Model.objects.all()`
    физически не может вернуть чужие данные, в отличие от DRF-миксина
    TenantModelMixin, который защищает только ViewSet'ы, явно его
    вызывающие (см. инцидент с TaskViewSet, где фильтрация была пропущена).

    Правила:
      - contextvar == '__ALL__' (дефолт ContextVar, когда никто его не
        выставлял — management-команда/Celery/shell вне HTTP-запроса;
        либо суперюзер без tenant внутри HTTP-запроса) → без фильтра.
      - contextvar == None (ТОЛЬКО явный результат middleware внутри
        HTTP-запроса: тенант не определён для аутентифицированного
        не-суперюзера без TenantMembership) → показываем строки с
        tenant=None (совместимость с single-tenant данными, как и
        раньше в TenantModelMixin.scope_to_tenant).
      - contextvar == <id> → filter(tenant_id=<id>).

    Для «сырого» доступа без фильтра (админка, скрипты миграции данных)
    использовать `Model.all_tenants` — см. TenantManagerMixin ниже.
    """

    def get_queryset(self):
        qs = super().get_queryset()
        tenant_id = get_current_tenant_id()

        if tenant_id == ALL_TENANTS:
            return qs
        if tenant_id is None:
            return qs.filter(tenant__isnull=True)
        return qs.filter(tenant_id=tenant_id)


class TenantManagerMixin(models.Model):
    """
    Miксин для моделей с полем tenant: добавляет `objects` (отфильтрованный
    TenantManager) и `all_tenants` (обычный Manager без фильтра — для
    админки, дата-миграций, superuser-скриптов).

    Использование:
        class Customer(TenantManagerMixin, UUIDModel, TimestampedModel):
            tenant = models.ForeignKey(...)
            ...

    ВАЖНО: порядок менеджеров имеет значение в Django — первый объявленный
    менеджер класса становится default manager. Объявляем `objects` первым.
    """

    objects = TenantManager()
    all_tenants = models.Manager()

    class Meta:
        abstract = True

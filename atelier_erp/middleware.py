"""
TenantMiddleware — определяет тенант текущего запроса из JWT и
прикрепляет его к request.tenant, а также кладёт id тенанта в
ContextVar (atelier_erp.tenant_context), который читает TenantManager
на уровне ORM — это даёт защиту от утечки данных между тенантами
даже там, где ViewSet забыл вызвать scope_to_tenant().

Работает ПОСЛЕ AuthenticationMiddleware / JWT-аутентификации DRF.
Tenant резолвится один раз, эагерно (сразу при входе в middleware) —
то же значение присваивается request.tenant и используется для
выставления ContextVar, повторного резолва при обращении к
request.tenant не происходит.
"""

from __future__ import annotations

from atelier_erp.tenant_context import (
    ALL_TENANTS,
    set_current_tenant_id,
    reset_current_tenant_id,
)


def _get_tenant(request):
    """Вернуть Tenant для текущего запроса или None."""
    from atelier_erp.models import TenantMembership

    user = getattr(request, '_cached_user', None) or getattr(request, 'user', None)
    if user is None or not user.is_authenticated:
        return None

    try:
        return user.tenant_membership.tenant
    except TenantMembership.DoesNotExist:
        return None


class TenantMiddleware:
    """Добавляет request.tenant (Tenant | None) к каждому запросу
    и выставляет ContextVar для ORM-уровня фильтрации."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Резолвим tenant один раз, эагерно (после AuthenticationMiddleware
        # user уже известен) — то же значение уходит и в request.tenant,
        # и в ContextVar, который должен быть выставлен ДО того, как view
        # начнёт делать ORM-запросы.
        tenant = _get_tenant(request)
        request.tenant = tenant
        user = getattr(request, 'user', None)

        if tenant is not None:
            token = set_current_tenant_id(tenant.id)
        elif user is not None and getattr(user, 'is_authenticated', False) and getattr(user, 'is_superuser', False):
            # Суперюзер без tenant membership (Railway shell/админка) — видит всё.
            token = set_current_tenant_id(ALL_TENANTS)
        else:
            # Тенант не определён — single-tenant режим, данные с tenant=None.
            token = set_current_tenant_id(None)

        try:
            response = self.get_response(request)
        finally:
            reset_current_tenant_id(token)

        return response

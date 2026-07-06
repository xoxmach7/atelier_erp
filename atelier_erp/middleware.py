"""
TenantMiddleware — определяет тенант текущего запроса из JWT и
прикрепляет его к request.tenant, а также кладёт id тенанта в
ContextVar (atelier_erp.tenant_context), который читает TenantManager
на уровне ORM — это даёт защиту от утечки данных между тенантами
даже там, где ViewSet забыл вызвать scope_to_tenant().

Работает ПОСЛЕ AuthenticationMiddleware / JWT-аутентификации DRF,
поэтому использует lazy-резолв: tenant подгружается только при первом
обращении к request.tenant.
"""

from __future__ import annotations
from django.utils.functional import SimpleLazyObject

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
        request.tenant = SimpleLazyObject(lambda: _get_tenant(request))

        # ContextVar должен быть выставлен ДО того, как view начнёт делать
        # ORM-запросы. request.tenant — ленивый, поэтому резолвим его здесь
        # явно (после AuthenticationMiddleware user уже известен).
        tenant = _get_tenant(request)
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

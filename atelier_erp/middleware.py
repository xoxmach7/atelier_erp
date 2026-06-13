"""
TenantMiddleware — определяет тенант текущего запроса из JWT и
прикрепляет его к request.tenant.

Работает ПОСЛЕ AuthenticationMiddleware / JWT-аутентификации DRF,
поэтому использует lazy-резолв: tenant подгружается только при первом
обращении к request.tenant.
"""

from __future__ import annotations
from django.utils.functional import SimpleLazyObject


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
    """Добавляет request.tenant (Tenant | None) к каждому запросу."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.tenant = SimpleLazyObject(lambda: _get_tenant(request))
        return self.get_response(request)

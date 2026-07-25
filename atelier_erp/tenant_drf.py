"""
Патч DRF APIView.perform_authentication — исправляет момент резолва тенанта
для API-запросов.

БАГ (найден 2026-07-25): TenantMiddleware (atelier_erp/middleware.py) —
обычный Django-middleware. Его код выполняется ДО вызова self.get_response(),
то есть ДО того, как DRF внутри dispatch()/initial() успевает распознать
пользователя по JWT (DEFAULT_AUTHENTICATION_CLASSES = JWTAuthentication).
В момент, когда middleware читает request.user, Django ещё не знает пользователя
(JWT — не сессионная аутентификация, AuthenticationMiddleware её не видит) —
request.user на этом этапе всегда AnonymousUser. Из-за этого request.tenant и
ContextVar (tenant_context.py) ВСЕГДА резолвились в «нет тенанта» для любого
JWT-аутентифицированного запроса, независимо от реального TenantMembership
пользователя — межателье-изоляция была фикцией для всего API (см. память
проекта, находка при подготовке фичи "Добавить ателье").

Для сессионной аутентификации (Django admin) middleware работает КОРРЕКТНО —
там request.user резолвится раньше (из сессии), поэтому middleware.py не
трогаем — эта проблема специфична для JWT/DRF-запросов.

ИСПРАВЛЕНИЕ: перерезолвить тенант ПОСЛЕ того, как DRF узнал настоящего
пользователя. APIView.perform_authentication — единственная точка, которую
DRF вызывает для КАЖДОГО запроса (внутри initial(), до вызова обработчика) и
сразу после которой request.user гарантированно правильный (JWT, сессия или
force_authenticate в тестах — все три пути идут через одну и ту же точку).
Патчим её один раз при старте приложения (AppConfig.ready) — так это
применяется сразу ко всем вьюсетам, без правки каждого класса и без риска
забыть подключить миксин на новом вьюсете.

ContextVar, выставленный здесь поверх значения от TenantMiddleware, всё равно
корректно сбрасывается после ответа: contextvars.Token, который вернул более
ранний set() у middleware, при reset() восстанавливает состояние ДО этого
set() — независимо от того, сколько раз ContextVar переустанавливали между
set() и reset() (см. try/finally в TenantMiddleware.__call__).
"""
from __future__ import annotations

from rest_framework.views import APIView

from atelier_erp.tenant_context import ALL_TENANTS, set_current_tenant_id

_original_perform_authentication = APIView.perform_authentication


def _resolve_tenant_for_user(user):
    from atelier_erp.models import TenantMembership

    if user is None or not getattr(user, 'is_authenticated', False):
        return None
    try:
        return user.tenant_membership.tenant
    except TenantMembership.DoesNotExist:
        return None


def _perform_authentication_and_resolve_tenant(self, request):
    _original_perform_authentication(self, request)

    user = request.user
    tenant = _resolve_tenant_for_user(user)

    # request здесь — DRF Request-обёртка; self.request в обработчиках
    # (list/create/get_queryset и т.д.) — тот же самый объект, поэтому
    # присваивание видно везде, где код читает self.request.tenant.
    request.tenant = tenant
    request._request.tenant = tenant  # держим в синхроне и «сырой» Django-request

    if tenant is not None:
        set_current_tenant_id(tenant.id)
    elif getattr(user, 'is_authenticated', False) and getattr(user, 'is_superuser', False):
        set_current_tenant_id(ALL_TENANTS)
    else:
        set_current_tenant_id(None)


def patch_drf_authentication() -> None:
    """Вызывается один раз из AtelierErpConfig.ready()."""
    APIView.perform_authentication = _perform_authentication_and_resolve_tenant

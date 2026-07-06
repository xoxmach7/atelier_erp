"""
ContextVar для текущего tenant запроса.

В отличие от threading.local, contextvars.ContextVar корректно работает
и в sync, и в async Django-обработчиках, и не «утекает» между потоками
в пуле воркеров (Gunicorn sync workers создают новый контекст на запрос).

Значение:
  None       — HTTP-запрос обработан TenantMiddleware, и тенант ЯВНО резолвился
               в «нет тенанта» (single-tenant режим / пользователь без
               TenantMembership). В этом случае TenantManager должен
               фильтровать по tenant=None (совместимость с данными,
               созданными до multi-tenancy).
  '__ALL__'  — сентинел «показывать всё» (для superuser без tenant,
               например Railway manage.py shell / админка, а также ЭТО
               ЗНАЧЕНИЕ ПО УМОЛЧАНИЮ у самого ContextVar).
  int        — id конкретного Tenant

Почему default = ALL_TENANTS, а не None:
  TenantMiddleware — единственный код, вызывающий set_current_tenant_id(),
  и делает это только для HTTP-запросов. Management-команды, Celery-таски,
  manage.py shell и сервисные слои (atelier_erp/services/*), запущенные не
  через HTTP, НИКОГДА не вызывают set_current_tenant_id — ContextVar остаётся
  нетронутым и отдаёт default. Раньше default был None, что TenantManager
  трактовал как «фильтровать по tenant=None» — то есть non-HTTP код молча
  видел только записи без тенанта вместо всех записей (регрессия). Теперь
  нетронутый ContextVar означает «без ограничения по tenant» (как ALL_TENANTS),
  а явный set_current_tenant_id(None) из middleware (внутри HTTP-запроса)
  по-прежнему означает «только tenant=None».
"""
from __future__ import annotations

import contextvars
from typing import Union

TenantContextValue = Union[int, str, None]

ALL_TENANTS = '__ALL__'

_current_tenant_id: contextvars.ContextVar[TenantContextValue] = contextvars.ContextVar(
    'current_tenant_id', default=ALL_TENANTS
)


def get_current_tenant_id() -> TenantContextValue:
    return _current_tenant_id.get()


def set_current_tenant_id(value: TenantContextValue) -> contextvars.Token:
    return _current_tenant_id.set(value)


def reset_current_tenant_id(token: contextvars.Token) -> None:
    _current_tenant_id.reset(token)

"""
ContextVar для текущего tenant запроса.

В отличие от threading.local, contextvars.ContextVar корректно работает
и в sync, и в async Django-обработчиках, и не «утекает» между потоками
в пуле воркеров (Gunicorn sync workers создают новый контекст на запрос).

Значение:
  None       — тенант не определён (анонимный запрос, тенанты не настроены)
  '__ALL__'  — сентинел «показывать всё» (только для superuser без tenant,
               например Railway manage.py shell / админка)
  int        — id конкретного Tenant
"""
from __future__ import annotations

import contextvars
from typing import Union

TenantContextValue = Union[int, str, None]

ALL_TENANTS = '__ALL__'

_current_tenant_id: contextvars.ContextVar[TenantContextValue] = contextvars.ContextVar(
    'current_tenant_id', default=None
)


def get_current_tenant_id() -> TenantContextValue:
    return _current_tenant_id.get()


def set_current_tenant_id(value: TenantContextValue) -> contextvars.Token:
    return _current_tenant_id.set(value)


def reset_current_tenant_id(token: contextvars.Token) -> None:
    _current_tenant_id.reset(token)

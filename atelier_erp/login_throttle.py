"""
Security-аудит #9 (Medium, 2026-07-20): вход через API (/api/auth/token/)
защищён ScopedRateThrottle (5/мин, см. ThrottledTokenObtainPairView в
api/auth_views.py), но этот throttle-класс — механизм DRF, работающий только
внутри DRF-view. Django admin login (/admin/login/) и DRF browsable API login
(/api/auth/login/, из rest_framework.urls) — обычные Django/DRF built-in view,
throttle-классы на них не распространяются, поэтому оставались без лимита
попыток вообще.

LoginThrottleMiddleware — тот же лимит (5/мин по IP), но через cache
напрямую, т.к. это не DRF-эндпоинты. Использует общий cache (см. CACHES в
settings.py — FileBasedCache в проде, общий между воркерами; LocMemCache в
тестах).
"""
from __future__ import annotations

from django.core.cache import cache
from django.http import HttpResponse

THROTTLED_LOGIN_PATHS = {'/admin/login/', '/api/auth/login/'}
LOGIN_RATE_LIMIT = 5
LOGIN_RATE_WINDOW_SECONDS = 60


class LoginThrottleMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == 'POST' and request.path in THROTTLED_LOGIN_PATHS:
            ip = request.META.get('REMOTE_ADDR', 'unknown')
            key = f'login_throttle:{request.path}:{ip}'
            attempts = cache.get(key, 0)
            if attempts >= LOGIN_RATE_LIMIT:
                return HttpResponse(
                    'Слишком много попыток входа. Повторите через минуту.',
                    status=429,
                )
            cache.set(key, attempts + 1, timeout=LOGIN_RATE_WINDOW_SECONDS)
        return self.get_response(request)

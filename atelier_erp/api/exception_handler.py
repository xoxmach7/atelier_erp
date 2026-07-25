"""
Security-аудит #12 (Medium, 2026-07-20): дефолтный DRF exception_handler
формирует Response с нужным статусом, но ничего не логирует — отказы в
доступе (401/403) нигде не оставляют следа, расследовать постфактум нечего.
Логируем 401/403 через logger.warning; всё остальное (валидация, 404 и т.п.)
не трогаем — оставляем стандартное поведение DRF.
"""
import logging

from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)


def logging_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)

    if response is not None and response.status_code in (401, 403):
        request = context.get('request')
        user = getattr(request, 'user', None)
        username = user.username if user and getattr(user, 'is_authenticated', False) else 'anonymous'
        logger.warning(
            'Отказ в доступе: path=%s method=%s user=%s ip=%s status=%s',
            getattr(request, 'path', '?'),
            getattr(request, 'method', '?'),
            username,
            request.META.get('REMOTE_ADDR', '?') if request is not None else '?',
            response.status_code,
        )

    return response

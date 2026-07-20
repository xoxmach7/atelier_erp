"""
Аутентификация: получение токена с ограничением частоты (anti-brute-force),
серверный logout с отзывом refresh-токена (blacklist), текущий пользователь.
"""

import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

logger = logging.getLogger(__name__)


class ThrottledTokenObtainPairView(TokenObtainPairView):
    """Логин с лимитом частоты (scope 'login', см. DEFAULT_THROTTLE_RATES)."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request, *args, **kwargs):
        # SimpleJWT поднимает исключение (AuthenticationFailed/ValidationError)
        # при неверных креденшлах — оно пролетает мимо простого "проверить
        # response.status_code после super().post()", т.к. вылетает ИЗ
        # super().post() до return. Ловим сами и конвертируем через
        # handle_exception (тот же путь, что использовал бы DRF dispatch),
        # чтобы залогировать и вернуть тот же ответ, что и раньше.
        try:
            response = super().post(request, *args, **kwargs)
        except Exception as exc:
            response = self.handle_exception(exc)

        if response.status_code != status.HTTP_200_OK:
            # Логируем username и IP, НЕ пароль — нужно для расследования
            # брутфорса постфактум (security-аудит 2026-07-20, G1: раньше
            # неудачные попытки логина нигде не оставляли следа).
            logger.warning(
                'Неудачная попытка входа: username=%r, ip=%s, status=%s',
                request.data.get('username'),
                request.META.get('REMOTE_ADDR'),
                response.status_code,
            )
        return response


class LogoutView(APIView):
    """Серверный выход: отзывает (blacklist) переданный refresh-токен."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh = request.data.get('refresh')
        if not refresh:
            return Response(
                {'detail': 'Не передан refresh-токен.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            RefreshToken(refresh).blacklist()
        except Exception:
            return Response(
                {'detail': 'Недействительный или уже отозванный токен.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_205_RESET_CONTENT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """Текущий пользователь: id, имя, группы (роли)."""
    user = request.user
    try:
        tenant = user.tenant_membership.tenant
        tenant_data = {'id': tenant.id, 'name': tenant.name, 'slug': tenant.slug}
    except Exception:
        tenant_data = None

    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'is_staff': user.is_staff,
        'is_superuser': user.is_superuser,
        'groups': [group.name for group in user.groups.all()],
        'tenant': tenant_data,
    })

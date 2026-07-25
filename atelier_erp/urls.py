"""
Atelier ERP - URL Configuration
"""

from django.urls import path, include
from django.contrib import admin
from django.http import JsonResponse
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenVerifyView,
)

from atelier_erp.api.auth_views import ThrottledTokenObtainPairView, LogoutView, ChangePasswordView, me

# Health check endpoint
@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Health check endpoint for monitoring"""
    return JsonResponse({
        'status': 'healthy',
        'service': 'atelier-erp-api',
        'version': '0.1.0'
    })

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('atelier_erp.api.urls')),

    # JWT Authentication endpoints (должны идти ДО rest_framework.urls,
    # иначе DRF-include перехватывает api/auth/logout/ своим браузерным logout).
    path('api/auth/token/', ThrottledTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('api/auth/logout/', LogoutView.as_view(), name='logout'),
    path('api/auth/change-password/', ChangePasswordView.as_view(), name='change_password'),

    # Current user endpoint
    path('api/me/', me, name='me'),

    # Браузерный логин/логаут DRF (для browsable API) — после кастомных путей
    path('api/auth/', include('rest_framework.urls')),

    path('health/', health_check, name='health'),
]

# Media files for development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

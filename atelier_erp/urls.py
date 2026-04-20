"""
Atelier ERP - URL Configuration
"""

from django.urls import path, include
from django.contrib import admin
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

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
    path('api/auth/', include('rest_framework.urls')),
    path('health/', health_check, name='health'),
]

"""
Atelier ERP - API URL Configuration
"""

from django.urls import path, include

urlpatterns = [
    path('v1/', include('atelier_erp.api.v1.urls')),
]

"""
Atelier ERP - API v1 URL Configuration
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import OrderViewSet, TaskViewSet, InventoryAvailabilityViewSet

router = DefaultRouter()
router.register(r'orders', OrderViewSet, basename='v1-order')
router.register(r'tasks', TaskViewSet, basename='v1-task')
router.register(r'inventory', InventoryAvailabilityViewSet, basename='v1-inventory')

urlpatterns = [
    path('', include(router.urls)),
]

"""
Atelier ERP - API v1 URL Configuration
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    OrderViewSet, TaskViewSet, InventoryAvailabilityViewSet, QuoteViewSet,
    DesignerWorkQueueView, QuotesWorkQueueView, WarehouseWorkQueueView,
    ProductionWorkQueueView, InstallationWorkQueueView, OwnerWorkQueueView,
    FinanceWorkQueueView,
)

router = DefaultRouter()
router.register(r'orders', OrderViewSet, basename='v1-order')
router.register(r'tasks', TaskViewSet, basename='v1-task')
router.register(r'inventory', InventoryAvailabilityViewSet, basename='v1-inventory')
router.register(r'quotes', QuoteViewSet, basename='v1-quote')

urlpatterns = [
    path('work/designer/', DesignerWorkQueueView.as_view(), name='v1-work-designer'),
    path('work/quotes/', QuotesWorkQueueView.as_view(), name='v1-work-quotes'),
    path('work/warehouse/', WarehouseWorkQueueView.as_view(), name='v1-work-warehouse'),
    path('work/production/', ProductionWorkQueueView.as_view(), name='v1-work-production'),
    path('work/installation/', InstallationWorkQueueView.as_view(), name='v1-work-installation'),
    path('work/owner/', OwnerWorkQueueView.as_view(), name='v1-work-owner'),
    path('work/finance/', FinanceWorkQueueView.as_view(), name='v1-work-finance'),
    path('', include(router.urls)),
]

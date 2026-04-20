"""
Atelier ERP - API URL Configuration
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()

# Main entities
router.register(r'customers', views.CustomerViewSet, basename='customer')
router.register(r'orders', views.OrderViewSet, basename='order')
router.register(r'tasks', views.TaskViewSet, basename='task')
router.register(r'quotes', views.QuoteViewSet, basename='quote')

# Inventory
router.register(r'fabrics', views.FabricViewSet, basename='fabric')
router.register(r'cornices', views.CorniceViewSet, basename='cornice')
router.register(r'services', views.ServiceViewSet, basename='service')

# Production & Payments
router.register(r'production-assignments', views.ProductionAssignmentViewSet, basename='production')
router.register(r'payments', views.PaymentViewSet, basename='payment')

# Audit
router.register(r'activity-logs', views.ActivityLogViewSet, basename='activity')

# Dashboard (viewset with custom actions)
router.register(r'dashboard', views.DashboardViewSet, basename='dashboard')

# Inventory operations
router.register(r'inventory', views.InventoryViewSet, basename='inventory')

urlpatterns = [
    path('', include(router.urls)),
    path('v1/', include('atelier_erp.api.v1.urls')),  # v1 API with service layer
]

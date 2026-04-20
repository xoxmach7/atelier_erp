"""
Atelier API v1 Routers - Centralized endpoint registration
"""
from rest_framework.routers import DefaultRouter

from apps.orders.api import OrderViewSet
from apps.production.api import TaskViewSet, WorkOrderViewSet
from apps.inventory.api import FabricViewSet, FabricUsageViewSet


# Create router
router = DefaultRouter()

# Register viewsets
# Orders
router.register(r"orders", OrderViewSet, basename="orders")

# Tasks & Production
router.register(r"tasks", TaskViewSet, basename="tasks")
router.register(r"work-orders", WorkOrderViewSet, basename="work-orders")

# Inventory (Fabric)
router.register(r"inventory", FabricViewSet, basename="inventory")
router.register(r"inventory/usage", FabricUsageViewSet, basename="fabric-usage")

# URL patterns will be generated automatically:
# /api/v1/orders/
# /api/v1/orders/{pk}/
# /api/v1/tasks/
# /api/v1/tasks/{pk}/
# /api/v1/work-orders/
# /api/v1/inventory/
# /api/v1/inventory/usage/

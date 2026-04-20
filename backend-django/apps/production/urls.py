from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.production.views import ProductionScheduleViewSet, WorkOrderViewSet

router = DefaultRouter()
router.register(r"work-orders", WorkOrderViewSet, basename="work-orders")
router.register(r"schedule", ProductionScheduleViewSet, basename="schedule")

urlpatterns = [
    path("", include(router.urls)),
]

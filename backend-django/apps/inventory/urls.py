from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.inventory.views import CategoryViewSet, ProductViewSet, StockMovementViewSet

router = DefaultRouter()
router.register(r"categories", CategoryViewSet, basename="categories")
router.register(r"products", ProductViewSet, basename="products")
router.register(r"movements", StockMovementViewSet, basename="movements")

urlpatterns = [
    path("", include(router.urls)),
]

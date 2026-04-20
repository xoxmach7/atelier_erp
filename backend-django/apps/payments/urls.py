from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.payments.views import InvoiceViewSet, PaymentViewSet

router = DefaultRouter()
router.register(r"payments", PaymentViewSet, basename="payments")
router.register(r"invoices", InvoiceViewSet, basename="invoices")

urlpatterns = [
    path("", include(router.urls)),
]

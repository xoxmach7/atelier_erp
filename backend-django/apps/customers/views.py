from drf_spectacular.utils import extend_schema
from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from core.pagination import StandardResultsSetPagination
from core.permissions import IsManagerOrAdmin
from apps.customers.models import Customer
from apps.customers.serializers import (
    CustomerCreateSerializer,
    CustomerDetailSerializer,
    CustomerListSerializer,
    CustomerStatsSerializer,
    CustomerUpdateSerializer,
)
from apps.customers.services import CustomerService


@extend_schema(tags=["Customers"])
class CustomerViewSet(ModelViewSet):
    """Customer management viewset."""

    queryset = Customer.objects.filter(is_active=True)
    serializer_class = CustomerListSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "first_name",
        "last_name",
        "company_name",
        "phone",
        "email",
        "bin",
    ]
    ordering_fields = ["created_at", "last_name", "total_spent", "total_orders"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "create":
            return CustomerCreateSerializer
        if self.action in ["update", "partial_update"]:
            return CustomerUpdateSerializer
        if self.action == "retrieve":
            return CustomerDetailSerializer
        return CustomerListSerializer

    def get_permissions(self):
        if self.action in ["destroy"]:
            return [IsManagerOrAdmin()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        customer = CustomerService.create_customer(
            **serializer.validated_data, created_by=self.request.user
        )
        return customer

    def perform_destroy(self, instance):
        CustomerService.deactivate_customer(str(instance.id))

    @extend_schema(summary="Search customers by phone")
    @action(detail=False, methods=["get"], url_path="search-by-phone")
    def search_by_phone(self, request):
        """Search customers by phone number."""
        phone = request.query_params.get("phone", "").strip()
        if not phone:
            return Response(
                {"error": "Phone parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        customers = CustomerService.find_by_phone(phone)
        serializer = CustomerListSerializer(customers, many=True)
        return Response(serializer.data)

    @extend_schema(summary="Get customer statistics")
    @action(detail=True, methods=["get"], url_path="stats")
    def stats(self, request, pk=None):
        """Get customer statistics."""
        customer = self.get_object()
        stats = CustomerService.get_customer_stats(str(customer.id))
        return Response(stats)

    @extend_schema(summary="Get top customers")
    @action(
        detail=False,
        methods=["get"],
        permission_classes=[IsManagerOrAdmin],
        url_path="top",
    )
    def top_customers(self, request):
        """Get top customers by spending."""
        limit = int(request.query_params.get("limit", 10))
        customers = CustomerService.get_top_customers(limit)
        serializer = CustomerListSerializer(customers, many=True)
        return Response(serializer.data)

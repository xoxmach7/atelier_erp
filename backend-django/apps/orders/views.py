from decimal import Decimal

from drf_spectacular.utils import extend_schema
from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from core.pagination import StandardResultsSetPagination
from core.permissions import IsManagerOrAdmin
from apps.orders.models import Order
from apps.orders.serializers import (
    OrderCreateSerializer,
    OrderDetailSerializer,
    OrderListSerializer,
    OrderStatusHistorySerializer,
    OrderStatusUpdateSerializer,
)
from apps.orders.services import OrderService


@extend_schema(tags=["Orders"])
class OrderViewSet(ModelViewSet):
    """Order management viewset."""

    queryset = Order.objects.filter(is_active=True)
    serializer_class = OrderListSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "order_number",
        "customer__first_name",
        "customer__last_name",
        "customer__company_name",
    ]
    ordering_fields = ["created_at", "deadline_date", "total_amount", "status"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "create":
            return OrderCreateSerializer
        if self.action == "retrieve":
            return OrderDetailSerializer
        return OrderListSerializer

    def perform_create(self, serializer):
        items_data = serializer.validated_data.pop("items")
        return OrderService.create_order(
            customer_id=str(serializer.validated_data["customer"].id),
            items=items_data,
            manager=self.request.user,
            **{
                k: v
                for k, v in serializer.validated_data.items()
                if k != "customer"
            }
        )

    @extend_schema(summary="Update order status", request=OrderStatusUpdateSerializer)
    @action(detail=True, methods=["post"], url_path="status")
    def update_status(self, request, pk=None):
        """Update order status."""
        serializer = OrderStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        order = OrderService.update_status(
            order_id=pk,
            new_status=serializer.validated_data["status"],
            changed_by=request.user,
            reason=serializer.validated_data.get("reason", ""),
        )

        return Response(OrderDetailSerializer(order).data)

    @extend_schema(summary="Add payment to order")
    @action(detail=True, methods=["post"], url_path="payment")
    def add_payment(self, request, pk=None):
        """Add payment to order."""
        amount = request.data.get("amount")
        if not amount:
            return Response(
                {"error": "Amount is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order = OrderService.add_payment(pk, Decimal(str(amount)))
        return Response(OrderDetailSerializer(order).data)

    @extend_schema(summary="Get order status history")
    @action(detail=True, methods=["get"], url_path="history")
    def status_history(self, request, pk=None):
        """Get order status history."""
        order = self.get_object()
        history = order.status_history.all()
        serializer = OrderStatusHistorySerializer(history, many=True)
        return Response(serializer.data)

    @extend_schema(summary="Get overdue orders")
    @action(
        detail=False,
        methods=["get"],
        permission_classes=[IsManagerOrAdmin],
        url_path="overdue",
    )
    def overdue(self, request):
        """Get all overdue orders."""
        orders = OrderService.get_overdue_orders()
        serializer = OrderListSerializer(orders, many=True)
        return Response(serializer.data)

    @extend_schema(summary="Assign masters to order")
    @action(detail=True, methods=["post"], url_path="assign-masters")
    def assign_masters(self, request, pk=None):
        """Assign masters to order."""
        master_ids = request.data.get("master_ids", [])
        if not master_ids:
            return Response(
                {"error": "master_ids is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order = OrderService.assign_masters(pk, master_ids)
        return Response(OrderDetailSerializer(order).data)

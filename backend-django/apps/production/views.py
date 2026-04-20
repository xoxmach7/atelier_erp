from drf_spectacular.utils import extend_schema
from rest_framework import filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from core.pagination import StandardResultsSetPagination
from core.permissions import IsManagerOrAdmin
from apps.production.models import ProductionSchedule, WorkOrder
from apps.production.serializers import (
    ProductionScheduleSerializer,
    WorkOrderCreateSerializer,
    WorkOrderDetailSerializer,
    WorkOrderListSerializer,
)
from apps.production.services import ProductionService


@extend_schema(tags=["Production - Work Orders"])
class WorkOrderViewSet(ModelViewSet):
    """Work order management viewset."""

    queryset = WorkOrder.objects.filter(is_active=True)
    serializer_class = WorkOrderListSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["work_order_number", "product__name", "description"]
    ordering_fields = ["created_at", "planned_start", "priority", "status"]
    ordering = ["-priority", "-created_at"]

    def get_serializer_class(self):
        if self.action == "create":
            return WorkOrderCreateSerializer
        if self.action == "retrieve":
            return WorkOrderDetailSerializer
        return WorkOrderListSerializer

    def get_permissions(self):
        if self.action in ["destroy", "update", "partial_update", "create"]:
            return [IsManagerOrAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = super().get_queryset()
        status = self.request.query_params.get("status")
        assigned_to = self.request.query_params.get("assigned_to")

        if status:
            queryset = queryset.filter(status=status)
        if assigned_to:
            queryset = queryset.filter(assigned_to_id=assigned_to)

        return queryset

    @extend_schema(summary="Update work order status")
    @action(detail=True, methods=["post"], url_path="update-status")
    def update_status(self, request, pk=None):
        """Update work order status."""
        work_order = self.get_object()
        new_status = request.data.get("status")
        quantity_completed = request.data.get("quantity_completed")

        if not new_status:
            return Response(
                {"error": "status is required"},
                status=400,
            )

        updated = ProductionService.update_work_order_status(
            work_order_id=str(work_order.id),
            new_status=new_status,
            quantity_completed=quantity_completed,
            user=request.user,
        )

        return Response(WorkOrderDetailSerializer(updated).data)

    @extend_schema(summary="Get my work orders")
    @action(detail=False, methods=["get"], url_path="my-orders")
    def my_orders(self, request):
        """Get current user's assigned work orders."""
        orders = WorkOrder.objects.filter(
            assigned_to=request.user,
            is_active=True,
            status__in=[WorkOrder.Status.PENDING, WorkOrder.Status.IN_PROGRESS],
        )
        serializer = WorkOrderListSerializer(orders, many=True)
        return Response(serializer.data)


@extend_schema(tags=["Production - Schedule"])
class ProductionScheduleViewSet(ModelViewSet):
    """Production schedule management viewset."""

    queryset = ProductionSchedule.objects.filter(is_active=True)
    serializer_class = ProductionScheduleSerializer
    permission_classes = [IsManagerOrAdmin]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["scheduled_date", "start_time"]
    ordering = ["scheduled_date", "start_time"]

    def get_queryset(self):
        queryset = super().get_queryset()
        date = self.request.query_params.get("date")
        if date:
            queryset = queryset.filter(scheduled_date=date)
        return queryset

    @extend_schema(summary="Get schedule by date range")
    @action(detail=False, methods=["get"], url_path="by-range")
    def by_range(self, request):
        """Get schedule for date range."""
        start = request.query_params.get("start")
        end = request.query_params.get("end")

        if not start or not end:
            return Response(
                {"error": "start and end dates are required"},
                status=400,
            )

        schedule = ProductionSchedule.objects.filter(
            scheduled_date__gte=start,
            scheduled_date__lte=end,
            is_active=True,
        )
        serializer = ProductionScheduleSerializer(schedule, many=True)
        return Response(serializer.data)

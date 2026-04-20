"""
Atelier Orders API - Role-based permissions
Admin: full access
Manager: manage orders
Worker: view orders they have tasks for
"""
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.orders.models import Order, OrderItem
from core.permissions import (
    CanManageOrders,
    CanViewOrders,
    is_manager_or_above,
)


# ============ SERIALIZERS ============

class OrderItemSerializer(serializers.ModelSerializer):
    """Order item with read-only display fields."""
    assigned_to_name = serializers.CharField(
        source="assigned_to.get_full_name", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            "id", "description", "quantity", "unit_price", "total_price",
            "assigned_to", "assigned_to_name", "status", "status_display",
            "hours_spent", "started_at", "completed_at"
        ]


class OrderListSerializer(serializers.ModelSerializer):
    """Lightweight order list."""
    customer_name = serializers.CharField(source="customer.display_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Order
        fields = [
            "id", "order_number", "customer", "customer_name",
            "status", "status_display", "total_amount", "deadline_date",
            "is_overdue", "created_at"
        ]


class OrderDetailSerializer(serializers.ModelSerializer):
    """Full order with nested items."""
    items = OrderItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source="customer.display_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    manager_name = serializers.CharField(source="manager.get_full_name", read_only=True)

    class Meta:
        model = Order
        fields = [
            "id", "order_number", "customer", "customer_name", "manager", "manager_name",
            "status", "status_display", "priority", "deadline_date",
            "total_amount", "paid_amount", "description", "items",
            "created_at", "modified_at"
        ]


class OrderCreateSerializer(serializers.ModelSerializer):
    """Create order with items."""
    items = OrderItemSerializer(many=True)

    class Meta:
        model = Order
        fields = [
            "customer", "priority", "deadline_date",
            "description", "total_amount", "items"
        ]

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        order = Order.objects.create(**validated_data)
        for item in items_data:
            OrderItem.objects.create(order=order, **item)
        return order


class StatusUpdateSerializer(serializers.Serializer):
    """Simple status update."""
    status = serializers.ChoiceField(choices=Order.Status.choices)


# ============ VIEWSET ============

class OrderViewSet(viewsets.ModelViewSet):
    """
    Orders API endpoint with role-based access.
    
    Permissions:
    - Admin: full CRUD
    - Manager: full CRUD
    - Worker: read-only, only orders with their tasks
    
    Endpoints:
    list: GET /api/v1/orders/
    create: POST /api/v1/orders/
    retrieve: GET /api/v1/orders/{id}/
    update: PUT /api/v1/orders/{id}/
    destroy: DELETE /api/v1/orders/{id}/
    """
    
    # Base permission: must be authenticated
    permission_classes = [IsAuthenticated, CanViewOrders]
    
    def get_permissions(self):
        """Dynamic permissions based on action."""
        if self.action in ["create", "update", "partial_update", "destroy"]:
            # Only admin and manager can modify orders
            return [IsAuthenticated(), CanManageOrders()]
        return [IsAuthenticated(), CanViewOrders()]
    
    def get_queryset(self):
        """
        Filter queryset based on user role.
        - Admin/Manager: all orders
        - Worker: only orders where they have assigned tasks
        """
        user = self.request.user
        
        # Admin and manager see all orders
        if is_manager_or_above(user):
            return Order.objects.filter(is_active=True)
        
        # Worker sees only orders with their tasks
        from apps.production.models import Task, WorkOrder
        
        # Get work orders where user has tasks
        work_orders = WorkOrder.objects.filter(
            tasks__assigned_to=user,
            tasks__is_active=True
        ).distinct()
        
        # Get orders from those work orders
        order_ids = work_orders.values_list("order_id", flat=True)
        
        return Order.objects.filter(
            id__in=order_ids,
            is_active=True
        )
    
    def get_serializer_class(self):
        if self.action == "list":
            return OrderListSerializer
        if self.action == "create":
            return OrderCreateSerializer
        return OrderDetailSerializer
    
    def perform_create(self, serializer):
        """Set current user as manager when creating order."""
        serializer.save(manager=self.request.user)
    
    @action(detail=True, methods=["post"], permission_classes=[CanManageOrders])
    def status(self, request, pk=None):
        """
        Update order status.
        Only admin and manager can update status manually.
        """
        order = self.get_object()
        serializer = StatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        order.status = serializer.validated_data["status"]
        order.save()
        
        return Response({
            "id": order.id,
            "status": order.status,
            "status_display": order.get_status_display()
        })
    
    @action(detail=False, methods=["get"])
    def my_orders(self, request):
        """
        Get orders for current worker.
        GET /api/v1/orders/my_orders/
        """
        # Uses same filtered queryset
        orders = self.get_queryset()
        serializer = OrderListSerializer(orders, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=["get"])
    def by_status(self, request):
        """Filter orders by status: GET /api/v1/orders/by_status/?status=new"""
        status_filter = request.query_params.get("status", "")
        orders = self.get_queryset()
        if status_filter:
            orders = orders.filter(status=status_filter)
        serializer = OrderListSerializer(orders, many=True)
        return Response(serializer.data)

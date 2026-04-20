from rest_framework import serializers

from apps.orders.models import Order, OrderItem, OrderStatusHistory


class OrderItemSerializer(serializers.ModelSerializer):
    """Serializer for order items."""

    assigned_to_name = serializers.CharField(
        source="assigned_to.get_full_name", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "product",
            "service_type",
            "description",
            "dimensions",
            "quantity",
            "unit_price",
            "total_price",
            "assigned_to",
            "assigned_to_name",
            "status",
            "status_display",
            "started_at",
            "completed_at",
            "hours_spent",
        ]


class OrderItemCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating order items."""

    class Meta:
        model = OrderItem
        fields = [
            "product",
            "service_type",
            "description",
            "dimensions",
            "quantity",
            "unit_price",
            "assigned_to",
        ]


class OrderListSerializer(serializers.ModelSerializer):
    """Serializer for listing orders."""

    customer_name = serializers.CharField(
        source="customer.display_name", read_only=True
    )
    manager_name = serializers.CharField(
        source="manager.get_full_name", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    balance_due = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "order_number",
            "customer",
            "customer_name",
            "status",
            "status_display",
            "priority",
            "priority_display",
            "total_amount",
            "paid_amount",
            "balance_due",
            "deadline_date",
            "is_overdue",
            "manager",
            "manager_name",
            "order_date",
        ]


class OrderDetailSerializer(serializers.ModelSerializer):
    """Serializer for order details."""

    items = OrderItemSerializer(many=True, read_only=True)
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)
    customer_name = serializers.CharField(
        source="customer.display_name", read_only=True
    )
    manager_name = serializers.CharField(
        source="manager.get_full_name", read_only=True
    )
    masters_names = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    balance_due = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Order
        exclude = ["is_active"]

    def get_masters_names(self, obj):
        return [m.get_full_name() for m in obj.masters.all()]


class OrderCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating orders."""

    items = OrderItemCreateSerializer(many=True)

    class Meta:
        model = Order
        fields = [
            "customer",
            "priority",
            "deadline_date",
            "pickup_address",
            "delivery_address",
            "description",
            "source",
            "items",
        ]

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        order = Order.objects.create(**validated_data)
        for item_data in items_data:
            OrderItem.objects.create(order=order, **item_data)
        return order


class OrderStatusUpdateSerializer(serializers.Serializer):
    """Serializer for updating order status."""

    status = serializers.ChoiceField(choices=Order.Status.choices)
    reason = serializers.CharField(required=False, allow_blank=True)


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    """Serializer for status history."""

    changed_by_name = serializers.CharField(
        source="changed_by.get_full_name", read_only=True
    )
    old_status_display = serializers.CharField(source="get_old_status_display", read_only=True)
    new_status_display = serializers.CharField(source="get_new_status_display", read_only=True)

    class Meta:
        model = OrderStatusHistory
        fields = [
            "id",
            "old_status",
            "old_status_display",
            "new_status",
            "new_status_display",
            "changed_by",
            "changed_by_name",
            "reason",
            "created_at",
        ]

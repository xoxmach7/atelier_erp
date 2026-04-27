"""
Atelier ERP - API v1 Serializers
Minimal serializers for orders, tasks, inventory
"""

from decimal import Decimal

from rest_framework import serializers
from atelier_erp.models import Order, Task, Fabric, OrderItem, Customer, Quote, Measurement, Payment


class CustomerMinimalSerializer(serializers.ModelSerializer):
    """Minimal customer info for embedding"""
    class Meta:
        model = Customer
        fields = ['id', 'full_name', 'phone']


class OrderItemSerializer(serializers.ModelSerializer):
    """Order item serializer"""
    class Meta:
        model = OrderItem
        fields = [
            'id', 'item_type', 'notes',
            'fabric', 'quantity',
            'cornice', 'service',
            'unit_price', 'total_price'
        ]


class OrderListSerializer(serializers.ModelSerializer):
    """Order list view - minimal fields"""
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    balance_due = serializers.DecimalField(source='remaining_amount', max_digits=12, decimal_places=2, read_only=True)
    
    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'customer', 'customer_name', 'customer_phone',
            'status', 'status_display', 'total_amount', 'paid_amount', 'balance_due',
            'created_at', 'planned_completion'
        ]
        read_only_fields = ['order_number', 'created_at']


class SourceQuoteSerializer(serializers.ModelSerializer):
    """Source quote info for orders created from quote"""
    class Meta:
        model = Quote
        fields = ['id', 'quote_number', 'total', 'status']


class PaymentSerializer(serializers.ModelSerializer):
    """Payment serializer for embedding in order detail"""
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    
    class Meta:
        model = Payment
        fields = [
            'id', 'order', 'order_number', 'amount', 'payment_type',
            'payment_method', 'notes', 'received_at', 'created_at'
        ]


class MeasurementSerializer(serializers.ModelSerializer):
    """Measurement serializer for embedding in order detail"""
    class Meta:
        model = Measurement
        fields = [
            'id', 'room_name', 'window_name', 'width_cm', 'height_cm',
            'mounting_type', 'measured_at'
        ]


class RelatedQuoteSerializer(serializers.ModelSerializer):
    """Serializer for quotes linked to an order (direct order flow)"""
    class Meta:
        model = Quote
        fields = ['id', 'quote_number', 'status', 'total']


class OrderDetailSerializer(serializers.ModelSerializer):
    """Order detail view - full fields with items, payments, measurements, source quote, and related quotes"""
    customer = CustomerMinimalSerializer(read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_paid = serializers.BooleanField(read_only=True)
    source_quote = SourceQuoteSerializer(source='quote', read_only=True)
    related_quotes = RelatedQuoteSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    measurements = MeasurementSerializer(many=True, read_only=True)
    balance_due = serializers.DecimalField(source='remaining_amount', max_digits=12, decimal_places=2, read_only=True)
    
    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'customer', 'status', 'status_display',
            'total_amount', 'paid_amount', 'is_paid', 'balance_due',
            'items', 'notes', 'created_at', 'updated_at', 'planned_completion',
            'installation_date', 'actual_completion', 'measurement_date',
            'installation_address_city', 'installation_address_street',
            'installation_address_building', 'installation_address_apartment',
            'installation_address_notes',
            'source_quote', 'related_quotes', 'payments', 'measurements'
        ]
        read_only_fields = ['order_number', 'created_at', 'updated_at']


class OrderCreateSerializer(serializers.ModelSerializer):
    """Order creation - write-only, supports direct order creation without quote"""
    customer_id = serializers.UUIDField(write_only=True)
    # Installation address fields
    installation_address_city = serializers.CharField(required=False, allow_blank=True)
    installation_address_street = serializers.CharField(required=False, allow_blank=True)
    installation_address_building = serializers.CharField(required=False, allow_blank=True)
    installation_address_apartment = serializers.CharField(required=False, allow_blank=True)
    installation_address_notes = serializers.CharField(required=False, allow_blank=True)
    # Dates
    measurement_date = serializers.DateField(required=False, allow_null=True)
    
    class Meta:
        model = Order
        fields = [
            'customer_id', 'notes', 'planned_completion',
            'installation_address_city', 'installation_address_street',
            'installation_address_building', 'installation_address_apartment',
            'installation_address_notes', 'measurement_date'
        ]


class OrderStatusUpdateSerializer(serializers.Serializer):
    """Order status transition - service layer will handle FSM"""
    new_status = serializers.ChoiceField(choices=Order.Status.choices)
    reason = serializers.CharField(required=False, allow_blank=True)


class TaskListSerializer(serializers.ModelSerializer):
    """Task list view"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = Task
        fields = [
            'id', 'task_number', 'client_name', 'client_phone',
            'status', 'status_display', 'created_at', 'preferred_date'
        ]
        read_only_fields = ['task_number', 'created_at']


class TaskDetailSerializer(serializers.ModelSerializer):
    """Task detail view"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = Task
        fields = [
            'id', 'task_number', 'client_name', 'client_phone',
            'client_address_city', 'client_address_street', 'client_address_building',
            'status', 'status_display',
            'description', 'preferred_date', 'created_by', 'created_by_name',
            'created_at', 'updated_at', 'converted_to_order'
        ]
        read_only_fields = ['task_number', 'created_at', 'updated_at', 'converted_to_order']


class TaskCreateSerializer(serializers.ModelSerializer):
    """Task creation"""
    class Meta:
        model = Task
        fields = ['client_name', 'client_phone', 'client_address_city', 'client_address_street', 'client_address_building', 'description', 'preferred_date']


class TaskStatusUpdateSerializer(serializers.Serializer):
    """Task status transition - service layer will handle"""
    new_status = serializers.ChoiceField(choices=Task.Status.choices)
    notes = serializers.CharField(required=False, allow_blank=True)


class FabricAvailabilitySerializer(serializers.ModelSerializer):
    """Inventory availability - read only"""
    available_meters = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    
    class Meta:
        model = Fabric
        fields = [
            'id', 'hanger_number', 'name', 'color', 'pattern',
            'stock_meters', 'reserved_meters', 'available_meters',
            'price_per_meter', 'is_active'
        ]


class InventoryCheckRequestSerializer(serializers.Serializer):
    """Request to check inventory availability"""
    fabric_id = serializers.UUIDField()
    required_meters = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))


class InventoryCheckResponseSerializer(serializers.Serializer):
    """Response for inventory availability check"""
    fabric_id = serializers.UUIDField()
    available = serializers.BooleanField()
    available_meters = serializers.DecimalField(max_digits=10, decimal_places=2)
    required_meters = serializers.DecimalField(max_digits=10, decimal_places=2)
    shortfall = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)

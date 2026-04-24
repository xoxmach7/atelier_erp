"""
Atelier ERP - API Serializers
DRF serializers for models
"""

from decimal import Decimal
from rest_framework import serializers
from ..models import (
    Customer, Fabric, Cornice, Service, Order, OrderItem,
    Task, Quote, QuoteItem, ProductionAssignment, Payment, ActivityLog, Measurement
)


class CustomerSerializer(serializers.ModelSerializer):
    """Customer serializer"""
    full_address = serializers.SerializerMethodField()
    
    class Meta:
        model = Customer
        fields = [
            'id', 'full_name', 'phone', 'email',
            'address_city', 'address_street', 'address_building', 'address_apartment',
            'full_address', 'address_notes', 'notes',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_full_address(self, obj):
        parts = [
            obj.address_city,
            obj.address_street,
            obj.address_building,
            f"кв. {obj.address_apartment}" if obj.address_apartment else None
        ]
        return ", ".join(filter(None, parts))


class CustomerListSerializer(serializers.ModelSerializer):
    """Minimal customer serializer for lists"""
    class Meta:
        model = Customer
        fields = ['id', 'full_name', 'phone', 'address_city', 'is_active']


class FabricSerializer(serializers.ModelSerializer):
    """Fabric serializer with available stock"""
    available_meters = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    
    class Meta:
        model = Fabric
        fields = [
            'id', 'hanger_number', 'name', 'composition', 'width_cm',
            'stock_meters', 'reserved_meters', 'available_meters',
            'price_per_meter', 'color', 'pattern', 'supplier', 'location',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class FabricListSerializer(serializers.ModelSerializer):
    """Minimal fabric serializer"""
    available_meters = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    
    class Meta:
        model = Fabric
        fields = ['id', 'hanger_number', 'name', 'available_meters', 'price_per_meter', 'is_active']


class CorniceSerializer(serializers.ModelSerializer):
    """Cornice serializer"""
    class Meta:
        model = Cornice
        fields = [
            'id', 'sku', 'name', 'type', 'material', 'color',
            'length_cm', 'max_load_kg', 'stock_count', 'price',
            'supplier', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class ServiceSerializer(serializers.ModelSerializer):
    """Service serializer"""
    class Meta:
        model = Service
        fields = ['id', 'name', 'description', 'unit', 'price_per_unit', 'is_active']


class OrderItemSerializer(serializers.ModelSerializer):
    """Order item serializer"""
    fabric_details = FabricListSerializer(source='fabric', read_only=True)
    cornice_details = CorniceSerializer(source='cornice', read_only=True)
    
    class Meta:
        model = OrderItem
        fields = [
            'id', 'item_type', 'description',
            'fabric', 'fabric_details', 'fabric_meters',
            'cornice', 'cornice_details', 'cornice_count',
            'service', 'unit_price', 'quantity', 'line_total',
            'created_at'
        ]
        read_only_fields = ['created_at']


class OrderItemCreateSerializer(serializers.ModelSerializer):
    """Order item create serializer"""
    class Meta:
        model = OrderItem
        fields = [
            'item_type', 'description',
            'fabric', 'fabric_meters',
            'cornice', 'cornice_count',
            'service', 'unit_price', 'quantity'
        ]


class OrderListSerializer(serializers.ModelSerializer):
    """Order list serializer"""
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)
    balance_due = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    
    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'customer', 'customer_name', 'customer_phone',
            'status', 'total_amount', 'paid_amount', 'balance_due',
            'measurement_date', 'planned_completion', 'created_at'
        ]


class OrderSerializer(serializers.ModelSerializer):
    """Full order serializer with related workflow data"""
    customer_details = CustomerListSerializer(source='customer', read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    balance_due = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    
    # Related workflow data
    measurements = serializers.SerializerMethodField()
    payments = serializers.SerializerMethodField()
    source_task = serializers.SerializerMethodField()
    
    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'customer', 'customer_details',
            'status', 'items', 'measurements', 'payments', 'source_task',
            'installation_address_city', 'installation_address_street',
            'installation_address_building', 'installation_address_apartment',
            'installation_address_notes',
            'measurement_date', 'installation_date', 'planned_completion', 'actual_completion',
            'total_amount', 'paid_amount', 'balance_due',
            'notes', 'created_at', 'updated_at',
            'created_by', 'updated_by'
        ]
        read_only_fields = [
            'order_number', 'status', 'total_amount', 'paid_amount',
            'actual_completion', 'created_at', 'updated_at',
            'created_by', 'updated_by'
        ]
    
    def get_measurements(self, obj):
        """Get measurements for this order"""
        measurements = obj.measurements.all()
        if measurements:
            from .serializers import MeasurementListSerializer
            return MeasurementListSerializer(measurements, many=True).data
        return []
    
    def get_measurements(self, obj):
        """Get measurements for this order"""
        measurements = obj.measurements.all()
        if measurements:
            # Lazy import to avoid circular dependency
            return MeasurementListSerializer(measurements, many=True).data
        return []
    
    def get_payments(self, obj):
        """Get payments for this order"""
        payments = obj.payments.all()
        if payments:
            # Lazy import to avoid circular dependency
            return PaymentSerializer(payments, many=True).data
        return []
    
    def get_source_task(self, obj):
        """Get source task if order was converted from task"""
        task = getattr(obj, 'source_task', None)
        if task and task.first():
            t = task.first()
            return {
                'id': str(t.id),
                'task_number': t.task_number,
                'client_name': t.client_name,
                'status': t.status
            }
        return None


class OrderCreateSerializer(serializers.ModelSerializer):
    """Order create serializer"""
    items = OrderItemCreateSerializer(many=True, required=False)
    
    class Meta:
        model = Order
        fields = [
            'customer', 'items',
            'installation_address_city', 'installation_address_street',
            'installation_address_building', 'installation_address_apartment',
            'installation_address_notes',
            'measurement_date', 'planned_completion',
            'notes'
        ]


class TaskListSerializer(serializers.ModelSerializer):
    """Task list serializer"""
    class Meta:
        model = Task
        fields = [
            'id', 'task_number', 'client_name', 'client_phone',
            'status', 'priority', 'assigned_designer',
            'created_at', 'updated_at'
        ]


class TaskSerializer(serializers.ModelSerializer):
    """Full task serializer"""
    class Meta:
        model = Task
        fields = [
            'id', 'task_number', 'client_name', 'client_phone',
            'client_address_city', 'client_address_street', 'client_address_building',
            'source', 'description', 'priority',
            'status', 'preferred_date', 'deadline',
            'assigned_designer', 'converted_to_order', 'converted_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'task_number', 'status', 'converted_to_order', 'converted_at',
            'created_at', 'updated_at'
        ]


class QuoteItemSerializer(serializers.ModelSerializer):
    """Quote item serializer"""
    fabric_details = FabricListSerializer(source='fabric', read_only=True)
    cornice_details = CorniceSerializer(source='cornice', read_only=True)

    class Meta:
        model = QuoteItem
        fields = [
            'id', 'quote', 'room_name',
            'window_width_cm', 'window_height_cm', 'folds_count',
            'fabric', 'fabric_details', 'fabric_meters', 'fabric_cost',
            'sewing_type', 'complexity', 'sewing_cost',
            'accessories_cost',
            'cornice', 'cornice_details', 'cornice_cost',
            'line_total', 'created_at'
        ]
        read_only_fields = ['line_total', 'created_at']


class QuoteItemCreateSerializer(serializers.ModelSerializer):
    """Quote item create/update serializer"""
    class Meta:
        model = QuoteItem
        fields = [
            'id', 'room_name',
            'window_width_cm', 'window_height_cm', 'folds_count',
            'fabric', 'fabric_meters', 'fabric_cost',
            'sewing_type', 'complexity', 'sewing_cost',
            'accessories_cost',
            'cornice', 'cornice_cost'
        ]


class QuoteListSerializer(serializers.ModelSerializer):
    """Quote list serializer"""
    customer_name = serializers.CharField(source='task.client_name', read_only=True)
    task_number = serializers.CharField(source='task.task_number', read_only=True)

    class Meta:
        model = Quote
        fields = [
            'id', 'quote_number', 'customer_name', 'task_number',
            'total', 'status', 'valid_until', 'created_at'
        ]


class QuoteSerializer(serializers.ModelSerializer):
    """Full quote serializer with items"""
    items = QuoteItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='task.client_name', read_only=True)
    task_number = serializers.CharField(source='task.task_number', read_only=True)

    class Meta:
        model = Quote
        fields = [
            'id', 'quote_number', 'task', 'task_number', 'customer', 'customer_name',
            'status', 'subtotal', 'discount_amount', 'installation_cost',
            'delivery_cost', 'total', 'prepayment_percent', 'valid_until',
            'pdf_generated', 'pdf_url', 'items',
            'created_at', 'updated_at', 'created_by', 'updated_by'
        ]
        read_only_fields = [
            'quote_number', 'total', 'pdf_generated', 'pdf_url',
            'created_at', 'updated_at', 'created_by', 'updated_by'
        ]


class QuoteCreateSerializer(serializers.ModelSerializer):
    """Quote create serializer"""
    items = QuoteItemCreateSerializer(many=True, required=False)

    class Meta:
        model = Quote
        fields = [
            'task', 'customer', 'status', 'valid_until',
            'subtotal', 'discount_amount', 'installation_cost', 'delivery_cost',
            'prepayment_percent', 'items'
        ]

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        quote = Quote.objects.create(**validated_data)
        for item_data in items_data:
            QuoteItem.objects.create(quote=quote, **item_data)
        return quote


class ProductionAssignmentSerializer(serializers.ModelSerializer):
    """Production assignment serializer"""
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    seamstress_name = serializers.CharField(source='assigned_to.get_full_name', read_only=True)
    
    class Meta:
        model = ProductionAssignment
        fields = [
            'id', 'order', 'order_number', 'assigned_to', 'seamstress_name',
            'status', 'complexity', 'priority', 'deadline',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class PaymentSerializer(serializers.ModelSerializer):
    """Payment serializer"""
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'order', 'order_number',
            'amount', 'payment_type', 'payment_method',
            'external_transaction_id',
            'created_by', 'created_by_name',
            'notes', 'received_at',
            'created_at'
        ]
        read_only_fields = ['created_at', 'received_at']


class DashboardSummarySerializer(serializers.Serializer):
    """Dashboard summary data"""
    total_orders = serializers.IntegerField()
    orders_by_status = serializers.DictField()
    total_customers = serializers.IntegerField()
    low_stock_fabrics = serializers.IntegerField()
    pending_tasks = serializers.IntegerField()
    revenue_today = serializers.DecimalField(max_digits=12, decimal_places=2)
    revenue_month = serializers.DecimalField(max_digits=12, decimal_places=2)


class InventoryAvailabilitySerializer(serializers.Serializer):
    """Inventory availability check result"""
    fabric_id = serializers.UUIDField()
    hanger_number = serializers.CharField()
    available_meters = serializers.DecimalField(max_digits=10, decimal_places=2)
    requested_meters = serializers.DecimalField(max_digits=10, decimal_places=2)
    can_fulfill = serializers.BooleanField()


class ActivityLogSerializer(serializers.ModelSerializer):
    """Activity log serializer"""
    class Meta:
        model = ActivityLog
        fields = [
            'id', 'entity_type', 'entity_id', 'entity_repr',
            'action', 'old_values', 'new_values',
            'performed_by_name', 'created_at'
        ]


class MeasurementSerializer(serializers.ModelSerializer):
    """Measurement serializer for CRUD operations"""
    selected_fabric_details = FabricListSerializer(source='selected_fabric', read_only=True)
    measured_by_name = serializers.CharField(source='measured_by.get_full_name', read_only=True, allow_null=True)

    class Meta:
        model = Measurement
        fields = [
            'id', 'order', 'room_name', 'window_name',
            'width_cm', 'height_cm', 'depth_cm', 'ceiling_height_cm',
            'mounting_type', 'window_type', 'has_radiator', 'has_slope',
            'obstacles', 'selected_fabric', 'selected_fabric_details',
            'selected_cornice_type', 'notes',
            'measured_by', 'measured_by_name', 'measured_at'
        ]
        read_only_fields = ['measured_at']


class MeasurementListSerializer(serializers.ModelSerializer):
    """Minimal measurement serializer for list views"""
    selected_fabric_hanger = serializers.CharField(source='selected_fabric.hanger_number', read_only=True, allow_null=True)

    class Meta:
        model = Measurement
        fields = [
            'id', 'order', 'room_name', 'window_name',
            'width_cm', 'height_cm', 'mounting_type',
            'selected_fabric_hanger', 'measured_at'
        ]

from rest_framework import serializers

from apps.production.models import ProductionSchedule, WorkOrder, WorkOrderMaterial


class WorkOrderMaterialSerializer(serializers.ModelSerializer):
    """Serializer for work order materials."""

    material_name = serializers.CharField(source="material.name", read_only=True)

    class Meta:
        model = WorkOrderMaterial
        fields = [
            "id",
            "material",
            "material_name",
            "quantity_required",
            "quantity_used",
        ]


class WorkOrderListSerializer(serializers.ModelSerializer):
    """Serializer for listing work orders."""

    order_number = serializers.CharField(source="order.order_number", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    assigned_to_name = serializers.CharField(
        source="assigned_to.get_full_name", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)
    completion_percentage = serializers.FloatField(read_only=True)

    class Meta:
        model = WorkOrder
        fields = [
            "id",
            "work_order_number",
            "order",
            "order_number",
            "product",
            "product_name",
            "quantity_required",
            "quantity_completed",
            "completion_percentage",
            "status",
            "status_display",
            "priority",
            "priority_display",
            "planned_start",
            "actual_start",
            "assigned_to",
            "assigned_to_name",
        ]


class WorkOrderDetailSerializer(serializers.ModelSerializer):
    """Serializer for work order details."""

    materials = WorkOrderMaterialSerializer(source="work_order_materials", many=True, read_only=True)
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    assigned_to_name = serializers.CharField(
        source="assigned_to.get_full_name", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)

    class Meta:
        model = WorkOrder
        exclude = ["is_active"]


class WorkOrderCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating work orders."""

    materials = WorkOrderMaterialSerializer(many=True, required=False)

    class Meta:
        model = WorkOrder
        fields = [
            "order",
            "product",
            "quantity_required",
            "priority",
            "planned_start",
            "planned_end",
            "assigned_to",
            "description",
            "special_instructions",
            "estimated_hours",
            "materials",
        ]

    def create(self, validated_data):
        materials_data = validated_data.pop("materials", [])
        work_order = WorkOrder.objects.create(**validated_data)

        for material_data in materials_data:
            WorkOrderMaterial.objects.create(work_order=work_order, **material_data)

        return work_order


class ProductionScheduleSerializer(serializers.ModelSerializer):
    """Serializer for production schedule."""

    work_order_number = serializers.CharField(
        source="work_order.work_order_number", read_only=True
    )
    product_name = serializers.CharField(source="work_order.product.name", read_only=True)

    class Meta:
        model = ProductionSchedule
        fields = [
            "id",
            "work_order",
            "work_order_number",
            "product_name",
            "scheduled_date",
            "start_time",
            "end_time",
            "machine",
            "notes",
        ]

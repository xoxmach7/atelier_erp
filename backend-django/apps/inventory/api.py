"""
Atelier Inventory API - Role-based permissions
Admin: full access
Manager: manage inventory
Worker: view-only (except cutters can record usage)
"""
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.inventory.models import Fabric, FabricUsage
from core.permissions import (
    CanManageInventory,
    CanRecordFabricUsage,
    is_manager_or_above,
)


# ============ SERIALIZERS ============

class FabricSerializer(serializers.ModelSerializer):
    """Fabric inventory."""
    fabric_type_display = serializers.CharField(source="get_fabric_type_display", read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = Fabric
        fields = [
            "id", "code", "name", "fabric_type", "fabric_type_display",
            "color", "pattern", "width_cm", "weight_gsm",
            "length_in_stock", "min_length", "price_per_meter",
            "is_low_stock", "supplier", "storage_location"
        ]


class FabricCreateSerializer(serializers.ModelSerializer):
    """Create/update fabric."""
    class Meta:
        model = Fabric
        fields = [
            "code", "name", "fabric_type", "color", "pattern",
            "width_cm", "weight_gsm", "length_in_stock", "min_length",
            "price_per_meter", "supplier", "storage_location"
        ]


class FabricUsageSerializer(serializers.ModelSerializer):
    """Fabric usage record."""
    fabric_name = serializers.CharField(source="fabric.name", read_only=True)
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    cut_by_name = serializers.CharField(source="cut_by.get_full_name", read_only=True)

    class Meta:
        model = FabricUsage
        fields = [
            "id", "fabric", "fabric_name", "order", "order_number",
            "length_used", "cost", "pieces_cut", "cut_by", "cut_by_name", "cut_date"
        ]


class FabricUsageCreateSerializer(serializers.ModelSerializer):
    """Create usage record and deduct from stock."""
    class Meta:
        model = FabricUsage
        fields = ["fabric", "order", "order_item", "length_used", "pieces_cut"]


class StockUpdateSerializer(serializers.Serializer):
    """Update fabric stock."""
    length = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)
    reason = serializers.CharField(required=False, allow_blank=True)


# ============ VIEWSETS ============

class FabricViewSet(viewsets.ModelViewSet):
    """
    Fabric inventory API with role-based access.
    
    Permissions:
    - Admin: full CRUD
    - Manager: full CRUD
    - Worker: read-only
    
    Endpoints:
    list: GET /api/v1/inventory/
    create: POST /api/v1/inventory/
    retrieve: GET /api/v1/inventory/{id}/
    update: PUT /api/v1/inventory/{id}/
    destroy: DELETE /api/v1/inventory/{id}/
    """
    
    def get_permissions(self):
        """Dynamic permissions based on action."""
        if self.action in ["create", "update", "partial_update", "destroy"]:
            # Only admin and manager can modify inventory
            return [IsAuthenticated(), CanManageInventory()]
        
        if self.action in ["add_stock", "remove_stock"]:
            # Only admin and manager can modify stock levels
            return [IsAuthenticated(), CanManageInventory()]
        
        # list, retrieve - all authenticated users can view
        return [IsAuthenticated()]
    
    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return FabricCreateSerializer
        return FabricSerializer
    
    def get_queryset(self):
        """All authenticated users can view inventory."""
        queryset = Fabric.objects.filter(is_active=True)
        
        # Filter by type
        fabric_type = self.request.query_params.get("type")
        if fabric_type:
            queryset = queryset.filter(fabric_type=fabric_type)
        
        # Filter by color
        color = self.request.query_params.get("color")
        if color:
            queryset = queryset.filter(color__icontains=color)
        
        # Filter low stock
        low_stock = self.request.query_params.get("low_stock")
        if low_stock == "true":
            queryset = [f for f in queryset if f.is_low_stock]
        
        return queryset
    
    @action(detail=False, methods=["get"])
    def low_stock(self, request):
        """
        Low stock fabrics.
        GET /api/v1/inventory/low_stock/
        All authenticated users.
        """
        fabrics = [f for f in self.get_queryset() if f.is_low_stock]
        serializer = FabricSerializer(fabrics, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=["post"], permission_classes=[CanManageInventory])
    def add_stock(self, request, pk=None):
        """
        Add stock.
        POST /api/v1/inventory/{id}/add_stock/
        Only admin/manager.
        """
        fabric = self.get_object()
        serializer = StockUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        fabric.length_in_stock += serializer.validated_data["length"]
        fabric.save()
        
        return Response(FabricSerializer(fabric).data)
    
    @action(detail=True, methods=["post"], permission_classes=[CanManageInventory])
    def remove_stock(self, request, pk=None):
        """
        Remove stock.
        POST /api/v1/inventory/{id}/remove_stock/
        Only admin/manager.
        """
        fabric = self.get_object()
        serializer = StockUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        length = serializer.validated_data["length"]
        if fabric.length_in_stock < length:
            return Response(
                {"error": "Not enough stock"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        fabric.length_in_stock -= length
        fabric.save()
        
        return Response(FabricSerializer(fabric).data)


class FabricUsageViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Fabric usage records with role-based access.
    
    Permissions:
    - Admin, Manager, Cutter: can record usage
    - Worker: read-only
    
    Endpoints:
    list: GET /api/v1/inventory/usage/
    retrieve: GET /api/v1/inventory/usage/{id}/
    """
    
    def get_permissions(self):
        """Dynamic permissions."""
        if self.action == "record_usage":
            # Admin, manager, cutter can record usage
            return [IsAuthenticated(), CanRecordFabricUsage()]
        
        # list, retrieve - all authenticated users
        return [IsAuthenticated()]
    
    queryset = FabricUsage.objects.filter(is_active=True)
    serializer_class = FabricUsageSerializer
    
    def get_queryset(self):
        """All authenticated users can view usage records."""
        queryset = super().get_queryset()
        
        # Filter by order
        order = self.request.query_params.get("order")
        if order:
            queryset = queryset.filter(order_id=order)
        
        # Filter by fabric
        fabric = self.request.query_params.get("fabric")
        if fabric:
            queryset = queryset.filter(fabric_id=fabric)
        
        return queryset
    
    @action(detail=False, methods=["post"])
    def record_usage(self, request):
        """
        Record fabric usage and deduct stock.
        POST /api/v1/inventory/usage/record_usage/
        Body: {"fabric": "uuid", "order": "uuid", "length_used": 2.5}
        Only admin, manager, or cutter.
        """
        serializer = FabricUsageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        fabric = serializer.validated_data["fabric"]
        length_used = serializer.validated_data["length_used"]
        
        # Check stock
        if fabric.length_in_stock < length_used:
            return Response(
                {"error": f"Not enough fabric. Available: {fabric.length_in_stock}m"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Deduct stock
        fabric.length_in_stock -= length_used
        fabric.save()
        
        # Calculate cost
        cost = length_used * fabric.price_per_meter
        
        # Create usage record
        usage = FabricUsage.objects.create(
            **serializer.validated_data,
            cost=cost,
            cut_by=request.user
        )
        
        return Response(FabricUsageSerializer(usage).data, status=status.HTTP_201_CREATED)

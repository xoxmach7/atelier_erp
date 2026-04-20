from drf_spectacular.utils import extend_schema
from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from core.pagination import StandardResultsSetPagination
from core.permissions import IsManagerOrAdmin
from apps.inventory.models import Category, Product, StockMovement
from apps.inventory.serializers import (
    CategorySerializer,
    ProductCreateUpdateSerializer,
    ProductDetailSerializer,
    ProductListSerializer,
    StockMovementSerializer,
)


@extend_schema(tags=["Inventory - Categories"])
class CategoryViewSet(ModelViewSet):
    """Category management viewset."""

    queryset = Category.objects.filter(is_active=True, parent=None)
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["sort_order", "name"]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsManagerOrAdmin()]
        return [IsAuthenticated()]


@extend_schema(tags=["Inventory - Products"])
class ProductViewSet(ModelViewSet):
    """Product management viewset."""

    queryset = Product.objects.filter(is_active=True)
    serializer_class = ProductListSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["sku", "name", "description"]
    ordering_fields = ["name", "base_price", "stock_quantity", "created_at"]
    ordering = ["sort_order", "name"]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return ProductCreateUpdateSerializer
        if self.action == "retrieve":
            return ProductDetailSerializer
        return ProductListSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsManagerOrAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = super().get_queryset()
        category = self.request.query_params.get("category")
        product_type = self.request.query_params.get("type")

        if category:
            queryset = queryset.filter(category_id=category)
        if product_type:
            queryset = queryset.filter(type=product_type)

        return queryset

    @extend_schema(summary="Get low stock products")
    @action(detail=False, methods=["get"], url_path="low-stock")
    def low_stock(self, request):
        """Get products with low stock."""
        products = self.get_queryset().filter(track_stock=True)
        low_stock = [p for p in products if p.is_low_stock]
        serializer = ProductListSerializer(low_stock, many=True)
        return Response(serializer.data)

    @extend_schema(summary="Update stock quantity")
    @action(detail=True, methods=["post"], url_path="update-stock")
    def update_stock(self, request, pk=None):
        """Update product stock."""
        product = self.get_object()
        quantity = request.data.get("quantity")
        movement_type = request.data.get("type", "adjustment")
        notes = request.data.get("notes", "")

        if quantity is None:
            return Response(
                {"error": "quantity is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.inventory.services import InventoryService
        movement = InventoryService.update_stock(
            product_id=str(product.id),
            quantity=float(quantity),
            movement_type=movement_type,
            notes=notes,
            user=request.user,
        )

        return Response(StockMovementSerializer(movement).data)


@extend_schema(tags=["Inventory - Stock Movements"])
class StockMovementViewSet(ModelViewSet):
    """Stock movement viewset (read-only)."""

    queryset = StockMovement.objects.all()
    serializer_class = StockMovementSerializer
    permission_classes = [IsManagerOrAdmin]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        product = self.request.query_params.get("product")
        if product:
            queryset = queryset.filter(product_id=product)
        return queryset

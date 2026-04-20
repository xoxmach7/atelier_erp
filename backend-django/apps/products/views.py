from drf_spectacular.utils import extend_schema
from rest_framework import filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.common.pagination import StandardResultsSetPagination
from apps.common.permissions import IsManagerOrAdmin
from apps.products.models import Category, Product
from apps.products.serializers import (
    CategorySerializer,
    ProductCreateUpdateSerializer,
    ProductDetailSerializer,
    ProductListSerializer,
)


@extend_schema(tags=["Products"])
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


@extend_schema(tags=["Products"])
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

    @extend_schema(summary="Get featured products")
    @action(detail=False, methods=["get"], url_path="featured")
    def featured(self, request):
        """Get featured products."""
        products = self.get_queryset().filter(is_featured=True)
        serializer = ProductListSerializer(products, many=True)
        return Response(serializer.data)

    @extend_schema(summary="Get services only")
    @action(detail=False, methods=["get"], url_path="services")
    def services(self, request):
        """Get only services."""
        products = self.get_queryset().filter(type=Product.Type.SERVICE)
        serializer = ProductListSerializer(products, many=True)
        return Response(serializer.data)

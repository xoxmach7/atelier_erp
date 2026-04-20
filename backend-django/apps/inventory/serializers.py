from rest_framework import serializers

from apps.inventory.models import Category, Product, StockMovement


class CategorySerializer(serializers.ModelSerializer):
    """Serializer for categories."""

    children = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "description", "icon", "sort_order", "children"]

    def get_children(self, obj):
        if hasattr(obj, "children"):
            return CategorySerializer(obj.children.filter(is_active=True), many=True).data
        return []


class ProductListSerializer(serializers.ModelSerializer):
    """Serializer for listing products."""

    category_name = serializers.CharField(source="category.name", read_only=True)
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    unit_display = serializers.CharField(source="get_unit_display", read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "sku",
            "name",
            "type",
            "type_display",
            "category",
            "category_name",
            "base_price",
            "unit",
            "unit_display",
            "track_stock",
            "stock_quantity",
            "is_low_stock",
            "is_featured",
        ]


class ProductDetailSerializer(serializers.ModelSerializer):
    """Serializer for product details."""

    category_name = serializers.CharField(source="category.name", read_only=True)
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    unit_display = serializers.CharField(source="get_unit_display", read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    needs_reorder = serializers.BooleanField(read_only=True)
    profit_margin = serializers.FloatField(read_only=True)

    class Meta:
        model = Product
        exclude = ["is_active"]


class ProductCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating products."""

    class Meta:
        model = Product
        fields = [
            "sku",
            "name",
            "description",
            "type",
            "category",
            "base_price",
            "cost_price",
            "unit",
            "track_stock",
            "stock_quantity",
            "min_stock_level",
            "reorder_point",
            "storage_location",
            "duration_minutes",
            "requires_master",
            "is_featured",
            "sort_order",
        ]


class StockMovementSerializer(serializers.ModelSerializer):
    """Serializer for stock movements."""

    product_name = serializers.CharField(source="product.name", read_only=True)
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "product",
            "product_name",
            "type",
            "type_display",
            "quantity",
            "reference",
            "notes",
            "created_by",
            "created_by_name",
            "created_at",
        ]

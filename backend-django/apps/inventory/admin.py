from django.contrib import admin

from apps.inventory.models import Category, Product, StockMovement


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "parent", "sort_order", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["name"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = [
        "sku",
        "name",
        "type",
        "category",
        "base_price",
        "stock_quantity",
        "is_featured",
        "is_active",
    ]
    list_filter = ["type", "category", "is_featured", "is_active"]
    search_fields = ["sku", "name", "description"]
    list_editable = ["base_price", "is_featured", "is_active"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ["product", "type", "quantity", "reference", "created_at", "created_by"]
    list_filter = ["type", "created_at"]
    search_fields = ["product__name", "reference"]
    readonly_fields = ["created_at"]

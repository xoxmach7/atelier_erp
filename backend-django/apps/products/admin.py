from django.contrib import admin

from apps.products.models import Category, Product


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

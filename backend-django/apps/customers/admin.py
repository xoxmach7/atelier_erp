from django.contrib import admin

from apps.customers.models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    """Admin configuration for Customer model."""

    list_display = [
        "display_name",
        "type",
        "phone",
        "email",
        "city",
        "total_orders",
        "total_spent",
        "is_active",
    ]
    list_filter = ["type", "source", "is_active", "city", "created_at"]
    search_fields = [
        "first_name",
        "last_name",
        "company_name",
        "phone",
        "email",
        "bin",
    ]
    readonly_fields = ["total_orders", "total_spent", "last_order_date"]
    ordering = ["-created_at"]

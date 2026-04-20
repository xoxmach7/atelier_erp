from django.contrib import admin

from apps.orders.models import Order, OrderItem, OrderStatusHistory


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    raw_id_fields = ["assigned_to"]


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = [
        "order_number",
        "customer",
        "status",
        "priority",
        "total_amount",
        "paid_amount",
        "deadline_date",
    ]
    list_filter = ["status", "priority", "created_at"]
    search_fields = ["order_number", "customer__first_name", "customer__last_name"]
    inlines = [OrderItemInline]
    readonly_fields = ["order_number", "total_amount", "paid_amount", "balance_due"]
    date_hierarchy = "created_at"


@admin.register(OrderStatusHistory)
class OrderStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ["order", "old_status", "new_status", "changed_by", "created_at"]
    list_filter = ["old_status", "new_status"]
    readonly_fields = ["created_at"]

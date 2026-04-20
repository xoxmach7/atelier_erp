from django.contrib import admin

from apps.production.models import ProductionSchedule, WorkOrder, WorkOrderMaterial


class WorkOrderMaterialInline(admin.TabularInline):
    model = WorkOrderMaterial
    extra = 0


@admin.register(WorkOrder)
class WorkOrderAdmin(admin.ModelAdmin):
    list_display = [
        "work_order_number",
        "order",
        "product",
        "status",
        "priority",
        "assigned_to",
        "planned_start",
    ]
    list_filter = ["status", "priority", "created_at"]
    search_fields = ["work_order_number", "product__name"]
    inlines = [WorkOrderMaterialInline]
    date_hierarchy = "created_at"


@admin.register(ProductionSchedule)
class ProductionScheduleAdmin(admin.ModelAdmin):
    list_display = ["work_order", "scheduled_date", "start_time", "end_time", "machine"]
    list_filter = ["scheduled_date", "machine"]
    date_hierarchy = "scheduled_date"

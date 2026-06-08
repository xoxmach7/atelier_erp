"""
Django Admin configuration for Atelier ERP
Optimized for production use with 100k+ records
"""

from django.contrib import admin
from django.db.models import Count, Sum
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe

from .models import (
    Customer, Fabric, Cornice, Service,
    Order, OrderItem, OrderStatusHistory, Payment, Measurement,
    Task, TaskMeasurement, TaskHistory,
    Quote, QuoteItem,
    FabricReservation,
    ProductionAssignment, ProductionLog, SeamstressPayment,
    ActivityLog, AppConfig,
)


# ============================================
# CUSTOMER ADMIN
# ============================================

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'phone', 'email', 'order_count', 'created_at', 'is_active']
    list_filter = ['is_active', 'created_at', 'address_city']
    search_fields = ['full_name', 'phone', 'email']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Contact Info', {
            'fields': ('full_name', 'phone', 'email')
        }),
        ('Address', {
            'fields': ('address_city', 'address_street', 'address_building', 'address_apartment', 'address_notes')
        }),
        ('Metadata', {
            'fields': ('notes', 'is_active', 'created_at', 'updated_at')
        }),
    )
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.annotate(order_count=Count('orders'))
    
    def order_count(self, obj):
        return obj.order_count
    order_count.admin_order_field = 'order_count'
    order_count.short_description = 'Orders'


# ============================================
# INVENTORY ADMIN
# ============================================

@admin.register(Fabric)
class FabricAdmin(admin.ModelAdmin):
    list_display = [
        'hanger_number', 'name', 'color', 'pattern',
        'stock_meters', 'reserved_meters', 'available_display',
        'price_per_meter', 'supplier', 'is_active'
    ]
    list_filter = ['is_active', 'color', 'pattern', 'supplier', 'created_at']
    search_fields = ['hanger_number', 'name', 'supplier']
    readonly_fields = ['created_at', 'updated_at', 'available_meters']
    date_hierarchy = 'created_at'
    
    def available_display(self, obj):
        available = obj.available_meters
        if available < 5:
            return format_html('<span style="color: red; font-weight: bold;">{}m</span>', available)
        elif available < 10:
            return format_html('<span style="color: orange;">{}m</span>', available)
        return format_html('<span style="color: green;">{}m</span>', available)
    available_display.short_description = 'Available'


@admin.register(FabricReservation)
class FabricReservationAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'fabric', 'task', 'reserved_meters',
        'status', 'reserved_at', 'expires_at', 'is_expired_display'
    ]
    list_filter = ['status', 'reserved_at', 'expires_at']
    search_fields = ['fabric__hanger_number', 'fabric__name', 'task__task_number']
    readonly_fields = ['reserved_at']
    date_hierarchy = 'reserved_at'
    
    def is_expired_display(self, obj):
        from django.utils import timezone
        if obj.status == 'active' and timezone.now() > obj.expires_at:
            return format_html('<span style="color: red;">EXPIRED</span>')
        return format_html('<span style="color: green;">OK</span>')
    is_expired_display.short_description = 'Expired'


@admin.register(Cornice)
class CorniceAdmin(admin.ModelAdmin):
    list_display = ['sku', 'name', 'type', 'material', 'color', 'stock_count', 'price', 'is_active']
    list_filter = ['is_active', 'type', 'material', 'color']
    search_fields = ['sku', 'name']


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ['name', 'unit', 'price_per_unit', 'is_active']
    list_filter = ['is_active', 'unit']
    search_fields = ['name']


# ============================================
# ORDER ADMIN
# ============================================

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    fields = ['item_type', 'fabric', 'cornice', 'quantity', 'unit_price', 'total_price']
    readonly_fields = ['total_price']


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    fields = ['amount', 'payment_type', 'payment_method', 'received_at']


class MeasurementInline(admin.TabularInline):
    model = Measurement
    extra = 0
    fields = ['room_name', 'window_name', 'width_cm', 'height_cm', 'mounting_type']


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = [
        'order_number', 'customer_link', 'status_badge',
        'total_amount', 'paid_amount', 'remaining_display',
        'planned_completion', 'created_at'
    ]
    list_filter = ['status', 'created_at', 'planned_completion', 'installation_address_city']
    search_fields = ['order_number', 'customer__full_name', 'customer__phone']
    readonly_fields = ['created_at', 'updated_at', 'order_number', 'paid_amount', 'is_fully_paid']
    date_hierarchy = 'created_at'
    inlines = [OrderItemInline, PaymentInline, MeasurementInline]
    
    fieldsets = (
        ('Order Info', {
            'fields': ('order_number', 'customer', 'status', 'quote')
        }),
        ('Financial', {
            'fields': ('total_amount', 'paid_amount', 'is_fully_paid')
        }),
        ('Installation Address', {
            'fields': ('installation_address_city', 'installation_address_street',
                      'installation_address_building', 'installation_address_apartment',
                      'installation_address_notes')
        }),
        ('Dates', {
            'fields': ('measurement_date', 'installation_date', 'planned_completion', 'actual_completion')
        }),
        ('Metadata', {
            'fields': ('notes', 'created_by', 'updated_by', 'created_at', 'updated_at')
        }),
    )
    
    def customer_link(self, obj):
        url = reverse('admin:atelier_erp_customer_change', args=[obj.customer_id])
        return format_html('<a href="{}">{}</a>', url, obj.customer.full_name)
    customer_link.short_description = 'Customer'
    
    def status_badge(self, obj):
        colors = {
            'measurement': 'blue',
            'design': 'purple',
            'production': 'indigo',
            'ready': 'cyan',
            'installation': 'pink',
            'completed': 'green',
            'cancelled': 'red',
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = 'Status'
    
    def remaining_display(self, obj):
        remaining = obj.remaining_amount
        if remaining > 0:
            return format_html('<span style="color: red;">{}</span>', remaining)
        return format_html('<span style="color: green;">Paid</span>')
    remaining_display.short_description = 'Remaining'


@admin.register(OrderStatusHistory)
class OrderStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ['order', 'old_status', 'new_status', 'changed_by_name', 'created_at']
    list_filter = ['new_status', 'created_at']
    search_fields = ['order__order_number']
    readonly_fields = ['created_at']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['order', 'amount', 'payment_type', 'payment_method', 'received_at', 'idempotency_key']
    list_filter = ['payment_type', 'payment_method', 'received_at']
    search_fields = ['order__order_number', 'external_transaction_id', 'idempotency_key']
    readonly_fields = ['received_at']


# ============================================
# TASK ADMIN
# ============================================

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = [
        'task_number', 'client_name', 'client_phone', 'status_badge',
        'priority', 'assigned_designer', 'deadline', 'created_at'
    ]
    list_filter = ['status', 'priority', 'source', 'created_at', 'preferred_date']
    search_fields = ['task_number', 'client_name', 'client_phone']
    readonly_fields = ['created_at', 'updated_at', 'task_number', 'converted_to_order']
    date_hierarchy = 'created_at'
    
    def status_badge(self, obj):
        colors = {
            'lead': 'gray',
            'measurement_scheduled': 'blue',
            'measurement_done': 'purple',
            'quoting': 'orange',
            'quote_sent': 'teal',
            'converted': 'green',
            'lost': 'red',
            'postponed': 'yellow',
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = 'Status'


@admin.register(TaskHistory)
class TaskHistoryAdmin(admin.ModelAdmin):
    list_display = ['task', 'action', 'old_value', 'new_value', 'performed_by_name', 'performed_at']
    list_filter = ['action', 'performed_at']
    readonly_fields = ['performed_at']


# ============================================
# QUOTE ADMIN
# ============================================

@admin.register(Quote)
class QuoteAdmin(admin.ModelAdmin):
    list_display = [
        'quote_number', 'task_link', 'customer', 'status',
        'subtotal', 'total', 'valid_until', 'created_at'
    ]
    list_filter = ['status', 'created_at', 'valid_until']
    search_fields = ['quote_number', 'task__task_number', 'customer__full_name']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'created_at'
    
    def task_link(self, obj):
        url = reverse('admin:atelier_erp_task_change', args=[obj.task_id])
        return format_html('<a href="{}">{}</a>', url, obj.task.task_number)
    task_link.short_description = 'Task'


# ============================================
# PRODUCTION ADMIN
# ============================================

@admin.register(ProductionAssignment)
class ProductionAssignmentAdmin(admin.ModelAdmin):
    list_display = [
        'order_link', 'assigned_to', 'status', 'complexity',
        'priority', 'deadline', 'total_payment'
    ]
    list_filter = ['status', 'complexity', 'priority', 'deadline', 'created_at']
    search_fields = ['order__order_number', 'assigned_to__first_name', 'assigned_to__last_name']
    readonly_fields = ['created_at', 'updated_at']
    
    def order_link(self, obj):
        url = reverse('admin:atelier_erp_order_change', args=[obj.order_id])
        return format_html('<a href="{}">{}</a>', url, obj.order.order_number)
    order_link.short_description = 'Order'


@admin.register(SeamstressPayment)
class SeamstressPaymentAdmin(admin.ModelAdmin):
    list_display = ['seamstress', 'assignment', 'total_amount', 'status', 'paid_at']
    list_filter = ['status', 'paid_at', 'created_at']
    search_fields = ['seamstress__first_name', 'seamstress__last_name']


# ============================================
# AUDIT ADMIN
# ============================================

@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'entity_type', 'action', 'entity_repr', 'performed_by_name']
    list_filter = ['entity_type', 'action', 'created_at']
    search_fields = ['entity_repr', 'performed_by_name']
    readonly_fields = [f.name for f in ActivityLog._meta.fields]
    date_hierarchy = 'created_at'
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


@admin.register(AppConfig)
class AppConfigAdmin(admin.ModelAdmin):
    list_display = ['key', 'value_type', 'description', 'updated_at']
    search_fields = ['key', 'description']

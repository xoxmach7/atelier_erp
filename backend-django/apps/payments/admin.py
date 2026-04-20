from django.contrib import admin

from apps.payments.models import Invoice, Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "order",
        "amount",
        "method",
        "status",
        "paid_at",
        "processed_by",
    ]
    list_filter = ["method", "status", "paid_at"]
    search_fields = ["order__order_number", "transaction_id", "customer__first_name"]
    date_hierarchy = "paid_at"


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = [
        "invoice_number",
        "customer",
        "total",
        "paid_amount",
        "status",
        "issue_date",
        "due_date",
    ]
    list_filter = ["status", "issue_date", "due_date"]
    search_fields = ["invoice_number", "customer__company_name"]
    readonly_fields = ["invoice_number", "subtotal", "tax_amount", "total"]
    date_hierarchy = "issue_date"

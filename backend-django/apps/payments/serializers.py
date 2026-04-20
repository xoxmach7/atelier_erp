from rest_framework import serializers

from apps.payments.models import Invoice, Payment


class PaymentListSerializer(serializers.ModelSerializer):
    """Serializer for listing payments."""

    order_number = serializers.CharField(
        source="order.order_number", read_only=True
    )
    customer_name = serializers.CharField(
        source="customer.display_name", read_only=True
    )
    method_display = serializers.CharField(source="get_method_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "order",
            "order_number",
            "customer",
            "customer_name",
            "amount",
            "method",
            "method_display",
            "status",
            "status_display",
            "transaction_id",
            "receipt_number",
            "paid_at",
        ]


class PaymentDetailSerializer(serializers.ModelSerializer):
    """Serializer for payment details."""

    order_number = serializers.CharField(
        source="order.order_number", read_only=True
    )
    customer_name = serializers.CharField(
        source="customer.display_name", read_only=True
    )
    processed_by_name = serializers.CharField(
        source="processed_by.get_full_name", read_only=True
    )
    method_display = serializers.CharField(source="get_method_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Payment
        exclude = ["is_active"]


class PaymentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating payments."""

    class Meta:
        model = Payment
        fields = [
            "order",
            "amount",
            "method",
            "status",
            "transaction_id",
            "reference_number",
            "notes",
        ]


class InvoiceListSerializer(serializers.ModelSerializer):
    """Serializer for listing invoices."""

    customer_name = serializers.CharField(
        source="customer.company_name", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    is_paid = serializers.BooleanField(read_only=True)
    balance_due = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "invoice_number",
            "customer",
            "customer_name",
            "issue_date",
            "due_date",
            "total",
            "paid_amount",
            "balance_due",
            "is_paid",
            "status",
            "status_display",
        ]


class InvoiceDetailSerializer(serializers.ModelSerializer):
    """Serializer for invoice details."""

    customer_name = serializers.CharField(
        source="customer.company_name", read_only=True
    )
    orders = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    is_paid = serializers.BooleanField(read_only=True)
    balance_due = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Invoice
        exclude = ["is_active"]

    def get_orders(self, obj):
        from apps.orders.serializers import OrderListSerializer

        return OrderListSerializer(obj.orders.all(), many=True).data


class InvoiceCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating invoices."""

    order_ids = serializers.ListField(
        child=serializers.UUIDField(), write_only=True
    )

    class Meta:
        model = Invoice
        fields = [
            "customer",
            "order_ids",
            "due_date",
            "tax_rate",
            "notes",
        ]

    def validate(self, data):
        if not data.get("order_ids"):
            raise serializers.ValidationError("At least one order is required.")
        return data

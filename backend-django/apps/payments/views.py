from drf_spectacular.utils import extend_schema
from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from core.pagination import StandardResultsSetPagination
from core.permissions import IsManagerOrAdmin
from apps.payments.models import Invoice, Payment
from apps.payments.serializers import (
    InvoiceCreateSerializer,
    InvoiceDetailSerializer,
    InvoiceListSerializer,
    PaymentCreateSerializer,
    PaymentDetailSerializer,
    PaymentListSerializer,
)
from apps.payments.services import InvoiceService, PaymentService


@extend_schema(tags=["Payments"])
class PaymentViewSet(ModelViewSet):
    """Payment management viewset."""

    queryset = Payment.objects.filter(is_active=True)
    serializer_class = PaymentListSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["order__order_number", "customer__first_name", "transaction_id"]
    ordering_fields = ["paid_at", "amount", "status"]
    ordering = ["-paid_at"]

    def get_serializer_class(self):
        if self.action == "create":
            return PaymentCreateSerializer
        if self.action == "retrieve":
            return PaymentDetailSerializer
        return PaymentListSerializer

    def get_permissions(self):
        if self.action in ["destroy", "update", "partial_update"]:
            return [IsManagerOrAdmin()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        return PaymentService.create_payment(
            **serializer.validated_data, processed_by=self.request.user
        )

    @extend_schema(summary="Get payments by date range")
    @action(detail=False, methods=["get"], url_path="by-date")
    def by_date(self, request):
        """Get payments filtered by date range."""
        start_date = request.query_params.get("start")
        end_date = request.query_params.get("end")

        payments = PaymentService.get_payments_by_date_range(start_date, end_date)
        serializer = PaymentListSerializer(payments, many=True)
        return Response(serializer.data)

    @extend_schema(summary="Get daily payments summary")
    @action(detail=False, methods=["get"], url_path="daily-summary")
    def daily_summary(self, request):
        """Get daily payments summary."""
        date = request.query_params.get("date")
        summary = PaymentService.get_daily_summary(date)
        return Response(summary)


@extend_schema(tags=["Invoices"])
class InvoiceViewSet(ModelViewSet):
    """Invoice management viewset."""

    queryset = Invoice.objects.filter(is_active=True)
    serializer_class = InvoiceListSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["invoice_number", "customer__company_name"]
    ordering_fields = ["issue_date", "due_date", "total", "status"]
    ordering = ["-issue_date"]

    def get_serializer_class(self):
        if self.action == "create":
            return InvoiceCreateSerializer
        if self.action == "retrieve":
            return InvoiceDetailSerializer
        return InvoiceListSerializer

    def get_permissions(self):
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        return InvoiceService.create_invoice(**serializer.validated_data)

    @extend_schema(summary="Mark invoice as paid")
    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        """Mark invoice as paid."""
        amount = request.data.get("amount")
        if not amount:
            return Response(
                {"error": "Amount is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        invoice = InvoiceService.mark_paid(pk, amount)
        return Response(InvoiceDetailSerializer(invoice).data)

    @extend_schema(summary="Generate invoice PDF")
    @action(detail=True, methods=["post"], url_path="generate-pdf")
    def generate_pdf(self, request, pk=None):
        """Generate PDF for invoice."""
        invoice = self.get_object()
        pdf_url = InvoiceService.generate_pdf(invoice)
        return Response({"pdf_url": pdf_url})

    @extend_schema(summary="Get overdue invoices")
    @action(
        detail=False,
        methods=["get"],
        permission_classes=[IsManagerOrAdmin],
        url_path="overdue",
    )
    def overdue(self, request):
        """Get overdue invoices."""
        invoices = InvoiceService.get_overdue_invoices()
        serializer = InvoiceListSerializer(invoices, many=True)
        return Response(serializer.data)

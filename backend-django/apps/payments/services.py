from decimal import Decimal
from typing import List, Optional

from django.db import transaction

from core.exceptions import NotFoundError, ValidationError
from apps.payments.models import Invoice, Payment


class PaymentService:
    """Service layer for payment-related business logic."""

    @classmethod
    @transaction.atomic
    def create_payment(
        cls,
        order_id: str,
        amount: Decimal,
        method: str,
        processed_by=None,
        **kwargs
    ) -> Payment:
        """Create a new payment."""
        from apps.orders.models import Order

        try:
            order = Order.objects.get(id=order_id, is_active=True)
        except Order.DoesNotExist:
            raise NotFoundError(f"Order with id {order_id} not found")

        payment = Payment.objects.create(
            order=order,
            customer=order.customer,
            amount=amount,
            method=method,
            processed_by=processed_by,
            **kwargs
        )

        # Update order paid amount
        order.paid_amount += amount
        order.save(update_fields=["paid_amount"])

        return payment

    @classmethod
    def get_payments_by_date_range(
        cls, start_date: Optional[str] = None, end_date: Optional[str] = None
    ):
        """Get payments within date range."""
        queryset = Payment.objects.filter(is_active=True)

        if start_date:
            queryset = queryset.filter(paid_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(paid_at__date__lte=end_date)

        return queryset

    @classmethod
    def get_daily_summary(cls, date: Optional[str] = None):
        """Get daily payments summary."""
        from django.db.models import Count, Sum
        from django.utils import timezone

        if date:
            queryset = Payment.objects.filter(paid_at__date=date)
        else:
            queryset = Payment.objects.filter(paid_at__date=timezone.now().date())

        summary = queryset.aggregate(
            total_amount=Sum("amount"),
            total_count=Count("id"),
        )

        by_method = (
            queryset.values("method")
            .annotate(total=Sum("amount"), count=Count("id"))
            .order_by("method")
        )

        return {
            "date": date or timezone.now().date().isoformat(),
            "total_amount": summary["total_amount"] or 0,
            "total_count": summary["total_count"] or 0,
            "by_method": list(by_method),
        }


class InvoiceService:
    """Service layer for invoice-related business logic."""

    @classmethod
    @transaction.atomic
    def create_invoice(cls, customer_id: str, order_ids: List[str], **kwargs) -> Invoice:
        """Create a new invoice for orders."""
        from apps.customers.models import Customer
        from apps.orders.models import Order

        try:
            customer = Customer.objects.get(id=customer_id, is_active=True)
        except Customer.DoesNotExist:
            raise NotFoundError(f"Customer with id {customer_id} not found")

        orders = Order.objects.filter(id__in=order_ids, customer=customer, is_active=True)

        if not orders.exists():
            raise ValidationError("No valid orders found for invoice")

        # Calculate totals
        subtotal = sum(o.total_amount for o in orders)
        tax_rate = Decimal(str(kwargs.get("tax_rate", 12)))
        tax_amount = (subtotal * tax_rate) / 100
        total = subtotal + tax_amount

        # Generate invoice number
        invoice_number = cls._generate_invoice_number()

        invoice = Invoice.objects.create(
            invoice_number=invoice_number,
            customer=customer,
            subtotal=subtotal,
            tax_rate=tax_rate,
            tax_amount=tax_amount,
            total=total,
            **kwargs
        )

        invoice.orders.set(orders)

        return invoice

    @classmethod
    @transaction.atomic
    def mark_paid(cls, invoice_id: str, amount: Decimal) -> Invoice:
        """Mark invoice as partially or fully paid."""
        try:
            invoice = Invoice.objects.get(id=invoice_id, is_active=True)
        except Invoice.DoesNotExist:
            raise NotFoundError(f"Invoice with id {invoice_id} not found")

        invoice.paid_amount += amount

        if invoice.paid_amount >= invoice.total:
            invoice.status = Invoice.Status.PAID
        elif invoice.due_date and invoice.due_date < timezone.now().date():
            invoice.status = Invoice.Status.OVERDUE

        invoice.save()
        return invoice

    @classmethod
    def get_overdue_invoices(cls):
        """Get all overdue invoices."""
        from django.utils import timezone

        return Invoice.objects.filter(
            due_date__lt=timezone.now().date(),
            status__in=[Invoice.Status.SENT, Invoice.Status.OVERDUE],
            is_active=True,
        )

    @classmethod
    def generate_pdf(cls, invoice: Invoice) -> str:
        """Generate PDF for invoice."""
        # Placeholder for PDF generation logic
        # In production, use a library like WeasyPrint or reportlab
        return f"/invoices/{invoice.invoice_number}.pdf"

    @classmethod
    def _generate_invoice_number(cls) -> str:
        """Generate unique invoice number."""
        from datetime import datetime

        prefix = datetime.now().strftime("INV-%Y%m")
        count = (
            Invoice.objects.filter(
                invoice_number__startswith=prefix,
                created_at__month=datetime.now().month,
            ).count()
            + 1
        )
        return f"{prefix}-{count:04d}"

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from core.models import TimeStampedModel


class Payment(TimeStampedModel):
    """Payment record for orders."""

    class Method(models.TextChoices):
        CASH = "cash", "Наличные"
        CARD = "card", "Карта"
        BANK_TRANSFER = "bank_transfer", "Банковский перевод"
        KASPI_PAY = "kaspi_pay", "Kaspi Pay"
        ONLINE = "online", "Онлайн оплата"
        CREDIT = "credit", "В кредит"

    class Status(models.TextChoices):
        PENDING = "pending", "Ожидает"
        COMPLETED = "completed", "Завершен"
        FAILED = "failed", "Ошибка"
        REFUNDED = "refunded", "Возвращен"

    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.CASCADE,
        related_name="payments",
        verbose_name="Заказ",
    )
    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.SET_NULL,
        null=True,
        related_name="payments",
        verbose_name="Клиент",
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        verbose_name="Сумма",
    )
    method = models.CharField(
        max_length=20, choices=Method.choices, verbose_name="Способ оплаты"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.COMPLETED,
        verbose_name="Статус",
    )

    # Transaction details
    transaction_id = models.CharField(
        max_length=100, blank=True, verbose_name="ID транзакции"
    )
    reference_number = models.CharField(
        max_length=100, blank=True, verbose_name="Номер платежа"
    )

    # Receipt/Invoice
    receipt_number = models.CharField(
        max_length=50, blank=True, verbose_name="Номер чека"
    )
    receipt_url = models.URLField(blank=True, verbose_name="Ссылка на чек")

    # Timestamps
    paid_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата оплаты")

    # Additional info
    notes = models.TextField(blank=True, verbose_name="Примечания")
    processed_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="processed_payments",
        verbose_name="Кем принят",
    )

    class Meta:
        verbose_name = "Платеж"
        verbose_name_plural = "Платежи"
        ordering = ["-paid_at"]
        indexes = [
            models.Index(fields=["order", "status"]),
            models.Index(fields=["customer", "status"]),
            models.Index(fields=["method", "status"]),
            models.Index(fields=["paid_at"]),
        ]

    def __str__(self) -> str:
        return f"Платеж {self.amount} для заказа {self.order}"


class Invoice(TimeStampedModel):
    """Invoice for company customers."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Черновик"
        SENT = "sent", "Отправлен"
        PAID = "paid", "Оплачен"
        OVERDUE = "overdue", "Просрочен"
        CANCELLED = "cancelled", "Отменен"

    invoice_number = models.CharField(max_length=50, unique=True, verbose_name="Номер счета")
    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.PROTECT,
        related_name="invoices",
        limit_choices_to={"type": "company"},
        verbose_name="Клиент",
    )

    orders = models.ManyToManyField("orders.Order", related_name="invoices")

    issue_date = models.DateField(auto_now_add=True, verbose_name="Дата выставления")
    due_date = models.DateField(verbose_name="Срок оплаты")

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Подытог")
    tax_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=12, verbose_name="Ставка НДС %"
    )
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="НДС")
    total = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Итого")

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name="Статус",
    )
    paid_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0, verbose_name="Оплачено"
    )

    notes = models.TextField(blank=True, verbose_name="Примечания")
    pdf_file = models.FileField(upload_to="invoices/", blank=True, null=True)

    class Meta:
        verbose_name = "Счет"
        verbose_name_plural = "Счета"
        ordering = ["-issue_date"]

    def __str__(self) -> str:
        return f"Счет #{self.invoice_number}"

    @property
    def balance_due(self) -> Decimal:
        return self.total - self.paid_amount

    @property
    def is_paid(self) -> bool:
        return self.balance_due <= 0

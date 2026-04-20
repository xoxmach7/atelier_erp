from django.core.validators import MinValueValidator
from django.db import models

from core.models import TimeStampedModel


class Order(TimeStampedModel):
    """Atelier order model with simplified lifecycle."""

    class Status(models.TextChoices):
        NEW = "new", "Новый"
        IN_PROGRESS = "in_progress", "В работе"
        DONE = "done", "Готов"
        DELIVERED = "delivered", "Выдан"
        CANCELLED = "cancelled", "Отменен"

    class Priority(models.TextChoices):
        LOW = "low", "Низкий"
        NORMAL = "normal", "Нормальный"
        HIGH = "high", "Высокий"
        URGENT = "urgent", "Срочный"

    order_number = models.CharField(max_length=20, unique=True, db_index=True)
    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.PROTECT,
        related_name="orders",
        verbose_name="Клиент",
    )

    # Order details
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NEW,
        verbose_name="Статус",
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.NORMAL,
        verbose_name="Приоритет",
    )

    # Dates
    order_date = models.DateTimeField(auto_now_add=True, verbose_name="Дата заказа")
    deadline_date = models.DateTimeField(null=True, blank=True, verbose_name="Срок")
    completed_date = models.DateTimeField(null=True, blank=True, verbose_name="Дата завершения")

    # Financial
    subtotal = models.DecimalField(
        max_digits=12, decimal_places=2, default=0, verbose_name="Подытог"
    )
    discount_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0, verbose_name="Скидка"
    )
    total_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0, verbose_name="Итого"
    )
    paid_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0, verbose_name="Оплачено"
    )

    # Assignment
    manager = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_orders",
        verbose_name="Менеджер",
    )
    masters = models.ManyToManyField(
        "users.User",
        related_name="assigned_orders",
        blank=True,
        verbose_name="Мастера",
    )

    # Location
    pickup_address = models.TextField(blank=True, verbose_name="Адрес забора")
    delivery_address = models.TextField(blank=True, verbose_name="Адрес доставки")

    # Additional info
    description = models.TextField(blank=True, verbose_name="Описание")
    internal_notes = models.TextField(blank=True, verbose_name="Внутренние заметки")
    source = models.CharField(max_length=50, blank=True, verbose_name="Источник")
    referral_code = models.CharField(max_length=50, blank=True, verbose_name="Реферальный код")

    class Meta:
        verbose_name = "Заказ"
        verbose_name_plural = "Заказы"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "is_active"]),
            models.Index(fields=["customer", "is_active"]),
            models.Index(fields=["order_date"]),
            models.Index(fields=["deadline_date"]),
        ]

    def __str__(self) -> str:
        return f"Заказ #{self.order_number}"

    @property
    def balance_due(self) -> float:
        return float(self.total_amount) - float(self.paid_amount)

    @property
    def is_paid(self) -> bool:
        return self.balance_due <= 0

    @property
    def is_overdue(self) -> bool:
        from django.utils import timezone

        if self.deadline_date and self.status not in [
            self.Status.DONE,
            self.Status.DELIVERED,
            self.Status.CANCELLED,
        ]:
            return timezone.now() > self.deadline_date
        return False


class OrderItem(TimeStampedModel):
    """Individual items/tasks within an order."""

    class Status(models.TextChoices):
        NEW = "new", "Новое"
        IN_PROGRESS = "in_progress", "В работе"
        DONE = "done", "Готово"

    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name="items", verbose_name="Заказ"
    )

    # Product/Service info
    product = models.ForeignKey(
        "products.Product",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_items",
        verbose_name="Продукт",
    )
    service_type = models.CharField(max_length=100, blank=True, verbose_name="Тип услуги")
    description = models.TextField(verbose_name="Описание")
    dimensions = models.CharField(max_length=100, blank=True, verbose_name="Размеры")

    # Financial
    quantity = models.PositiveIntegerField(default=1, verbose_name="Количество")
    unit_price = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(0)], verbose_name="Цена"
    )
    total_price = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Сумма")

    # Assignment
    assigned_to = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_items",
        verbose_name="Исполнитель",
    )

    # Status & Dates
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NEW,
        verbose_name="Статус",
    )
    started_at = models.DateTimeField(null=True, blank=True, verbose_name="Начато")
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name="Завершено")

    # Production
    materials_used = models.JSONField(default=dict, blank=True, verbose_name="Материалы")
    hours_spent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0, verbose_name="Часов"
    )

    class Meta:
        verbose_name = "Позиция заказа"
        verbose_name_plural = "Позиции заказа"
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.order} - {self.description[:50]}"

    def save(self, *args, **kwargs):
        self.total_price = self.quantity * self.unit_price
        super().save(*args, **kwargs)


class OrderStatusHistory(TimeStampedModel):
    """Track order status changes."""

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="status_history",
        verbose_name="Заказ",
    )
    old_status = models.CharField(max_length=20, verbose_name="Старый статус")
    new_status = models.CharField(max_length=20, verbose_name="Новый статус")
    changed_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        verbose_name="Кем изменено",
    )
    reason = models.TextField(blank=True, verbose_name="Причина")

    class Meta:
        verbose_name = "История статуса"
        verbose_name_plural = "История статусов"
        ordering = ["-created_at"]

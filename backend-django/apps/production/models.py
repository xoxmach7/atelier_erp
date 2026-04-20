from django.core.validators import MinValueValidator
from django.db import models

from core.models import TimeStampedModel


class WorkOrder(TimeStampedModel):
    """Work order for atelier production."""

    class Status(models.TextChoices):
        NEW = "new", "Новый"
        IN_PROGRESS = "in_progress", "В работе"
        DONE = "done", "Готов"

    class Priority(models.TextChoices):
        LOW = "low", "Низкий"
        NORMAL = "normal", "Нормальный"
        HIGH = "high", "Высокий"
        URGENT = "urgent", "Срочный"

    work_order_number = models.CharField(max_length=20, unique=True, db_index=True)
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.CASCADE,
        related_name="work_orders",
        verbose_name="Заказ",
    )

    # Product to manufacture
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.SET_NULL,
        null=True,
        verbose_name="Продукт",
    )
    quantity_required = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(0)],
        verbose_name="Требуется"
    )
    quantity_completed = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, verbose_name="Готово"
    )

    # Status
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

    # Scheduling
    planned_start = models.DateTimeField(null=True, blank=True, verbose_name="Плановый старт")
    planned_end = models.DateTimeField(null=True, blank=True, verbose_name="Плановое окончание")
    actual_start = models.DateTimeField(null=True, blank=True, verbose_name="Фактический старт")
    actual_end = models.DateTimeField(null=True, blank=True, verbose_name="Фактическое окончание")

    # Assignment
    assigned_to = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="work_orders",
        verbose_name="Исполнитель",
        limit_choices_to={"role__in": ["worker", "cutter"]},
    )

    # Materials
    materials = models.ManyToManyField(
        "inventory.Product",
        through="WorkOrderMaterial",
        related_name="used_in_work_orders",
    )

    # Instructions
    description = models.TextField(blank=True, verbose_name="Описание работ")
    special_instructions = models.TextField(blank=True, verbose_name="Особые указания")

    # Time tracking
    estimated_hours = models.DecimalField(
        max_digits=5, decimal_places=2, default=0, verbose_name="Оценка часов"
    )
    actual_hours = models.DecimalField(
        max_digits=5, decimal_places=2, default=0, verbose_name="Факт часов"
    )

    class Meta:
        verbose_name = "Производственное задание"
        verbose_name_plural = "Производственные задания"
        ordering = ["-priority", "created_at"]
        indexes = [
            models.Index(fields=["status", "is_active"]),
            models.Index(fields=["assigned_to", "status"]),
            models.Index(fields=["planned_start"]),
        ]

    def __str__(self) -> str:
        return f"Наряд #{self.work_order_number}"

    @property
    def completion_percentage(self) -> float:
        if self.quantity_required > 0:
            return (self.quantity_completed / self.quantity_required) * 100
        return 0


class WorkOrderMaterial(TimeStampedModel):
    """Materials required for a work order."""

    work_order = models.ForeignKey(
        WorkOrder, on_delete=models.CASCADE, related_name="work_order_materials"
    )
    material = models.ForeignKey(
        "inventory.Product",
        on_delete=models.CASCADE,
        limit_choices_to={"type": "material"},
    )
    quantity_required = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(0)]
    )
    quantity_used = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        verbose_name = "Материал наряда"
        verbose_name_plural = "Материалы наряда"


class Task(TimeStampedModel):
    """Individual task assigned to a worker."""

    class Status(models.TextChoices):
        NEW = "new", "Новое"
        IN_PROGRESS = "in_progress", "В работе"
        DONE = "done", "Готово"

    class TaskType(models.TextChoices):
        CUTTING = "cutting", "Раскрой"
        SEWING = "sewing", "Пошив"
        FINISHING = "finishing", "Отделка"
        EMBROIDERY = "embroidery", "Вышивка"
        ALTERATION = "alteration", "Перешив"
        REPAIR = "repair", "Ремонт"
        PRESSING = "pressing", "Глажка"
        QUALITY_CHECK = "quality_check", "Проверка качества"

    work_order = models.ForeignKey(
        WorkOrder,
        on_delete=models.CASCADE,
        related_name="tasks",
        verbose_name="Наряд",
    )

    # Task details
    task_type = models.CharField(
        max_length=20,
        choices=TaskType.choices,
        default=TaskType.SEWING,
        verbose_name="Тип работы",
    )
    description = models.TextField(verbose_name="Описание задачи")
    sequence = models.PositiveIntegerField(default=1, verbose_name="Порядок")

    # Assignment
    assigned_to = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_tasks",
        verbose_name="Исполнитель",
        limit_choices_to={"role__in": ["worker", "cutter"]},
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NEW,
        verbose_name="Статус",
    )

    # Timing
    estimated_minutes = models.PositiveIntegerField(default=0, verbose_name="Оценка (мин)")
    actual_minutes = models.PositiveIntegerField(default=0, verbose_name="Факт (мин)")

    started_at = models.DateTimeField(null=True, blank=True, verbose_name="Начато")
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name="Завершено")

    # Quality
    quality_score = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name="Оценка качества")
    rework_required = models.BooleanField(default=False, verbose_name="Требуется переделка")
    rework_notes = models.TextField(blank=True, verbose_name="Примечания по переделке")

    # Dependencies
    depends_on = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="dependent_tasks",
        verbose_name="Зависит от",
    )

    class Meta:
        verbose_name = "Задача"
        verbose_name_plural = "Задачи"
        ordering = ["work_order", "sequence", "created_at"]

    def __str__(self) -> str:
        return f"{self.work_order} - {self.get_task_type_display()}"


class ProductionSchedule(TimeStampedModel):
    """Production schedule entry."""

    work_order = models.OneToOneField(
        WorkOrder,
        on_delete=models.CASCADE,
        related_name="schedule",
    )
    scheduled_date = models.DateField(verbose_name="Дата")
    start_time = models.TimeField(verbose_name="Время начала")
    end_time = models.TimeField(verbose_name="Время окончания")
    machine = models.CharField(max_length=100, blank=True, verbose_name="Оборудование")
    notes = models.TextField(blank=True, verbose_name="Примечания")

    class Meta:
        verbose_name = "План производства"
        verbose_name_plural = "План производства"
        ordering = ["scheduled_date", "start_time"]

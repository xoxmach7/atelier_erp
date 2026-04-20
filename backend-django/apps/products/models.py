from django.core.validators import MinValueValidator
from django.db import models

from apps.common.models import TimeStampedModel


class Category(TimeStampedModel):
    """Product/service category."""

    name = models.CharField(max_length=100, verbose_name="Название")
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True, verbose_name="Описание")
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
        verbose_name="Родительская категория",
    )
    sort_order = models.PositiveIntegerField(default=0, verbose_name="Порядок")
    icon = models.CharField(max_length=50, blank=True, verbose_name="Иконка")

    class Meta:
        verbose_name = "Категория"
        verbose_name_plural = "Категории"
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name


class Product(TimeStampedModel):
    """Product or service."""

    class Type(models.TextChoices):
        PRODUCT = "product", "Товар"
        SERVICE = "service", "Услуга"

    class Unit(models.TextChoices):
        PIECE = "piece", "шт"
        METER = "meter", "м"
        SQM = "sqm", "м²"
        LFM = "lfm", "п.м"
        KG = "kg", "кг"
        HOUR = "hour", "час"

    # Basic info
    sku = models.CharField(
        max_length=50, unique=True, blank=True, verbose_name="Артикул"
    )
    name = models.CharField(max_length=255, verbose_name="Название")
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True, verbose_name="Описание")
    type = models.CharField(
        max_length=20, choices=Type.choices, default=Type.PRODUCT, verbose_name="Тип"
    )

    # Categorization
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products",
        verbose_name="Категория",
    )

    # Pricing
    base_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name="Базовая цена",
    )
    cost_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name="Себестоимость",
    )
    unit = models.CharField(
        max_length=20, choices=Unit.choices, default=Unit.PIECE, verbose_name="Ед. изм."
    )

    # Inventory (for products)
    track_stock = models.BooleanField(default=False, verbose_name="Учет остатков")
    stock_quantity = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, verbose_name="На складе"
    )
    min_stock_level = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, verbose_name="Мин. остаток"
    )

    # Service options
    duration_minutes = models.PositiveIntegerField(
        default=0, verbose_name="Длительность (мин)"
    )
    requires_master = models.BooleanField(default=False, verbose_name="Требует мастера")

    # Media
    image = models.ImageField(
        upload_to="products/", blank=True, null=True, verbose_name="Изображение"
    )

    # Status
    is_featured = models.BooleanField(default=False, verbose_name="Популярный")
    sort_order = models.PositiveIntegerField(default=0, verbose_name="Порядок")

    class Meta:
        verbose_name = "Продукт"
        verbose_name_plural = "Продукты"
        ordering = ["-is_featured", "sort_order", "name"]
        indexes = [
            models.Index(fields=["type", "is_active"]),
            models.Index(fields=["category", "is_active"]),
            models.Index(fields=["sku"]),
        ]

    def __str__(self) -> str:
        return self.name

    @property
    def is_low_stock(self) -> bool:
        return self.track_stock and self.stock_quantity <= self.min_stock_level

    @property
    def profit_margin(self) -> float:
        if self.base_price > 0:
            return ((self.base_price - self.cost_price) / self.base_price) * 100
        return 0

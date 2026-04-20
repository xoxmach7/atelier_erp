from django.core.validators import MinValueValidator
from django.db import models

from core.models import TimeStampedModel


class Category(TimeStampedModel):
    """Product category."""

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

    class Meta:
        verbose_name = "Категория"
        verbose_name_plural = "Категории"
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name


class Product(TimeStampedModel):
    """Product or service in inventory."""

    class Type(models.TextChoices):
        PRODUCT = "product", "Товар"
        SERVICE = "service", "Услуга"
        MATERIAL = "material", "Материал"

    class Unit(models.TextChoices):
        PIECE = "piece", "шт"
        METER = "meter", "м"
        SQM = "sqm", "м²"
        LFM = "lfm", "п.м"
        KG = "kg", "кг"
        LITER = "liter", "л"
        ROLL = "roll", "рул"

    sku = models.CharField(max_length=50, unique=True, blank=True, verbose_name="Артикул")
    name = models.CharField(max_length=255, verbose_name="Название")
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True, verbose_name="Описание")
    type = models.CharField(
        max_length=20, choices=Type.choices, default=Type.PRODUCT, verbose_name="Тип"
    )

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
        max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)],
        verbose_name="Базовая цена",
    )
    cost_price = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)],
        verbose_name="Себестоимость",
    )
    unit = models.CharField(
        max_length=20, choices=Unit.choices, default=Unit.PIECE, verbose_name="Ед. изм."
    )

    # Stock
    track_stock = models.BooleanField(default=False, verbose_name="Учет остатков")
    stock_quantity = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, verbose_name="На складе"
    )
    min_stock_level = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, verbose_name="Мин. остаток"
    )
    reorder_point = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, verbose_name="Точка заказа"
    )

    # Location
    storage_location = models.CharField(max_length=100, blank=True, verbose_name="Место хранения")

    # Service specific
    duration_minutes = models.PositiveIntegerField(default=0, verbose_name="Длительность (мин)")
    requires_master = models.BooleanField(default=False, verbose_name="Требует мастера")

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
    def needs_reorder(self) -> bool:
        return self.track_stock and self.stock_quantity <= self.reorder_point

    @property
    def profit_margin(self) -> float:
        if self.base_price > 0:
            return ((self.base_price - self.cost_price) / self.base_price) * 100
        return 0


class StockMovement(TimeStampedModel):
    """Track stock movements (in/out)."""

    class Type(models.TextChoices):
        IN = "in", "Приход"
        OUT = "out", "Расход"
        ADJUSTMENT = "adjustment", "Корректировка"

    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="stock_movements"
    )
    type = models.CharField(max_length=20, choices=Type.choices)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    reference = models.CharField(max_length=100, blank=True, verbose_name="Ссылка")
    notes = models.TextField(blank=True, verbose_name="Примечания")
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="stock_movements",
    )

    class Meta:
        verbose_name = "Движение склада"
        verbose_name_plural = "Движения склада"
        ordering = ["-created_at"]


class Fabric(TimeStampedModel):
    """Fabric inventory for atelier."""

    class FabricType(models.TextChoices):
        COTTON = "cotton", "Хлопок"
        LINEN = "linen", "Лен"
        SILK = "silk", "Шелк"
        WOOL = "wool", "Шерсть"
        POLYESTER = "polyester", "Полиэстер"
        VISCOSE = "viscose", "Вискоза"
        BLEND = "blend", "Смесь"
        OTHER = "other", "Другое"

    code = models.CharField(max_length=50, unique=True, verbose_name="Код")
    name = models.CharField(max_length=255, verbose_name="Название")
    fabric_type = models.CharField(
        max_length=20,
        choices=FabricType.choices,
        default=FabricType.OTHER,
        verbose_name="Тип ткани",
    )
    color = models.CharField(max_length=100, verbose_name="Цвет")
    pattern = models.CharField(max_length=100, blank=True, verbose_name="Рисунок")

    # Physical properties
    width_cm = models.PositiveIntegerField(default=150, verbose_name="Ширина (см)")
    weight_gsm = models.PositiveIntegerField(null=True, blank=True, verbose_name="Плотность (г/м²)")

    # Stock tracking (in meters)
    length_in_stock = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, verbose_name="Остаток (м)")
    min_length = models.DecimalField(
        max_digits=10, decimal_places=2, default=5, verbose_name="Мин. остаток (м)")

    # Pricing
    price_per_meter = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, verbose_name="Цена за метр")

    # Supplier info
    supplier = models.CharField(max_length=255, blank=True, verbose_name="Поставщик")
    supplier_code = models.CharField(max_length=100, blank=True, verbose_name="Код поставщика")

    # Location
    storage_location = models.CharField(max_length=100, blank=True, verbose_name="Место хранения")

    # Additional
    notes = models.TextField(blank=True, verbose_name="Примечания")

    class Meta:
        verbose_name = "Ткань"
        verbose_name_plural = "Ткани"
        ordering = ["name", "color"]
        indexes = [
            models.Index(fields=["fabric_type", "is_active"]),
            models.Index(fields=["color", "is_active"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.color}) - {self.length_in_stock}м"

    @property
    def is_low_stock(self) -> bool:
        return self.length_in_stock <= self.min_length


class FabricUsage(TimeStampedModel):
    """Track fabric usage in orders."""

    fabric = models.ForeignKey(
        Fabric,
        on_delete=models.CASCADE,
        related_name="usages",
        verbose_name="Ткань",
    )
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.CASCADE,
        related_name="fabric_usages",
        verbose_name="Заказ",
    )
    order_item = models.ForeignKey(
        "orders.OrderItem",
        on_delete=models.CASCADE,
        related_name="fabric_usages",
        null=True,
        blank=True,
        verbose_name="Позиция заказа",
    )

    # Usage details
    length_used = models.DecimalField(
        max_digits=8, decimal_places=2, verbose_name="Использовано (м)")
    cost = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, verbose_name="Стоимость")

    # Cutting details
    layout_length = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True, verbose_name="Длина раскладки")
    pieces_cut = models.PositiveIntegerField(default=1, verbose_name="Количество деталей")

    # Who and when
    cut_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="fabric_cuts",
        verbose_name="Кто раскроил",
    )
    cut_date = models.DateTimeField(auto_now_add=True, verbose_name="Дата раскроя")

    notes = models.TextField(blank=True, verbose_name="Примечания")

    class Meta:
        verbose_name = "Использование ткани"
        verbose_name_plural = "Использование тканей"
        ordering = ["-created_at"]

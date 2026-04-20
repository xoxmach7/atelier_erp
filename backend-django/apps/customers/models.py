from django.core.validators import RegexValidator
from django.db import models

from core.models import SoftDeleteModel


class Customer(SoftDeleteModel):
    """Customer model for storing client information."""

    class Type(models.TextChoices):
        INDIVIDUAL = "individual", "Физическое лицо"
        COMPANY = "company", "Юридическое лицо"

    class Source(models.TextChoices):
        WEBSITE = "website", "Сайт"
        REFERRAL = "referral", "Рекомендация"
        ADVERTISING = "advertising", "Реклама"
        WALK_IN = "walk_in", "Проходной"
        SOCIAL_MEDIA = "social_media", "Соцсети"
        OTHER = "other", "Другое"

    type = models.CharField(
        max_length=20, choices=Type.choices, default=Type.INDIVIDUAL
    )
    first_name = models.CharField(max_length=150, blank=True, verbose_name="Имя")
    last_name = models.CharField(max_length=150, blank=True, verbose_name="Фамилия")
    company_name = models.CharField(
        max_length=255, blank=True, verbose_name="Название компании"
    )

    email = models.EmailField(blank=True, db_index=True)
    phone = models.CharField(
        max_length=20,
        validators=[
            RegexValidator(
                regex=r"^\+?1?\d{9,15}$",
                message="Phone number must be in format: '+999999999'",
            )
        ],
        verbose_name="Телефон",
    )
    phone_secondary = models.CharField(
        max_length=20, blank=True, verbose_name="Доп. телефон"
    )

    address = models.TextField(blank=True, verbose_name="Адрес")
    city = models.CharField(max_length=100, blank=True, verbose_name="Город")
    region = models.CharField(max_length=100, blank=True, verbose_name="Регион")

    bin = models.CharField(
        max_length=12, blank=True, verbose_name="БИН", db_index=True
    )
    bank_account = models.CharField(max_length=50, blank=True, verbose_name="Р/с")
    bank_name = models.CharField(max_length=255, blank=True, verbose_name="Банк")
    bik = models.CharField(max_length=20, blank=True, verbose_name="БИК")
    kbe = models.CharField(max_length=10, blank=True, verbose_name="КБе")

    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.WALK_IN,
        verbose_name="Источник",
    )
    notes = models.TextField(blank=True, verbose_name="Примечания")
    discount_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0, verbose_name="Скидка %"
    )
    credit_limit = models.DecimalField(
        max_digits=12, decimal_places=2, default=0, verbose_name="Кредитный лимит"
    )

    assigned_to = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_customers",
        verbose_name="Ответственный",
    )
    referred_by = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="referrals",
        verbose_name="Привел клиента",
    )

    total_orders = models.PositiveIntegerField(default=0)
    total_spent = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    last_order_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Клиент"
        verbose_name_plural = "Клиенты"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["phone", "is_active"]),
            models.Index(fields=["email", "is_active"]),
            models.Index(fields=["type", "is_active"]),
            models.Index(fields=["assigned_to", "is_active"]),
        ]

    def __str__(self) -> str:
        if self.type == self.Type.COMPANY:
            return self.company_name or f"Компания {self.bin}"
        return f"{self.last_name} {self.first_name}".strip() or self.phone

    @property
    def full_name(self) -> str:
        return f"{self.last_name} {self.first_name}".strip()

    @property
    def display_name(self) -> str:
        if self.type == self.Type.COMPANY:
            return self.company_name or f"Компания {self.bin}"
        return self.full_name or self.phone

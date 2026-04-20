from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from core.models import TimeStampedModel
from apps.users.managers import UserManager


class User(AbstractBaseUser, PermissionsMixin, TimeStampedModel):
    """Atelier user model with role-based access."""

    class Role(models.TextChoices):
        ADMIN = "admin", _("Администратор")
        MANAGER = "manager", _("Менеджер")
        WORKER = "worker", _("Швея/Мастер")
        CUTTER = "cutter", _("Закройщик")
        OPERATOR = "operator", _("Оператор")
        ACCOUNTANT = "accountant", _("Бухгалтер")

    # Fields
    email = models.EmailField(
        unique=True,
        db_index=True,
        verbose_name=_("Email"),
        error_messages={
            "unique": _("A user with this email already exists."),
        },
    )
    phone = models.CharField(
        max_length=20,
        blank=True,
        validators=[
            RegexValidator(
                regex=r"^\+?1?\d{9,15}$",
                message="Phone number must be in format: '+999999999'. Up to 15 digits allowed.",
            )
        ],
        verbose_name=_("Phone Number"),
    )
    first_name = models.CharField(max_length=150, verbose_name=_("First Name"))
    last_name = models.CharField(max_length=150, verbose_name=_("Last Name"))
    patronymic = models.CharField(
        max_length=150, blank=True, verbose_name=_("Patronymic")
    )

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.OPERATOR,
        verbose_name=_("Role"),
    )

    # Status fields
    is_staff = models.BooleanField(
        default=False,
        help_text=_("Designates whether the user can log into admin site."),
        verbose_name=_("Staff Status"),
    )
    is_superuser = models.BooleanField(
        default=False,
        help_text=_("Designates that this user has all permissions without explicitly assigning them."),
        verbose_name=_("Superuser Status"),
    )
    date_joined = models.DateTimeField(default=timezone.now, verbose_name=_("Date Joined"))
    last_login = models.DateTimeField(null=True, blank=True, verbose_name=_("Last Login"))

    # Additional profile data
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True, verbose_name=_("Avatar"))
    birth_date = models.DateField(null=True, blank=True, verbose_name=_("Birth Date"))
    address = models.TextField(blank=True, verbose_name=_("Address"))
    emergency_contact = models.CharField(max_length=150, blank=True, verbose_name=_("Emergency Contact"))
    notes = models.TextField(blank=True, verbose_name=_("Notes"))

    # Work-related
    employee_id = models.CharField(
        max_length=50, blank=True, unique=True, null=True, verbose_name=_("Employee ID")
    )
    hire_date = models.DateField(null=True, blank=True, verbose_name=_("Hire Date"))
    hourly_rate = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True, verbose_name=_("Hourly Rate")
    )
    commission_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=0, verbose_name=_("Commission Rate")
    )

    # Settings
    email_verified = models.BooleanField(default=False, verbose_name=_("Email Verified"))
    phone_verified = models.BooleanField(default=False, verbose_name=_("Phone Verified"))
    two_factor_enabled = models.BooleanField(default=False, verbose_name=_("2FA Enabled"))
    language = models.CharField(max_length=10, default="ru", verbose_name=_("Language"))
    timezone = models.CharField(max_length=50, default="Asia/Almaty", verbose_name=_("Timezone"))

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    class Meta:
        verbose_name = _("User")
        verbose_name_plural = _("Users")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["email", "is_active"]),
            models.Index(fields=["role", "is_active"]),
            models.Index(fields=["last_name", "first_name"]),
        ]

    def __str__(self) -> str:
        return f"{self.get_full_name()} ({self.email})"

    def get_full_name(self) -> str:
        parts = [self.last_name, self.first_name]
        if self.patronymic:
            parts.append(self.patronymic)
        return " ".join(filter(None, parts))

    def get_short_name(self) -> str:
        return self.first_name

    @property
    def is_admin(self) -> bool:
        return self.role == self.Role.ADMIN or self.is_superuser

    @property
    def is_manager(self) -> bool:
        return self.role in [self.Role.ADMIN, self.Role.MANAGER]

    @property
    def is_master(self) -> bool:
        return self.role == self.Role.MASTER


class UserSession(models.Model):
    """Track user sessions for security."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sessions")
    session_key = models.CharField(max_length=40, db_index=True)
    ip_address = models.GenericIPAddressField(null=True)
    user_agent = models.TextField(blank=True)
    device_info = models.CharField(max_length=255, blank=True)
    location = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_activity = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = _("User Session")
        verbose_name_plural = _("User Sessions")
        ordering = ["-created_at"]

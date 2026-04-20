from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from apps.users.models import User, UserSession


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin configuration for User model."""

    list_display = [
        "email",
        "get_full_name",
        "role",
        "is_active",
        "email_verified",
        "last_login",
    ]
    list_filter = ["role", "is_active", "email_verified", "created_at"]
    search_fields = ["email", "first_name", "last_name", "phone", "employee_id"]
    ordering = ["-created_at"]
    readonly_fields = ["created_at", "modified_at", "last_login", "date_joined"]

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            _("Personal info"),
            {
                "fields": (
                    "first_name",
                    "last_name",
                    "patronymic",
                    "phone",
                    "birth_date",
                    "address",
                )
            },
        ),
        (
            _("Work info"),
            {"fields": ("role", "employee_id", "hire_date", "hourly_rate", "commission_rate")},
        ),
        (
            _("Permissions"),
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        (_("Important dates"), {"fields": ("last_login", "date_joined")}),
        (
            _("Additional info"),
            {"fields": ("avatar", "notes", "emergency_contact")},
        ),
        (
            _("Settings"),
            {"fields": ("email_verified", "phone_verified", "two_factor_enabled", "language", "timezone")},
        ),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2", "first_name", "last_name", "role"),
            },
        ),
    )

    @admin.display(description="Full Name")
    def get_full_name(self, obj):
        return obj.get_full_name()


@admin.register(UserSession)
class UserSessionAdmin(admin.ModelAdmin):
    """Admin configuration for UserSession model."""

    list_display = ["user", "ip_address", "device_info", "created_at", "is_active"]
    list_filter = ["is_active", "created_at"]
    search_fields = ["user__email", "ip_address"]
    readonly_fields = ["created_at", "last_activity"]

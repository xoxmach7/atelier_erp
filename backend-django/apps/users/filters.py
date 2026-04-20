import django_filters
from django.db import models

from core.filters import BaseFilter
from apps.users.models import User


class UserFilter(BaseFilter):
    """Filter for users."""

    role = django_filters.ChoiceFilter(choices=User.Role.choices)
    is_verified = django_filters.BooleanFilter(
        field_name="email_verified", method="filter_verified"
    )

    class Meta:
        model = User
        fields = [
            "role",
            "is_active",
            "email_verified",
            "phone_verified",
            "created_at",
        ]

    def filter_search(self, queryset, name, value):
        return queryset.filter(
            models.Q(first_name__icontains=value)
            | models.Q(last_name__icontains=value)
            | models.Q(email__icontains=value)
            | models.Q(phone__icontains=value)
        )

    def filter_verified(self, queryset, name, value):
        if value:
            return queryset.filter(email_verified=True)
        return queryset.filter(email_verified=False)

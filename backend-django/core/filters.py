import django_filters
from django.db import models


class BaseFilter(django_filters.FilterSet):
    """Base filter with common fields."""

    created_after = django_filters.DateTimeFilter(field_name="created_at", lookup_expr="gte")
    created_before = django_filters.DateTimeFilter(field_name="created_at", lookup_expr="lte")
    is_active = django_filters.BooleanFilter()
    search = django_filters.CharFilter(method="filter_search")

    class Meta:
        abstract = True

    def filter_search(self, queryset, name, value):
        """Override in subclass to implement search."""
        return queryset


class UUIDInFilter(django_filters.BaseInFilter, django_filters.UUIDFilter):
    """Filter for multiple UUIDs."""

    pass


class CharInFilter(django_filters.BaseInFilter, django_filters.CharFilter):
    """Filter for multiple char values."""

    pass

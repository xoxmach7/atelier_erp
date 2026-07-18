"""
Фильтры для API v1.

Группы статусов заказа (`status_group`) — то, чем реально пользуется клиент:
восемь технических статусов FSM слишком дробные для фильтр-пилюль в мобилке.
Группировка живёт здесь, на бэке, а не в UI, чтобы веб и мобилка не разъехались
(та же причина, по которой подписи статусов берутся из Order.Status.choices).

Важно: `overdue` — не статус, а производное состояние (дедлайн прошёл, заказ не
закрыт), поэтому пересекается с `in_work`/`waiting`. Это ожидаемо: пилюля
«Просрочен» отвечает на вопрос «что горит», а не «на какой стадии заказ».
"""

import django_filters
from django.utils import timezone

from ...models import Order
# Раскладка групп живёт в status_groups.py — она нужна и фильтрам, и подписям
# статусов в сериализаторах, поэтому вынесена в общий модуль.
from .status_groups import ORDER_STATUS_GROUPS  # noqa: F401  (реэкспорт для обратной совместимости)


class OrderFilterSet(django_filters.FilterSet):
    """Фильтры списка заказов: точный статус + пользовательские группы."""

    status_group = django_filters.CharFilter(method='filter_status_group')

    class Meta:
        model = Order
        fields = ['status', 'customer']

    def filter_status_group(self, queryset, name, value):
        value = (value or '').strip()
        if not value:
            return queryset

        if value == 'overdue':
            today = timezone.localtime(timezone.now()).date()
            return queryset.filter(
                planned_completion__isnull=False,
                planned_completion__lt=today,
            ).exclude(
                status__in=[Order.Status.COMPLETED, Order.Status.CANCELLED]
            )

        statuses = ORDER_STATUS_GROUPS.get(value)
        if statuses is None:
            # Неизвестная группа — пустой результат, а не молчаливый «все».
            return queryset.none()
        return queryset.filter(status__in=statuses)

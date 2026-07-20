"""
Ролевой срез заказов — единственное место, где живёт правило «кто что видит».

Правило было зашито внутри `OrderViewSet.get_queryset`, и из-за этого замеры
оказались шире заказов: `MeasurementViewSet` не сужал выборку по роли вообще,
поэтому швея могла прочитать и отметить галочку на любом замере внутри своего
тенанта — включая заказы, которых нет в её списке. С автопродвижением статусов
(`services/status_automation.py`) ошибочная галочка двигает чужой заказ, так что
это уже не только вопрос дисциплины.

Любая новая вьюха, отдающая данные, привязанные к заказу, должна фильтроваться
через `scope_orders_for_role` / `filter_by_visible_orders`, а не заводить свою
копию раскладки ролей.
"""

from django.db.models import Q
from django.utils import timezone

from ...models import Order
from ...roles import Roles, user_in

# Роль → статусы заказов, которые ей показываются (простые случаи).
# Owner/Designer отсутствуют намеренно: у них полный доступ (см. ROLE_SEES_ALL).
# Warehouse/Seamstress/Installer — «В работе» + просроченные, см.
# `_ACTIVE_OR_OVERDUE_ROLES` и `_active_or_overdue_q` ниже.
ROLE_VISIBLE_STATUSES = {}

# Статусы группы «В работе» (совпадает с IN_WORK-группой из status_groups.py).
_ACTIVE_STATUSES = (
    Order.Status.IN_WORK,
    Order.Status.IN_PRODUCTION,
    Order.Status.READY,
    Order.Status.ON_INSTALLATION,
)

# Роли, у которых пилюли ровно «В работе»/«Просрочен» (2026-07-20, по прямому
# запросу владельца — склад/швея/установщик исторически видели только один
# узкий статус/срез каждая, из-за чего просроченные и уже принятые в работу
# заказы на соседних стадиях выпадали из вида).
_ACTIVE_OR_OVERDUE_ROLES = (Roles.WAREHOUSE, Roles.SEAMSTRESS, Roles.INSTALLER)


def _active_or_overdue_q(prefix=''):
    """
    «В работе» (in_work/in_production/ready/on_installation) плюс любой
    просроченный заказ независимо от статуса — свежий (`new`) или ожидающий
    финальной оплаты заказ роли не нужен, ПОКА он не просрочен, тогда он
    должен всплыть, иначе потеряется из вида для всех исполнителей разом.
    """
    def f(name):
        return f'{prefix}{name}'

    today = timezone.localtime(timezone.now()).date()
    return (
        Q(**{f('status__in'): _ACTIVE_STATUSES})
        | (
            Q(**{f('planned_completion__isnull'): False})
            & Q(**{f('planned_completion__lt'): today})
            & ~Q(**{f('status__in'): [Order.Status.COMPLETED, Order.Status.CANCELLED]})
        )
    )


def scope_orders_for_role(queryset, user):
    """
    Сузить queryset заказов до того, что видно этой роли.

    Пользователь без подходящей группы не видит ничего (default deny).
    Изоляцию по тенанту это НЕ делает — её накладывает вызывающий
    через `scope_to_tenant`.
    """
    if user_in(user, *Roles.FULL_ORDER_ACCESS):
        return queryset

    if user_in(user, *_ACTIVE_OR_OVERDUE_ROLES):
        return queryset.filter(_active_or_overdue_q())

    for role, statuses in ROLE_VISIBLE_STATUSES.items():
        if user_in(user, role):
            return queryset.filter(status__in=statuses)

    return queryset.none()


def filter_by_visible_orders(queryset, user, order_field='order'):
    """
    Сузить queryset объектов, привязанных к заказу (замеры, платежи, фото),
    до заказов, видимых этой роли.

    `order_field` — имя FK на заказ в фильтруемой модели.
    """
    if user_in(user, *Roles.FULL_ORDER_ACCESS):
        return queryset

    if user_in(user, *_ACTIVE_OR_OVERDUE_ROLES):
        return queryset.filter(_active_or_overdue_q(prefix=f'{order_field}__'))

    for role, statuses in ROLE_VISIBLE_STATUSES.items():
        if user_in(user, role):
            return queryset.filter(**{f'{order_field}__status__in': statuses})

    return queryset.none()

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

# Роль → статусы заказов, которые ей показываются.
# Owner/Designer отсутствуют намеренно: у них полный доступ (см. ROLE_SEES_ALL).
# Installer — не простой список статусов, см. `_installer_visible_q` ниже.
ROLE_VISIBLE_STATUSES = {
    Roles.WAREHOUSE: (
        Order.Status.IN_WORK,
        Order.Status.IN_PRODUCTION,
        Order.Status.READY,
    ),
    Roles.SEAMSTRESS: (
        Order.Status.IN_PRODUCTION,
    ),
}

# Статусы группы «В работе» для установщика (совпадает с IN_WORK-группой
# из status_groups.py, минус ON_INSTALLATION погоды не делает — он там есть).
_INSTALLER_ACTIVE_STATUSES = (
    Order.Status.IN_WORK,
    Order.Status.IN_PRODUCTION,
    Order.Status.READY,
    Order.Status.ON_INSTALLATION,
)


def _installer_visible_q(prefix=''):
    """
    Установщик видит ровно то же, что показывают пилюли «В работе» и
    «Просрочен» (2026-07-20, по прямому запросу владельца): свежий (`new`)
    или ожидающий финальной оплаты заказ ему не нужен, ПОКА он не
    просрочен — тогда он должен всплыть, иначе просроченный заказ
    потеряется из виду для всех исполнителей разом.
    """
    def f(name):
        return f'{prefix}{name}'

    today = timezone.localtime(timezone.now()).date()
    return (
        Q(**{f('status__in'): _INSTALLER_ACTIVE_STATUSES})
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

    if user_in(user, Roles.INSTALLER):
        return queryset.filter(_installer_visible_q())

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

    if user_in(user, Roles.INSTALLER):
        return queryset.filter(_installer_visible_q(prefix=f'{order_field}__'))

    for role, statuses in ROLE_VISIBLE_STATUSES.items():
        if user_in(user, role):
            return queryset.filter(**{f'{order_field}__status__in': statuses})

    return queryset.none()

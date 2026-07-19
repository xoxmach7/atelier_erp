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

from ...models import Order
from ...roles import Roles, user_in

# Роль → статусы заказов, которые ей показываются.
# Owner/Designer отсутствуют намеренно: у них полный доступ (см. ROLE_SEES_ALL).
ROLE_VISIBLE_STATUSES = {
    Roles.WAREHOUSE: (
        Order.Status.IN_WORK,
        Order.Status.IN_PRODUCTION,
        Order.Status.READY,
    ),
    Roles.SEAMSTRESS: (
        Order.Status.IN_PRODUCTION,
    ),
    Roles.INSTALLER: (
        Order.Status.READY,
        Order.Status.ON_INSTALLATION,
        Order.Status.WAITING_FINAL_PAYMENT,
    ),
}


def scope_orders_for_role(queryset, user):
    """
    Сузить queryset заказов до того, что видно этой роли.

    Пользователь без подходящей группы не видит ничего (default deny).
    Изоляцию по тенанту это НЕ делает — её накладывает вызывающий
    через `scope_to_tenant`.
    """
    if user_in(user, *Roles.FULL_ORDER_ACCESS):
        return queryset

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

    for role, statuses in ROLE_VISIBLE_STATUSES.items():
        if user_in(user, role):
            return queryset.filter(**{f'{order_field}__status__in': statuses})

    return queryset.none()

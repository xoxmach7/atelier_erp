"""
Группы статусов заказа — ЕДИНСТВЕННЫЙ источник истины.

Восемь технических статусов FSM нужны движку заказа, но наружу показываются
ровно четыре: «В работе», «Ожидание», «Завершён», «Просрочен». Пользователь
других статусов знать не должен — «Новый» или «Ожидает финальной оплаты» в
интерфейсе не появляются.

Раньше подписи расходились: список заказов брал текст из `ui_badge`
(«Новый», «Ожидание оплаты», «Ожидание материалов»), а карточка заказа — сырой
`status_label` («Ожидает финальной оплаты»). Один и тот же заказ показывался
в списке как «Просрочен», а внутри — как «Новый».

`overdue` — не статус, а производное состояние (дедлайн прошёл, заказ не
закрыт), поэтому считается отдельно и перебивает стадию.
"""

from ...models import Order

IN_WORK = 'in_work'
WAITING = 'waiting'
COMPLETED = 'completed'
OVERDUE = 'overdue'

# Группа -> технические статусы FSM.
# Держать синхронным с frontend/src/lib/list-status.ts и
# mobile/src/utils/orderLabels.ts (STATUS_GROUP_LABELS).
ORDER_STATUS_GROUPS = {
    IN_WORK: [
        Order.Status.IN_WORK,
        Order.Status.IN_PRODUCTION,
        Order.Status.READY,
        Order.Status.ON_INSTALLATION,
    ],
    WAITING: [
        Order.Status.NEW,
        Order.Status.WAITING_FINAL_PAYMENT,
    ],
    # Отменённые лежат здесь же: иначе такой заказ не попадает ни в одну
    # пилюлю и виден только в «Все».
    COMPLETED: [
        Order.Status.COMPLETED,
        Order.Status.CANCELLED,
    ],
}

GROUP_LABELS = {
    IN_WORK: 'В работе',
    WAITING: 'Ожидание',
    COMPLETED: 'Завершён',
    OVERDUE: 'Просрочен',
}

# Статус -> группа, развёрнуто один раз на импорте.
_STATUS_TO_GROUP = {
    status: group
    for group, statuses in ORDER_STATUS_GROUPS.items()
    for status in statuses
}


def get_status_group(order) -> str:
    """
    Группа заказа для показа пользователю.

    Просрочка перебивает стадию, но только у незакрытых заказов: завершённый
    заказ с прошедшим дедлайном — «Завершён», а не «Просрочен».
    """
    group = _STATUS_TO_GROUP.get(order.status, IN_WORK)
    if group == COMPLETED:
        return COMPLETED
    return OVERDUE if order.is_overdue else group


def get_status_group_label(order) -> str:
    return GROUP_LABELS[get_status_group(order)]

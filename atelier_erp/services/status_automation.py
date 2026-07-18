"""
Автопродвижение статуса заказа по событиям.

Статусы двигались только руками, поэтому в системе они почти всегда отставали
от реальности: КП одобрено, материалы собраны, пошив закончен — а заказ всё ещё
висит в `new`. Здесь собраны переходы, которые следуют из уже принятого решения
и не требуют отдельного нажатия.

Три свойства, на которых всё держится (см.
docs/superpowers/specs/2026-07-18-status-automation-design.md):

1. Своих правил перехода тут нет. Всё идёт через
   `OrderService.transition_status_mvp` — тот же путь, что у ручных кнопок,
   с теми же инвариантами (одобренный КП, позиции заказа, АВР+фотоотчёт+оплата
   для завершения). Автоматика лишь избавляет от клика там, где переход и так
   был бы разрешён.
2. Автоматика не роняет основную операцию. Приём платежа не должен падать
   из-за того, что заказ нельзя завершить без подписанного АВР, поэтому
   запрещённый переход — это молчаливый no-op, а не исключение.
3. Автопереход отличим от ручного: в историю уходит пометка `[авто]` с причиной.
"""

import logging

from django.db import transaction

from ..models import Order

logger = logging.getLogger(__name__)


def auto_advance(order: Order, target: str, reason: str, changed_by=None) -> bool:
    """
    Попытаться перевести заказ в `target`. Никогда не бросает исключений.

    Возвращает True, если статус действительно изменился.
    """
    if order is None or not target:
        return False

    # Уже там — не пишем лишнюю запись в историю.
    if order.status == target:
        return False

    # Терминальные статусы автоматика не трогает вообще.
    if order.status in (Order.Status.COMPLETED, Order.Status.CANCELLED):
        return False

    # Импорт внутри функции: order_service импортирует модели и сервисы,
    # на уровне модуля это давало бы цикл.
    from .order_service import OrderService

    try:
        with transaction.atomic():
            service = OrderService(unit_of_work=None)
            service.transition_status_mvp(
                order_id=order.id,
                new_status=target,
                changed_by=changed_by,
                notes=f"[авто] {reason}",
            )
    except Exception as exc:
        # Ожидаемый случай: инварианты перехода не выполнены (нет позиций,
        # нет АВР, есть остаток оплаты). Это не ошибка — просто ещё рано.
        logger.info(
            "auto_advance: заказ %s остался в %s (цель %s): %s",
            order.pk, order.status, target, exc,
        )
        return False

    order.refresh_from_db(fields=['status'])
    logger.info("auto_advance: заказ %s -> %s (%s)", order.pk, order.status, reason)
    return True

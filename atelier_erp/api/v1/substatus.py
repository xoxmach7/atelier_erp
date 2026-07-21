"""
Подстатус «Исполнение» для карточки заказа.

Это не статус заказа и не шкала склада, а третья, ролевая величина: ответ на
вопрос «этот заказ сейчас на мне?». Один и тот же заказ одновременно имеет
подстатус для швейного цеха и не имеет для установщика (или наоборот).

Правила (со слов владельца):
  - Швейный цех: появляется (`EXECUTION`), когда склад отметил материалы
    готовыми, и пропадает, когда цех сшил все изделия по заказу.
  - Установщик (2026-07-21, по прямому запросу — раньше был такой же бинарный
    флаг «в исполнении/нет», разбит на 3 стадии): всегда одна из трёх, пока
    заказ вообще виден установщику (видимость сужает role_scope):
      `PREPARATION` — заказ ещё у швеи/склада (не все изделия сшиты),
      `INSTALLATION` — швея отметила все изделия, монтаж можно начинать,
      `DONE` — загружен подписанный АВР.

Считается на бэке, а не в мобилке: зависит от агрегата по замерам и от наличия
акта, которых нет в списочном ответе — на клиенте это стоило бы N+1 запросов.
"""

from django.db.models import Count, Exists, OuterRef, Q

from ...models import Measurement, OrderCompletionAct
from ...constants import MaterialReadiness
from ...roles import Roles, user_in

# Значения, уходящие на клиент. Подписи живут в UI
# (mobile/src/utils/orderLabels.ts).
EXECUTION = 'execution'
PREPARATION = 'preparation'
INSTALLATION = 'installation'
DONE = 'done'


def execution_substatus_annotations() -> dict:
    """
    Аннотации, без которых расчёт подстатуса даёт N+1 на списке заказов.

    Держим их рядом с правилами: если правило поменяется, здесь же видно,
    какие агрегаты для него нужны.
    """
    return {
        'windows_total': Count('measurements', distinct=True),
        'windows_sewn': Count(
            'measurements', filter=Q(measurements__sewing_done=True), distinct=True,
        ),
        'has_completion_act': Exists(
            OrderCompletionAct.objects.filter(order=OuterRef('pk'), is_active=True)
        ),
    }


def get_execution_substatus(order, user) -> str | None:
    """
    Подстатус заказа для конкретного пользователя или None.

    Требует аннотаций из `execution_substatus_annotations()`. Если их нет
    (объект получен в обход аннотированного queryset), считаем по связям —
    медленнее, но не падаем.
    """
    if user is None or not getattr(user, 'is_authenticated', False):
        return None

    is_seamstress = user_in(user, Roles.SEAMSTRESS)
    is_installer = user_in(user, Roles.INSTALLER)
    if not (is_seamstress or is_installer):
        return None

    total = getattr(order, 'windows_total', None)
    sewn = getattr(order, 'windows_sewn', None)
    if total is None or sewn is None:
        total = order.measurements.count()
        sewn = order.measurements.filter(sewing_done=True).count()

    all_sewn = total > 0 and sewn >= total

    if is_seamstress:
        # Заказ без замеров не может быть «в исполнении»: шить нечего.
        if total == 0:
            return None
        materials_ready = order.material_readiness == MaterialReadiness.READY
        return EXECUTION if materials_ready and not all_sewn else None

    # Установщик: всегда одна из трёх стадий — заказ без замеров тоже «в
    # подготовке» (ещё не начат монтаж), а не «нет подстатуса», в отличие от
    # швеи (для неё пустой заказ вообще не в работе).
    has_act = getattr(order, 'has_completion_act', None)
    if has_act is None:
        has_act = OrderCompletionAct.objects.filter(order=order, is_active=True).exists()
    if has_act:
        return DONE
    return INSTALLATION if all_sewn else PREPARATION

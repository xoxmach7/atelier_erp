"""
Атомарная генерация номеров документов: заказы (О-), КП (КП-), задачи (З-).

Раньше номера считались как count()+1 или "последний+1" — это гонка: два
одновременных запроса получали один номер, срабатывал unique-constraint (500)
или появлялись дубли. Здесь номер выдаётся под строковой блокировкой
(select_for_update) на строке NumberSequence(prefix, year), что корректно
сериализует выдачу на PostgreSQL и безопасно на SQLite.

При первой выдаче для (prefix, year) счётчик инициализируется текущим
максимумом из таблицы документов, чтобы не было коллизий с уже существующими
номерами (включая демо-данные).
"""

import re
from datetime import datetime

from django.db import transaction

from atelier_erp.models import NumberSequence, Order, Quote, Task


# kind -> (префикс, модель, поле с номером)
_KINDS = {
    "order": ("О", Order, "order_number"),
    "quote": ("КП", Quote, "quote_number"),
    "task": ("З", Task, "task_number"),
}


def _current_max(model, field, prefix, year):
    """Максимальный уже использованный порядковый номер для (prefix, year)."""
    pattern = re.compile(rf"^{re.escape(prefix)}-{year}-(\d+)$")
    best = 0
    values = model.objects.filter(**{f"{field}__startswith": f"{prefix}-{year}-"}).values_list(field, flat=True)
    for value in values:
        match = pattern.match(value or "")
        if match:
            best = max(best, int(match.group(1)))
    return best


@transaction.atomic
def next_number(kind: str, year: int = None) -> str:
    """Вернуть следующий уникальный номер документа атомарно.

    kind: 'order' | 'quote' | 'task'.
    """
    if kind not in _KINDS:
        raise ValueError(f"Unknown numbering kind: {kind}")
    if year is None:
        year = datetime.now().year

    prefix, model, field = _KINDS[kind]

    # Гарантируем строку счётчика и берём её под блокировку
    seq, _created = NumberSequence.objects.get_or_create(prefix=prefix, year=year)
    seq = NumberSequence.objects.select_for_update().get(pk=seq.pk)

    if seq.last_value == 0:
        # первичная инициализация — продолжаем от существующего максимума
        seq.last_value = _current_max(model, field, prefix, year)

    seq.last_value += 1
    seq.save(update_fields=["last_value", "updated_at"])
    return f"{prefix}-{year}-{seq.last_value:03d}"


def next_order_number(year: int = None) -> str:
    return next_number("order", year)


def next_quote_number(year: int = None) -> str:
    return next_number("quote", year)


def next_task_number(year: int = None) -> str:
    return next_number("task", year)

"""
Списание материалов со склада при формировании позиций заказа (2026-07-21).

До этого изменения остаток склада (InventoryItem.quantity) не уменьшался
никогда — принятие КП никак не влияло на «Свободно» на экране «Материалы».
Списываем при генерации позиций заказа (OrderItemGenerationService), не при
одобрении КП: позиции — это момент, когда заказ реально забирает материал под
себя, а КП можно одобрить и не сформировать позиции (см. project_order_quote
_gotchas в памяти). Источник расхода — Measurement заказа (там же живут
крепление/фурнитура, а не в QuoteItem), а не сам QuoteItem.
"""
from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.db.models.functions import Greatest
from django.utils import timezone

from ..models import InventoryItem, MaterialDeduction, Order, OrderItem


def _deduct(order: Order, item: InventoryItem, quantity: Decimal, order_item: OrderItem = None) -> None:
    if not quantity or quantity <= 0:
        return
    MaterialDeduction.objects.create(
        order=order, order_item=order_item, inventory_item=item, quantity=quantity,
    )
    # Greatest(...— 0) — на InventoryItem висит constraint quantity >= 0;
    # заказ не должен падать из-за нехватки остатка, просто уходит в 0
    # (столбец «Свободно» и так подсвечивает «на исходе»/«0»).
    InventoryItem.objects.filter(pk=item.pk).update(
        quantity=Greatest(F('quantity') - quantity, Decimal('0'))
    )


def deduct_materials_for_order(order: Order) -> None:
    """
    Списывает ткань/тюль (через Fabric.source_item — прямой ссылки замера на
    InventoryItem нет), крепление и фурнитуру (прямые InventoryItem) по всем
    замерам заказа.

    Идемпотентно: если у заказа уже есть активные (не возвращённые) списания,
    повторно не списывает — иначе force=True при регенерации позиций списал
    бы материал ещё раз за тот же заказ.
    """
    if order.material_deductions.filter(reversed_at__isnull=True).exists():
        return

    with transaction.atomic():
        measurements = order.measurements.select_related(
            'curtain_fabric__source_item', 'tulle_fabric__source_item',
            'cornice_item', 'hardware_item',
        )
        # Сопоставление окно -> позиция, та же пара ключей, что и у
        # ItemRow.matchedMeasurement на фронте — нужно, чтобы привязать
        # списание к конкретному OrderItem (см. order_item на модели).
        items_by_window = {
            (it.room_name, it.window_name): it for it in order.items.all()
        }
        for m in measurements:
            order_item = items_by_window.get((m.room_name, m.window_name))
            # quantity — сколько одинаковых изделий по этому окну (повторяющиеся
            # окна не заводят отдельными замерами, а растят количество здесь же,
            # см. project_measurement_write_paths в памяти) — curtain_meters/
            # tulle_meters/cornice_quantity/hardware_quantity расходуются НА
            # ОДНО изделие, поэтому списание обязано умножаться на quantity.
            # Та же логика уже была в window_price_breakdown (quote_calc.py)
            # для цены — здесь её не было вообще, из-за чего окно с quantity=2
            # списывало материал так, будто изделие одно.
            qty = max(1, int(m.quantity or 1))
            if m.curtain_fabric_id and m.curtain_fabric.source_item_id:
                _deduct(order, m.curtain_fabric.source_item, m.curtain_meters * qty, order_item)
            if m.tulle_fabric_id and m.tulle_fabric.source_item_id:
                _deduct(order, m.tulle_fabric.source_item, m.tulle_meters * qty, order_item)
            if m.cornice_item_id:
                _deduct(order, m.cornice_item, m.cornice_quantity * qty, order_item)
            if m.hardware_item_id:
                _deduct(order, m.hardware_item, m.hardware_quantity * qty, order_item)


def return_materials_for_item(order_item: OrderItem) -> None:
    """
    Возвращает на склад списание конкретной позиции (удаление позиции —
    manage_item DELETE). Отдельно от return_materials_for_order: раньше
    удаление ОДНОЙ позиции при других оставшихся в заказе вообще не
    возвращало материал — возврат был завязан только на «в заказе не
    осталось ни одной позиции».
    """
    with transaction.atomic():
        deductions = list(
            order_item.material_deductions.select_for_update().filter(reversed_at__isnull=True)
        )
        for d in deductions:
            InventoryItem.objects.filter(pk=d.inventory_item_id).update(
                quantity=F('quantity') + d.quantity
            )
        MaterialDeduction.objects.filter(
            id__in=[d.id for d in deductions]
        ).update(reversed_at=timezone.now())


def return_materials_for_order(order: Order) -> None:
    """Возвращает на склад все ещё не возвращённые списания заказа (отмена заказа)."""
    with transaction.atomic():
        deductions = list(
            order.material_deductions.select_for_update().filter(reversed_at__isnull=True)
        )
        for d in deductions:
            InventoryItem.objects.filter(pk=d.inventory_item_id).update(
                quantity=F('quantity') + d.quantity
            )
        MaterialDeduction.objects.filter(
            id__in=[d.id for d in deductions]
        ).update(reversed_at=timezone.now())


def adjust_deduction_for_item_quantity(order_item: OrderItem, old_quantity: int, new_quantity: int) -> None:
    """
    Пересчитывает списание конкретной позиции при изменении OrderItem.quantity
    (степпер «Количество» в карточке заказа после КП). Раньше списание
    происходило один раз при генерации позиций и дальше никак не следило за
    изменением количества — увеличение количества «в 2 раза» в интерфейсе не
    списывало со склада ничего дополнительно.

    Считает от старого количества к новому пропорционально (per_unit = текущее
    списание / old_quantity), а не пересчитывает с нуля из замера — так проще
    сохранить консистентность, если материал уже частично не хватало на складе
    (списание было клипнуто на 0 раньше).
    """
    if old_quantity <= 0 or old_quantity == new_quantity:
        return

    with transaction.atomic():
        deductions = list(
            order_item.material_deductions.select_for_update().filter(reversed_at__isnull=True)
        )
        for d in deductions:
            per_unit = d.quantity / old_quantity
            new_amount = (per_unit * new_quantity).quantize(d.quantity)
            delta = new_amount - d.quantity
            if delta == 0:
                continue
            if delta > 0:
                InventoryItem.objects.filter(pk=d.inventory_item_id).update(
                    quantity=Greatest(F('quantity') - delta, Decimal('0'))
                )
            else:
                InventoryItem.objects.filter(pk=d.inventory_item_id).update(
                    quantity=F('quantity') - delta  # delta отрицательный — прибавляем
                )
            d.quantity = new_amount
            d.save(update_fields=['quantity'])

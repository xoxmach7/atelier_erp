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

from ..models import InventoryItem, MaterialDeduction, Order


def _deduct(order: Order, item: InventoryItem, quantity: Decimal) -> None:
    if not quantity or quantity <= 0:
        return
    MaterialDeduction.objects.create(order=order, inventory_item=item, quantity=quantity)
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
        for m in measurements:
            if m.curtain_fabric_id and m.curtain_fabric.source_item_id:
                _deduct(order, m.curtain_fabric.source_item, m.curtain_meters)
            if m.tulle_fabric_id and m.tulle_fabric.source_item_id:
                _deduct(order, m.tulle_fabric.source_item, m.tulle_meters)
            if m.cornice_item_id:
                _deduct(order, m.cornice_item, m.cornice_quantity)
            if m.hardware_item_id:
                _deduct(order, m.hardware_item, m.hardware_quantity)


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

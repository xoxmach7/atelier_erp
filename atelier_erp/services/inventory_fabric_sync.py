"""
Синхронизация InventoryItem (склад) -> Fabric (каталог КП/замеров).

Measurement.curtain_fabric/tulle_fabric — FK на Fabric, а не на
InventoryItem. Экран «Материалы» умеет создавать только InventoryItem
(единая CRUD-форма для ткани/тюля/карниза/фурнитуры/прочего), поэтому без
этой синхронизации добавленная на складе ткань никогда не появлялась бы в
выпадающем списке при создании замера.
"""

import re
from decimal import Decimal, InvalidOperation

from ..models import Fabric, InventoryItem

_HANGER_INVALID = re.compile(r'[^A-Z0-9-]')


def _sanitize_hanger_number(raw: str, fallback_id) -> str:
    """
    hanger_number обязан быть [A-Z0-9-]+ — артикулы на нелатинице (кириллица
    и т.п.) после чистки дают пустую строку. Раньше в этом случае всегда
    подставлялась константа 'MAT': два разных тканевых InventoryItem с
    нелатинскими артикулами схлопывались в один и тот же hanger_number, и
    update_or_create() затирал Fabric-зеркало одного позицией другого.
    Фолбэк на префикс id самой позиции — уникален и стабилен между вызовами
    sync для одного и того же InventoryItem.
    """
    cleaned = _HANGER_INVALID.sub('-', raw.upper()).strip('-')
    if cleaned:
        return cleaned[:50]
    return f"ITM-{str(fallback_id).replace('-', '').upper()[:8]}"


def sync_fabric_from_inventory_item(item: InventoryItem) -> None:
    """Отражает InventoryItem категории «ткань»/«тюль» в Fabric.

    Сопоставление — по `source_item` (прямая ссылка на позицию склада), а не
    по hanger_number: sku позиции может измениться, из-за чего пересчитанный
    hanger_number перестаёт совпадать со старым — раньше это создавало ВТОРУЮ
    Fabric-запись вместо обновления первой (осиротевший дубликат-«призрак»,
    видимый в выпадашке замера, но не на экране «Материалы»). Для записей,
    заведённых до появления `source_item` (легаси-синк по hanger_number),
    первый вызов после апдейта доматчивает их по старому ключу и проставляет
    `source_item`, чтобы не расплодить дубли повторно.

    Остальные категории (карниз, фурнитура, прочее) не участвуют — у них нет
    аналога в Measurement.
    """
    if item.category not in (InventoryItem.Category.FABRIC, InventoryItem.Category.TULLE):
        return

    hanger_number = _sanitize_hanger_number(item.sku or item.name, item.id)
    try:
        stock_meters = Decimal(item.quantity) if item.unit == InventoryItem.Unit.METER else Decimal('0')
    except InvalidOperation:
        stock_meters = Decimal('0')
    try:
        price_per_meter = Decimal(item.price_per_unit)
    except InvalidOperation:
        price_per_meter = Decimal('0')

    category = (
        Fabric.Category.TULLE if item.category == InventoryItem.Category.TULLE
        else Fabric.Category.FABRIC
    )
    defaults = {
        'tenant': item.tenant,
        'hanger_number': hanger_number,
        'name': item.name,
        'category': category,
        'stock_meters': stock_meters,
        'price_per_meter': price_per_meter,
        'is_active': item.is_active,
    }

    fabric = Fabric.objects.filter(source_item=item).first()
    if fabric is None:
        # Легаси-путь: запись существует, но ещё не привязана к своему
        # source_item (заведена до этого поля) — доматчиваем по старому ключу.
        fabric = Fabric.objects.filter(tenant=item.tenant, hanger_number=hanger_number, source_item__isnull=True).first()

    if fabric is not None:
        for field, value in defaults.items():
            setattr(fabric, field, value)
        fabric.source_item = item
        fabric.save()
    else:
        Fabric.objects.create(source_item=item, **defaults)

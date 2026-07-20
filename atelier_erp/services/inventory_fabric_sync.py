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

    Сопоставление — по (tenant, hanger_number), где hanger_number выводится
    из артикула (sku) позиции склада. Остальные категории (карниз,
    фурнитура, прочее) не участвуют — у них нет аналога в Measurement.
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

    Fabric.objects.update_or_create(
        tenant=item.tenant,
        hanger_number=hanger_number,
        defaults={
            'name': item.name,
            'stock_meters': stock_meters,
            'price_per_meter': price_per_meter,
            'is_active': item.is_active,
        },
    )

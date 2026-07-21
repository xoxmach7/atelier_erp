"""
Order Item Generation Service

Handles generation of OrderItems from QuoteItems.
This is a snapshot operation - OrderItems become the execution source of truth.
"""

from typing import Optional, List
from uuid import UUID
from decimal import Decimal

from django.db import transaction

from ..models import Order, OrderItem, Quote, QuoteItem
from .exceptions import OrderValidationError


class OrderItemGenerationService:
    """
    Service for generating OrderItems from QuoteItems.
    
    OrderItem is a snapshot of QuoteItem at the moment of execution start.
    Changes to QuoteItem after generation do NOT affect OrderItem.
    """
    
    # Statuses where automatic generation is allowed
    AUTO_GENERATION_ALLOWED_STATUSES = [
        Order.Status.NEW,
        Order.Status.IN_WORK,
    ]
    
    # Statuses where generation is forbidden
    FORBIDDEN_STATUSES = [
        Order.Status.COMPLETED,
        Order.Status.CANCELLED,
    ]
    
    def __init__(self, user: Optional[UUID] = None):
        self.user = user
    
    def _get_source_quote(self, order: Order, quote: Optional[Quote] = None) -> Optional[Quote]:
        """
        Get APPROVED source quote for order item generation.
        
        Priority:
        1. Explicitly provided quote (must be approved)
        2. order.quote if APPROVED (source quote - when order created from quote)
        3. First APPROVED related_quote (when quote created from order - direct order flow)
        
        Returns None if no approved quote found.
        """
        from ..models import Quote

        if quote:
            # Explicitly provided quote_id может принадлежать другому tenant
            # (Quote не имеет прямого tenant FK, только через order__tenant) —
            # без этой проверки чужой approved-КП можно скопировать в свой заказ.
            if quote.order_id and quote.order.tenant_id != order.tenant_id:
                return None
            # Check if explicitly provided quote is approved
            if quote.status == Quote.Status.APPROVED:
                return quote
            return None
        
        # Check order.quote (source quote) - must be APPROVED
        if order.quote and order.quote.status == Quote.Status.APPROVED:
            return order.quote
        
        # Direct order flow: find first APPROVED related quote
        approved_related = order.related_quotes.filter(status=Quote.Status.APPROVED).first()
        if approved_related:
            return approved_related
        
        return None

    def recalculate_order_total(self, order: Order) -> Decimal:
        """
        Единый пересчёт order.total_amount: сумма позиций + installation_cost/
        delivery_cost/скидка исходного КП (позиции их не несут — это поля
        уровня Quote, не QuoteItem). Единственное место, где считается эта
        формула — используется и после генерации позиций, и после ручного
        редактирования/удаления позиции (views.manage_item), иначе они бы
        разошлись: сумма-без-услуг после правки позиции откатывала бы
        total_amount ниже реальной суммы КП.
        """
        from django.db.models import Sum

        items_sum = order.items.aggregate(s=Sum('total_price'))['s'] or Decimal('0')

        quote = self._get_source_quote(order)
        extras = Decimal('0')
        if quote:
            extras = (
                (quote.installation_cost or Decimal('0'))
                + (quote.delivery_cost or Decimal('0'))
                - (quote.discount_amount or Decimal('0'))
            )

        order.total_amount = items_sum + extras
        order.save(update_fields=['total_amount', 'updated_at'])
        return order.total_amount

    def generate_order_items_from_quote(
        self,
        order: Order,
        quote: Optional[Quote] = None,
        force: bool = False
    ) -> List[OrderItem]:
        """
        Generate OrderItems from QuoteItems.
        
        Args:
            order: Order to generate items for
            quote: Quote to source items from (defaults to order.quote or related_quotes.first())
            force: If True, regenerate even if items exist (with cleanup)
        
        Returns:
            List of created OrderItems
        
        Raises:
            OrderValidationError: If validation fails
        """
        # Validate order status
        if order.status in self.FORBIDDEN_STATUSES:
            raise OrderValidationError(
                f"Cannot generate order items for {order.status} order"
            )
        
        # Check for any linked quote first (for better error messages)
        from ..models import Quote
        has_any_quote = order.quote or order.related_quotes.exists()
        
        # Get source quote (supports both source_quote and related_quotes)
        source_quote = self._get_source_quote(order, quote)
        if not source_quote:
            if has_any_quote:
                raise OrderValidationError(
                    "КП не принят. Сначала примите КП, чтобы сформировать позиции заказа."
                )
            raise OrderValidationError(
                "Order must have a linked quote to generate items"
            )
        
        # Check for existing items
        existing_items = order.items.count()
        if existing_items > 0 and not force:
            raise OrderValidationError(
                f"Order already has {existing_items} items. "
                "Use force=True to regenerate."
            )
        
        # Get quote items
        quote_items = list(source_quote.items.all())
        if not quote_items:
            raise OrderValidationError(
                "Quote has no items to generate from"
            )
        
        # If force mode, delete existing items
        if force and existing_items > 0:
            order.items.all().delete()
        
        # Generate OrderItems
        created_items = []
        for quote_item in quote_items:
            order_item = self._create_order_item_from_quote_item(
                order, quote_item
            )
            created_items.append(order_item)

        # order.total_amount раньше не синхронизировался с суммой КП — заказ
        # так и оставался должен 0 ₸, из-за чего "оплата закрыта" была
        # тривиально истинной и заказ либо завершался без единой оплаты,
        # либо навсегда зависал в on_installation (FSM не пускает туда, где
        # оплата якобы не нужна, но и completed напрямую не даёт).
        if created_items:
            self.recalculate_order_total(order)

        # Списываем со склада материалы по замерам заказа — момент выбран
        # здесь же (формирование позиций), а не при одобрении КП: до этого
        # момента остаток вообще не двигался, хотя владелец видел «Свободно»
        # на экране «Материалы» неизменным после каждого принятого КП.
        # Идемпотентно (см. material_deduction_service) — повторный вызов
        # (force=True) не спишет ещё раз.
        if created_items:
            from .material_deduction_service import deduct_materials_for_order
            deduct_materials_for_order(order)

        # Позиции сформированы из одобренного КП — заказ перестал быть заявкой.
        # Момент выбран именно здесь: FSM пускает в in_work только когда есть
        # и одобренное КП, и позиции, так что раньше переход всё равно не прошёл бы.
        if created_items and order.status == Order.Status.NEW:
            from .status_automation import auto_advance
            auto_advance(order, Order.Status.IN_WORK, "позиции сформированы из КП", self.user)

        return created_items
    
    def _create_order_item_from_quote_item(
        self,
        order: Order,
        quote_item: QuoteItem
    ) -> OrderItem:
        """
        Create a single OrderItem from QuoteItem.

        Maps fields from QuoteItem to OrderItem (snapshot).
        """
        # room_name/window_name раньше НЕ копировались в свои поля модели —
        # оседали только внутри составной строки notes ("комната / окно /
        # тип пошива"). Из-за этого веб не мог сопоставить позицию с исходным
        # замером (сопоставление идёт по room_name+window_name — см.
        # ItemRow.matchedMeasurement), и заголовок позиции в «Позициях» не
        # показывал комнату/окно вовсе (пусто у `item.room_name`/`window_name`).
        description_parts = []
        if quote_item.sewing_type:
            description_parts.append(quote_item.sewing_type)
        if quote_item.complexity:
            description_parts.append(f"Сложность: {quote_item.complexity}")

        description = " / ".join(description_parts)

        # Create OrderItem
        # Only use fields that exist in the OrderItem model
        from decimal import Decimal
        from atelier_erp.models import OrderItem

        # Calculate pricing from line_total or use defaults
        line_total = getattr(quote_item, 'line_total', None) or getattr(quote_item, 'total_price', None) or Decimal("0.00")

        item_type, reference = self._resolve_item_reference(quote_item, description or "Пошив изделия")

        order_item = OrderItem.objects.create(
            order=order,
            item_type=item_type,
            quantity=1,
            unit_price=line_total,
            total_price=line_total,
            room_name=getattr(quote_item, 'room_name', None) or '',
            window_name=getattr(quote_item, 'window_name', None) or '',
            sewing_type=getattr(quote_item, 'sewing_type', None) or '',
            window_width_cm=getattr(quote_item, 'window_width_cm', None),
            window_height_cm=getattr(quote_item, 'window_height_cm', None),
            notes=description,
            **reference,
        )

        return order_item

    def _resolve_item_reference(self, quote_item: QuoteItem, description: str) -> tuple:
        """
        Определить тип позиции заказа и ссылку под него.

        Раньше тип был захардкожен как 'fabric' с `fabric=quote_item.fabric`.
        Для строки КП без ткани (чистая услуга — установка электрокарниза,
        демонтаж, доставка) это роняло генерацию позиций на constraint
        `orderitem_valid_reference`, который требует ровно одну ссылку,
        соответствующую item_type.

        Приоритет: ткань → карниз → услуга. Строка с тканью и карнизом
        одновременно остаётся тканевой, как и было.
        """
        fabric = getattr(quote_item, 'fabric', None)
        if fabric:
            return 'fabric', {'fabric': fabric}

        cornice = getattr(quote_item, 'cornice', None)
        if cornice:
            return 'cornice', {'cornice': cornice}

        return 'service', {'service': self._resolve_service(quote_item, description)}

    def _resolve_service(self, quote_item: QuoteItem, description: str):
        """
        Подобрать запись справочника услуг для сервисной позиции.

        У QuoteItem нет ссылки на Service (только цены `installation_price` /
        `additional_services_total`), поэтому опираемся на `sewing_type` как на
        название услуги. Справочная запись здесь — это ярлык: реальная цена
        лежит на самой позиции заказа (unit_price/total_price), поэтому
        `price_per_unit` у автосозданной записи нулевой и не искажает прайс.
        """
        from atelier_erp.models import Service

        name = (getattr(quote_item, 'sewing_type', None) or '').strip() or 'Услуга по КП'
        service, _ = Service.objects.get_or_create(
            name=name,
            defaults={
                'unit': 'window',
                'price_per_unit': Decimal('0.00'),
                'description': description,
            },
        )
        return service
    
    def can_auto_generate(self, order: Order) -> bool:
        """
        Check if automatic generation is allowed for this order status.
        """
        return order.status in self.AUTO_GENERATION_ALLOWED_STATUSES
    
    def validate_for_generation(
        self,
        order: Order,
        quote: Optional[Quote] = None
    ) -> dict:
        """
        Validate if generation is possible without performing it.
        
        Returns:
            dict with 'valid' (bool) and 'reason' (str if not valid)
        """
        # Check status
        if order.status in self.FORBIDDEN_STATUSES:
            return {
                'valid': False,
                'reason': f"Cannot generate items for {order.status} order"
            }
        
        # Check quote approval (supports both source_quote and related_quotes)
        from ..models import Quote
        
        # Check if any linked quote exists
        has_linked_quote = order.quote or order.related_quotes.exists()
        if not has_linked_quote:
            return {
                'valid': False,
                'reason': "Order has no linked quote"
            }
        
        # Check for APPROVED quote
        source_quote = self._get_source_quote(order, quote)
        if not source_quote:
            return {
                'valid': False,
                'reason': "КП не принят. Сначала примите КП, чтобы сформировать позиции заказа."
            }
        
        # Check quote items
        if not source_quote.items.exists():
            return {
                'valid': False,
                'reason': "Quote has no items"
            }
        
        # Check existing items
        existing_count = order.items.count()
        if existing_count > 0:
            return {
                'valid': False,
                'reason': f"Order already has {existing_count} items. Use force regenerate."
            }
        
        return {'valid': True, 'reason': None}

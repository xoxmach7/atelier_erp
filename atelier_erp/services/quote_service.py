"""
Quote Service
Commercial proposal generation and management
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4

from django.utils import timezone

from ..models import Quote, QuoteItem, Task, Fabric, Cornice, Customer
from ..constants import SewingRates, MeasurementConfig, GatheringRatios
from .exceptions import QuoteNotFoundError, QuoteServiceError, QuoteExpiredError, QuoteNotApprovedError


class QuoteService:
    """
    Service for creating and managing commercial proposals (quotes).
    Handles material calculations, pricing, and PDF generation.
    """
    
    def __init__(self, unit_of_work):
        self.uow = unit_of_work
    
    def create_quote(
        self,
        task_id: UUID,
        customer_id: UUID,
        items: List[Dict[str, Any]],
        quote_number: str,
        installation_cost: Decimal = Decimal('0'),
        delivery_cost: Decimal = Decimal('0'),
        discount_amount: Decimal = Decimal('0'),
        prepayment_percent: Decimal = Decimal('0.5'),
        valid_days: int = 7,
        created_by: Optional[UUID] = None
    ) -> Quote:
        """
        Create new quote with calculated items.
        
        Args:
            task_id: Associated task
            customer_id: Customer to quote
            items: List of calculated items
            quote_number: Unique quote number (КП-YYYY-NNN)
            installation_cost: Installation fee
            delivery_cost: Delivery fee
            discount_amount: Discount to apply
            prepayment_percent: Required prepayment %
            valid_days: Days quote is valid
            created_by: User creating quote
        
        Returns:
            Created Quote
        """
        # Validate task and customer
        try:
            task = Task.objects.get(pk=task_id)
        except Task.DoesNotExist:
            raise QuoteServiceError(f"Task {task_id} not found")
        
        try:
            customer = Customer.objects.get(pk=customer_id)
        except Customer.DoesNotExist:
            raise QuoteServiceError(f"Customer {customer_id} not found")
        
        # Calculate totals
        subtotal = sum(item.get('line_total', Decimal('0')) for item in items)
        
        # Validate discount
        if discount_amount > subtotal:
            raise QuoteServiceError("Discount cannot exceed subtotal")
        
        total = subtotal + installation_cost + delivery_cost - discount_amount
        
        # Create quote
        valid_until = timezone.now().date() + timedelta(days=valid_days)
        
        quote = Quote.objects.create(
            quote_number=quote_number,
            task=task,
            customer=customer,
            status=Quote.Status.DRAFT,
            subtotal=subtotal,
            discount_amount=discount_amount,
            installation_cost=installation_cost,
            delivery_cost=delivery_cost,
            total=total,
            prepayment_percent=prepayment_percent,
            valid_until=valid_until,
            created_by_id=created_by
        )
        
        # Create quote items
        for item_data in items:
            QuoteItem.objects.create(
                quote=quote,
                room_name=item_data.get('room_name', ''),
                window_width_cm=item_data.get('window_width_cm', 0),
                window_height_cm=item_data.get('window_height_cm', 0),
                folds_count=item_data.get('folds_count', 0),
                fabric_id=item_data.get('fabric_id'),
                fabric_meters=item_data.get('fabric_meters', Decimal('0')),
                fabric_cost=item_data.get('fabric_cost', Decimal('0')),
                sewing_type=item_data.get('sewing_type', ''),
                complexity=item_data.get('complexity', 'medium'),
                sewing_cost=item_data.get('sewing_cost', Decimal('0')),
                accessories_cost=item_data.get('accessories_cost', Decimal('0')),
                cornice_id=item_data.get('cornice_id'),
                cornice_cost=item_data.get('cornice_cost', Decimal('0')),
                line_total=item_data.get('line_total', Decimal('0'))
            )
        
        return quote
    
    def calculate_line_item(
        self,
        room_name: str,
        window_width_cm: int,
        window_height_cm: int,
        fabric_id: UUID,
        sewing_type: str = 'curtain',
        complexity: str = 'medium',
        folds_count: int = 0,
        cornice_id: Optional[UUID] = None,
        accessories_cost: Decimal = Decimal('2500')
    ) -> Dict[str, Any]:
        """
        Calculate single line item for quote.
        
        Returns:
            Dict with all calculated fields
        """
        try:
            fabric = Fabric.objects.get(pk=fabric_id)
        except Fabric.DoesNotExist:
            raise QuoteServiceError(f"Fabric {fabric_id} not found")
        
        # Calculate fabric needed
        fabric_width_cm = fabric.width_cm or MeasurementConfig.STANDARD_FABRIC_WIDTH_CM
        gathering_ratio = GatheringRatios.get_ratio(sewing_type)
        
        # Calculate panels needed
        panels = max(1, (window_width_cm / fabric_width_cm))
        
        # Height with hems
        height_with_hems = window_height_cm + MeasurementConfig.TOTAL_HEM_CM
        
        # Base meters
        base_meters = Decimal(height_with_hems * panels / 100)
        
        # Add fold allowance
        if folds_count > 0:
            base_meters *= Decimal(1 + (folds_count * 0.02))
        
        # Round to 0.1m
        fabric_meters = Decimal(int(base_meters * 10)) / 10
        
        # Calculate costs
        fabric_cost = fabric_meters * fabric.price_per_meter
        
        sewing_rate = SewingRates.get_rate(complexity)
        sewing_cost = fabric_meters * sewing_rate
        
        # Cornice cost
        cornice_cost = Decimal('0')
        if cornice_id:
            try:
                cornice = Cornice.objects.get(pk=cornice_id)
                cornice_cost = cornice.price
            except Cornice.DoesNotExist:
                pass
        
        # Total
        line_total = fabric_cost + sewing_cost + accessories_cost + cornice_cost
        
        return {
            'room_name': room_name,
            'window_width_cm': window_width_cm,
            'window_height_cm': window_height_cm,
            'folds_count': folds_count,
            'fabric_id': fabric_id,
            'fabric_meters': fabric_meters,
            'fabric_cost': fabric_cost,
            'sewing_type': sewing_type,
            'complexity': complexity,
            'sewing_cost': sewing_cost,
            'accessories_cost': accessories_cost,
            'cornice_id': cornice_id,
            'cornice_cost': cornice_cost,
            'line_total': line_total
        }
    
    def send_quote(self, quote_id: UUID, sent_by: Optional[UUID] = None) -> Quote:
        """
        Mark quote as sent to customer.
        """
        quote = self._get_quote_for_update(quote_id)
        
        if quote.status != Quote.Status.DRAFT:
            raise QuoteServiceError(f"Cannot send quote in status {quote.status}")
        
        quote.status = Quote.Status.SENT
        quote.save(update_fields=['status', 'updated_at'])
        
        return quote
    
    def approve_quote(
        self,
        quote_id: UUID,
        approved_by_customer: bool = True
    ) -> Quote:
        """
        Mark quote as approved by customer.
        
        INVARIANT: Quote must be in SENT status.
        INVARIANT: Quote must not be expired.
        """
        quote = self._get_quote_for_update(quote_id)
        
        # Check status
        if quote.status not in (Quote.Status.SENT, Quote.Status.DRAFT):
            raise QuoteNotApprovedError(f"Quote must be sent before approval, current status: {quote.status}")
        
        # Check expiration
        if quote.valid_until and quote.valid_until < timezone.now().date():
            quote.status = Quote.Status.EXPIRED
            quote.save(update_fields=['status', 'updated_at'])
            raise QuoteExpiredError(f"Quote expired on {quote.valid_until}")
        
        quote.status = Quote.Status.APPROVED
        quote.save(update_fields=['status', 'updated_at'])
        
        return quote
    
    def reject_quote(
        self,
        quote_id: UUID,
        reason: str = ""
    ) -> Quote:
        """
        Mark quote as rejected by customer.
        """
        quote = self._get_quote_for_update(quote_id)
        
        if quote.status not in (Quote.Status.SENT, Quote.Status.DRAFT):
            raise QuoteServiceError(f"Cannot reject quote in status {quote.status}")
        
        quote.status = Quote.Status.REJECTED
        quote.save(update_fields=['status', 'updated_at'])
        
        return quote
    
    def revise_quote(
        self,
        quote_id: UUID,
        items: List[Dict[str, Any]],
        installation_cost: Optional[Decimal] = None,
        delivery_cost: Optional[Decimal] = None,
        discount_amount: Optional[Decimal] = None,
        revised_by: Optional[UUID] = None
    ) -> Quote:
        """
        Create revised version of quote.
        Original quote marked as rejected, new quote created.
        """
        old_quote = self._get_quote_for_update(quote_id)
        
        # Mark old as rejected
        old_quote.status = Quote.Status.REJECTED
        old_quote.save(update_fields=['status', 'updated_at'])
        
        # Generate new quote number
        new_number = self._generate_quote_number()
        
        # Create new quote with updated values
        new_quote = self.create_quote(
            task_id=old_quote.task_id,
            customer_id=old_quote.customer_id,
            items=items,
            quote_number=new_number,
            installation_cost=installation_cost if installation_cost is not None else old_quote.installation_cost,
            delivery_cost=delivery_cost if delivery_cost is not None else old_quote.delivery_cost,
            discount_amount=discount_amount if discount_amount is not None else old_quote.discount_amount,
            prepayment_percent=old_quote.prepayment_percent,
            valid_days=7,
            created_by=revised_by
        )
        
        return new_quote
    
    def check_expired_quotes(self) -> int:
        """
        Background task: Mark expired quotes.
        
        Returns:
            Number of quotes marked as expired
        """
        today = timezone.now().date()
        
        expired = Quote.objects.filter(
            status__in=[Quote.Status.SENT, Quote.Status.DRAFT],
            valid_until__lt=today
        ).update(status=Quote.Status.EXPIRED)
        
        return expired
    
    def create_quote_for_order(
        self,
        order_id: UUID,
        items: List[Dict[str, Any]],
        quote_number: str,
        installation_cost: Decimal = Decimal('0'),
        delivery_cost: Decimal = Decimal('0'),
        discount_amount: Decimal = Decimal('0'),
        prepayment_percent: Decimal = Decimal('0.5'),
        valid_until: Optional[date] = None,
        created_by: Optional[UUID] = None
    ) -> Quote:
        """
        Create quote linked to an existing order (direct order flow).
        """
        from ..models import Order
        try:
            order = Order.objects.select_related('customer').get(pk=order_id)
        except Order.DoesNotExist:
            raise QuoteServiceError(f"Order {order_id} not found")

        customer = order.customer

        subtotal = sum(item.get('line_total', Decimal('0')) for item in items)

        if discount_amount > subtotal:
            raise QuoteServiceError("Discount cannot exceed subtotal")

        total = subtotal + installation_cost + delivery_cost - discount_amount

        if valid_until is None:
            valid_until = timezone.now().date() + timedelta(days=7)

        quote = Quote.objects.create(
            quote_number=quote_number,
            task=None,
            customer=customer,
            order=order,
            status=Quote.Status.DRAFT,
            subtotal=subtotal,
            discount_amount=discount_amount,
            installation_cost=installation_cost,
            delivery_cost=delivery_cost,
            total=total,
            prepayment_percent=prepayment_percent,
            valid_until=valid_until,
            created_by_id=created_by
        )

        for item_data in items:
            QuoteItem.objects.create(
                quote=quote,
                room_name=item_data.get('room_name', ''),
                window_name=item_data.get('window_name', ''),
                window_width_cm=item_data.get('window_width_cm', 0),
                window_height_cm=item_data.get('window_height_cm', 0),
                fabric_id=item_data.get('fabric_id'),
                fabric_meters=item_data.get('fabric_meters', Decimal('0')),
                fabric_cost=item_data.get('fabric_cost', Decimal('0')),
                tulle_fabric_id=item_data.get('tulle_fabric_id'),
                tulle_meters=item_data.get('tulle_meters', Decimal('0')),
                tulle_cost=item_data.get('tulle_cost', Decimal('0')),
                sewing_type=item_data.get('sewing_type', ''),
                sewing_cost=item_data.get('sewing_cost', Decimal('0')),
                installation_price=item_data.get('installation_price', Decimal('0')),
                accessories_cost=item_data.get('accessories_cost', Decimal('0')),
                line_total=item_data.get('line_total', Decimal('0'))
            )

        return quote

    def update_quote(
        self,
        quote_id: UUID,
        items: Optional[List[Dict[str, Any]]] = None,
        installation_cost: Optional[Decimal] = None,
        delivery_cost: Optional[Decimal] = None,
        discount_amount: Optional[Decimal] = None,
        prepayment_percent: Optional[Decimal] = None,
        valid_until: Optional[date] = None,
        updated_by: Optional[UUID] = None
    ) -> Quote:
        """
        Update existing quote and recalculate totals.
        If items provided, replaces all existing items.
        """
        quote = self._get_quote_for_update(quote_id)

        if quote.status not in (Quote.Status.DRAFT, Quote.Status.SENT):
            raise QuoteServiceError(f"Cannot update quote in status {quote.status}")

        if items is not None:
            quote.items.all().delete()
            for item_data in items:
                QuoteItem.objects.create(
                    quote=quote,
                    room_name=item_data.get('room_name', ''),
                    window_name=item_data.get('window_name', ''),
                    window_width_cm=item_data.get('window_width_cm', 0),
                    window_height_cm=item_data.get('window_height_cm', 0),
                    fabric_id=item_data.get('fabric_id'),
                    fabric_meters=item_data.get('fabric_meters', Decimal('0')),
                    fabric_cost=item_data.get('fabric_cost', Decimal('0')),
                    tulle_fabric_id=item_data.get('tulle_fabric_id'),
                    tulle_meters=item_data.get('tulle_meters', Decimal('0')),
                    tulle_cost=item_data.get('tulle_cost', Decimal('0')),
                    sewing_type=item_data.get('sewing_type', ''),
                    sewing_cost=item_data.get('sewing_cost', Decimal('0')),
                    installation_price=item_data.get('installation_price', Decimal('0')),
                    accessories_cost=item_data.get('accessories_cost', Decimal('0')),
                    line_total=item_data.get('line_total', Decimal('0'))
                )

        if installation_cost is not None:
            quote.installation_cost = installation_cost
        if delivery_cost is not None:
            quote.delivery_cost = delivery_cost
        if discount_amount is not None:
            quote.discount_amount = discount_amount
        if prepayment_percent is not None:
            quote.prepayment_percent = prepayment_percent
        if valid_until is not None:
            quote.valid_until = valid_until

        # Recalculate totals
        subtotal = sum(item.line_total for item in quote.items.all())
        quote.subtotal = subtotal

        if quote.discount_amount > subtotal:
            raise QuoteServiceError("Discount cannot exceed subtotal")

        quote.total = subtotal + quote.installation_cost + quote.delivery_cost - quote.discount_amount
        quote.save(update_fields=[
            'subtotal', 'total', 'installation_cost', 'delivery_cost',
            'discount_amount', 'prepayment_percent', 'valid_until',
            'updated_at'
        ])

        return quote

    def generate_pdf(self, quote_id: UUID, media_root: str = '') -> str:
        """
        Generate PDF for quote using weasyprint.
        Returns path to generated PDF file.
        """
        try:
            from weasyprint import HTML, CSS
        except ImportError:
            raise QuoteServiceError(
                "weasyprint is not installed. Run: pip install weasyprint"
            )

        try:
            quote = Quote.objects.select_related('customer', 'order').prefetch_related('items').get(pk=quote_id)
        except Quote.DoesNotExist:
            raise QuoteNotFoundError(f"Quote {quote_id} not found")

        # Build HTML
        items_rows = ""
        for item in quote.items.all():
            items_rows += f"""
            <tr>
                <td>{item.room_name}</td>
                <td>{item.window_name or '-'}</td>
                <td>{item.window_width_cm}×{item.window_height_cm}</td>
                <td>{item.fabric_meters or '-'} м</td>
                <td>{item.fabric_cost or '-'}</td>
                <td>{item.sewing_cost or '-'}</td>
                <td>{item.installation_price or '-'}</td>
                <td><strong>{item.line_total}</strong></td>
            </tr>
            """

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                @page {{ size: A4; margin: 2cm; }}
                body {{ font-family: 'DejaVu Sans', sans-serif; font-size: 11pt; color: #333; }}
                h1 {{ font-size: 18pt; text-align: center; margin-bottom: 8px; }}
                .subtitle {{ text-align: center; color: #666; margin-bottom: 24px; }}
                .info {{ margin-bottom: 16px; }}
                .info-row {{ display: flex; justify-content: space-between; margin-bottom: 4px; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
                th, td {{ border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-size: 10pt; }}
                th {{ background: #f5f5f5; font-weight: 600; }}
                .total-section {{ margin-top: 20px; text-align: right; }}
                .total-section p {{ margin: 4px 0; }}
                .total {{ font-size: 14pt; font-weight: bold; margin-top: 8px; }}
                .stamp {{ margin-top: 40px; font-size: 9pt; color: #888; text-align: center; }}
            </style>
        </head>
        <body>
            <h1>Коммерческое предложение</h1>
            <p class="subtitle">№ {quote.quote_number}</p>

            <div class="info">
                <div class="info-row"><span>Клиент:</span> <strong>{quote.customer.full_name}</strong></div>
                <div class="info-row"><span>Телефон:</span> {quote.customer.phone or '-'}</div>
                {f'<div class="info-row"><span>Заказ:</span> {quote.order.order_number}</div>' if quote.order else ''}
                <div class="info-row"><span>Дата:</span> {timezone.now().strftime('%d.%m.%Y')}</div>
                <div class="info-row"><span>Срок действия:</span> {quote.valid_until.strftime('%d.%m.%Y') if quote.valid_until else '-'}</div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Комната</th>
                        <th>Окно</th>
                        <th>Размеры, см</th>
                        <th>Ткань, м</th>
                        <th>Ткань, ₽</th>
                        <th>Пошив, ₽</th>
                        <th>Монтаж, ₽</th>
                        <th>Итого, ₽</th>
                    </tr>
                </thead>
                <tbody>
                    {items_rows or '<tr><td colspan="8" style="text-align:center;">Нет позиций</td></tr>'}
                </tbody>
            </table>

            <div class="total-section">
                <p>Подытог: {quote.subtotal} ₽</p>
                {f'<p>Скидка: -{quote.discount_amount} ₽</p>' if quote.discount_amount else ''}
                {f'<p>Доставка: +{quote.delivery_cost} ₽</p>' if quote.delivery_cost else ''}
                {f'<p>Монтаж: +{quote.installation_cost} ₽</p>' if quote.installation_cost else ''}
                <p class="total">Итого: {quote.total} ₽</p>
                <p>Предоплата ({int(quote.prepayment_percent * 100)}%): {quote.total * quote.prepayment_percent} ₽</p>
            </div>

            <div class="stamp">
                Документ сформирован автоматически из системы Atelier ERP
            </div>
        </body>
        </html>
        """

        import os
        pdf_dir = os.path.join(media_root, 'quotes')
        os.makedirs(pdf_dir, exist_ok=True)
        pdf_path = os.path.join(pdf_dir, f'{quote_id}.pdf')

        HTML(string=html_content).write_pdf(pdf_path)

        quote.pdf_generated = True
        quote.pdf_url = f'/media/quotes/{quote_id}.pdf'
        quote.save(update_fields=['pdf_generated', 'pdf_url', 'updated_at'])

        return pdf_path

    def get_quote_summary(self, quote_id: UUID) -> Dict[str, Any]:
        """
        Get summary of quote for display.
        """
        try:
            quote = Quote.objects.prefetch_related('items').get(pk=quote_id)
        except Quote.DoesNotExist:
            raise QuoteNotFoundError(f"Quote {quote_id} not found")

        return {
            'quote_number': quote.quote_number,
            'status': quote.status,
            'customer_name': quote.customer.full_name,
            'items_count': quote.items.count(),
            'subtotal': quote.subtotal,
            'discount': quote.discount_amount,
            'installation': quote.installation_cost,
            'delivery': quote.delivery_cost,
            'total': quote.total,
            'prepayment_required': quote.total * quote.prepayment_percent,
            'valid_until': quote.valid_until,
            'is_expired': quote.valid_until and quote.valid_until < timezone.now().date()
        }

    # ============================================
    # HELPER METHODS
    # ============================================
    
    def _get_quote_for_update(self, quote_id: UUID) -> Quote:
        """Get quote with lock"""
        try:
            return Quote.objects.select_for_update().get(pk=quote_id)
        except Quote.DoesNotExist:
            raise QuoteNotFoundError(f"Quote {quote_id} not found")
    
    def _generate_quote_number(self) -> str:
        """Generate unique quote number КП-YYYY-NNN"""
        import re
        from datetime import datetime
        
        year = datetime.now().year
        
        latest = Quote.objects.filter(
            quote_number__regex=f'^КП-{year}-\\d{{3}}$'
        ).order_by('-quote_number').first()
        
        if latest:
            match = re.match(rf'^КП-{year}-(\d{{3}})$', latest.quote_number)
            if match:
                seq = int(match.group(1)) + 1
            else:
                seq = 1
        else:
            seq = 1
        
        return f"КП-{year}-{seq:03d}"

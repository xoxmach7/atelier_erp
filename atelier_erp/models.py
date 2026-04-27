"""
Atelier ERP - Production Django Models
Optimized for 100k+ orders with proper indexing and constraints.
"""

import uuid
from decimal import Decimal

from django.conf import settings
from .constants import SupplyMode, MaterialReadiness
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator
from django.db import models
from django.db.models import CheckConstraint, Q, UniqueConstraint, Index
from django.utils.translation import gettext_lazy as _


# ============================================
# SHARED ABSTRACT MODELS
# ============================================

class TimestampedModel(models.Model):
    """Abstract base with created_at and updated_at"""
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        abstract = True


class AuditedModel(TimestampedModel):
    """Adds audit fields for created_by/updated_by"""
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_created',
        db_index=True
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_updated',
        db_index=True
    )
    
    class Meta:
        abstract = True


class UUIDModel(models.Model):
    """UUID primary key"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    class Meta:
        abstract = True


# ============================================
# CUSTOMER CONTEXT
# ============================================

class Customer(UUIDModel, TimestampedModel):
    """Customer aggregate - normalized contact info"""
    
    full_name = models.CharField(max_length=255, db_index=True)
    phone = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        validators=[RegexValidator(
            regex=r'^\+?[\d\s-]{10,20}$',
            message='Phone must be 10-20 digits'
        )]
    )
    email = models.EmailField(blank=True, null=True, db_index=True)
    address_city = models.CharField(max_length=100, blank=True, db_index=True)
    address_street = models.CharField(max_length=255, blank=True)
    address_building = models.CharField(max_length=50, blank=True)
    address_apartment = models.CharField(max_length=50, blank=True)
    address_notes = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    
    # Soft delete support
    is_active = models.BooleanField(default=True, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'customers'
        ordering = ['-created_at']
        indexes = [
            Index(fields=['full_name', 'phone'], name='idx_customer_name_phone'),
            Index(fields=['is_active', 'created_at'], name='idx_customer_active_created'),
        ]
        verbose_name = 'Customer'
        verbose_name_plural = 'Customers'
    
    def __str__(self):
        return f"{self.full_name} ({self.phone})"


# ============================================
# INVENTORY CONTEXT
# ============================================

class Fabric(UUIDModel, AuditedModel):
    """Fabric inventory aggregate with reservation tracking"""
    
    hanger_number = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        validators=[RegexValidator(
            regex=r'^[A-Z0-9-]{1,50}$',
            message='Hanger number must be alphanumeric uppercase'
        )]
    )
    name = models.CharField(max_length=255, db_index=True)
    composition = models.CharField(max_length=255, blank=True)
    width_cm = models.PositiveIntegerField(null=True, blank=True, validators=[MaxValueValidator(500)])
    
    # Stock tracking
    stock_meters = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0'),
        validators=[MinValueValidator(Decimal('0'))],
        db_index=True
    )
    reserved_meters = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0'),
        validators=[MinValueValidator(Decimal('0'))]
    )
    
    # Pricing
    price_per_meter = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0'))])
    
    # Attributes
    color = models.CharField(max_length=100, blank=True, db_index=True)
    pattern = models.CharField(max_length=100, blank=True, db_index=True)
    supplier = models.CharField(max_length=255, blank=True, db_index=True)
    location = models.CharField(max_length=50, blank=True, db_index=True)
    
    # Soft delete
    is_active = models.BooleanField(default=True, db_index=True)
    
    class Meta:
        db_table = 'fabrics'
        ordering = ['-created_at']
        indexes = [
            Index(fields=['is_active', 'color'], name='idx_fabric_active_color'),
            Index(fields=['supplier', 'created_at'], name='idx_fabric_supplier'),
            Index(fields=['stock_meters', 'is_active'], name='idx_fabric_stock'),
        ]
        constraints = [
            CheckConstraint(
                check=Q(stock_meters__gte=Decimal('0')),
                name='fabric_stock_non_negative'
            ),
            CheckConstraint(
                check=Q(reserved_meters__lte=models.F('stock_meters')),
                name='fabric_reserved_not_exceed_stock'
            ),
        ]
        verbose_name = 'Fabric'
        verbose_name_plural = 'Fabrics'
    
    def __str__(self):
        return f"{self.hanger_number} - {self.name}"
    
    @property
    def available_meters(self):
        return self.stock_meters - self.reserved_meters


class FabricReservation(UUIDModel, AuditedModel):
    """Fabric reservation within inventory context"""
    
    class Status(models.TextChoices):
        ACTIVE = 'active', _('Active')
        CONVERTED = 'converted', _('Converted to Order')
        CANCELLED = 'cancelled', _('Cancelled')
        EXPIRED = 'expired', _('Expired')
    
    fabric = models.ForeignKey(
        Fabric,
        on_delete=models.PROTECT,
        related_name='reservations',
        db_index=True
    )
    task = models.ForeignKey(
        'Task',
        on_delete=models.CASCADE,
        related_name='fabric_reservations',
        db_index=True,
        null=True,
        blank=True
    )
    reserved_meters = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.1'))]
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True
    )
    
    # TTL
    reserved_at = models.DateTimeField(auto_now_add=True, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    
    # Conversion tracking
    converted_to_order = models.ForeignKey(
        'Order',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='converted_reservations'
    )
    converted_at = models.DateTimeField(null=True, blank=True)
    
    # Cancellation
    cancelled_reason = models.TextField(blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'fabric_reservations'
        ordering = ['-reserved_at']
        indexes = [
            Index(fields=['status', 'expires_at'], name='idx_reserv_status_expires'),
            Index(fields=['fabric', 'status'], name='idx_reserv_fabric_status'),
            Index(fields=['task', 'status'], name='idx_reserv_task_status'),
        ]
        constraints = [
            CheckConstraint(
                check=Q(reserved_meters__gt=Decimal('0')),
                name='reservation_positive_amount'
            ),
        ]
        verbose_name = 'Fabric Reservation'
        verbose_name_plural = 'Fabric Reservations'


class Cornice(UUIDModel, AuditedModel):
    """Cornice (curtain rod) inventory"""
    
    sku = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        validators=[RegexValidator(
            regex=r'^[A-Z0-9-]{3,50}$',
            message='SKU must be alphanumeric uppercase, 3-50 chars'
        )]
    )
    name = models.CharField(max_length=255, db_index=True)
    type = models.CharField(max_length=100, db_index=True)  # ceiling, wall, electric
    material = models.CharField(max_length=100, blank=True, db_index=True)
    color = models.CharField(max_length=100, blank=True, db_index=True)
    length_cm = models.PositiveIntegerField(null=True, blank=True)
    max_load_kg = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    
    # Stock
    stock_count = models.PositiveIntegerField(default=0, db_index=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0'))])
    
    supplier = models.CharField(max_length=255, blank=True, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    
    class Meta:
        db_table = 'cornices'
        ordering = ['-created_at']
        indexes = [
            Index(fields=['type', 'material'], name='idx_cornice_type_mat'),
            Index(fields=['is_active', 'stock_count'], name='idx_cornice_active_stock'),
        ]
        verbose_name = 'Cornice'
        verbose_name_plural = 'Cornices'


class Service(models.Model):
    """Services (sewing, installation) - static dictionary"""
    
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True)
    unit = models.CharField(max_length=50)  # meter, piece, window
    price_per_unit = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'services'
        ordering = ['name']
        verbose_name = 'Service'
        verbose_name_plural = 'Services'


# ============================================
# ORDER CONTEXT (Core Domain)
# ============================================

class Order(UUIDModel, AuditedModel):
    """Order aggregate root - the core entity"""
    
    class Status(models.TextChoices):
        # Approved MVP Order Status Model
        NEW = 'new', _('Новый')
        IN_WORK = 'in_work', _('В работе')
        IN_PRODUCTION = 'in_production', _('В производстве')
        READY = 'ready', _('Готов')
        ON_INSTALLATION = 'on_installation', _('На установке / выдаче')
        WAITING_FINAL_PAYMENT = 'waiting_final_payment', _('Ожидает финальной оплаты')
        COMPLETED = 'completed', _('Завершён')
        CANCELLED = 'cancelled', _('Отменён')
        
        # Legacy statuses (to be removed in Sprint 3+)
        DRAFT = 'draft', _('Draft')
        MEASUREMENT = 'measurement', _('Measurement Scheduled')
        DESIGN = 'design', _('Design in Progress')
        QUOTED = 'quoted', _('Quote Generated')
        APPROVED = 'approved', _('Approved by Customer')
        PREPAYMENT_RECEIVED = 'prepayment_received', _('Prepayment Received')
        FABRIC_RESERVED = 'fabric_reserved', _('Fabric Reserved')
        PRODUCTION = 'production', _('In Production')
        INSTALLATION = 'installation', _('Installation Scheduled')
    
    # Identity
    order_number = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        validators=[RegexValidator(
            regex=r'^О-\d{4}-\d{3}$',
            message='Order number format: О-YYYY-NNN'
        )]
    )
    
    # Customer relationship
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name='orders',
        db_index=True
    )
    
    # Status (FSM state)
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.NEW,
        db_index=True
    )
    
    # Material readiness - operational layer (NOT a replacement for main status)
    material_readiness = models.CharField(
        max_length=20,
        choices=MaterialReadiness.choices,
        default=MaterialReadiness.NOT_READY,
        db_index=True,
        help_text='Operational state: whether order materials are ready for production'
    )
    
    # Address
    installation_address_city = models.CharField(max_length=100, blank=True, db_index=True)
    installation_address_street = models.CharField(max_length=255, blank=True)
    installation_address_building = models.CharField(max_length=50, blank=True)
    installation_address_apartment = models.CharField(max_length=50, blank=True)
    installation_address_notes = models.TextField(blank=True)
    
    # Dates
    measurement_date = models.DateField(null=True, blank=True, db_index=True)
    installation_date = models.DateField(null=True, blank=True, db_index=True)
    planned_completion = models.DateField(null=True, blank=True, db_index=True)
    actual_completion = models.DateField(null=True, blank=True)
    
    # Financial
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0'),
        validators=[MinValueValidator(Decimal('0'))]
    )
    paid_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0'),
        validators=[MinValueValidator(Decimal('0'))]
    )
    
    # Relations
    quote = models.ForeignKey(
        'Quote',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='converted_orders'
    )
    
    # Notes
    notes = models.TextField(blank=True)
    
    class Meta:
        db_table = 'orders'
        ordering = ['-created_at']
        indexes = [
            # Primary query patterns
            Index(fields=['customer', 'status'], name='idx_order_customer_status'),
            Index(fields=['status', 'created_at'], name='idx_order_status_created'),
            Index(fields=['status', 'planned_completion'], name='idx_order_status_deadline'),
            Index(fields=['measurement_date'], name='idx_order_measurement_date'),
            Index(fields=['installation_date'], name='idx_order_installation_date'),
            
            # Financial queries
            Index(fields=['total_amount', 'paid_amount'], name='idx_order_payment_status'),
            
            # Dashboard queries
            Index(fields=['status', 'updated_at'], name='idx_order_status_updated'),
        ]
        constraints = [
            CheckConstraint(
                check=Q(paid_amount__lte=models.F('total_amount')),
                name='order_paid_not_exceed_total'
            ),
            CheckConstraint(
                check=Q(total_amount__gte=Decimal('0')),
                name='order_total_non_negative'
            ),
        ]
        verbose_name = 'Order'
        verbose_name_plural = 'Orders'
    
    def __str__(self):
        return f"{self.order_number} - {self.customer.full_name}"
    
    def save(self, *args, **kwargs):
        """Auto-generate order_number if not set"""
        if not self.order_number:
            self.order_number = self._generate_order_number()
        super().save(*args, **kwargs)
    
    def _generate_order_number(self) -> str:
        """Generate unique order number О-YYYY-NNN"""
        import re
        from datetime import datetime
        
        year = datetime.now().year
        
        # Get the latest order number for this year (excluding empty ones)
        latest = Order.objects.filter(
            order_number__regex=f'^О-{year}-\\d{{3}}$'
        ).order_by('-order_number').first()
        
        if latest:
            match = re.match(rf'^О-{year}-(\d{{3}})$', latest.order_number)
            if match:
                seq = int(match.group(1)) + 1
            else:
                seq = 1
        else:
            seq = 1
        
        return f"О-{year}-{seq:03d}"
    
    @property
    def remaining_amount(self):
        return self.total_amount - self.paid_amount
    
    @property
    def is_fully_paid(self):
        return self.paid_amount >= self.total_amount


class OrderItem(UUIDModel):
    """Line item within Order"""
    
    class ItemType(models.TextChoices):
        FABRIC = 'fabric', _('Fabric')
        CORNICE = 'cornice', _('Cornice')
        SERVICE = 'service', _('Service')
    
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='items',
        db_index=True
    )
    item_type = models.CharField(max_length=20, choices=ItemType.choices, db_index=True)
    
    # Polymorphic references (only one populated based on item_type)
    fabric = models.ForeignKey(
        Fabric,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='order_items'
    )
    cornice = models.ForeignKey(
        Cornice,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='order_items'
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='order_items'
    )
    
    # Pricing (snapshot at order creation)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0'))])
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0'))])
    total_price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0'))])
    
    # Fabric-specific fields
    sewing_type = models.CharField(max_length=100, blank=True, db_index=True)
    window_width_cm = models.PositiveIntegerField(null=True, blank=True)
    window_height_cm = models.PositiveIntegerField(null=True, blank=True)
    folds_count = models.PositiveIntegerField(null=True, blank=True)
    
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'order_items'
        ordering = ['created_at']
        indexes = [
            Index(fields=['order', 'item_type'], name='idx_orderitem_order_type'),
            Index(fields=['fabric'], name='idx_orderitem_fabric'),
            Index(fields=['cornice'], name='idx_orderitem_cornice'),
        ]
        constraints = [
            # Ensure exactly one reference is populated based on item_type
            CheckConstraint(
                check=(
                    Q(item_type='fabric', fabric__isnull=False, cornice__isnull=True, service__isnull=True) |
                    Q(item_type='cornice', fabric__isnull=True, cornice__isnull=False, service__isnull=True) |
                    Q(item_type='service', fabric__isnull=True, cornice__isnull=True, service__isnull=False)
                ),
                name='orderitem_valid_reference'
            ),
        ]
        verbose_name = 'Order Item'
        verbose_name_plural = 'Order Items'


class OrderStatusHistory(UUIDModel):
    """Audit trail for order status changes"""
    
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='status_history',
        db_index=True
    )
    old_status = models.CharField(max_length=30, choices=Order.Status.choices, blank=True)
    new_status = models.CharField(max_length=30, choices=Order.Status.choices)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+'
    )
    changed_by_name = models.CharField(max_length=100, blank=True)  # Snapshot
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'order_status_history'
        ordering = ['-created_at']
        indexes = [
            Index(fields=['order', 'created_at'], name='idx_orderhist_order_created'),
            Index(fields=['new_status', 'created_at'], name='idx_orderhist_status_created'),
        ]
        verbose_name = 'Order Status History'
        verbose_name_plural = 'Order Status History'


class Payment(UUIDModel, AuditedModel):
    """Payment within Order aggregate"""
    
    class PaymentType(models.TextChoices):
        PREPAYMENT = 'prepayment', _('Prepayment')
        FINAL = 'final', _('Final Payment')
        ADDITIONAL = 'additional', _('Additional Payment')
    
    class PaymentMethod(models.TextChoices):
        CASH = 'cash', _('Cash')
        CARD = 'card', _('Card')
        TRANSFER = 'transfer', _('Bank Transfer')
        KASPI = 'kaspi', _('Kaspi Pay')
    
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='payments',
        db_index=True
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))]
    )
    payment_type = models.CharField(max_length=20, choices=PaymentType.choices, db_index=True)
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices, db_index=True)
    
    # Idempotency key for external payment gateways
    idempotency_key = models.CharField(max_length=100, blank=True, db_index=True)
    external_transaction_id = models.CharField(max_length=255, blank=True, db_index=True)
    
    received_at = models.DateTimeField(db_index=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        db_table = 'payments'
        ordering = ['-received_at']
        indexes = [
            Index(fields=['order', 'payment_type'], name='idx_payment_order_type'),
            Index(fields=['idempotency_key'], name='idx_payment_idempotency'),
            Index(fields=['external_transaction_id'], name='idx_payment_external'),
        ]
        constraints = [
            UniqueConstraint(
                fields=['idempotency_key'],
                condition=~Q(idempotency_key=''),
                name='unique_payment_idempotency'
            ),
        ]
        verbose_name = 'Payment'
        verbose_name_plural = 'Payments'


class Measurement(UUIDModel):
    """Window measurements for order"""
    
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='measurements',
        db_index=True
    )
    room_name = models.CharField(max_length=100, db_index=True)
    window_name = models.CharField(max_length=100, blank=True)
    
    # Dimensions
    width_cm = models.PositiveIntegerField(validators=[MaxValueValidator(1000)])
    height_cm = models.PositiveIntegerField(validators=[MaxValueValidator(500)])
    depth_cm = models.PositiveIntegerField(null=True, blank=True)
    ceiling_height_cm = models.PositiveIntegerField(null=True, blank=True)
    
    # Technical details
    mounting_type = models.CharField(max_length=50, blank=True, db_index=True)
    window_type = models.CharField(max_length=50, blank=True)
    has_radiator = models.BooleanField(default=False)
    has_slope = models.BooleanField(default=False)
    obstacles = models.TextField(blank=True)
    
    # Selected materials (pre-order phase)
    selected_fabric = models.ForeignKey(
        Fabric,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='measurement_selections'
    )
    selected_cornice_type = models.CharField(max_length=100, blank=True)
    
    notes = models.TextField(blank=True)
    measured_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    measured_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'measurements'
        ordering = ['room_name', 'window_name']
        indexes = [
            Index(fields=['order', 'room_name'], name='idx_measurement_order_room'),
            Index(fields=['selected_fabric'], name='idx_measurement_fabric'),
        ]
        verbose_name = 'Measurement'
        verbose_name_plural = 'Measurements'


# ============================================
# TASK CONTEXT (Lead Management)
# ============================================

class Task(UUIDModel, AuditedModel):
    """Task aggregate - pre-order lead management"""
    
    class Status(models.TextChoices):
        LEAD = 'lead', _('Lead')
        MEASUREMENT_SCHEDULED = 'measurement_scheduled', _('Measurement Scheduled')
        MEASUREMENT_DONE = 'measurement_done', _('Measurement Done')
        QUOTING = 'quoting', _('Quoting')
        QUOTE_SENT = 'quote_sent', _('Quote Sent')
        CONVERTED = 'converted', _('Converted to Order')
        LOST = 'lost', _('Lost')
        POSTPONED = 'postponed', _('Postponed')
    
    class Source(models.TextChoices):
        PHONE = 'phone', _('Phone Call')
        INSTAGRAM = 'instagram', _('Instagram')
        WHATSAPP = 'whatsapp', _('WhatsApp')
        REFERRAL = 'referral', _('Referral')
        WEBSITE = 'website', _('Website')
        WALKIN = 'walkin', _('Walk-in')
        OTHER = 'other', _('Other')
    
    # Identity
    task_number = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        validators=[RegexValidator(
            regex=r'^З-\d{4}-\d{3}$',
            message='Task number format: З-YYYY-NNN'
        )]
    )
    
    # Client info (may not be registered customer yet)
    client_name = models.CharField(max_length=255, db_index=True)
    client_phone = models.CharField(max_length=50, db_index=True)
    client_address_city = models.CharField(max_length=100, blank=True, db_index=True)
    client_address_street = models.CharField(max_length=255, blank=True)
    client_address_building = models.CharField(max_length=50, blank=True)
    
    # Link to customer (if registered)
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tasks'
    )
    
    # Status
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.LEAD,
        db_index=True
    )
    
    # Classification
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.OTHER, db_index=True)
    priority = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        db_index=True
    )
    
    # Assignment
    assigned_designer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_tasks',
        db_index=True,
        limit_choices_to={'groups__name': 'Designer'}
    )
    
    # Dates
    preferred_date = models.DateField(null=True, blank=True, db_index=True)
    deadline = models.DateField(null=True, blank=True, db_index=True)
    
    # Content
    description = models.TextField(blank=True)
    client_wishes = models.TextField(blank=True)
    
    # Conversion tracking
    converted_to_order = models.ForeignKey(
        Order,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='source_task'
    )
    converted_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'tasks'
        ordering = ['-priority', '-created_at']
        indexes = [
            Index(fields=['status', 'priority'], name='idx_task_status_priority'),
            Index(fields=['assigned_designer', 'status'], name='idx_task_designer_status'),
            Index(fields=['source', 'created_at'], name='idx_task_source_created'),
            Index(fields=['preferred_date'], name='idx_task_preferred_date'),
            Index(fields=['deadline'], name='idx_task_deadline'),
        ]
        verbose_name = 'Task'
        verbose_name_plural = 'Tasks'
    
    def __str__(self):
        return f"{self.task_number} - {self.client_name}"


class TaskMeasurement(UUIDModel):
    """Measurements taken during task phase"""
    
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='measurements',
        db_index=True
    )
    room_name = models.CharField(max_length=100, db_index=True)
    window_name = models.CharField(max_length=100, blank=True)
    
    width_cm = models.PositiveIntegerField()
    height_cm = models.PositiveIntegerField()
    depth_cm = models.PositiveIntegerField(null=True, blank=True)
    ceiling_height_cm = models.PositiveIntegerField(null=True, blank=True)
    
    mounting_type = models.CharField(max_length=50, blank=True, db_index=True)
    window_type = models.CharField(max_length=50, blank=True)
    has_radiator = models.BooleanField(default=False)
    has_slope = models.BooleanField(default=False)
    obstacles = models.TextField(blank=True)
    
    selected_fabric = models.ForeignKey(
        Fabric,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='task_measurement_selections'
    )
    selected_cornice_type = models.CharField(max_length=100, blank=True)
    
    measured_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    measured_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'task_measurements'
        ordering = ['room_name', 'window_name']
        verbose_name = 'Task Measurement'
        verbose_name_plural = 'Task Measurements'


class TaskHistory(UUIDModel):
    """Audit trail for task"""
    
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='history',
        db_index=True
    )
    action = models.CharField(max_length=50, db_index=True)  # status_changed, designer_assigned, etc.
    old_value = models.TextField(blank=True)
    new_value = models.TextField(blank=True)
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    performed_by_name = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    performed_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'task_history'
        ordering = ['-performed_at']
        indexes = [
            Index(fields=['task', 'performed_at'], name='idx_taskhist_task_time'),
            Index(fields=['action', 'performed_at'], name='idx_taskhist_action_time'),
        ]
        verbose_name = 'Task History'
        verbose_name_plural = 'Task History'


# ============================================
# QUOTE CONTEXT
# ============================================

class Quote(UUIDModel, AuditedModel):
    """Quote aggregate - commercial proposal"""
    
    class Status(models.TextChoices):
        DRAFT = 'draft', _('Draft')
        SENT = 'sent', _('Sent to Customer')
        APPROVED = 'approved', _('Approved')
        REJECTED = 'rejected', _('Rejected')
        EXPIRED = 'expired', _('Expired')
    
    quote_number = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        validators=[RegexValidator(
            regex=r'^КП-\d{4}-\d{3}$',
            message='Quote number format: КП-YYYY-NNN'
        )]
    )
    
    task = models.ForeignKey(
        Task,
        on_delete=models.SET_NULL,
        related_name='quotes',
        db_index=True,
        null=True,
        blank=True
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name='quotes',
        db_index=True
    )
    # Link to existing order when quote is created from order context (direct order flow)
    order = models.ForeignKey(
        'Order',
        on_delete=models.SET_NULL,
        related_name='related_quotes',
        db_index=True,
        null=True,
        blank=True,
        help_text='Existing order this quote was created for (direct order flow)'
    )
    
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True
    )
    
    # Financial
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    installation_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    delivery_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    
    prepayment_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.5'))
    
    # Expiration
    valid_until = models.DateField(null=True, blank=True, db_index=True)
    
    # PDF generation
    pdf_generated = models.BooleanField(default=False)
    pdf_url = models.URLField(blank=True, max_length=500)
    
    class Meta:
        db_table = 'quotes'
        ordering = ['-created_at']
        indexes = [
            Index(fields=['task', 'status'], name='idx_quote_task_status'),
            Index(fields=['customer', 'status'], name='idx_quote_customer_status'),
            Index(fields=['valid_until', 'status'], name='idx_quote_valid_status'),
        ]
        verbose_name = 'Quote'
        verbose_name_plural = 'Quotes'


class QuoteItem(UUIDModel):
    """Line item in quote"""
    
    quote = models.ForeignKey(
        Quote,
        on_delete=models.CASCADE,
        related_name='items',
        db_index=True
    )
    
    room_name = models.CharField(max_length=100)
    
    # Measurements snapshot
    window_width_cm = models.PositiveIntegerField()
    window_height_cm = models.PositiveIntegerField()
    folds_count = models.PositiveIntegerField(default=0)
    
    # Materials
    fabric = models.ForeignKey(
        Fabric,
        on_delete=models.PROTECT,
        null=True,
        blank=True
    )
    fabric_meters = models.DecimalField(max_digits=10, decimal_places=2)
    fabric_cost = models.DecimalField(max_digits=12, decimal_places=2)
    
    # Material supply mode - how this fabric will be sourced
    supply_mode = models.CharField(
        max_length=20,
        choices=SupplyMode.CHOICES,
        default=SupplyMode.IN_STOCK,
        db_index=True,
        help_text='How the fabric/material will be supplied for this item'
    )
    
    # Sewing
    sewing_type = models.CharField(max_length=100, blank=True)
    complexity = models.CharField(max_length=20, blank=True)  # simple, medium, complex, premium
    sewing_cost = models.DecimalField(max_digits=12, decimal_places=2)
    
    # Accessories
    accessories_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    
    # Cornice
    cornice = models.ForeignKey(
        Cornice,
        on_delete=models.PROTECT,
        null=True,
        blank=True
    )
    cornice_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    
    # Total for line
    line_total = models.DecimalField(max_digits=12, decimal_places=2)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'quote_items'
        ordering = ['created_at']
        verbose_name = 'Quote Item'
        verbose_name_plural = 'Quote Items'


# ============================================
# PRODUCTION CONTEXT
# ============================================

class ProductionAssignment(UUIDModel, AuditedModel):
    """Assignment of order to seamstress"""
    
    class Status(models.TextChoices):
        ASSIGNED = 'assigned', _('Assigned')
        MATERIALS_PREPARED = 'materials_prepared', _('Materials Prepared')
        CUTTING = 'cutting', _('Cutting')
        SEWING = 'sewing', _('Sewing')
        QUALITY_CHECK = 'quality_check', _('Quality Check')
        READY = 'ready', _('Ready')
        RETURNED = 'returned', _('Returned for Revision')
    
    class Complexity(models.TextChoices):
        LOW = 'low', _('Low')
        MEDIUM = 'medium', _('Medium')
        HIGH = 'high', _('High')
    
    order = models.OneToOneField(
        Order,
        on_delete=models.CASCADE,
        related_name='production_assignment',
        db_index=True
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='production_assignments',
        db_index=True,
        limit_choices_to={'groups__name': 'Seamstress'}
    )
    
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.ASSIGNED,
        db_index=True
    )
    
    complexity = models.CharField(
        max_length=10,
        choices=Complexity.choices,
        default=Complexity.MEDIUM,
        db_index=True
    )
    priority = models.PositiveSmallIntegerField(default=1, validators=[MinValueValidator(1), MaxValueValidator(5)])
    
    # Planning
    deadline = models.DateField(null=True, blank=True, db_index=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Payment calculation
    base_payment = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    complexity_bonus = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    total_payment = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    
    notes = models.TextField(blank=True)
    
    class Meta:
        db_table = 'production_assignments'
        ordering = ['-priority', 'deadline']
        indexes = [
            Index(fields=['assigned_to', 'status'], name='idx_prodassign_worker_status'),
            Index(fields=['status', 'deadline'], name='idx_prodassign_status_deadline'),
            Index(fields=['deadline', 'status'], name='idx_prodassign_deadline_status'),
        ]
        verbose_name = 'Production Assignment'
        verbose_name_plural = 'Production Assignments'


class ProductionLog(UUIDModel):
    """Status change log for production"""
    
    assignment = models.ForeignKey(
        ProductionAssignment,
        on_delete=models.CASCADE,
        related_name='logs',
        db_index=True
    )
    old_status = models.CharField(max_length=30, choices=ProductionAssignment.Status.choices, blank=True)
    new_status = models.CharField(max_length=30, choices=ProductionAssignment.Status.choices)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'production_logs'
        ordering = ['-created_at']
        verbose_name = 'Production Log'
        verbose_name_plural = 'Production Logs'


class SeamstressPayment(UUIDModel, AuditedModel):
    """Payment to seamstress for completed work"""
    
    class Status(models.TextChoices):
        PENDING = 'pending', _('Pending')
        PAID = 'paid', _('Paid')
        CANCELLED = 'cancelled', _('Cancelled')
    
    assignment = models.OneToOneField(
        ProductionAssignment,
        on_delete=models.CASCADE,
        related_name='payment',
        db_index=True
    )
    seamstress = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='seamstress_payments',
        db_index=True
    )
    
    base_amount = models.DecimalField(max_digits=12, decimal_places=2)
    complexity_bonus = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    paid_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    
    notes = models.TextField(blank=True)
    
    class Meta:
        db_table = 'seamstress_payments'
        ordering = ['-created_at']
        indexes = [
            Index(fields=['seamstress', 'status'], name='idx_seampay_worker_status'),
            Index(fields=['status', 'created_at'], name='idx_seampay_status_created'),
        ]
        verbose_name = 'Seamstress Payment'
        verbose_name_plural = 'Seamstress Payments'


# ============================================
# AUDIT & LOGGING
# ============================================

class ActivityLog(UUIDModel):
    """Cross-entity activity logging"""
    
    class EntityType(models.TextChoices):
        ORDER = 'order', _('Order')
        TASK = 'task', _('Task')
        CUSTOMER = 'customer', _('Customer')
        FABRIC = 'fabric', _('Fabric')
        CORNICE = 'cornice', _('Cornice')
        QUOTE = 'quote', _('Quote')
    
    class Action(models.TextChoices):
        CREATED = 'created', _('Created')
        UPDATED = 'updated', _('Updated')
        DELETED = 'deleted', _('Deleted')
        STATUS_CHANGED = 'status_changed', _('Status Changed')
        ASSIGNED = 'assigned', _('Assigned')
        PAYMENT_RECEIVED = 'payment_received', _('Payment Received')
    
    entity_type = models.CharField(max_length=20, choices=EntityType.choices, db_index=True)
    entity_id = models.UUIDField(db_index=True)
    entity_repr = models.CharField(max_length=255, blank=True)  # Human-readable reference
    
    action = models.CharField(max_length=30, choices=Action.choices, db_index=True)
    
    old_values = models.JSONField(null=True, blank=True)
    new_values = models.JSONField(null=True, blank=True)
    
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    performed_by_name = models.CharField(max_length=100, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'activity_log'
        ordering = ['-created_at']
        indexes = [
            Index(fields=['entity_type', 'entity_id', 'created_at'], name='idx_activity_entity_time'),
            Index(fields=['action', 'created_at'], name='idx_activity_action_time'),
            Index(fields=['performed_by', 'created_at'], name='idx_activity_user_time'),
        ]
        verbose_name = 'Activity Log'
        verbose_name_plural = 'Activity Logs'


# ============================================
# CONFIGURATION
# ============================================

class AppConfig(models.Model):
    """Dynamic application configuration"""
    
    key = models.CharField(max_length=100, unique=True, db_index=True)
    value = models.TextField()
    value_type = models.CharField(max_length=20, choices=[
        ('string', 'String'),
        ('int', 'Integer'),
        ('decimal', 'Decimal'),
        ('bool', 'Boolean'),
        ('json', 'JSON'),
    ])
    description = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    
    class Meta:
        db_table = 'app_config'
        verbose_name = 'App Config'
        verbose_name_plural = 'App Config'
    
    def get_value(self):
        import json
        if self.value_type == 'int':
            return int(self.value)
        elif self.value_type == 'decimal':
            return Decimal(self.value)
        elif self.value_type == 'bool':
            return self.value.lower() in ('true', '1', 'yes')
        elif self.value_type == 'json':
            return json.loads(self.value)
        return self.value

"""
Atelier ERP - API v1 Serializers
Minimal serializers for orders, tasks, inventory
"""

from decimal import Decimal

from rest_framework import serializers
from atelier_erp.models import Order, Task, Fabric, OrderItem, Customer, Quote, QuoteItem, Measurement, Payment, PhotoReport, OrderMaterial, InventoryItem
# Inline definitions (previously imported from api/serializers.py)
from atelier_erp.models import Fabric as _Fabric, Quote as _Quote

class FabricListSerializer(serializers.ModelSerializer):
    """Minimal fabric serializer"""
    available_meters = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    class Meta:
        model = _Fabric
        fields = ['id', 'hanger_number', 'name', 'available_meters', 'price_per_meter', 'is_active']

class RelatedQuoteSerializer(serializers.ModelSerializer):
    """Serializer for quotes linked to an order"""
    class Meta:
        model = _Quote
        fields = ['id', 'quote_number', 'status', 'total', 'created_at']
from atelier_erp.constants import MaterialReadiness
from atelier_erp.roles import Roles, user_in
from .substatus import get_execution_substatus

# Финансовые поля заказа, скрываемые от ролей без финансового доступа
FINANCIAL_ORDER_FIELDS = ('total_amount', 'paid_amount', 'balance_due')


def compute_ui_badge(order) -> dict:
    """Возвращает {color, label} для карточки заказа на фронте/мобиле.

    Приоритет:
      1. red    — просрочен (is_overdue), перебивает всё
      2. yellow — ожидание оплаты ИЛИ in_work без готовых материалов
      3. green  — активное выполнение
      4. gray   — new / completed / cancelled
    """
    S = order.__class__.Status

    if order.is_overdue:
        return {'color': 'red', 'label': 'Просрочен'}

    if order.status == S.WAITING_FINAL_PAYMENT:
        return {'color': 'yellow', 'label': 'Ожидание оплаты'}
    if order.status == S.IN_WORK and order.material_readiness != MaterialReadiness.READY:
        return {'color': 'yellow', 'label': 'Ожидание материалов'}

    if order.status in (S.IN_WORK, S.IN_PRODUCTION, S.ON_INSTALLATION, S.READY):
        return {'color': 'green', 'label': 'В работе'}

    return {'color': 'gray', 'label': order.get_status_display()}


class CustomerMinimalSerializer(serializers.ModelSerializer):
    """Minimal customer info for embedding"""
    class Meta:
        model = Customer
        fields = ['id', 'full_name', 'phone']


class CustomerSerializer(serializers.ModelSerializer):
    """Full customer serializer for /api/v1/customers/"""
    class Meta:
        model = Customer
        fields = ['id', 'full_name', 'phone', 'email', 'address_city',
                  'address_street', 'notes', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class OrderItemSerializer(serializers.ModelSerializer):
    """Order item serializer"""
    fabric_name = serializers.CharField(source='fabric.name', read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            'id', 'item_type', 'notes',
            'room_name', 'window_name',
            'fabric', 'fabric_name', 'quantity',
            'cornice', 'service',
            'unit_price', 'total_price',
            'sewing_type', 'window_width_cm', 'window_height_cm', 'folds_count',
        ]


class OrderListSerializer(serializers.ModelSerializer):
    """Order list view - minimal fields"""
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    balance_due = serializers.DecimalField(source='remaining_amount', max_digits=12, decimal_places=2, read_only=True)
    designer_name = serializers.SerializerMethodField()
    ui_badge = serializers.SerializerMethodField()
    # Производное состояние: считается из planned_completion и статуса.
    # Фронт группирует по нему пилюлю «Просрочено».
    is_overdue = serializers.BooleanField(read_only=True)
    # Ролевой подстатус «Исполнение» (швейный цех / установщик), см. substatus.py.
    execution_substatus = serializers.SerializerMethodField()
    material_readiness_label = serializers.CharField(source='get_material_readiness_display', read_only=True)
    production_stage_label = serializers.CharField(source='get_production_stage_display', read_only=True)
    handover_stage_label = serializers.CharField(source='get_handover_stage_display', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'customer', 'customer_name', 'customer_phone',
            'status', 'status_display', 'ui_badge', 'is_overdue', 'execution_substatus',
            'total_amount', 'paid_amount', 'balance_due',
            'designer_name', 'created_at', 'planned_completion',
            'material_readiness', 'material_readiness_label',
            'production_stage', 'production_stage_label',
            'handover_stage', 'handover_stage_label'
        ]
        read_only_fields = ['order_number', 'created_at']

    def get_designer_name(self, obj) -> str:
        user = obj.responsible_user or getattr(obj, 'created_by', None)
        if not user:
            return ""
        full = f"{user.first_name} {user.last_name}".strip()
        return full or user.username

    def get_ui_badge(self, obj) -> dict:
        return compute_ui_badge(obj)

    def get_execution_substatus(self, obj):
        request = self.context.get('request')
        return get_execution_substatus(obj, getattr(request, 'user', None))

    def to_representation(self, instance):
        """Скрыть денежные поля от ролей без финансового доступа.

        Склад/цех/монтаж не должны видеть суммы, оплаты и баланс.
        Owner и Designer — видят.
        """
        data = super().to_representation(instance)
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user_in(user, *Roles.FINANCIAL_ACCESS):
            for field in FINANCIAL_ORDER_FIELDS:
                data.pop(field, None)
        return data


class SourceQuoteSerializer(serializers.ModelSerializer):
    """Source quote info for orders created from quote"""
    class Meta:
        model = Quote
        fields = ['id', 'quote_number', 'total', 'status']


class PaymentSerializer(serializers.ModelSerializer):
    """Payment serializer for embedding in order detail"""
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    
    class Meta:
        model = Payment
        fields = [
            'id', 'order', 'order_number', 'amount', 'payment_type',
            'payment_method', 'notes', 'received_at', 'created_at'
        ]
        extra_kwargs = {
            # received_at проставляется моделью (save) если не передан — не делаем обязательным
            'received_at': {'required': False},
        }


class MeasurementSerializer(serializers.ModelSerializer):
    """Measurement serializer for embedding in order detail
    Phase 3: Includes curtain_fabric + tulle_fabric with meters
    Measurement = what selected and how much needed (no prices)
    """
    # Phase 3: Curtain and tulle fabrics with meters
    curtain_fabric_details = FabricListSerializer(source='curtain_fabric', read_only=True)
    tulle_fabric_details = FabricListSerializer(source='tulle_fabric', read_only=True)

    class Meta:
        model = Measurement
        fields = [
            'id', 'room_name', 'window_name', 'width_cm', 'height_cm',
            'mounting_type', 'measured_at',
            # Phase 3: Curtain and tulle fabrics
            'curtain_fabric', 'curtain_fabric_details', 'curtain_meters', 'curtain_gathering',
            'tulle_fabric', 'tulle_fabric_details', 'tulle_meters', 'tulle_gathering',
            'notes', 'materials_ready', 'sewing_done', 'installation_done',
        ]


class MeasurementWarehouseFlagSerializer(serializers.ModelSerializer):
    """Складу разрешено менять по замеру ровно одно поле — отметку сборки.

    Отдельный узкий сериализатор вместо общего write-пути: иначе PATCH со
    склада мог бы переписать размеры окна, ткань или коэффициент сборки.
    """

    class Meta:
        model = Measurement
        fields = ['id', 'materials_ready']


class MeasurementSewingFlagSerializer(serializers.ModelSerializer):
    """Швее разрешено менять по замеру ровно одно поле — отметку пошива."""

    class Meta:
        model = Measurement
        fields = ['id', 'sewing_done']


class MeasurementInstallerFlagSerializer(serializers.ModelSerializer):
    """Установщику — ровно одно поле: отметку установки по окну."""

    class Meta:
        model = Measurement
        fields = ['id', 'installation_done']


class MeasurementCreateSerializer(serializers.Serializer):
    """Simplified measurement creation for mobile forms.

    Принимает обе ткани (шторы + тюль) по имени и раздельные коэффициенты сборки.
    Метраж (curtain_meters/tulle_meters) НЕ принимается от клиента — вычисляется
    сервером из ширины окна и коэффициента сборки (см. services.measurement_calc).
    """
    room_name = serializers.CharField(max_length=100)
    window_number = serializers.CharField(max_length=100, required=False, allow_blank=True)
    width = serializers.DecimalField(max_digits=8, decimal_places=2)
    height = serializers.DecimalField(max_digits=8, decimal_places=2)
    mounting_type = serializers.CharField(max_length=50, required=False, allow_blank=True)
    comment = serializers.CharField(required=False, allow_blank=True)
    # Раздельные ткани и коэффициенты сборки на окно
    curtain_fabric_name = serializers.CharField(required=False, allow_blank=True)
    curtain_gathering = serializers.DecimalField(
        max_digits=4, decimal_places=2, required=False, default=Decimal('2.2')
    )
    tulle_fabric_name = serializers.CharField(required=False, allow_blank=True)
    tulle_gathering = serializers.DecimalField(
        max_digits=4, decimal_places=2, required=False, default=Decimal('2.0')
    )


class MeasurementWriteSerializer(serializers.ModelSerializer):
    """Создание/редактирование замера из веб- и мобайл-формы.

    Принимает поля модели напрямую (width_cm/height_cm/window_name/curtain_fabric/
    tulle_fabric/...), сохраняет ОБЕ ткани. Лишние ключи в payload игнорируются.
    Используется MeasurementViewSet для create/update.

    Метраж НЕ принимается от клиента — вычисляется сервером из ширины окна и
    коэффициента сборки (та же формула, что в action orders/{id}/measurements/,
    см. services.measurement_calc). Раньше этот путь принимал метраж вручную и
    расходился с мобильным авторасчётом.
    """
    class Meta:
        model = Measurement
        fields = [
            'id', 'order', 'room_name', 'window_name',
            'width_cm', 'height_cm', 'mounting_type',
            'curtain_fabric', 'curtain_meters', 'curtain_gathering',
            'tulle_fabric', 'tulle_meters', 'tulle_gathering', 'notes',
            'materials_ready', 'sewing_done', 'installation_done',
        ]
        read_only_fields = ['curtain_meters', 'tulle_meters']

    def _apply_meterage(self, validated_data, instance=None):
        from atelier_erp.services.measurement_calc import compute_meters

        def resolved(field, default):
            if field in validated_data:
                return validated_data[field]
            if instance is not None:
                return getattr(instance, field)
            return default

        width = resolved('width_cm', 0)
        curtain_fabric = resolved('curtain_fabric', None)
        tulle_fabric = resolved('tulle_fabric', None)

        validated_data['curtain_meters'] = compute_meters(
            width, resolved('curtain_gathering', Decimal('2.2')),
            has_fabric=curtain_fabric is not None,
        )
        validated_data['tulle_meters'] = compute_meters(
            width, resolved('tulle_gathering', Decimal('2.0')),
            has_fabric=tulle_fabric is not None,
        )
        return validated_data

    def create(self, validated_data):
        return super().create(self._apply_meterage(validated_data))

    def update(self, instance, validated_data):
        return super().update(instance, self._apply_meterage(validated_data, instance=instance))


class QuoteItemSerializer(serializers.ModelSerializer):
    """Quote item serializer for embedding in quote detail"""
    class Meta:
        model = QuoteItem
        fields = [
            'id', 'room_name', 'window_name',
            'window_width_cm', 'window_height_cm',
            'fabric_meters', 'fabric_cost',
            'tulle_meters', 'tulle_cost',
            'sewing_cost', 'installation_price',
            'accessories_cost', 'line_total',
        ]


class QuoteSerializer(serializers.ModelSerializer):
    """Quote detail serializer with items"""
    items = QuoteItemSerializer(many=True, read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)
    order_number = serializers.CharField(source='order.order_number', read_only=True)

    class Meta:
        model = Quote
        fields = [
            'id', 'quote_number', 'status', 'status_label',
            'customer_name', 'customer_phone', 'order', 'order_number',
            'subtotal', 'discount_amount', 'installation_cost',
            'delivery_cost', 'total', 'prepayment_percent',
            'valid_until', 'pdf_generated', 'pdf_url',
            'items', 'created_at',
        ]


class QuoteCreateSerializer(serializers.Serializer):
    """Create/update quote for an existing order"""
    order_id = serializers.UUIDField()
    valid_until = serializers.DateField(required=False)
    discount_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=Decimal('0'))
    installation_cost = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=Decimal('0'))
    delivery_cost = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=Decimal('0'))
    prepayment_percent = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, default=Decimal('0.5'))
    items = serializers.ListSerializer(
        child=serializers.DictField(),
        allow_empty=False
    )

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("At least one item is required")
        for item in value:
            if 'room_name' not in item:
                raise serializers.ValidationError("Each item must have room_name")
            if 'line_total' not in item:
                raise serializers.ValidationError("Each item must have line_total")
        return value


class OrderMaterialSerializer(serializers.ModelSerializer):
    """Order material with status display label"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = OrderMaterial
        fields = [
            'id', 'order', 'name', 'material_type',
            'quantity', 'unit', 'status', 'status_display',
            'source_quote_item', 'comment', 'updated_at',
        ]


class OrderMaterialUpdateSerializer(serializers.ModelSerializer):
    """Update only status and comment"""
    class Meta:
        model = OrderMaterial
        fields = ['status', 'comment']


class OrderDetailSerializer(serializers.ModelSerializer):
    """Order detail view - full fields with execution tracking, workflow state, and available actions"""
    customer = CustomerMinimalSerializer(read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    designer_name = serializers.SerializerMethodField()
    
    # Status with labels
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    
    # Material readiness with labels
    material_readiness_label = serializers.SerializerMethodField()
    
    # Production stage with labels
    production_stage_label = serializers.SerializerMethodField()
    
    # Handover stage with labels
    handover_stage_label = serializers.SerializerMethodField()
    
    # Payment info
    is_paid = serializers.BooleanField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    balance_due = serializers.DecimalField(source='remaining_amount', max_digits=12, decimal_places=2, read_only=True)
    payment_state = serializers.SerializerMethodField()
    payment_state_label = serializers.SerializerMethodField()
    
    # Workflow state
    available_actions = serializers.SerializerMethodField()
    warnings = serializers.SerializerMethodField()
    blockers = serializers.SerializerMethodField()
    
    # Related data
    source_quote = SourceQuoteSerializer(source='quote', read_only=True)
    related_quotes = RelatedQuoteSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    measurements = MeasurementSerializer(many=True, read_only=True)
    
    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'customer', 'status', 'status_label',
            'total_amount', 'paid_amount', 'is_paid', 'balance_due', 'is_overdue',
            'payment_state', 'payment_state_label',
            'items', 'notes',
            'material_readiness', 'material_readiness_label',
            'production_stage', 'production_stage_label',
            'handover_stage', 'handover_stage_label',
            'available_actions', 'warnings', 'blockers',
            'created_at', 'updated_at', 'planned_completion',
            'installation_date', 'actual_completion', 'measurement_date',
            'installation_address_city', 'installation_address_street',
            'installation_address_building', 'installation_address_apartment',
            'installation_address_notes',
            'source_quote', 'related_quotes', 'payments', 'measurements',
            'cancel_reason', 'cancelled_at',
            'materials_ready_at', 'production_started_at', 'production_done_at', 'handover_done_at',
            'designer_name',
        ]
        read_only_fields = ['order_number', 'created_at', 'updated_at']
    
    def get_designer_name(self, obj: Order) -> str:
        user = obj.responsible_user or obj.created_by
        if user:
            full = f"{user.first_name} {user.last_name}".strip()
            return full or user.username
        return ''

    def get_material_readiness_label(self, obj: Order) -> str:
        from atelier_erp.constants import MaterialReadiness
        labels = {
            MaterialReadiness.NOT_READY: 'Не обеспечен',
            MaterialReadiness.PARTIALLY_READY: 'Частично обеспечен',
            MaterialReadiness.READY: 'Обеспечен материалами',
        }
        return labels.get(obj.material_readiness, obj.material_readiness)
    
    def get_production_stage_label(self, obj: Order) -> str:
        from atelier_erp.constants import ProductionStage
        labels = {
            ProductionStage.NOT_STARTED: 'Не начато',
            ProductionStage.SEWING: 'Раскрой',
            ProductionStage.SEWING: 'Пошив',
            ProductionStage.DONE: 'Контроль качества',
            ProductionStage.DONE: 'Производство завершено',
        }
        return labels.get(obj.production_stage, obj.production_stage)
    
    def get_handover_stage_label(self, obj: Order) -> str:
        from atelier_erp.constants import HandoverStage
        labels = {
            HandoverStage.NOT_REQUIRED: 'Не требуется',
            HandoverStage.PENDING: 'Ожидает установки / выдачи',
            HandoverStage.SCHEDULED: 'Запланировано',
            HandoverStage.IN_PROGRESS: 'В процессе',
            HandoverStage.DONE: 'Передано / установлено',
        }
        return labels.get(obj.handover_stage, obj.handover_stage)
    
    def get_payment_state(self, obj: Order) -> str:
        """Calculate payment state from paid_amount vs total_amount"""
        if obj.paid_amount == 0:
            return 'unpaid'
        elif obj.paid_amount >= obj.total_amount:
            return 'paid'
        elif obj.paid_amount >= obj.total_amount * Decimal('0.5'):
            return 'partial'
        else:
            return 'prepayment_due'
    
    def get_payment_state_label(self, obj: Order) -> str:
        """Get human-readable payment state label"""
        state = self.get_payment_state(obj)
        labels = {
            'unpaid': 'Не оплачен',
            'prepayment_due': 'Требуется предоплата',
            'partial': 'Оплачен частично',
            'paid': 'Оплачен полностью',
        }
        return labels.get(state, state)
    
    def get_available_actions(self, obj: Order) -> list:
        """Get available actions using OrderExecutionService"""
        from atelier_erp.services.order_execution_service import OrderExecutionService
        service = OrderExecutionService()
        return service.get_available_order_actions(obj)
    
    def get_warnings(self, obj: Order) -> list:
        """Get warnings using OrderExecutionService"""
        from atelier_erp.services.order_execution_service import OrderExecutionService
        service = OrderExecutionService()
        return service._get_warnings(obj)
    
    def get_blockers(self, obj: Order) -> list:
        """Get blockers using OrderExecutionService"""
        from atelier_erp.services.order_execution_service import OrderExecutionService
        service = OrderExecutionService()
        return service._get_blockers(obj)


class OrderCreateSerializer(serializers.ModelSerializer):
    """Order creation - write-only, supports direct order creation without quote

    Two modes:
    1. Legacy: provide customer_id (UUID) + installation_address_* fields
    2. Simplified: provide client_name, client_phone, address, deadline, comment
       — customer is found by phone or created automatically.
    """
    customer_id = serializers.UUIDField(write_only=True, required=False)
    # Simplified fields (alternative to customer_id)
    client_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    client_phone = serializers.CharField(required=False, allow_blank=True, write_only=True)
    address = serializers.CharField(required=False, allow_blank=True, write_only=True)
    deadline = serializers.DateField(required=False, allow_null=True, write_only=True)
    comment = serializers.CharField(required=False, allow_blank=True, write_only=True)
    # Installation address fields (legacy)
    installation_address_city = serializers.CharField(required=False, allow_blank=True)
    installation_address_street = serializers.CharField(required=False, allow_blank=True)
    installation_address_building = serializers.CharField(required=False, allow_blank=True)
    installation_address_apartment = serializers.CharField(required=False, allow_blank=True)
    installation_address_notes = serializers.CharField(required=False, allow_blank=True)
    # Dates
    measurement_date = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = Order
        fields = [
            'customer_id', 'client_name', 'client_phone', 'address', 'deadline', 'comment',
            'notes', 'planned_completion',
            'installation_address_city', 'installation_address_street',
            'installation_address_building', 'installation_address_apartment',
            'installation_address_notes', 'measurement_date', 'responsible_user_id'
        ]

    def validate(self, data):
        """Ensure either customer_id OR (client_name + client_phone) is provided."""
        has_customer_id = bool(data.get('customer_id'))
        has_client_name = bool(data.get('client_name', '').strip())
        has_client_phone = bool(data.get('client_phone', '').strip())

        if not has_customer_id and not (has_client_name and has_client_phone):
            raise serializers.ValidationError(
                "Укажите либо customer_id, либо client_name и client_phone."
            )

        return data


class OrderUpdateSerializer(serializers.ModelSerializer):
    """Order update - editable fields for owner/designer

    Fields:
    - client_name / client_phone: update customer info
    - address: simplified full address string
    - deadline: planned completion date
    - comment: order notes
    - installation_address_*: granular address fields
    """
    client_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    client_phone = serializers.CharField(required=False, allow_blank=True, write_only=True)
    address = serializers.CharField(required=False, allow_blank=True, write_only=True)
    deadline = serializers.DateField(required=False, allow_null=True, write_only=True)
    comment = serializers.CharField(required=False, allow_blank=True, write_only=True)
    # Granular address fields
    installation_address_city = serializers.CharField(required=False, allow_blank=True)
    installation_address_street = serializers.CharField(required=False, allow_blank=True)
    installation_address_building = serializers.CharField(required=False, allow_blank=True)
    installation_address_apartment = serializers.CharField(required=False, allow_blank=True)
    installation_address_notes = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Order
        fields = [
            'client_name', 'client_phone', 'address', 'deadline', 'comment',
            'notes', 'planned_completion',
            'installation_address_city', 'installation_address_street',
            'installation_address_building', 'installation_address_apartment',
            'installation_address_notes', 'responsible_user_id',
        ]

    def update(self, instance, validated_data):
        # Update customer info if provided
        client_name = validated_data.pop('client_name', None)
        client_phone = validated_data.pop('client_phone', None)
        if client_name or client_phone:
            customer = instance.customer
            if client_name:
                customer.full_name = client_name
            if client_phone:
                customer.phone = client_phone
            customer.save(update_fields=['full_name', 'phone', 'updated_at'])

        # Handle simplified address
        address = validated_data.pop('address', None)
        if address:
            instance.installation_address_street = address
            instance.installation_address_city = ''
            instance.installation_address_building = ''
            instance.installation_address_apartment = ''

        # Handle deadline -> planned_completion
        deadline = validated_data.pop('deadline', None)
        if deadline is not None:
            instance.planned_completion = deadline

        # Handle comment -> notes
        comment = validated_data.pop('comment', None)
        if comment is not None:
            instance.notes = comment

        # Update remaining fields directly
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance


class OrderStatusUpdateSerializer(serializers.Serializer):
    """Order status transition - service layer will handle FSM"""
    new_status = serializers.ChoiceField(choices=Order.Status.choices)
    reason = serializers.CharField(required=False, allow_blank=True)


# ============================================
# ORDER ACTION SERIALIZERS
# ============================================

class ChangeStatusSerializer(serializers.Serializer):
    """Change order status - lightweight validation"""
    status = serializers.ChoiceField(choices=Order.Status.choices)
    
    def validate_status(self, value):
        from atelier_erp.constants import OrderFSMRules
        # FSM validation happens in service, but we can pre-validate here
        return value


class ChangeMaterialReadinessSerializer(serializers.Serializer):
    """Change material readiness state"""
    material_readiness = serializers.ChoiceField(
        choices=[
            ('not_ready', 'Не обеспечен'),
            ('partially_ready', 'Частично обеспечен'),
            ('ready', 'Обеспечен материалами'),
        ]
    )


class ChangeProductionStageSerializer(serializers.Serializer):
    """Change production stage"""
    production_stage = serializers.ChoiceField(
        choices=[
            ('not_started', 'Не начато'),
            ('sewing', 'Пошив'),
            ('done', 'Производство завершено'),
        ]
    )


class ChangeHandoverStageSerializer(serializers.Serializer):
    """Change handover stage"""
    handover_stage = serializers.ChoiceField(
        choices=[
            ('not_required', 'Не требуется'),
            ('pending', 'Ожидает установки / выдачи'),
            ('scheduled', 'Запланировано'),
            ('in_progress', 'В процессе'),
            ('done', 'Передано / установлено'),
        ]
    )


class CancelOrderSerializer(serializers.Serializer):
    """Cancel order with reason"""
    reason = serializers.CharField(required=True, allow_blank=False, max_length=500)
    
    def validate_reason(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Причина отмены обязательна.")
        return value.strip()


class TaskListSerializer(serializers.ModelSerializer):
    """Task list view"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = Task
        fields = [
            'id', 'task_number', 'client_name', 'client_phone',
            'status', 'status_display', 'created_at', 'preferred_date'
        ]
        read_only_fields = ['task_number', 'created_at']


class TaskDetailSerializer(serializers.ModelSerializer):
    """Task detail view"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = Task
        fields = [
            'id', 'task_number', 'client_name', 'client_phone',
            'client_address_city', 'client_address_street', 'client_address_building',
            'status', 'status_display',
            'description', 'preferred_date', 'created_by', 'created_by_name',
            'created_at', 'updated_at', 'converted_to_order'
        ]
        read_only_fields = ['task_number', 'created_at', 'updated_at', 'converted_to_order']


class TaskCreateSerializer(serializers.ModelSerializer):
    """Task creation"""
    class Meta:
        model = Task
        fields = ['client_name', 'client_phone', 'client_address_city', 'client_address_street', 'client_address_building', 'description', 'preferred_date']


class TaskStatusUpdateSerializer(serializers.Serializer):
    """Task status transition - service layer will handle"""
    new_status = serializers.ChoiceField(choices=Task.Status.choices)
    notes = serializers.CharField(required=False, allow_blank=True)


class FabricAvailabilitySerializer(serializers.ModelSerializer):
    """Inventory availability - read only"""
    available_meters = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    
    class Meta:
        model = Fabric
        fields = [
            'id', 'hanger_number', 'name', 'color', 'pattern',
            'stock_meters', 'reserved_meters', 'available_meters',
            'price_per_meter', 'is_active'
        ]


class InventoryItemSerializer(serializers.ModelSerializer):
    """General warehouse item — read + write (create/update)."""
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    unit_display = serializers.CharField(source='get_unit_display', read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = InventoryItem
        fields = [
            'id', 'sku', 'name', 'category', 'category_display',
            'unit', 'unit_display', 'quantity', 'price_per_unit',
            'low_stock_threshold', 'supplier', 'note',
            'is_low_stock', 'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'is_low_stock', 'created_at', 'updated_at']


class InventoryCheckRequestSerializer(serializers.Serializer):
    """Request to check inventory availability"""
    fabric_id = serializers.UUIDField()
    required_meters = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))


class InventoryCheckResponseSerializer(serializers.Serializer):
    """Response for inventory availability check"""
    fabric_id = serializers.UUIDField()
    available = serializers.BooleanField()
    available_meters = serializers.DecimalField(max_digits=10, decimal_places=2)
    required_meters = serializers.DecimalField(max_digits=10, decimal_places=2)
    shortfall = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)


class PhotoReportSerializer(serializers.ModelSerializer):
    """Photo report serializer with file URL and uploader info"""
    file_url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)
    
    class Meta:
        model = PhotoReport
        fields = [
            'id', 'order', 'order_item',
            'file', 'file_url', 'caption',
            'uploaded_by', 'uploaded_by_name',
            'created_at', 'is_active'
        ]
        read_only_fields = ['uploaded_by', 'created_at', 'is_active']
    
    def get_file_url(self, obj):
        """Return absolute URL for the file"""
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class PhotoReportUploadSerializer(serializers.Serializer):
    """Upload serializer with validation"""
    file = serializers.FileField(required=True)
    caption = serializers.CharField(required=False, allow_blank=True)
    order_item = serializers.UUIDField(required=False, allow_null=True)

    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
    ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

    def validate_file(self, value):
        """Validate file type and size.

        content_type пришедший в заголовке — клиент может подделать
        (переименовать произвольный файл в .png). Поэтому дополнительно
        проверяем реальное содержимое через Pillow (magic bytes), а не
        только заявленный Content-Type.
        """
        # Check file size
        if value.size > self.MAX_FILE_SIZE:
            raise serializers.ValidationError(
                f'File size must be less than 10 MB. Current size: {value.size / (1024*1024):.1f} MB'
            )

        # Check content type (заявленный клиентом)
        content_type = value.content_type
        if content_type not in self.ALLOWED_TYPES:
            raise serializers.ValidationError(
                f'Only image files are allowed (JPEG, PNG, WebP). Got: {content_type}'
            )

        # Проверка реального содержимого файла (защита от подмены расширения/content-type)
        from PIL import Image, UnidentifiedImageError
        try:
            value.seek(0)
            with Image.open(value) as img:
                img.verify()
            value.seek(0)
            with Image.open(value) as img2:
                if img2.format not in ('JPEG', 'PNG', 'WEBP'):
                    raise serializers.ValidationError('Файл не является изображением поддерживаемого формата.')
        # SyntaxError — то, чем Pillow отвечает на битую структуру файла
        # (например, PNG с неверной CRC чанка). Без него повреждённая
        # картинка улетала в 500 вместо честного 400.
        except (UnidentifiedImageError, OSError, SyntaxError, ValueError):
            raise serializers.ValidationError('Файл повреждён или не является реальным изображением.')
        finally:
            value.seek(0)

        return value


# ============================================
# ORDER COMPLETION ACT (AVR) SERIALIZERS
# ============================================

class OrderCompletionActSerializer(serializers.ModelSerializer):
    """
    Order completion act (АВР) serializer.
    Includes signed file URL and uploader info.
    """
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    signed_file_url = serializers.SerializerMethodField()
    signed_file_uploaded_by_name = serializers.CharField(
        source='signed_file_uploaded_by.get_full_name',
        read_only=True
    )

    class Meta:
        from atelier_erp.models import OrderCompletionAct
        model = OrderCompletionAct
        fields = [
            'id', 'order', 'act_number', 'status', 'status_label',
            'signed_file', 'signed_file_url',
            'signed_file_uploaded_by', 'signed_file_uploaded_by_name',
            'signed_at', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'act_number', 'signed_file_uploaded_by', 'signed_at', 'created_at', 'updated_at'
        ]

    def get_signed_file_url(self, obj):
        """Return absolute URL for the signed file"""
        if obj.signed_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.signed_file.url)
            return obj.signed_file.url
        return None


class OrderCompletionActUploadSerializer(serializers.Serializer):
    """
    Upload serializer for signed completion act.
    Validates file type (PDF, images) and size (max 20MB).
    """
    signed_file = serializers.FileField(required=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
    ALLOWED_TYPES = [
        'application/pdf',
        'image/jpeg', 'image/jpg', 'image/png', 'image/webp'
    ]

    def validate_signed_file(self, value):
        """Validate file type and size.

        Помимо заявленного content_type (который клиент может подделать)
        проверяем реальные magic bytes файла: PDF-подпись или валидное
        изображение через Pillow.
        """
        # Check file size
        if value.size > self.MAX_FILE_SIZE:
            raise serializers.ValidationError(
                f'Размер файла должен быть меньше 20 МБ. Текущий размер: {value.size / (1024*1024):.1f} МБ'
            )

        # Check content type (заявленный клиентом)
        content_type = value.content_type
        if content_type not in self.ALLOWED_TYPES:
            raise serializers.ValidationError(
                f'Разрешены только PDF и изображения (JPEG, PNG, WebP). Получено: {content_type}'
            )

        # Проверка реального содержимого файла
        value.seek(0)
        header = value.read(5)
        value.seek(0)
        if content_type == 'application/pdf':
            if not header.startswith(b'%PDF-'):
                raise serializers.ValidationError('Файл не является настоящим PDF.')
        else:
            from PIL import Image, UnidentifiedImageError
            try:
                with Image.open(value) as img:
                    img.verify()
                value.seek(0)
                with Image.open(value) as img2:
                    if img2.format not in ('JPEG', 'PNG', 'WEBP'):
                        raise serializers.ValidationError('Файл не является изображением поддерживаемого формата.')
            # SyntaxError — то, чем Pillow отвечает на битую структуру файла
            # (например, PNG с неверной CRC чанка). Без него повреждённая
            # картинка улетала в 500 вместо честного 400.
            except (UnidentifiedImageError, OSError, SyntaxError, ValueError):
                raise serializers.ValidationError('Файл повреждён или не является реальным изображением.')
            finally:
                value.seek(0)

        return value

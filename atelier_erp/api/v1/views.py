"""
Atelier ERP - API v1 Views
Minimal ViewSets with service layer integration
All state changes go through services
"""

import logging
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db.models import Q, F, Exists, OuterRef, ExpressionWrapper, DecimalField
from dateutil.relativedelta import relativedelta
from rest_framework import viewsets, status, filters
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser

from atelier_erp.api.permissions import IsManagerOrAdmin, IsOwnerOrDesigner, IsWarehouseOrOwner, IsInstallationOrOwner, IsInstallationOrOwnerOrReadOnly, IsSeamstressOrOwner, CanAccessMeasurement, IsPlatformAdmin
from atelier_erp.api.v1.role_scope import scope_orders_for_role, filter_by_visible_orders
from atelier_erp.tenant_utils import TenantModelMixin, TenantViaOrderMixin
from atelier_erp.roles import Roles, user_in
from atelier_erp.services.numbering import next_number
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone

from atelier_erp.models import (
    Order, Task, Fabric, PhotoReport, OrderItem, OrderCompletionAct,
    Measurement, Quote, Payment, Customer, OrderMaterial, InventoryItem
)
from atelier_erp.services import OrderService, TaskService, UnitOfWork, QuoteService, PaymentService
from atelier_erp.services.inventory_fabric_sync import sync_fabric_from_inventory_item


logger = logging.getLogger(__name__)

# Текст необработанной ошибки наружу не отдаём: в него попадают имена
# ограничений БД, пути файлов и прочие внутренности. Настоящая ошибка уходит
# в лог со стеком, клиент получает обобщённую формулировку. Машиночитаемый
# `code` в ответах сохранён — фронтенд ориентируется на него, а не на текст.
UNEXPECTED_ERROR_MESSAGE = (
    'Не удалось выполнить операцию. Попробуйте ещё раз или обратитесь к администратору.'
)


def _safe_error(exc, context='request'):
    """Залогировать настоящую ошибку, вернуть безопасный текст для клиента."""
    logger.exception('Необработанная ошибка (%s): %s', context, exc)
    return UNEXPECTED_ERROR_MESSAGE
from atelier_erp.services.exceptions import (
    OrderNotFoundError, InvalidOrderStatusTransition,
    TaskNotFoundError, InvalidTaskStatusTransition,
    PaymentServiceError, InvalidPaymentAmount, DuplicatePaymentError,
)

from .serializers import (
    OrderListSerializer, OrderDetailSerializer, OrderCreateSerializer, OrderUpdateSerializer, OrderStatusUpdateSerializer,
    MeasurementSerializer, MeasurementCreateSerializer, MeasurementWriteSerializer,
    MeasurementWarehouseFlagSerializer, MeasurementSewingFlagSerializer,
    MeasurementInstallerFlagSerializer,
    PaymentSerializer,
    CustomerSerializer,
    QuoteSerializer, QuoteCreateSerializer,
    OrderMaterialSerializer, OrderMaterialUpdateSerializer,
    ChangeStatusSerializer, ChangeMaterialReadinessSerializer, ChangeProductionStageSerializer,
    ChangeHandoverStageSerializer, CancelOrderSerializer,
    TaskListSerializer, TaskDetailSerializer, TaskCreateSerializer, TaskStatusUpdateSerializer,
    FabricAvailabilitySerializer, InventoryCheckRequestSerializer, InventoryCheckResponseSerializer,
    InventoryItemSerializer,
    PhotoReportSerializer, PhotoReportUploadSerializer,
    OrderCompletionActSerializer, OrderCompletionActUploadSerializer
)
from .filters import OrderFilterSet
from .substatus import execution_substatus_annotations
from atelier_erp.constants import MaterialReadiness, ProductionStage, HandoverStage


class OrderViewSet(TenantModelMixin, viewsets.ModelViewSet):
    """
    Order API v1
    List/Retrieve: GET /api/v1/orders/
    Create: POST /api/v1/orders/ (Manager/Admin only)
    State changes: POST /api/v1/orders/{id}/change_status/ (via service layer)
    """
    queryset = Order.objects.all().order_by('-created_at')
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        """Create, update и delete — Owner/Designer (веб-форма 2026-07-20 дала дизайнеру ту же кнопку «Удалить заказ», что и владельцу)."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsOwnerOrDesigner()]
        return super().get_permissions()

    def get_queryset(self):
        """Срез заказов по роли + изоляция по тенанту.

        Полный список всех заказов компании — только Owner и Designer.
        Остальные роли видят только свой операционный срез по статусам.
        Пользователь без подходящей группы не видит ничего (default deny).
        select_related('customer') убирает N+1 в списке.

        Order.objects уже отфильтрован TenantManager на уровне ORM (см.
        tenant_utils.TenantManagerMixin) — Order.objects.all() сам по себе
        безопасен. Но здесь queryset строится ролевыми ветками (WAREHOUSE/
        SEAMSTRESS/INSTALLER/default deny), поэтому scope_to_tenant()
        применяется в конце ко ВСЕМ веткам как вторая линия защиты
        (defense in depth): без него (см. tenant_utils.TenantModelMixin)
        заказы одного тенанта были бы видны сотрудникам другого при
        появлении второго клиента, если по какой-то причине ORM-уровень
        не сработал (например, ContextVar не был выставлен вне HTTP-запроса).
        """
        qs = (
            Order.objects.select_related('customer')
            .annotate(**execution_substatus_annotations())
            .order_by('-created_at')
        )
        # Раскладка «роль → статусы» живёт в role_scope.py: тем же правилом
        # сужаются замеры, иначе они оказываются шире заказов.
        scoped = scope_orders_for_role(qs, self.request.user)
        return self.scope_to_tenant(scoped)
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = OrderFilterSet
    search_fields = ['order_number', 'customer__full_name', 'customer__phone']
    ordering_fields = ['created_at', 'planned_completion', 'total_amount']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return OrderListSerializer
        if self.action == 'create':
            return OrderCreateSerializer
        if self.action in ['update', 'partial_update']:
            return OrderUpdateSerializer
        if self.action == 'change_status':
            return OrderStatusUpdateSerializer
        # New MVP action serializers
        if self.action == 'change_status_mvp':
            return ChangeStatusSerializer
        if self.action == 'change_material_readiness':
            return ChangeMaterialReadinessSerializer
        if self.action == 'change_production_stage':
            return ChangeProductionStageSerializer
        if self.action == 'change_handover_stage':
            return ChangeHandoverStageSerializer
        if self.action == 'cancel':
            return CancelOrderSerializer
        return OrderDetailSerializer
    
    def create(self, request, *args, **kwargs):
        """Create order via OrderService - supports direct creation without quote"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated = serializer.validated_data

        # Номер заказа: свой, если ателье ведёт нумерацию по-своему, иначе
        # атомарный нумератор О-YYYY-NNN (без гонки).
        year = timezone.now().year
        order_number = (validated.pop('order_number', '') or '').strip()
        if not order_number:
            order_number = next_number('order', year)

        # --- Resolve customer ---
        customer_id = validated.get('customer_id')
        if not customer_id:
            # Simplified mode: find or create customer from name + phone
            client_name = validated.get('client_name', '').strip()
            client_phone = validated.get('client_phone', '').strip()
            try:
                customer = Customer.objects.get(phone=client_phone, is_active=True)
            except Customer.DoesNotExist:
                customer = Customer.objects.create(
                    full_name=client_name,
                    phone=client_phone,
                    address_city='',
                )
            customer_id = customer.id

        # --- Build installation address ---
        address = validated.get('address', '')
        if address:
            # Simplified mode: stuff full address into street field
            installation_address = {
                'city': '',
                'street': address,
                'building': '',
                'apartment': '',
                'notes': '',
            }
        else:
            installation_address = {
                'city': validated.get('installation_address_city', ''),
                'street': validated.get('installation_address_street', ''),
                'building': validated.get('installation_address_building', ''),
                'apartment': validated.get('installation_address_apartment', ''),
                'notes': validated.get('installation_address_notes', ''),
            }

        # --- Resolve notes / comment ---
        notes = validated.get('notes', '')
        comment = validated.get('comment', '')
        final_notes = comment if comment else notes

        # --- Resolve planned_completion / deadline ---
        planned_completion = validated.get('planned_completion')
        deadline = validated.get('deadline')
        final_deadline = deadline if deadline else planned_completion

        with UnitOfWork() as uow:
            service = OrderService(uow)
            try:
                order = service.create_order(
                    customer_id=customer_id,
                    order_number=order_number,
                    installation_address=installation_address,
                    created_by=request.user.id,
                    notes=final_notes,
                    planned_completion=final_deadline,
                    measurements=None  # Measurements added separately
                )

                # Set measurement_date if provided
                measurement_date = validated.get('measurement_date')
                if measurement_date:
                    order.measurement_date = measurement_date
                    order.save(update_fields=['measurement_date'])

                uow.commit()

                # Refresh to get related data
                order.refresh_from_db()

                response_serializer = OrderDetailSerializer(order)
                return Response(response_serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({'error': _safe_error(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def update(self, request, *args, **kwargs):
        """Update order via OrderUpdateSerializer - customer, address, deadline, notes"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        response_serializer = OrderDetailSerializer(updated)
        return Response(response_serializer.data)
    
    @action(detail=True, methods=['get'])
    def execution(self, request, pk=None):
        """
        Get complete order execution summary for role-based order detail view.
        
        Returns role-specific sections for:
        - admin: full overview, payment, production status
        - designer: measurements, selected materials
        - warehouse: material requirements, supply modes
        - production: items to sew, assignment, deadline
        - installer: address, products, handover status
        
        GET /api/v1/orders/{id}/execution/
        """
        order = self.get_object()
        
        from atelier_erp.services.order_execution_service import OrderExecutionService
        
        service = OrderExecutionService()
        summary = service.get_order_execution_summary(order, user=request.user)
        
        return Response(summary)
    
    @action(
        detail=True,
        methods=['get', 'post'],
        url_path='photo-reports',
        url_name='photo-reports',
        parser_classes=[MultiPartParser, FormParser],
        permission_classes=[IsAuthenticated, IsInstallationOrOwnerOrReadOnly]
    )
    def photo_reports(self, request, pk=None):
        """
        Photo report management for order.
        
        GET /api/v1/orders/{id}/photo-reports/ - List active photo reports
        POST /api/v1/orders/{id}/photo-reports/ - Upload new photo report
        
        Upload rules:
        - Only if handover_stage == done (except cancelled)
        - Max file size: 10 MB
        - Allowed types: JPEG, PNG, WebP
        - Cancelled orders: upload forbidden
        - Completed orders: read allowed, upload forbidden
        """
        order = self.get_object()
        
        if request.method == 'GET':
            # List active photo reports.
            # ?measurement=<id> — только фото конкретного окна (карточка окна
            # у установщика показывает свои снимки, а не весь заказ).
            photo_reports = order.photo_reports.filter(is_active=True)
            measurement_id = request.query_params.get('measurement')
            if measurement_id:
                photo_reports = photo_reports.filter(measurement_id=measurement_id)
            serializer = PhotoReportSerializer(
                photo_reports, 
                many=True, 
                context={'request': request}
            )
            return Response({
                'count': photo_reports.count(),
                'photo_reports': serializer.data
            })
        
        # POST - Upload new photo report
        # Check order status
        if order.status == Order.Status.CANCELLED:
            return Response(
                {'error': 'Cannot upload photo report for cancelled order'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if order.status == Order.Status.COMPLETED:
            return Response(
                {'error': 'Cannot upload photo report for completed order'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if photo report is available
        # Allow upload if:
        # A) handover_stage == done
        # B) handover_stage == not_required AND production_stage == done
        # C) заказ дошёл до монтажа (ready / on_installation)
        #
        # Пункт C добавлен осознанно: установщик снимает окна ПОКА вешает, а
        # прежние правила пускали фото только после отметки «установка
        # завершена». Требовать закрыть монтаж, чтобы приложить фото монтажа —
        # обратный порядок, из-за него экран установщика был неработоспособен.
        can_upload_photo_report = (
            order.handover_stage == 'done'
            or (
                order.handover_stage == 'not_required'
                and order.production_stage == 'done'
            )
            or order.status in (Order.Status.READY, Order.Status.ON_INSTALLATION)
        )
        
        if not can_upload_photo_report:
            return Response(
                {
                    'code': 'photo_report_not_available',
                    'detail': 'Фотоотчёт доступен после установки / выдачи или после завершения производства, если установка не требуется'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate and save
        serializer = PhotoReportUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Get optional order_item
        order_item_id = serializer.validated_data.get('order_item')
        order_item = None
        if order_item_id:
            try:
                order_item = OrderItem.objects.get(id=order_item_id, order=order)
            except OrderItem.DoesNotExist:
                return Response(
                    {'error': 'Order item not found'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Create photo report with file from request.FILES
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response(
                {'error': 'No file provided in request'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Привязка к окну замера: установщик снимает конкретное окно.
        measurement = None
        measurement_id = request.data.get('measurement')
        if measurement_id:
            try:
                measurement = Measurement.objects.get(id=measurement_id, order=order)
            except (Measurement.DoesNotExist, ValueError, ValidationError):
                return Response(
                    {'detail': 'Замер не найден в этом заказе', 'code': 'measurement_not_found'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        photo_report = PhotoReport.objects.create(
            order=order,
            order_item=order_item,
            measurement=measurement,
            file=uploaded_file,
            caption=request.data.get('caption', ''),
            uploaded_by=request.user if request.user.is_authenticated else None
        )
        
        return Response(
            PhotoReportSerializer(photo_report, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )

    @action(
        detail=True,
        methods=['delete'],
        url_path=r'photo-reports/(?P<photo_id>[^/.]+)',
        url_name='photo-report-delete',
        permission_classes=[IsAuthenticated, IsInstallationOrOwner]
    )
    def delete_photo_report(self, request, pk=None, photo_id=None):
        """
        DELETE /api/v1/orders/{id}/photo-reports/{photo_id}/

        Мягкое удаление (is_active=False), как и везде в проекте: файл-артефакт
        может понадобиться при разборе, поэтому строку не выкидываем.
        """
        order = self.get_object()
        try:
            photo = order.photo_reports.get(id=photo_id, is_active=True)
        except (PhotoReport.DoesNotExist, ValueError, ValidationError):
            return Response(
                {'detail': 'Фото не найдено', 'code': 'photo_not_found'},
                status=status.HTTP_404_NOT_FOUND
            )

        photo.is_active = False
        photo.save(update_fields=['is_active', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(
        detail=True,
        methods=['get', 'post'],
        url_path='completion-act',
        url_name='completion-act',
        parser_classes=[MultiPartParser, FormParser],
        permission_classes=[IsAuthenticated, IsInstallationOrOwnerOrReadOnly]
    )
    def completion_act(self, request, pk=None):
        """
        Order completion act (АВР) management.

        GET /api/v1/orders/{id}/completion-act/ - Get existing act or status
        POST /api/v1/orders/{id}/completion-act/ - Create act if not exists

        AVR availability rules:
        A) handover_stage == done
        B) handover_stage == not_required AND production_stage == done
        """
        order = self.get_object()

        # Check AVR availability
        can_create_act = (
            order.handover_stage == HandoverStage.DONE
            or (
                order.handover_stage == HandoverStage.NOT_REQUIRED
                and order.production_stage == ProductionStage.DONE
            )
        )

        if request.method == 'GET':
            # Try to get existing act
            try:
                act = order.completion_act
                if act.is_active:
                    serializer = OrderCompletionActSerializer(act, context={'request': request})
                    return Response({
                        'exists': True,
                        'status': act.status,
                        'act': serializer.data
                    })
            except OrderCompletionAct.DoesNotExist:
                pass

            # No active act exists
            if not can_create_act:
                return Response({
                    'exists': False,
                    'status': 'not_available',
                    'message': 'АВР доступен после установки / выдачи'
                })
            return Response({
                'exists': False,
                'status': 'not_created',
                'message': 'АВР ещё не создан'
            })

        # POST - Create act
        if not can_create_act:
            return Response(
                {
                    'code': 'act_not_available',
                    'detail': 'АВР доступен после установки / выдачи'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if act already exists
        try:
            existing_act = order.completion_act
            if existing_act.is_active:
                serializer = OrderCompletionActSerializer(existing_act, context={'request': request})
                return Response({
                    'exists': True,
                    'act': serializer.data,
                    'message': 'АВР уже существует'
                })
        except OrderCompletionAct.DoesNotExist:
            pass

        # Generate act number: АВР-{order_number}
        act_number = f"АВР-{order.order_number}"

        # Create the act
        act = OrderCompletionAct.objects.create(
            order=order,
            act_number=act_number,
            status=OrderCompletionAct.Status.DRAFT,
            created_by=request.user if request.user.is_authenticated else None
        )

        serializer = OrderCompletionActSerializer(act, context={'request': request})
        return Response({
            'exists': True,
            'act': serializer.data,
            'message': 'АВР успешно создан'
        }, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=['post'],
        url_path='completion-act/upload-signed',
        url_name='completion-act-upload-signed',
        parser_classes=[MultiPartParser, FormParser],
        permission_classes=[IsAuthenticated, IsInstallationOrOwner]
    )
    def upload_signed_completion_act(self, request, pk=None):
        """
        Upload signed completion act file.
        POST /api/v1/orders/{id}/completion-act/upload-signed/

        Body (multipart/form-data):
        - signed_file: File (PDF, JPG, PNG, WebP, max 20MB)
        - notes: Optional notes

        If act doesn't exist, creates it automatically.
        Sets status to 'signed' after upload.
        Does NOT change Order.status.
        """
        order = self.get_object()

        # Check AVR availability
        can_upload = (
            order.handover_stage == HandoverStage.DONE
            or (
                order.handover_stage == HandoverStage.NOT_REQUIRED
                and order.production_stage == ProductionStage.DONE
            )
        )

        if not can_upload:
            return Response(
                {
                    'code': 'act_not_available',
                    'detail': 'АВР доступен после установки / выдачи'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate upload data
        serializer = OrderCompletionActUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Get or create act
        act, created = OrderCompletionAct.objects.get_or_create(
            order=order,
            defaults={
                'act_number': f"АВР-{order.order_number}",
                'status': OrderCompletionAct.Status.DRAFT,
                'created_by': request.user if request.user.is_authenticated else None,
                'is_active': True
            }
        )

        # If act was soft-deleted, reactivate it
        if not act.is_active:
            act.is_active = True
            act.status = OrderCompletionAct.Status.DRAFT

        # Update act with signed file
        uploaded_file = request.FILES.get('signed_file')
        if not uploaded_file:
            return Response(
                {'error': 'No file provided in request'},
                status=status.HTTP_400_BAD_REQUEST
            )

        act.signed_file = uploaded_file
        act.status = OrderCompletionAct.Status.SIGNED
        act.signed_at = timezone.now()
        act.signed_file_uploaded_by = request.user if request.user.is_authenticated else None

        # Update notes if provided
        notes = request.data.get('notes', '')
        if notes:
            act.notes = notes

        act.save()

        response_serializer = OrderCompletionActSerializer(act, context={'request': request})
        return Response({
            'act': response_serializer.data,
            'created': created,
            'message': 'Подписанный АВР успешно загружен'
        })

    @action(
        detail=True,
        methods=['get'],
        url_path='completion-checklist',
        url_name='completion-checklist',
        permission_classes=[IsAuthenticated]
    )
    def completion_checklist(self, request, pk=None):
        """
        Return completion checklist for order.
        GET /api/v1/orders/{id}/completion-checklist/
        """
        from ..constants import ProductionStage, HandoverStage
        order = self.get_object()

        installation_done = order.handover_stage in [HandoverStage.DONE, HandoverStage.NOT_REQUIRED]
        has_photos = order.photo_reports.filter(is_active=True).exists()
        has_act = False
        act_signed = False
        try:
            act = order.completion_act
            has_act = act.is_active
            act_signed = act.status == OrderCompletionAct.Status.SIGNED
        except OrderCompletionAct.DoesNotExist:
            pass
        fully_paid = order.paid_amount >= order.total_amount

        checklist = [
            {
                "key": "installation",
                "label": "Установка/выдача завершена",
                "done": installation_done,
            },
            {
                "key": "photos",
                "label": "Фотоотчёт загружен",
                "done": has_photos,
            },
            {
                "key": "act_created",
                "label": "АВР создан",
                "done": has_act,
            },
            {
                "key": "act_signed",
                "label": "Подписанный АВР загружен",
                "done": act_signed,
            },
            {
                "key": "payment",
                "label": "Оплата закрыта",
                "done": fully_paid,
            },
        ]

        can_complete = all(item["done"] for item in checklist)

        return Response({
            "checklist": checklist,
            "can_complete": can_complete,
        })

    @action(detail=True, methods=['post'])
    def change_status(self, request, pk=None):
        """
        Order state transition via service layer FSM
        POST /api/v1/orders/{id}/change_status/
        Body: {"new_status": "confirmed", "reason": "..."}
        """
        order = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        new_status = serializer.validated_data['new_status']
        reason = serializer.validated_data.get('reason', '')
        
        with UnitOfWork() as uow:
            service = OrderService(uow)
            try:
                if new_status == Order.Status.CANCELLED:
                    order = service.cancel_order(order.id, cancelled_by=request.user, reason=reason)
                else:
                    order = service.transition_status_mvp(
                        order_id=order.id,
                        new_status=new_status,
                        changed_by=request.user.id if request.user else None,
                        notes=reason
                    )
                uow.commit()
                
                response_serializer = OrderDetailSerializer(order)
                return Response(response_serializer.data)
            except InvalidOrderStatusTransition as e:
                return Response(
                    {'error': str(e), 'current_status': order.status, 'allowed_transitions': e.allowed},
                    status=status.HTTP_409_CONFLICT
                )
            except OrderNotFoundError as e:
                return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
            except Exception as e:
                return Response({'error': _safe_error(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    # ============================================
    # ЯВНЫЕ ДЕЙСТВИЯ (MVP Workflow)
    # ============================================

    @action(detail=True, methods=['post'], url_path='accept', permission_classes=[IsAuthenticated, IsOwnerOrDesigner])
    def accept(self, request, pk=None):
        """
        Принять заказ в работу (new → in_work).
        Требует: принятое КП + позиции заказа.
        POST /api/v1/orders/{id}/accept/
        """
        return self._mvp_transition(request, pk, Order.Status.IN_WORK)

    @action(detail=True, methods=['post'], url_path='send-to-production', permission_classes=[IsAuthenticated, IsOwnerOrDesigner])
    def send_to_production(self, request, pk=None):
        """
        Передать заказ в цех (in_work → in_production).
        Требует: материалы обеспечены (material_readiness != not_ready).
        POST /api/v1/orders/{id}/send-to-production/
        """
        return self._mvp_transition(request, pk, Order.Status.IN_PRODUCTION)

    # ============================================
    # NEW ACTION ENDPOINTS (MVP Workflow)
    # ============================================
    
    @action(detail=True, methods=['post'], url_path='change-status', permission_classes=[IsAuthenticated, IsOwnerOrDesigner])
    def change_status_mvp(self, request, pk=None):
        """
        Change order status with MVP workflow business rules.
        POST /api/v1/orders/{id}/change-status/
        Body: {"status": "in_production"}
        """
        order = self.get_object()
        serializer = ChangeStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data['status']

        from atelier_erp.services.exceptions import OrderValidationError

        with UnitOfWork() as uow:
            service = OrderService(uow)
            try:
                order = service.transition_status_mvp(
                    order_id=order.id,
                    new_status=new_status,
                    changed_by=request.user.id if request.user else None,
                    notes=""
                )
                uow.commit()

                response_serializer = OrderDetailSerializer(order)
                return Response({'order': response_serializer.data})
            except InvalidOrderStatusTransition as e:
                return Response(
                    {'detail': str(e), 'code': 'invalid_transition', 'allowed_transitions': e.allowed},
                    status=status.HTTP_409_CONFLICT
                )
            except OrderValidationError as e:
                resp = {'detail': str(e), 'code': e.code}
                if e.code == 'payment_required' and hasattr(e, 'balance_due'):
                    resp['balance_due'] = str(e.balance_due)
                return Response(resp, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                return Response(
                    {'detail': _safe_error(e), 'code': 'status_change_error'},
                    status=status.HTTP_400_BAD_REQUEST
                )
    
    @action(detail=True, methods=['post'], url_path='change-material-readiness', permission_classes=[IsAuthenticated, IsWarehouseOrOwner])
    def change_material_readiness(self, request, pk=None):
        """
        Change order material readiness state.
        POST /api/v1/orders/{id}/change-material-readiness/
        Body: {"material_readiness": "ready"}
        """
        order = self.get_object()
        serializer = ChangeMaterialReadinessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        from atelier_erp.services.order_execution_service import OrderExecutionService
        exec_service = OrderExecutionService()
        
        try:
            updated_order, warnings = exec_service.change_material_readiness(
                order=order,
                material_readiness=serializer.validated_data['material_readiness'],
                changed_by=request.user.id if request.user else None,
                notes=""
            )
            
            # Return both order and execution summary
            response_serializer = OrderDetailSerializer(updated_order)
            return Response({
                'order': response_serializer.data,
                'warnings': warnings
            })
        except Exception as e:
            return Response(
                {'detail': _safe_error(e), 'code': 'material_readiness_error'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'], url_path='change-production-stage', permission_classes=[IsAuthenticated, IsSeamstressOrOwner])
    def change_production_stage(self, request, pk=None):
        """
        Change order production stage.
        POST /api/v1/orders/{id}/change-production-stage/
        Body: {"production_stage": "sewing"}
        """
        order = self.get_object()
        serializer = ChangeProductionStageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        from atelier_erp.services.order_execution_service import OrderExecutionService
        exec_service = OrderExecutionService()
        
        try:
            updated_order = exec_service.change_production_stage(
                order=order,
                production_stage=serializer.validated_data['production_stage'],
                changed_by=request.user.id if request.user else None,
                notes=""
            )
            
            response_serializer = OrderDetailSerializer(updated_order)
            return Response({'order': response_serializer.data})
        except Exception as e:
            return Response(
                {'detail': _safe_error(e), 'code': 'production_stage_error'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'], url_path='change-handover-stage', permission_classes=[IsAuthenticated, IsInstallationOrOwner])
    def change_handover_stage(self, request, pk=None):
        """
        Change order handover stage.
        POST /api/v1/orders/{id}/change-handover-stage/
        Body: {"handover_stage": "done"}
        """
        order = self.get_object()
        serializer = ChangeHandoverStageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        from atelier_erp.services.order_execution_service import OrderExecutionService
        exec_service = OrderExecutionService()
        
        try:
            updated_order, can_auto_complete = exec_service.change_handover_stage(
                order=order,
                handover_stage=serializer.validated_data['handover_stage'],
                changed_by=request.user.id if request.user else None,
                notes=""
            )
            
            response_serializer = OrderDetailSerializer(updated_order)
            return Response({
                'order': response_serializer.data,
                'can_auto_complete': can_auto_complete
            })
        except Exception as e:
            return Response(
                {'detail': _safe_error(e), 'code': 'handover_stage_error'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'], url_path='cancel', permission_classes=[IsAuthenticated, IsManagerOrAdmin])
    def cancel(self, request, pk=None):
        """
        Cancel order with required reason.
        POST /api/v1/orders/{id}/cancel/
        Body: {"reason": "Клиент отказался от заказа"}
        """
        order = self.get_object()
        serializer = CancelOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        reason = serializer.validated_data['reason']
        
        from atelier_erp.services.order_execution_service import OrderExecutionService
        from atelier_erp.services.exceptions import OrderValidationError
        
        exec_service = OrderExecutionService()
        
        try:
            cancelled_order = exec_service.cancel_order(
                order=order,
                reason=reason,
                user=request.user
            )
            
            response_serializer = OrderDetailSerializer(cancelled_order)
            return Response({
                'order': response_serializer.data,
                'message': 'Заказ успешно отменён.'
            })
        except OrderValidationError as e:
            # Map specific errors to codes
            error_msg = str(e)
            code = 'cancel_error'
            if 'уже отменён' in error_msg:
                code = 'already_cancelled'
            elif 'завершённый' in error_msg:
                code = 'completed_order'
            elif 'Причина' in error_msg:
                code = 'reason_required'
            
            return Response(
                {'detail': error_msg, 'code': code},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'detail': _safe_error(e), 'code': 'cancel_error'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'], url_path='generate-items-from-quote', permission_classes=[IsAuthenticated, IsOwnerOrDesigner])
    def generate_items_from_quote(self, request, pk=None):
        """
        Generate OrderItems from linked QuoteItems.
        POST /api/v1/orders/{id}/generate-items-from-quote/
        Body: {"quote_id": "uuid"} (optional - defaults to order.quote)
        """
        order = self.get_object()
        
        # Get optional quote_id from request
        quote_id = request.data.get('quote_id')
        quote = None
        
        if quote_id:
            from ..models import Quote
            try:
                quote = Quote.objects.get(id=quote_id)
            except Quote.DoesNotExist:
                return Response(
                    {'detail': 'Quote not found', 'code': 'quote_not_found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        from atelier_erp.services import OrderItemGenerationService
        from atelier_erp.services.exceptions import OrderValidationError
        
        service = OrderItemGenerationService(user=request.user.id if request.user else None)
        
        # First validate
        validation = service.validate_for_generation(order, quote)
        if not validation['valid']:
            return Response(
                {
                    'detail': validation['reason'],
                    'code': 'generation_validation_error',
                    'validation': validation
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            created_items = service.generate_order_items_from_quote(
                order=order,
                quote=quote,
                force=False
            )
            
            # Return fresh order data
            response_serializer = OrderDetailSerializer(order)
            return Response({
                'order': response_serializer.data,
                'created_count': len(created_items),
                'message': f'Создано {len(created_items)} позиций из КП'
            })
            
        except OrderValidationError as e:
            return Response(
                {'detail': str(e), 'code': 'generation_error'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'detail': _safe_error(e), 'code': 'generation_error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    

    @action(
        detail=True,
        methods=['patch', 'delete'],
        url_path='items/(?P<item_id>[^/.]+)',
        url_name='manage-item',
        permission_classes=[IsAuthenticated, IsOwnerOrDesigner],
    )
    def manage_item(self, request, pk=None, item_id=None):
        """
        PATCH /api/v1/orders/{id}/items/{item_id}/  — частичное обновление позиции
        DELETE /api/v1/orders/{id}/items/{item_id}/ — удалить позицию
        """
        from decimal import Decimal, InvalidOperation
        from atelier_erp.services import OrderItemGenerationService

        order = self.get_object()
        try:
            item = order.items.get(id=item_id)
        except OrderItem.DoesNotExist:
            return Response({"detail": "Позиция не найдена."}, status=status.HTTP_404_NOT_FOUND)

        if request.method == "DELETE":
            # Возвращаем на склад материал, списанный именно под эту позицию —
            # ДО удаления (order_item на MaterialDeduction — SET_NULL, после
            # delete() связь потерялась бы). Раньше материал возвращался,
            # только когда позиций не оставалось вообще ни одной — удаление
            # одной из нескольких позиций молча оставляло материал списанным.
            from atelier_erp.services.material_deduction_service import (
                return_materials_for_item, return_materials_for_order,
            )
            return_materials_for_item(item)
            item.delete()
            # Пересчёт через тот же сервис, что и генерация позиций из КП:
            # сумма позиций сама по себе не включает installation_cost/
            # delivery_cost/скидку КП — если считать total_amount отдельной
            # формулой здесь, после правки позиции сумма заказа откатывалась
            # бы ниже реальной суммы КП.
            OrderItemGenerationService().recalculate_order_total(order)

            # Подчищаем и списания без order_item (легаси-записи, сделанные до
            # появления этой привязки) — return_materials_for_order трогает
            # только ещё не возвращённые, поэтому не задвоит уже возвращённое.
            if not order.items.exists():
                return_materials_for_order(order)

            return Response(status=status.HTTP_204_NO_CONTENT)

        # PATCH — partial update, any combination of fields
        data = request.data
        update_fields = []
        errors = {}
        old_quantity = item.quantity

        # quantity
        if "quantity" in data:
            try:
                qty = int(data["quantity"])
                if qty < 1:
                    raise ValueError
                item.quantity = qty
                update_fields.append("quantity")
            except (ValueError, TypeError):
                errors["quantity"] = "Должно быть целым числом >= 1."

        # unit_price
        if "unit_price" in data:
            try:
                item.unit_price = Decimal(str(data["unit_price"]))
                update_fields.append("unit_price")
            except (InvalidOperation, ValueError):
                errors["unit_price"] = "Некорректная сумма."

        # text fields
        for field in ["room_name", "window_name", "sewing_type", "notes"]:
            if field in data:
                setattr(item, field, str(data[field]))
                update_fields.append(field)

        # nullable int fields
        for field in ["folds_count", "window_width_cm", "window_height_cm"]:
            if field in data:
                val = data[field]
                try:
                    setattr(item, field, int(val) if val not in (None, "", "null") else None)
                    update_fields.append(field)
                except (ValueError, TypeError):
                    errors[field] = "Должно быть целым числом или пустым."

        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        if not update_fields:
            return Response({"detail": "Нет полей для обновления."}, status=status.HTTP_400_BAD_REQUEST)

        # Пересчитать total_price если изменилась цена или количество
        if "unit_price" in update_fields or "quantity" in update_fields:
            item.total_price = (item.unit_price or Decimal("0")) * (item.quantity or 1)
            if "total_price" not in update_fields:
                update_fields.append("total_price")

        item.save(update_fields=update_fields)

        # Количество позиции изменилось — списание материала под неё было
        # рассчитано на старое количество и никак не следило за изменением
        # (см. material_deduction_service.adjust_deduction_for_item_quantity).
        if "quantity" in update_fields and old_quantity != item.quantity:
            from atelier_erp.services.material_deduction_service import adjust_deduction_for_item_quantity
            adjust_deduction_for_item_quantity(item, old_quantity, item.quantity)

        OrderItemGenerationService().recalculate_order_total(order)

        return Response({
            "id": str(item.id),
            "room_name": item.room_name,
            "window_name": item.window_name,
            "sewing_type": item.sewing_type,
            "notes": item.notes,
            "folds_count": item.folds_count,
            "window_width_cm": item.window_width_cm,
            "window_height_cm": item.window_height_cm,
            "quantity": item.quantity,
            "unit_price": str(item.unit_price or "0"),
            "total_price": str(item.total_price or "0"),
        })

    def _mvp_transition(self, request, pk, target_status):
        """Helper for simple state transitions"""
        order = self.get_object()
        
        with UnitOfWork() as uow:
            service = OrderService(uow)
            try:
                order = service.transition_status_mvp(
                    order_id=order.id,
                    new_status=target_status,
                    changed_by=request.user.id
                )
                uow.commit()
                
                response_serializer = OrderDetailSerializer(order)
                return Response(response_serializer.data)
            except InvalidOrderStatusTransition as e:
                return Response(
                    {'error': str(e), 'current_status': order.status},
                    status=status.HTTP_409_CONFLICT
                )
            except Exception as e:
                return Response({'error': _safe_error(e)}, status=status.HTTP_400_BAD_REQUEST)


    @action(
        detail=True,
        methods=['get', 'post'],
        url_path='measurements',
        url_name='measurements',
        permission_classes=[IsAuthenticated, IsOwnerOrDesigner]
    )
    def measurements(self, request, pk=None):
        """
        Order measurements management.

        GET  /api/v1/orders/{id}/measurements/  — list measurements
        POST /api/v1/orders/{id}/measurements/  — add measurement
        """
        order = self.get_object()

        if request.method == 'GET':
            measurements = order.measurements.all().order_by('room_name', 'window_name')
            serializer = MeasurementSerializer(measurements, many=True)
            return Response({
                'count': measurements.count(),
                'results': serializer.data,
            })

        # POST — create measurement
        serializer = MeasurementCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        width_cm = int(data['width'])

        # Обе ткани разрешаются по имени. Метраж — ручной ввод клиента
        # (2026-07-20: авторасчёт из ширины/сборки отключён везде как сырой).
        def resolve_fabric(name):
            return Fabric.objects.filter(name__iexact=name).first() if name else None

        curtain_fabric = resolve_fabric(data.get('curtain_fabric_name', ''))
        tulle_fabric = resolve_fabric(data.get('tulle_fabric_name', ''))

        measurement = Measurement.objects.create(
            order=order,
            room_name=data['room_name'],
            window_name=data.get('window_number', ''),
            width_cm=width_cm,
            height_cm=int(data['height']),
            mounting_type=data.get('mounting_type', ''),
            notes=data.get('comment', ''),
            curtain_fabric=curtain_fabric,
            curtain_meters=data.get('curtain_meters') or Decimal('0'),
            tulle_fabric=tulle_fabric,
            tulle_meters=data.get('tulle_meters') or Decimal('0'),
            measured_by=request.user if request.user.is_authenticated else None,
        )

        response_serializer = MeasurementSerializer(measurement)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=['get'],
        url_path='quotes',
        url_name='quotes',
        permission_classes=[IsAuthenticated]
    )
    def quotes(self, request, pk=None):
        """
        List quotes for an order.
        GET /api/v1/orders/{id}/quotes/
        """
        order = self.get_object()
        quotes = order.related_quotes.all().order_by('-created_at')
        serializer = QuoteSerializer(quotes, many=True)
        return Response({
            'count': quotes.count(),
            'results': serializer.data,
        })

    @action(
        detail=True,
        methods=['get'],
        url_path='materials',
        url_name='materials',
        permission_classes=[IsAuthenticated]
    )
    def materials(self, request, pk=None):
        """
        List materials for an order.
        GET /api/v1/orders/{id}/materials/
        """
        order = self.get_object()
        materials = order.materials.all().order_by('name')
        serializer = OrderMaterialSerializer(materials, many=True)
        return Response({
            'count': materials.count(),
            'results': serializer.data,
        })

    @action(
        detail=True,
        methods=['patch'],
        url_path=r'materials/(?P<material_id>[^/.]+)',
        url_name='update-material',
        permission_classes=[IsAuthenticated, IsWarehouseOrOwner]
    )
    def update_material(self, request, pk=None, material_id=None):
        """
        Update material status.
        PATCH /api/v1/orders/{id}/materials/{material_id}/
        Body: {"status": "ready", "comment": "..."}
        """
        order = self.get_object()
        try:
            material = order.materials.get(pk=material_id)
        except OrderMaterial.DoesNotExist:
            return Response(
                {'error': f'Material {material_id} not found for this order'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = OrderMaterialUpdateSerializer(material, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)

        # Recalculate order material readiness
        service = OrderService(unit_of_work=None)
        service.recalculate_material_readiness(order)
        order.refresh_from_db()

        return Response({
            'material': OrderMaterialSerializer(material).data,
            'order_material_readiness': order.material_readiness,
            'order_material_readiness_label': order.get_material_readiness_display(),
        })

# Единый источник истины для подписей статусов — Order.Status на модели.
# Раньше здесь был отдельный словарь, из-за чего рабочие очереди отдавали
# 'Готов к установке'/'На установке', а сериализаторы (get_status_display) —
# 'Готов'/'На установке / выдаче'. Один заказ получал разную подпись в
# зависимости от эндпоинта, а веб и мобилка держали ещё по своей копии.
STATUS_LABELS = {value: str(label) for value, label in Order.Status.choices}

MATERIAL_LABELS = {
    MaterialReadiness.NOT_READY: 'Не готово',
    MaterialReadiness.PARTIALLY_READY: 'Частично готово',
    MaterialReadiness.READY: 'Готово',
}

PRODUCTION_LABELS = {
    ProductionStage.NOT_STARTED: 'Не начато',
    ProductionStage.SEWING: 'Пошив',
    ProductionStage.DONE: 'Готово',
}

HANDOVER_LABELS = {
    HandoverStage.NOT_REQUIRED: 'Не требуется',
    HandoverStage.PENDING: 'Ожидает установки',
    HandoverStage.SCHEDULED: 'Запланировано',
    HandoverStage.IN_PROGRESS: 'В процессе',
    HandoverStage.DONE: 'Установка завершена',
}

QUOTE_LABELS = {
    Quote.Status.DRAFT: 'Черновик',
    Quote.Status.SENT: 'На согласовании',
    Quote.Status.APPROVED: 'Принято',
    Quote.Status.REJECTED: 'Отклонено',
    Quote.Status.EXPIRED: 'Истекло',
}


def _money(value):
    return str(value or Decimal('0'))


def _date(value):
    return value.isoformat() if value else None


def _address(order):
    parts = [
        order.installation_address_city,
        order.installation_address_street,
        order.installation_address_building,
        order.installation_address_apartment,
    ]
    return ', '.join(part for part in parts if part) or ''


def _base_order(order, include_financial=True):
    """Базовый payload заказа для рабочих очередей.

    include_financial=False скрывает денежные поля (суммы/оплаты/баланс) —
    для ролей без финансового доступа (склад/цех/монтаж).
    """
    balance_due = max(order.remaining_amount, Decimal('0'))
    is_paid = balance_due <= 0

    data = {
        'id': str(order.id),
        'order_number': order.order_number,
        'customer_name': order.customer.full_name,
        'customer_phone': order.customer.phone,
        'installation_address': _address(order),
        'status': order.status,
        'status_label': 'Оплата закрыта' if order.status == Order.Status.WAITING_FINAL_PAYMENT and is_paid else STATUS_LABELS.get(order.status, order.status),
        'planned_completion_date': _date(order.planned_completion),
        'measurement_date': _date(order.measurement_date),
        'installation_date': _date(order.installation_date),
        'material_readiness': order.material_readiness,
        'material_readiness_label': MATERIAL_LABELS.get(order.material_readiness, order.material_readiness),
        'production_stage': order.production_stage,
        'production_stage_label': PRODUCTION_LABELS.get(order.production_stage, order.production_stage),
        'handover_stage': order.handover_stage,
        'handover_stage_label': HANDOVER_LABELS.get(order.handover_stage, order.handover_stage),
        'order_url': f'/orders/{order.id}',
    }
    if include_financial:
        data.update({
            'total_amount': _money(order.total_amount),
            'paid_amount': _money(order.paid_amount),
            'balance_due': _money(balance_due),
            'payment_state': 'paid' if is_paid else 'partial' if order.paid_amount > 0 else 'unpaid',
        })
    return data


def _quote_payload(quote):
    return {
        'id': str(quote.id),
        'quote_number': quote.quote_number,
        'customer_name': quote.customer.full_name,
        'customer_phone': quote.customer.phone,
        'status': quote.status,
        'status_label': QUOTE_LABELS.get(quote.status, quote.status),
        'total': _money(quote.total),
        'items_count': quote.items.count(),
        'order_id': str(quote.order_id) if quote.order_id else None,
        'order_url': f'/orders/{quote.order_id}' if quote.order_id else '',
        'quote_url': f'/quotes/{quote.id}',
    }


def _measurement_payload(measurement):
    curtain = measurement.curtain_fabric or measurement.selected_fabric

    return {
        'id': str(measurement.id),
        'room_name': measurement.room_name,
        'window_name': measurement.window_name,
        'product_type': measurement.mounting_type or 'Шторы',
        'width_cm': measurement.width_cm,
        'height_cm': measurement.height_cm,
        'fabric_name': curtain.name if curtain else '',
        'fabric_meters': _money(measurement.curtain_meters),
        'tulle_name': measurement.tulle_fabric.name if measurement.tulle_fabric else '',
        'tulle_meters': _money(measurement.tulle_meters),
        'notes': measurement.notes,
    }


def _quote_item_payload(item):
    return {
        'id': str(item.id),
        'room_name': item.room_name,
        'window_name': item.window_name,
        'product_type': item.sewing_type or 'Шторы',
        'width_cm': item.window_width_cm,
        'height_cm': item.window_height_cm,
        'fabric_name': item.fabric.name if item.fabric else '',
        'fabric_meters': _money(item.fabric_meters),
        'tulle_name': item.tulle_fabric.name if item.tulle_fabric else '',
        'tulle_meters': _money(item.tulle_meters),
        'notes': '',
    }


def _order_item_payload(item):
    label = ''
    if item.fabric:
        label = item.fabric.name
    elif item.service:
        label = item.service.name
    elif item.cornice:
        label = item.cornice.name

    return {
        'id': str(item.id),
        'room_name': item.room_name,
        'window_name': item.window_name,
        'product_type': item.sewing_type or item.item_type,
        'width_cm': item.window_width_cm,
        'height_cm': item.window_height_cm,
        'fabric_name': label if item.item_type == OrderItem.ItemType.FABRIC else '',
        'fabric_meters': _money(item.quantity) if item.item_type == OrderItem.ItemType.FABRIC else '0',
        'tulle_name': '',
        'tulle_meters': '0',
        'notes': item.notes,
    }


def _related_quotes(order):
    quotes = list(order.related_quotes.all())
    if order.quote_id and order.quote not in quotes:
        quotes.append(order.quote)
    return quotes


def _best_quote(order):
    quotes = _related_quotes(order)
    approved = [quote for quote in quotes if quote.status == Quote.Status.APPROVED]
    return approved[0] if approved else quotes[0] if quotes else None


def _measurement_summary(order):
    return [_measurement_payload(item) for item in order.measurements.all()]


def _selected_materials(order):
    materials = _measurement_summary(order)
    if materials:
        return materials

    quote = _best_quote(order)
    if quote:
        return [_quote_item_payload(item) for item in quote.items.all()]

    return [_order_item_payload(item) for item in order.items.all()]


def _items_for_work(order):
    quote = _best_quote(order)
    if quote and quote.items.exists():
        return [_quote_item_payload(item) for item in quote.items.all()]

    measurements = _measurement_summary(order)
    if measurements:
        return measurements

    return [_order_item_payload(item) for item in order.items.all()]


def _photo_status(order):
    count = order.photo_reports.filter(is_active=True).count()
    return {
        'photo_report_status': 'uploaded' if count else 'missing',
        'photo_report_count': count,
    }


def _completion_act_status(order):
    act = getattr(order, 'completion_act', None)
    if not act or not act.is_active:
        return {
            'completion_act_status': 'missing',
            'signed_act_uploaded': False,
        }

    return {
        'completion_act_status': act.status,
        'signed_act_uploaded': bool(act.signed_file),
    }


def _base_order_queryset():
    return (
        Order.objects
        .select_related('customer', 'quote')
        .prefetch_related(
            'measurements__selected_fabric',
            'measurements__curtain_fabric',
            'measurements__tulle_fabric',
            'related_quotes__items__fabric',
            'related_quotes__items__tulle_fabric',
            'items__fabric',
            'items__service',
            'items__cornice',
            'photo_reports',
            'payments',
        )
        .order_by('planned_completion', '-created_at')
    )


class BaseWorkQueueView(APIView):
    permission_classes = [IsAuthenticated]
    DEFAULT_LIMIT = 50
    MAX_LIMIT = 200

    def orders(self):
        return _base_order_queryset()

    def include_financial(self):
        """Видит ли текущий пользователь денежные поля заказа."""
        return user_in(self.request.user, *Roles.FINANCIAL_ACCESS)

    def get_limit(self):
        try:
            limit = int(self.request.query_params.get('limit', self.DEFAULT_LIMIT))
        except (TypeError, ValueError):
            limit = self.DEFAULT_LIMIT
        return min(max(limit, 1), self.MAX_LIMIT)


class ProductionWorkQueueView(BaseWorkQueueView):
    permission_classes = [IsAuthenticated, IsSeamstressOrOwner]

    def _payload(self, order):
        data = _base_order(order, self.include_financial())
        data.update({
            'items_to_sew': _items_for_work(order),
            'actions': {
                'can_start_sewing': order.status == Order.Status.IN_PRODUCTION and order.production_stage == ProductionStage.NOT_STARTED,
                'can_mark_done': order.status == Order.Status.IN_PRODUCTION and order.production_stage == ProductionStage.SEWING,
            },
        })
        return data

    def get(self, request):
        limit = self.get_limit()
        base = self.orders()
        active = base.filter(
            Q(status=Order.Status.IN_PRODUCTION) | Q(status=Order.Status.IN_WORK, material_readiness=MaterialReadiness.READY)
        )
        ready_to_start = [
            self._payload(o) for o in
            active.filter(
                Q(status=Order.Status.IN_WORK) | Q(production_stage=ProductionStage.NOT_STARTED)
            )[:limit]
        ]
        in_sewing = [
            self._payload(o) for o in
            active.filter(status=Order.Status.IN_PRODUCTION, production_stage=ProductionStage.SEWING)[:limit]
        ]
        done = [
            self._payload(o) for o in
            base.filter(
                Q(status=Order.Status.IN_PRODUCTION, production_stage=ProductionStage.DONE) | Q(status=Order.Status.READY)
            )[:limit]
        ]
        return Response({'ready_to_start': ready_to_start, 'in_sewing': in_sewing, 'done': done})


class InstallationWorkQueueView(BaseWorkQueueView):
    permission_classes = [IsAuthenticated, IsInstallationOrOwner]

    def _payload(self, order):
        data = _base_order(order, self.include_financial())
        data.update({
            'items_to_install': _items_for_work(order),
            **_photo_status(order),
            **_completion_act_status(order),
        })
        return data

    def get(self, request):
        limit = self.get_limit()
        orders = self.orders()
        ready = [self._payload(o) for o in orders.filter(status=Order.Status.READY)[:limit]]
        in_installation = [self._payload(o) for o in orders.filter(status=Order.Status.ON_INSTALLATION)[:limit]]
        payment = [self._payload(o) for o in orders.filter(status=Order.Status.WAITING_FINAL_PAYMENT)[:limit]]
        needs_artifacts = [
            item for item in payment
            if item['photo_report_status'] == 'missing' or not item['signed_act_uploaded']
        ]
        return Response({
            'ready_for_installation': ready,
            'in_installation': in_installation,
            'needs_photo_or_avr': needs_artifacts,
            'waiting_final_payment': payment,
        })


class WarehouseWorkQueueView(BaseWorkQueueView):
    permission_classes = [IsAuthenticated, IsWarehouseOrOwner]

    def _payload(self, order):
        data = _base_order(order, self.include_financial())
        data.update({'selected_materials': _selected_materials(order)})
        return data

    def get(self, request):
        limit = self.get_limit()
        orders = self.orders().filter(status__in=[
            Order.Status.IN_WORK,
            Order.Status.IN_PRODUCTION,
            Order.Status.READY,
        ]).annotate(
            has_measurements=Exists(Measurement.objects.filter(order=OuterRef('pk')))
        )

        def group(readiness):
            return [self._payload(o) for o in orders.filter(material_readiness=readiness)[:limit]]

        fabrics = [
            {
                'id': str(fabric.id),
                'hanger_number': fabric.hanger_number,
                'name': fabric.name,
                'stock_meters': _money(fabric.stock_meters),
                'reserved_meters': _money(fabric.reserved_meters),
                'available_meters': _money(fabric.available_meters),
                'color': fabric.color,
                'location': fabric.location,
            }
            for fabric in Fabric.objects.filter(is_active=True).order_by('name')[:30]
        ]

        needs_check = [self._payload(o) for o in orders.filter(has_measurements=False)[:limit]]

        return Response({
            'needs_check': needs_check,
            'not_ready': group(MaterialReadiness.NOT_READY),
            'partially_ready': group(MaterialReadiness.PARTIALLY_READY),
            'ready': group(MaterialReadiness.READY),
            'fabrics': fabrics,
        })


class DesignerWorkQueueView(BaseWorkQueueView):
    permission_classes = [IsAuthenticated, IsOwnerOrDesigner]

    def _payload(self, order):
        data = _base_order(order, self.include_financial())
        customer_id = str(order.customer_id)
        data.update({
            'measurement_summary': _measurement_summary(order),
            'measurements_url': f'/measurements?order={order.id}',
            'estimate_url': f'/orders/{order.id}/quote',
        })
        return data

    def get(self, request):
        limit = self.get_limit()
        today = timezone.localdate()
        orders = self.orders().filter(status__in=[Order.Status.NEW, Order.Status.IN_WORK]).annotate(
            has_measurements=Exists(Measurement.objects.filter(order=OuterRef('pk'))),
            has_quotes=Exists(Quote.objects.filter(order=OuterRef('pk'))),
            has_pending_quote=Exists(
                Quote.objects.filter(
                    order=OuterRef('pk'),
                    status__in=[Quote.Status.DRAFT, Quote.Status.SENT],
                )
            ),
        )

        qs_needs_meas = orders.filter(has_measurements=False)
        qs_needs_quote = orders.filter(has_measurements=True, has_quotes=False)
        qs_quote_progress = orders.filter(has_measurements=True, has_quotes=True, has_pending_quote=True)
        qs_overdue = orders.filter(planned_completion__lt=today)

        return Response({
            'needs_measurement': [self._payload(o) for o in qs_needs_meas[:limit]],
            'measurement_done_needs_quote': [self._payload(o) for o in qs_needs_quote[:limit]],
            'quote_in_progress': [self._payload(o) for o in qs_quote_progress[:limit]],
            'overdue': [self._payload(o) for o in qs_overdue[:limit]],
        })


class QuotesWorkQueueView(BaseWorkQueueView):
    permission_classes = [IsAuthenticated, IsOwnerOrDesigner]

    def get(self, request):
        limit = self.get_limit()
        orders = self.orders().filter(status__in=[Order.Status.NEW, Order.Status.IN_WORK]).annotate(
            has_measurements=Exists(Measurement.objects.filter(order=OuterRef('pk'))),
            has_quotes=Exists(Quote.objects.filter(order=OuterRef('pk'))),
        )
        ready_for_quote = [
            {
                **_base_order(order),
                'measurement_summary': _measurement_summary(order),
                'estimate_url': f'/orders/{order.id}/quote',
            }
            for order in orders.filter(has_measurements=True, has_quotes=False)[:limit]
        ]

        quotes = Quote.objects.select_related('customer', 'order').prefetch_related('items').order_by('-created_at')

        return Response({
            'ready_for_quote': ready_for_quote,
            'draft_quotes': [_quote_payload(q) for q in quotes.filter(status=Quote.Status.DRAFT)[:limit]],
            'pending_approval': [_quote_payload(q) for q in quotes.filter(status=Quote.Status.SENT)[:limit]],
            'accepted_quotes': [_quote_payload(q) for q in quotes.filter(status=Quote.Status.APPROVED)[:limit]],
        })


class OwnerWorkQueueView(BaseWorkQueueView):
    permission_classes = [IsAuthenticated, IsManagerOrAdmin]

    def get(self, request):
        limit = self.get_limit()
        today = timezone.localdate()

        # Annotate once: has_measurements, has_quotes, remaining_amount
        orders = self.orders().annotate(
            has_measurements=Exists(
                Measurement.objects.filter(order=OuterRef('pk'))
            ),
            has_quotes=Exists(
                Quote.objects.filter(order=OuterRef('pk'))
            ),
            remaining=ExpressionWrapper(
                F('total_amount') - F('paid_amount'),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            ),
        )

        S = Order.Status
        active = [S.NEW, S.IN_WORK]

        qs_new = orders.filter(status=S.NEW)
        qs_needs_meas = orders.filter(status__in=active, has_measurements=False)
        qs_needs_quote = orders.filter(status__in=active, has_measurements=True, has_quotes=False)
        qs_mat_not_ready = orders.filter(
            status__in=[S.IN_WORK, S.IN_PRODUCTION]
        ).exclude(material_readiness=MaterialReadiness.READY)
        qs_in_sewing = orders.filter(status=S.IN_PRODUCTION)
        qs_on_install = orders.filter(status__in=[S.READY, S.ON_INSTALLATION])
        qs_waiting_pay = orders.filter(status=S.WAITING_FINAL_PAYMENT, remaining__gt=0)
        qs_paid_needs = orders.filter(status=S.WAITING_FINAL_PAYMENT, remaining__lte=0)
        qs_overdue = orders.filter(
            planned_completion__lt=today
        ).exclude(status__in=[S.COMPLETED, S.CANCELLED])

        def to_list(qs):
            return [_base_order(o, True) for o in qs[:limit]]

        return Response({
            'counters': {
                'new_orders': qs_new.count(),
                'needs_measurement': qs_needs_meas.count(),
                'needs_quote': qs_needs_quote.count(),
                'materials_not_ready': qs_mat_not_ready.count(),
                'in_sewing': qs_in_sewing.count(),
                'on_installation': qs_on_install.count(),
                'waiting_payment': qs_waiting_pay.count(),
                'paid_needs_completion': qs_paid_needs.count(),
                'overdue': qs_overdue.count(),
            },
            'new_orders': to_list(qs_new),
            'needs_measurement': to_list(qs_needs_meas),
            'needs_quote': to_list(qs_needs_quote),
            'materials_not_ready': to_list(qs_mat_not_ready),
            'in_sewing': to_list(qs_in_sewing),
            'on_installation': to_list(qs_on_install),
            'waiting_payment': to_list(qs_waiting_pay),
            'paid_needs_completion': to_list(qs_paid_needs),
            'overdue': to_list(qs_overdue),
        })


class FinanceWorkQueueView(TenantViaOrderMixin, BaseWorkQueueView):
    permission_classes = [IsAuthenticated, IsManagerOrAdmin]

    def get(self, request):
        limit = self.get_limit()
        orders = self.orders().filter(status=Order.Status.WAITING_FINAL_PAYMENT).annotate(
            remaining=ExpressionWrapper(
                F('total_amount') - F('paid_amount'),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            )
        )
        waiting_payment = [_base_order(o) for o in orders.filter(remaining__gt=0)[:limit]]
        paid_needs_completion = [_base_order(o) for o in orders.filter(remaining__lte=0)[:limit]]

        # Payment не имеет прямого tenant FK — scope_to_tenant() здесь ЕДИНСТВЕННАЯ
        # линия защиты (см. TenantViaOrderMixin). Раньше запрос шёл через
        # Payment.objects напрямую и утекал платежи всех тенантов.
        payments_qs = self.scope_to_tenant(
            Payment.objects.select_related('order', 'order__customer').order_by('-received_at')
        )
        recent_payments = [
            {
                'id': str(payment.id),
                'order_id': str(payment.order_id),
                'order_number': payment.order.order_number,
                'customer_name': payment.order.customer.full_name,
                'amount': _money(payment.amount),
                'payment_type': payment.payment_type,
                'payment_method': payment.payment_method,
                'received_at': payment.received_at.isoformat() if payment.received_at else None,
            }
            for payment in payments_qs[:20]
        ]

        return Response({
            'waiting_payment': waiting_payment,
            'paid_needs_completion': paid_needs_completion,
            'recent_payments': recent_payments,
        })


class DashboardView(APIView):
    """
    Owner/Manager dashboard metrics
    GET /api/v1/dashboard/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not user_in(request.user, Roles.OWNER):
            return Response({'detail': 'Доступ только для владельца/админа'}, status=403)

        today = timezone.localdate()
        first_of_month = today.replace(day=1)

        # --- Orders stats ---
        total = Order.objects.count()
        in_work = Order.objects.filter(
            status__in=[
                Order.Status.IN_WORK,
                Order.Status.IN_PRODUCTION,
                Order.Status.READY,
                Order.Status.ON_INSTALLATION,
                Order.Status.WAITING_FINAL_PAYMENT,
            ]
        ).count()
        completed = Order.objects.filter(status=Order.Status.COMPLETED).count()
        cancelled = Order.objects.filter(status=Order.Status.CANCELLED).count()
        overdue = Order.objects.filter(
            planned_completion__lt=today,
        ).exclude(
            status__in=[Order.Status.COMPLETED, Order.Status.CANCELLED]
        ).count()
        awaiting_payment = Order.objects.filter(
            status=Order.Status.WAITING_FINAL_PAYMENT,
            paid_amount__lt=F('total_amount'),
        ).count()

        # --- Finance aggregates ---
        from django.db.models import Sum
        revenue_agg = Order.objects.aggregate(total_revenue=Sum('total_amount'), total_paid=Sum('paid_amount'))
        total_revenue = revenue_agg['total_revenue'] or Decimal('0')
        total_paid = revenue_agg['total_paid'] or Decimal('0')
        total_debt = total_revenue - total_paid

        this_month_revenue = (
            Order.objects.filter(created_at__date__gte=first_of_month).aggregate(v=Sum('total_amount'))['v']
            or Decimal('0')
        )
        this_month_paid = (
            Order.objects.filter(created_at__date__gte=first_of_month).aggregate(v=Sum('paid_amount'))['v']
            or Decimal('0')
        )

        # --- 6-month chart ---
        chart = []
        for i in range(5, -1, -1):
            month_date = (today.replace(day=1) - relativedelta(months=i))
            month_start = month_date
            month_end = (month_date + relativedelta(months=1))
            month_orders = Order.objects.filter(created_at__date__gte=month_start, created_at__date__lt=month_end)
            month_revenue = month_orders.aggregate(v=Sum('total_amount'))['v'] or Decimal('0')
            month_paid = month_orders.aggregate(v=Sum('paid_amount'))['v'] or Decimal('0')
            chart.append({
                'month': month_start.strftime('%Y-%m'),
                'revenue': int(month_revenue),
                'paid': int(month_paid),
            })

        # --- Designers stats (за период) ---
        from django.contrib.auth import get_user_model
        UserModel = get_user_model()
        in_work_statuses = [
            Order.Status.IN_WORK,
            Order.Status.IN_PRODUCTION,
            Order.Status.READY,
            Order.Status.ON_INSTALLATION,
            Order.Status.WAITING_FINAL_PAYMENT,
        ]
        designers = []
        for u in UserModel.objects.filter(groups__name='Designer').order_by('id'):
            dqs = Order.objects.filter(responsible_user=u)
            name = (u.get_full_name() or '').strip() or u.username
            designers.append({
                'name': name,
                'completed': dqs.filter(status=Order.Status.COMPLETED).count(),
                'in_work': dqs.filter(status__in=in_work_statuses).count(),
            })

        return Response({
            'orders': {
                'total': total,
                'in_work': in_work,
                'completed': completed,
                'cancelled': cancelled,
                'overdue': overdue,
                'awaiting_payment': awaiting_payment,
            },
            'finance': {
                'total_revenue': int(total_revenue),
                'total_paid': int(total_paid),
                'total_debt': int(total_debt),
                'this_month_revenue': int(this_month_revenue),
                'this_month_paid': int(this_month_paid),
            },
            'chart': chart,
            'designers': designers,
        })


class TaskViewSet(TenantModelMixin, viewsets.ModelViewSet):
    """
    Task API v1
    List/Retrieve: GET /api/v1/tasks/
    Create: POST /api/v1/tasks/
    State changes: POST /api/v1/tasks/{id}/change_status/ (via service layer)
    Convert to order: POST /api/v1/tasks/{id}/convert_to_order/
    """
    queryset = Task.objects.all().order_by('-created_at')
    # Лиды ведут владелец и дизайнер. Раньше стоял голый IsAuthenticated, и
    # любая роль (склад, цех, монтаж) могла вычитать все лиды тенанта вместе
    # с контактами клиентов — при том, что ни один экран этот эндпоинт не
    # использует. Приведено к таблице ролей из CLAUDE.md.
    permission_classes = [IsAuthenticated, IsOwnerOrDesigner]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'client_phone']
    search_fields = ['task_number', 'client_name', 'client_phone']
    ordering_fields = ['created_at', 'scheduled_date']

    def get_queryset(self):
        # Task.objects уже отфильтрован TenantManager на уровне ORM (см.
        # tenant_utils.TenantManagerMixin) — Task.objects.all() сам по себе
        # безопасен. scope_to_tenant() здесь — вторая линия защиты
        # (defense in depth): если ContextVar по какой-то причине не был
        # выставлен (например, вызов вне HTTP-запроса), она всё равно
        # применит фильтр через request.tenant.
        return self.scope_to_tenant(Task.objects.all().order_by('-created_at'))

    def get_serializer_class(self):
        if self.action == 'list':
            return TaskListSerializer
        if self.action == 'create':
            return TaskCreateSerializer
        if self.action == 'change_status':
            return TaskStatusUpdateSerializer
        return TaskDetailSerializer
    
    def create(self, request, *args, **kwargs):
        """Create task via TaskService"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        with UnitOfWork() as uow:
            service = TaskService(uow)
            try:
                task = service.create_task(
                    client_name=serializer.validated_data['client_name'],
                    client_phone=serializer.validated_data['client_phone'],
                    address=serializer.validated_data.get('address', ''),
                    notes=serializer.validated_data.get('notes', ''),
                    scheduled_date=serializer.validated_data.get('scheduled_date'),
                    created_by=request.user,
                    tenant=self._current_tenant()
                )
                uow.commit()
                
                response_serializer = TaskDetailSerializer(task)
                return Response(response_serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({'error': _safe_error(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def update(self, request, *args, **kwargs):
        """Update task via service layer"""
        task = self.get_object()
        
        with UnitOfWork() as uow:
            service = TaskService(uow)
            try:
                updated_task = service.update_task(
                    task_id=task.id,
                    client_name=request.data.get('client_name'),
                    client_phone=request.data.get('client_phone'),
                    address=request.data.get('address'),
                    notes=request.data.get('notes'),
                    scheduled_date=request.data.get('scheduled_date'),
                    updated_by=request.user
                )
                uow.commit()
                
                response_serializer = TaskDetailSerializer(updated_task)
                return Response(response_serializer.data)
            except Exception as e:
                return Response({'error': _safe_error(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def change_status(self, request, pk=None):
        """
        Task state transition via service layer
        POST /api/v1/tasks/{id}/change_status/
        Body: {"new_status": "completed", "notes": "..."}
        """
        task = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        new_status = serializer.validated_data['new_status']
        notes = serializer.validated_data.get('notes', '')
        
        with UnitOfWork() as uow:
            service = TaskService(uow)
            try:
                task = service.transition_status(
                    task_id=task.id,
                    new_status=new_status,
                    performed_by=request.user,
                    notes=notes
                )
                uow.commit()
                
                response_serializer = TaskDetailSerializer(task)
                return Response(response_serializer.data)
            except InvalidTaskStatusTransition as e:
                return Response(
                    {'error': str(e), 'current_status': task.status},
                    status=status.HTTP_409_CONFLICT
                )
            except TaskNotFoundError as e:
                return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
            except Exception as e:
                return Response({'error': _safe_error(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def convert_to_order(self, request, pk=None):
        """
        Convert task to order via service layer
        POST /api/v1/tasks/{id}/convert_to_order/
        """
        task = self.get_object()
        
        with UnitOfWork() as uow:
            service = TaskService(uow)
            try:
                order = service.convert_to_order(
                    task_id=task.id,
                    converted_by=request.user
                )
                uow.commit()
                
                from .serializers import OrderDetailSerializer
                response_serializer = OrderDetailSerializer(order)
                return Response(response_serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({'error': _safe_error(e)}, status=status.HTTP_400_BAD_REQUEST)


class InventoryAvailabilityViewSet(TenantModelMixin, viewsets.ReadOnlyModelViewSet):
    """
    Inventory Availability API v1 - Read Only
    GET /api/v1/inventory/
    GET /api/v1/inventory/{id}/
    POST /api/v1/inventory/check/ - Check availability for specific request
    """
    queryset = Fabric.objects.filter(is_active=True).order_by('hanger_number')
    serializer_class = FabricAvailabilitySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['color', 'pattern', 'supplier', 'is_active', 'category']
    search_fields = ['hanger_number', 'name', 'color', 'pattern']
    ordering_fields = ['hanger_number', 'available_meters', 'price_per_meter']

    def get_permissions(self):
        if self.action == 'delete_orphan':
            return [IsAuthenticated(), IsWarehouseOrOwner()]
        return [IsAuthenticated()]

    @action(detail=True, methods=['delete'], url_path='delete-orphan')
    def delete_orphan(self, request, pk=None):
        """
        DELETE /api/v1/inventory/{id}/delete-orphan/

        Fabric — обычно только зеркало InventoryItem (см.
        services/inventory_fabric_sync.py), поэтому у него нет полноценного
        write-API: удаление живой позиции идёт через InventoryItemViewSet.
        Но исторически (SKU-коллизия на кириллице, ручные .delete() мимо API
        при чистке демо-данных — см. CLAUDE.md 2026-07-20) в БД остаются
        Fabric-строки без InventoryItem за спиной — экран «Материалы» их
        показывает, а удалить нечем: своего «⋮» у них нет, потому что обычно
        Fabric и не должен управляться напрямую. Разрешаем деактивировать
        именно такие осиротевшие записи (source_item пуст), а не любые.
        """
        fabric = self.get_object()
        if fabric.source_item_id is not None:
            return Response(
                {
                    'detail': 'Материал привязан к позиции склада — удалите её, а не эту запись каталога',
                    'code': 'fabric_has_source_item',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        fabric.is_active = False
        fabric.save(update_fields=['is_active'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'])
    def check(self, request):
        """
        Check fabric availability for specific requirements
        POST /api/v1/inventory/check/
        Body: {"fabric_id": "...", "required_meters": 5.5}
        """
        serializer = InventoryCheckRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        fabric_id = serializer.validated_data['fabric_id']
        required_meters = serializer.validated_data['required_meters']

        try:
            fabric = self.scope_to_tenant(Fabric.objects.filter(is_active=True)).get(id=fabric_id)
            available_meters = fabric.available_meters
            shortfall = None if available_meters >= required_meters else required_meters - available_meters
            
            response_data = {
                'fabric_id': fabric_id,
                'available': available_meters >= required_meters,
                'available_meters': available_meters,
                'required_meters': required_meters,
                'shortfall': shortfall
            }
            response_serializer = InventoryCheckResponseSerializer(data=response_data)
            response_serializer.is_valid(raise_exception=True)
            
            return Response(response_serializer.data)
        except Fabric.DoesNotExist:
            return Response(
                {'error': f'Fabric with id {fabric_id} not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class InventoryItemViewSet(TenantModelMixin, viewsets.ModelViewSet):
    """
    General warehouse inventory — ткань/тюль/карниз/фурнитура/прочее.

    GET    /api/v1/inventory-items/      — list (любой авторизованный)
    POST   /api/v1/inventory-items/      — create (склад/владелец)
    PATCH  /api/v1/inventory-items/{id}/ — update (склад/владелец)
    DELETE /api/v1/inventory-items/{id}/ — soft-delete (склад/владелец)

    Не переопределяет get_queryset(): использует TenantModelMixin.get_queryset()
    по умолчанию (см. tenant_utils.py), который вызывает scope_to_tenant()
    поверх super().get_queryset() (т.е. поверх `queryset` ниже). InventoryItem
    также под TenantManagerMixin, так что фильтрация по тенанту здесь
    двухуровневая: ORM-менеджер (InventoryItem.objects) + scope_to_tenant()
    миксина (defense in depth).
    """
    queryset = InventoryItem.objects.filter(is_active=True).order_by('category', 'name')
    serializer_class = InventoryItemSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'unit', 'is_active', 'supplier']
    search_fields = ['name', 'sku', 'supplier']
    ordering_fields = ['name', 'category', 'quantity', 'price_per_unit']

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsWarehouseOrOwner()]

    def perform_create(self, serializer):
        super().perform_create(serializer)
        sync_fabric_from_inventory_item(serializer.instance)

    def perform_update(self, serializer):
        super().perform_update(serializer)
        sync_fabric_from_inventory_item(serializer.instance)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])
        sync_fabric_from_inventory_item(instance)


class QuoteViewSet(TenantViaOrderMixin, viewsets.ModelViewSet):
    """
    Quote (Commercial Proposal) API v1

    List/Retrieve: GET /api/v1/quotes/
    Create: POST /api/v1/quotes/
    Update: PATCH /api/v1/quotes/{id}/
    Generate PDF: POST /api/v1/quotes/{id}/generate-pdf/
    """
    queryset = Quote.objects.all().order_by('-created_at')
    permission_classes = [IsAuthenticated, IsOwnerOrDesigner]
    serializer_class = QuoteSerializer

    def get_queryset(self):
        queryset = Quote.objects.all().order_by('-created_at')
        order_id = self.request.query_params.get('order')
        if order_id:
            queryset = queryset.filter(order_id=order_id)
        # Quote не имеет прямого tenant FK и не покрывается TenantManager
        # (см. TenantViaOrderMixin в tenant_utils.py) — фильтрация идёт через
        # order__tenant. scope_to_tenant() здесь ЕДИНСТВЕННАЯ линия защиты,
        # а не вторая: удаление вызова полностью открывает кросс-тенантный доступ.
        return self.scope_to_tenant(queryset)

    def create(self, request, *args, **kwargs):
        """Create quote for an existing order"""
        serializer = QuoteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        service = QuoteService(unit_of_work=None)
        quote_number = service._generate_quote_number()

        try:
            quote = service.create_quote_for_order(
                order_id=data['order_id'],
                items=data['items'],
                quote_number=quote_number,
                installation_cost=data.get('installation_cost', Decimal('0')),
                delivery_cost=data.get('delivery_cost', Decimal('0')),
                discount_amount=data.get('discount_amount', Decimal('0')),
                prepayment_percent=data.get('prepayment_percent', Decimal('0.5')),
                valid_until=data.get('valid_until'),
                created_by=request.user.id if request.user.is_authenticated else None
            )

            # В этом ателье КП создаёт сам дизайнер/владелец уже в финальном
            # виде — отдельного шага «отправить клиенту / клиент одобрил» в
            # интерфейсе нет (create-kp-modal сразу «Скачать КП»). Без
            # авто-одобрения здесь Quote навсегда оставался бы в draft, а
            # order.status — в new: auto_advance в in_work требует ОДНОВРЕМЕННО
            # одобренного КП и сформированных позиций (см. status_automation.py).
            try:
                quote = service.approve_quote(quote.id)
            except Exception:
                pass  # КП создано, но не одобрено — можно доодобрить вручную

            if quote.status == Quote.Status.APPROVED and quote.order_id:
                from atelier_erp.services import OrderItemGenerationService
                gen_service = OrderItemGenerationService(
                    user=request.user.id if request.user.is_authenticated else None
                )
                try:
                    gen_service.generate_order_items_from_quote(quote.order)
                except Exception:
                    pass  # позиции можно сформировать позже вручную

            response_serializer = QuoteSerializer(quote)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': _safe_error(e)}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        """Update existing quote (partial)"""
        partial = kwargs.pop('partial', False)
        quote = self.get_object()

        serializer = QuoteCreateSerializer(data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        service = QuoteService(unit_of_work=None)
        try:
            updated = service.update_quote(
                quote_id=quote.id,
                items=data.get('items'),
                installation_cost=data.get('installation_cost'),
                delivery_cost=data.get('delivery_cost'),
                discount_amount=data.get('discount_amount'),
                prepayment_percent=data.get('prepayment_percent'),
                valid_until=data.get('valid_until'),
                updated_by=request.user.id if request.user.is_authenticated else None
            )
            response_serializer = QuoteSerializer(updated)
            return Response(response_serializer.data)
        except Exception as e:
            return Response({'error': _safe_error(e)}, status=status.HTTP_400_BAD_REQUEST)


    @action(detail=True, methods=['post'], url_path='convert_to_order')
    def convert_to_order(self, request, pk=None):
        """
        Convert approved quote to order.
        POST /api/v1/quotes/{id}/convert_to_order/
        """
        quote = self.get_object()
        with UnitOfWork() as uow:
            service = OrderService(uow)
            try:
                order_number = next_number('ORDER')
                order = service.create_order_from_quote(
                    quote_id=quote.id,
                    order_number=order_number,
                    created_by=request.user.id if request.user.is_authenticated else None
                )
                uow.commit()
                return Response(OrderDetailSerializer(order).data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({'error': _safe_error(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='generate-pdf', url_name='generate-pdf')
    def generate_pdf(self, request, pk=None):
        """
        Generate PDF for quote.
        POST /api/v1/quotes/{id}/generate-pdf/
        """
        quote = self.get_object()
        service = QuoteService(unit_of_work=None)

        try:
            from django.conf import settings
            media_root = getattr(settings, 'MEDIA_ROOT', '')
            pdf_path = service.generate_pdf(quote.id, media_root=media_root)
            quote.refresh_from_db()
            return Response({
                'pdf_url': quote.pdf_url,
                'pdf_generated': quote.pdf_generated,
                'path': pdf_path,
            })
        except ImportError as e:
            return Response(
                {'error': str(e), 'hint': 'Run: pip install xhtml2pdf'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except Exception as e:
            return Response({'error': _safe_error(e)}, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Customer ViewSet
# ---------------------------------------------------------------------------

class CustomerViewSet(TenantModelMixin, viewsets.ModelViewSet):
    """
    CRUD for customers.
    GET  /api/v1/customers/          — list (search by name/phone)
    POST /api/v1/customers/          — create (Owner/Designer)
    GET  /api/v1/customers/{id}/     — detail
    PATCH /api/v1/customers/{id}/    — update (Owner/Designer)
    """
    serializer_class = CustomerSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['full_name', 'phone', 'email']
    ordering_fields = ['full_name', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        # Customer.objects уже отфильтрован TenantManager на уровне ORM (см.
        # tenant_utils.TenantManagerMixin) — Customer.objects.all() сам по
        # себе безопасен. scope_to_tenant() здесь — вторая линия защиты
        # (defense in depth), а не дублирующая ручная фильтрация: она
        # страхует на случай, если ContextVar не был выставлен (вызов вне
        # HTTP-запроса и т.п.).
        qs = Customer.objects.filter(is_active=True)
        return self.scope_to_tenant(qs)

    def get_permissions(self):
        # Справочник клиентов — владелец и дизайнер. Раньше чтение было открыто
        # любой роли: склад/цех/монтаж могли выгрузить всю клиентскую базу с
        # телефонами и почтой. Имя клиента по своему заказу исполнители
        # по-прежнему видят — оно приходит внутри OrderDetailSerializer,
        # а не отсюда.
        return [IsAuthenticated(), IsOwnerOrDesigner()]


# ---------------------------------------------------------------------------
# Payment ViewSet
# ---------------------------------------------------------------------------

class PaymentViewSet(TenantViaOrderMixin, viewsets.ModelViewSet):
    """
    Payments — финансовые данные, только Owner.
    Designer видит платежи конкретного заказа через OrderDetailSerializer,
    но список ВСЕХ платежей — исключительно Owner.
    GET  /api/v1/payments/?order=<id>  — list filtered by order (Owner only)
    POST /api/v1/payments/             — create payment (Owner only)
    GET  /api/v1/payments/{id}/        — detail (Owner only)
    """
    serializer_class = PaymentSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['order', 'payment_type', 'payment_method']
    ordering_fields = ['received_at', 'amount']
    ordering = ['-received_at']
    permission_classes = [IsAuthenticated, IsManagerOrAdmin]

    def get_permissions(self):
        # Создание/запись платежа (предоплата) доступно владельцу и дизайнеру.
        # Просмотр полного списка всех платежей — только владельцу.
        if self.action == 'create':
            return [IsAuthenticated(), IsOwnerOrDesigner()]
        return super().get_permissions()

    def get_queryset(self):
        # Payment не имеет прямого tenant FK и не покрывается TenantManager
        # (см. TenantViaOrderMixin в tenant_utils.py) — фильтрация идёт через
        # order__tenant. scope_to_tenant() здесь ЕДИНСТВЕННАЯ линия защиты,
        # а не вторая: удаление вызова полностью открывает кросс-тенантный доступ.
        return self.scope_to_tenant(Payment.objects.select_related('order').all())

    def create(self, request, *args, **kwargs):
        """
        Приём платежа через PaymentService — раньше здесь был дефолтный
        ModelViewSet.create, который просто писал строку Payment мимо
        PaymentService.record_payment: order.paid_amount никогда не рос,
        и заказ не мог доехать до completed (найдено при сквозном прогоне
        воркфлоу new -> completed через реальные API 2026-07-20).
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        order = data['order']

        service = PaymentService(unit_of_work=None)
        try:
            payment = service.record_payment(
                order_id=order.id,
                amount=data['amount'],
                payment_type=data['payment_type'],
                payment_method=data['payment_method'],
                received_by=request.user.id if request.user.is_authenticated else None,
                notes=data.get('notes', ''),
            )
        except DuplicatePaymentError as e:
            return Response({'error': str(e), 'code': 'duplicate_payment'}, status=status.HTTP_409_CONFLICT)
        except InvalidPaymentAmount as e:
            return Response({'error': str(e), 'code': 'invalid_amount'}, status=status.HTTP_400_BAD_REQUEST)
        except PaymentServiceError as e:
            return Response({'error': _safe_error(e), 'code': 'payment_error'}, status=status.HTTP_400_BAD_REQUEST)

        response_serializer = PaymentSerializer(payment)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Measurement ViewSet
# ---------------------------------------------------------------------------

class MeasurementViewSet(TenantViaOrderMixin, viewsets.ModelViewSet):
    """
    Measurements (замеры) — Owner/Designer CRUD.
    GET  /api/v1/measurements/?order=<id>  — list filtered by order
    POST /api/v1/measurements/              — create
    GET  /api/v1/measurements/{id}/         — detail
    PATCH /api/v1/measurements/{id}/        — update
    DELETE /api/v1/measurements/{id}/       — delete
    """
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['order', 'room_name', 'mounting_type']
    ordering_fields = ['room_name', 'window_name']
    ordering = ['room_name', 'window_name']
    permission_classes = [IsAuthenticated, CanAccessMeasurement]

    def get_serializer_class(self):
        # Запись (создание/редактирование) — write-серилайзер с полями модели,
        # сохраняет обе ткани. Чтение — detail-серилайзер.
        if self.action in ('create', 'update', 'partial_update'):
            # Склад и швея правят только свою галочку по окну. Узкие
            # сериализаторы — вторая линия после CanAccessMeasurement:
            # разрешение пускает PATCH, а набор полей ограничивается здесь.
            if user_in(self.request.user, Roles.OWNER, Roles.DESIGNER):
                return MeasurementWriteSerializer
            if user_in(self.request.user, Roles.WAREHOUSE):
                return MeasurementWarehouseFlagSerializer
            if user_in(self.request.user, Roles.SEAMSTRESS):
                return MeasurementSewingFlagSerializer
            if user_in(self.request.user, Roles.INSTALLER):
                return MeasurementInstallerFlagSerializer
            return MeasurementWriteSerializer
        return MeasurementSerializer

    def get_queryset(self):
        # Measurement не имеет прямого tenant FK и не покрывается TenantManager
        # (см. TenantViaOrderMixin в tenant_utils.py) — фильтрация идёт через
        # order__tenant. scope_to_tenant() здесь ЕДИНСТВЕННАЯ линия защиты,
        # а не вторая: удаление вызова полностью открывает кросс-тенантный доступ.
        #
        # Поверх тенанта — ролевой срез по заказу. Без него замеры были шире
        # заказов: исполнитель не видел чужой заказ в списке, но мог прочитать
        # и отметить галочку на его замере по прямому id, а автопродвижение
        # статусов превращало это в смену статуса чужого заказа.
        qs = Measurement.objects.select_related('curtain_fabric', 'tulle_fabric').all()
        return self.scope_to_tenant(
            filter_by_visible_orders(qs, self.request.user)
        )


class StaffListView(APIView):
    """GET /api/v1/staff/?role=designer — list users by role group.
    Used by frontend to populate designer selects.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.contrib.auth.models import User, Group
        role = request.query_params.get('role', '')
        if role:
            try:
                group = Group.objects.get(name__iexact=role)
                users = User.objects.filter(groups=group, is_active=True).order_by('last_name', 'first_name')
            except Group.DoesNotExist:
                users = User.objects.none()
        else:
            # All active staff
            users = User.objects.filter(is_active=True).order_by('last_name', 'first_name')

        data = [
            {
                'id': u.id,
                'username': u.username,
                'full_name': f"{u.first_name} {u.last_name}".strip() or u.username,
            }
            for u in users
        ]
        return Response(data)


def _user_role(user):
    """Каноническое имя роли пользователя (одна группа = одна роль).

    Легаси-пользователи, заведённые до единого реестра ролей, могут состоять
    сразу в нескольких/устаревших группах — берём первую каноническую,
    остальное не наше дело в рамках экрана "Сотрудники".
    """
    names = set(user.groups.values_list('name', flat=True))
    for canon in Roles.ALL:
        if canon in names:
            return canon
    return None


def _serialize_staff(user):
    return {
        'id': user.id,
        'username': user.username,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'full_name': f"{user.first_name} {user.last_name}".strip() or user.username,
        'email': user.email,
        'role': _user_role(user),
        'is_active': user.is_active,
        'date_joined': user.date_joined,
    }


def _staff_queryset_for_request(request):
    """Сотрудники, которых текущий запрос имеет право видеть/менять.

    request.tenant теперь корректно резолвится по JWT-пользователю (см.
    atelier_erp/tenant_drf.py — до фикса 2026-07-25 он был всегда None для
    любого API-запроса, изоляции между ателье не было вообще).

    - Конкретный Tenant (обычный Owner ателье) → только сотрудники этого
      ателье.
    - Суперюзер без своего membership (платформенный админ) → видит всех, во
      всех ателье — так он может открыть список сотрудников выбранного
      ателье с экрана "Ателье" (см. AtelierManagementViewSet).
    - Обычный пользователь без membership → легаси-режим (текущее состояние
      прод-аккаунтов до реконсиляции, см. project_tenant_isolation): видит
      только таких же "безтенантных" сотрудников, не всех подряд.
    """
    from django.contrib.auth.models import User

    tenant = getattr(request, 'tenant', None)
    if tenant is not None:
        return User.objects.filter(tenant_membership__tenant=tenant)
    if request.user.is_superuser:
        # Платформенный админ на экране "Ателье" смотрит сотрудников ОДНОГО
        # выбранного ателье, не всех подряд — ?tenant_id= сужает список.
        tenant_id = request.query_params.get('tenant_id')
        if tenant_id:
            return User.objects.filter(tenant_membership__tenant_id=tenant_id)
        return User.objects.all()
    return User.objects.filter(tenant_membership__isnull=True)


def _resolve_target_tenant_for_staff_create(request):
    """Тенант, к которому будет привязан новый сотрудник. Возвращает
    (tenant_or_None, error_response_or_None)."""
    tenant = getattr(request, 'tenant', None)
    if tenant is not None:
        return tenant, None
    if request.user.is_superuser:
        from atelier_erp.models import Tenant
        tenant_id = request.data.get('tenant_id')
        if not tenant_id:
            return None, Response(
                {'detail': 'Укажите ателье (tenant_id)', 'code': 'tenant_id_required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            return Tenant.objects.get(pk=tenant_id), None
        except (Tenant.DoesNotExist, ValueError, TypeError):
            return None, Response({'detail': 'Ателье не найдено', 'code': 'tenant_not_found'}, status=status.HTTP_404_NOT_FOUND)
    return None, None  # легаси-режим — сотрудник без тенанта, как и создающий его пользователь


def _create_staff_user(tenant, username, role, first_name='', last_name='', email=''):
    """Создать нового сотрудника: пароль генерируется здесь и возвращается
    вызывающему один раз (нигде не хранится в открытом виде — только хэш).
    tenant=None — легаси-режим, сотрудник создаётся без TenantMembership."""
    from django.contrib.auth.models import User, Group
    from django.utils.crypto import get_random_string
    from atelier_erp.models import TenantMembership

    password = get_random_string(12)
    user = User.objects.create(
        username=username,
        first_name=first_name,
        last_name=last_name,
        email=email,
        is_active=True,
    )
    user.set_password(password)
    user.save()
    user.groups.add(Group.objects.get(name=role))
    if tenant is not None:
        TenantMembership.objects.create(user=user, tenant=tenant)
    return user, password


class StaffManagementViewSet(viewsets.ViewSet):
    """CRUD над сотрудниками (создание/деактивация/смена роли) — только Owner.

    Роль — не поле модели User, а членство в Django Group (см.
    atelier_erp.roles.Roles) — смена роли это groups.clear()+add(), не update
    одного поля. Удаление — всегда деактивация (is_active=False), не DELETE
    из БД: на пользователя могут ссылаться заказы/платежи/фотоотчёты, и
    физическое удаление истории кто что делал недопустимо.

    Тенант-скоуп — см. _staff_queryset_for_request: Owner видит и меняет
    только сотрудников своего ателье; суперюзер (платформенный админ) может
    работать с сотрудниками любого ателье, передав tenant_id при создании
    (list/retrieve/update/destroy опираются на pk, tenant там не нужен — он
    уже определяет ГРАНИЦУ видимости, а не выбирается заново).
    """
    permission_classes = [IsManagerOrAdmin]

    def _get_scoped_user(self, request, pk):
        return _staff_queryset_for_request(request).get(pk=pk)

    def list(self, request):
        users = _staff_queryset_for_request(request).order_by('last_name', 'first_name', 'username')
        return Response([_serialize_staff(u) for u in users])

    def retrieve(self, request, pk=None):
        from django.contrib.auth.models import User
        try:
            user = self._get_scoped_user(request, pk)
        except User.DoesNotExist:
            return Response({'detail': 'Сотрудник не найден', 'code': 'staff_not_found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(_serialize_staff(user))

    def create(self, request):
        from django.contrib.auth.models import User

        username = (request.data.get('username') or '').strip()
        role = request.data.get('role')
        first_name = (request.data.get('first_name') or '').strip()
        last_name = (request.data.get('last_name') or '').strip()
        email = (request.data.get('email') or '').strip()

        if not username:
            return Response({'detail': 'Укажите логин', 'code': 'username_required'}, status=status.HTTP_400_BAD_REQUEST)
        if role not in Roles.ALL:
            return Response({'detail': 'Укажите корректную роль', 'code': 'invalid_role'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({'detail': 'Такой логин уже занят', 'code': 'username_taken'}, status=status.HTTP_400_BAD_REQUEST)

        tenant, err = _resolve_target_tenant_for_staff_create(request)
        if err:
            return err

        user, password = _create_staff_user(tenant, username, role, first_name, last_name, email)

        data = _serialize_staff(user)
        data['generated_password'] = password
        return Response(data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        from django.contrib.auth.models import User, Group

        try:
            user = self._get_scoped_user(request, pk)
        except User.DoesNotExist:
            return Response({'detail': 'Сотрудник не найден', 'code': 'staff_not_found'}, status=status.HTTP_404_NOT_FOUND)

        if 'first_name' in request.data:
            user.first_name = (request.data.get('first_name') or '').strip()
        if 'last_name' in request.data:
            user.last_name = (request.data.get('last_name') or '').strip()
        if 'email' in request.data:
            user.email = (request.data.get('email') or '').strip()

        if 'role' in request.data:
            role = request.data.get('role')
            if role not in Roles.ALL:
                return Response({'detail': 'Укажите корректную роль', 'code': 'invalid_role'}, status=status.HTTP_400_BAD_REQUEST)
            if user.id == request.user.id and role != Roles.OWNER:
                return Response(
                    {'detail': 'Нельзя снять с себя роль владельца', 'code': 'cannot_change_own_role'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.groups.clear()
            user.groups.add(Group.objects.get(name=role))

        if 'is_active' in request.data:
            is_active = bool(request.data.get('is_active'))
            if not is_active and user.id == request.user.id:
                return Response(
                    {'detail': 'Нельзя деактивировать самого себя', 'code': 'cannot_deactivate_self'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.is_active = is_active

        user.save()
        return Response(_serialize_staff(user))

    def destroy(self, request, pk=None):
        from django.contrib.auth.models import User

        try:
            user = self._get_scoped_user(request, pk)
        except User.DoesNotExist:
            return Response({'detail': 'Сотрудник не найден', 'code': 'staff_not_found'}, status=status.HTTP_404_NOT_FOUND)
        if user.id == request.user.id:
            return Response(
                {'detail': 'Нельзя деактивировать самого себя', 'code': 'cannot_deactivate_self'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.is_active = False
        user.save()
        return Response(_serialize_staff(user))


def _serialize_tenant(tenant):
    from atelier_erp.models import TenantMembership
    return {
        'id': tenant.id,
        'name': tenant.name,
        'slug': tenant.slug,
        'is_active': tenant.is_active,
        'created_at': tenant.created_at,
        'employee_count': TenantMembership.objects.filter(tenant=tenant).count(),
    }


class AtelierManagementViewSet(viewsets.ViewSet):
    """Список/создание ателье (Tenant) — только платформенный админ Sheber
    (is_superuser), не Owner конкретного ателье.

    Единственный способ завести новое ателье до этой фичи — management-
    команда `create_tenant` из консоли Railway (см. CLAUDE.md); она к тому же
    рассчитана на одноразовую миграцию single-tenant → multi-tenant и
    подхватывает ВСЕХ безтенантных пользователей при повторном запуске —
    не годится для регулярного онбординга новых клиентов.

    Создание ателье всегда идёт вместе с первым сотрудником-владельцем
    (ателье без единого сотрудника бессмысленно) — переиспользует
    _create_staff_user, тот же путь, что и StaffManagementViewSet.create.
    Список сотрудников конкретного ателье смотреть/пополнять — через
    /api/v1/staff-management/?tenant_id=<id> (тот же StaffManagementViewSet,
    доступный суперюзеру для любого tenant_id).
    """
    permission_classes = [IsPlatformAdmin]

    def list(self, request):
        from atelier_erp.models import Tenant
        tenants = Tenant.objects.all().order_by('name')
        return Response([_serialize_tenant(t) for t in tenants])

    def create(self, request):
        from django.db import transaction
        from django.utils.text import slugify
        from django.utils.crypto import get_random_string
        from django.contrib.auth.models import User
        from atelier_erp.models import Tenant

        name = (request.data.get('name') or '').strip()
        owner_username = (request.data.get('owner_username') or '').strip()
        owner_first_name = (request.data.get('owner_first_name') or '').strip()
        owner_last_name = (request.data.get('owner_last_name') or '').strip()
        owner_email = (request.data.get('owner_email') or '').strip()

        if not name:
            return Response({'detail': 'Укажите название ателье', 'code': 'name_required'}, status=status.HTTP_400_BAD_REQUEST)
        if not owner_username:
            return Response({'detail': 'Укажите логин владельца', 'code': 'owner_username_required'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=owner_username).exists():
            return Response({'detail': 'Такой логин уже занят', 'code': 'username_taken'}, status=status.HTTP_400_BAD_REQUEST)

        # slugify() не транслитерирует кириллицу (даёт пустую строку на
        # "Новое ателье" и т.п.) — а названия ателье почти всегда кириллица.
        # Вместо требования ручного slug на каждое создание — короткий
        # случайный идентификатор, если из названия ничего не вышло.
        slug = (request.data.get('slug') or '').strip() or slugify(name) or get_random_string(
            8, allowed_chars='abcdefghijklmnopqrstuvwxyz0123456789'
        )
        base_slug = slug
        suffix = 1
        while Tenant.objects.filter(slug=slug).exists():
            suffix += 1
            slug = f'{base_slug}-{suffix}'

        with transaction.atomic():
            tenant = Tenant.objects.create(name=name, slug=slug, is_active=True)
            owner_user, password = _create_staff_user(
                tenant, owner_username, Roles.OWNER,
                first_name=owner_first_name, last_name=owner_last_name, email=owner_email,
            )

        data = _serialize_tenant(tenant)
        data['owner'] = _serialize_staff(owner_user)
        data['owner']['generated_password'] = password
        return Response(data, status=status.HTTP_201_CREATED)

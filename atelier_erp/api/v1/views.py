"""
Atelier ERP - API v1 Views
Minimal ViewSets with service layer integration
All state changes go through services
"""

from decimal import Decimal

from django.db.models import Q
from rest_framework import viewsets, status, filters
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser

from atelier_erp.api.permissions import IsManagerOrAdmin, IsOwnerOrDesigner, IsWarehouseOrOwner, IsInstallationOrOwner, IsInstallationOrOwnerOrReadOnly
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone

from atelier_erp.models import (
    Order, Task, Fabric, PhotoReport, OrderItem, OrderCompletionAct,
    Measurement, Quote, Payment, Customer, OrderMaterial
)
from atelier_erp.services import OrderService, TaskService, UnitOfWork, QuoteService
from atelier_erp.services.exceptions import (
    OrderNotFoundError, InvalidOrderStatusTransition,
    TaskNotFoundError, InvalidTaskStatusTransition
)

from .serializers import (
    OrderListSerializer, OrderDetailSerializer, OrderCreateSerializer, OrderUpdateSerializer, OrderStatusUpdateSerializer,
    MeasurementSerializer, MeasurementCreateSerializer,
    QuoteSerializer, QuoteCreateSerializer,
    OrderMaterialSerializer, OrderMaterialUpdateSerializer,
    ChangeStatusSerializer, ChangeMaterialReadinessSerializer, ChangeProductionStageSerializer,
    ChangeHandoverStageSerializer, CancelOrderSerializer,
    TaskListSerializer, TaskDetailSerializer, TaskCreateSerializer, TaskStatusUpdateSerializer,
    FabricAvailabilitySerializer, InventoryCheckRequestSerializer, InventoryCheckResponseSerializer,
    PhotoReportSerializer, PhotoReportUploadSerializer,
    OrderCompletionActSerializer, OrderCompletionActUploadSerializer
)
from atelier_erp.constants import OrderFSMRules, OrderExecutionGuide, MaterialReadiness, ProductionStage, HandoverStage


class OrderViewSet(viewsets.ModelViewSet):
    """
    Order API v1
    List/Retrieve: GET /api/v1/orders/
    Create: POST /api/v1/orders/ (Manager/Admin only)
    State changes: POST /api/v1/orders/{id}/change_status/ (via service layer)
    """
    queryset = Order.objects.all().order_by('-created_at')
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        """Create and update require Owner/Designer role"""
        if self.action in ['create', 'update', 'partial_update']:
            return [IsAuthenticated(), IsOwnerOrDesigner()]
        return super().get_permissions()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'customer']
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

        # Generate order number: О-YYYY-NNN
        year = timezone.now().year
        count = Order.objects.filter(created_at__year=year).count() + 1
        order_number = f"О-{year}-{count:03d}"

        validated = serializer.validated_data

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
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
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
    
    @action(detail=True, methods=['get'])
    def execution_info(self, request, pk=None):
        """
        [DEPRECATED] Use /execution/ instead.
        Kept for backward compatibility.
        
        GET /api/v1/orders/{id}/execution_info/
        """
        order = self.get_object()
        
        allowed_transitions = OrderFSMRules.get_allowed_transitions(order.status)
        guidance = OrderExecutionGuide.get_guidance(order.status)
        
        return Response({
            'current_status': order.status,
            'current_status_display': order.get_status_display(),
            'material_readiness': order.material_readiness,
            'material_readiness_display': order.get_material_readiness_display(),
            'allowed_transitions': allowed_transitions,
            'guidance': guidance,
            'material_readiness_options': [
                {'value': choice[0], 'label': choice[1]}
                for choice in MaterialReadiness.choices
            ],
            'deprecated': True,
            'use_endpoint': f'/api/v1/orders/{pk}/execution/',
        })
    
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
            # List active photo reports
            photo_reports = order.photo_reports.filter(is_active=True)
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
        can_upload_photo_report = (
            order.handover_stage == 'done'
            or (
                order.handover_stage == 'not_required'
                and order.production_stage == 'done'
            )
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
        
        photo_report = PhotoReport.objects.create(
            order=order,
            order_item=order_item,
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
                    order = service.transition_status(
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
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Shortcut: Confirm order via service layer"""
        return self._simple_transition(request, pk, Order.Status.APPROVED)
    
    @action(detail=True, methods=['post'])
    def start_production(self, request, pk=None):
        """Shortcut: Start production via service layer"""
        return self._simple_transition(request, pk, Order.Status.PRODUCTION)
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Shortcut: Complete order via service layer"""
        return self._simple_transition(request, pk, Order.Status.COMPLETED)
    
    # ============================================
    # NEW ACTION ENDPOINTS (MVP Workflow)
    # ============================================
    
    @action(detail=True, methods=['post'], url_path='change-status')
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
                    {'detail': str(e), 'code': 'status_change_error'},
                    status=status.HTTP_400_BAD_REQUEST
                )
    
    @action(detail=True, methods=['post'], url_path='change-material-readiness')
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
                {'detail': str(e), 'code': 'material_readiness_error'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'], url_path='change-production-stage')
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
                {'detail': str(e), 'code': 'production_stage_error'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'], url_path='change-handover-stage')
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
                {'detail': str(e), 'code': 'handover_stage_error'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'], url_path='cancel')
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
                {'detail': str(e), 'code': 'cancel_error'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'], url_path='generate-items-from-quote')
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
                {'detail': str(e), 'code': 'generation_error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _simple_transition(self, request, pk, target_status):
        """Helper for simple state transitions"""
        order = self.get_object()
        
        with UnitOfWork() as uow:
            service = OrderService(uow)
            try:
                order = service.transition_status(
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
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


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

        # Map simplified fields to model fields
        measurement = Measurement.objects.create(
            order=order,
            room_name=data['room_name'],
            window_name=data.get('window_number', ''),
            width_cm=int(data['width']),
            height_cm=int(data['height']),
            mounting_type=data.get('mounting_type', ''),
            notes=data.get('comment', ''),
            measured_by=request.user if request.user.is_authenticated else None,
        )

        # Map fabric_type + fabric_meters to curtain/tulle fields
        fabric_type = data.get('fabric_type')
        fabric_meters = data.get('fabric_meters')
        fabric_name = data.get('fabric_name', '')

        if fabric_type and fabric_meters:
            if fabric_type == 'curtain':
                measurement.curtain_meters = fabric_meters
                if fabric_name:
                    fabric = Fabric.objects.filter(name__iexact=fabric_name).first()
                    if fabric:
                        measurement.curtain_fabric = fabric
            elif fabric_type == 'tulle':
                measurement.tulle_meters = fabric_meters
                if fabric_name:
                    fabric = Fabric.objects.filter(name__iexact=fabric_name).first()
                    if fabric:
                        measurement.tulle_fabric = fabric

        measurement.save()

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

STATUS_LABELS = {
    'new': 'Новый',
    'in_work': 'В работе',
    'in_production': 'В производстве',
    'ready': 'Готов к установке',
    'on_installation': 'На установке',
    'waiting_final_payment': 'Ожидает финальной оплаты',
    'completed': 'Завершён',
    'cancelled': 'Отменён',
}

MATERIAL_LABELS = {
    MaterialReadiness.NOT_READY: 'Не готово',
    MaterialReadiness.PARTIALLY_READY: 'Частично готово',
    MaterialReadiness.READY: 'Готово',
}

PRODUCTION_LABELS = {
    ProductionStage.NOT_STARTED: 'Не начато',
    ProductionStage.CUTTING: 'Раскрой',
    ProductionStage.SEWING: 'Пошив',
    ProductionStage.QUALITY_CHECK: 'Контроль качества',
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


def _base_order(order):
    balance_due = max(order.remaining_amount, Decimal('0'))
    is_paid = balance_due <= 0

    return {
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
        'total_amount': _money(order.total_amount),
        'paid_amount': _money(order.paid_amount),
        'balance_due': _money(balance_due),
        'payment_state': 'paid' if is_paid else 'partial' if order.paid_amount > 0 else 'unpaid',
        'order_url': f'/orders/{order.id}',
    }


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

    def orders(self):
        return _base_order_queryset()


class ProductionWorkQueueView(BaseWorkQueueView):
    def _payload(self, order):
        data = _base_order(order)
        data.update({
            'items_to_sew': _items_for_work(order),
            'actions': {
                'can_start_sewing': order.status == Order.Status.IN_PRODUCTION and order.production_stage == ProductionStage.NOT_STARTED,
                'can_mark_done': order.status == Order.Status.IN_PRODUCTION and order.production_stage in [ProductionStage.SEWING, ProductionStage.QUALITY_CHECK],
            },
        })
        return data

    def get(self, request):
        production_orders = list(self.orders().filter(
            Q(status=Order.Status.IN_PRODUCTION) | Q(status=Order.Status.IN_WORK, material_readiness=MaterialReadiness.READY)
        ))
        ready_to_start = [
            self._payload(order)
            for order in production_orders
            if order.status == Order.Status.IN_WORK or order.production_stage == ProductionStage.NOT_STARTED
        ]
        in_sewing = [
            self._payload(order)
            for order in production_orders
            if order.status == Order.Status.IN_PRODUCTION and order.production_stage in [
                ProductionStage.CUTTING,
                ProductionStage.SEWING,
                ProductionStage.QUALITY_CHECK,
            ]
        ]
        done = [
            self._payload(order)
            for order in self.orders().filter(
                Q(status=Order.Status.IN_PRODUCTION, production_stage=ProductionStage.DONE) | Q(status=Order.Status.READY)
            )
        ]
        return Response({'ready_to_start': ready_to_start, 'in_sewing': in_sewing, 'done': done})


class InstallationWorkQueueView(BaseWorkQueueView):
    def _payload(self, order):
        data = _base_order(order)
        data.update({
            'items_to_install': _items_for_work(order),
            **_photo_status(order),
            **_completion_act_status(order),
        })
        return data

    def get(self, request):
        orders = self.orders()
        ready = [self._payload(order) for order in orders.filter(status=Order.Status.READY)]
        in_installation = [self._payload(order) for order in orders.filter(status=Order.Status.ON_INSTALLATION)]
        payment = [self._payload(order) for order in orders.filter(status=Order.Status.WAITING_FINAL_PAYMENT)]
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
    def _payload(self, order):
        data = _base_order(order)
        data.update({'selected_materials': _selected_materials(order)})
        return data

    def get(self, request):
        orders = self.orders().filter(status__in=[
            Order.Status.IN_WORK,
            Order.Status.IN_PRODUCTION,
            Order.Status.READY,
        ])

        def group(readiness):
            return [self._payload(order) for order in orders.filter(material_readiness=readiness)]

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

        needs_check = [
            self._payload(order)
            for order in orders
            if not _selected_materials(order)
        ]

        return Response({
            'needs_check': needs_check,
            'not_ready': group(MaterialReadiness.NOT_READY),
            'partially_ready': group(MaterialReadiness.PARTIALLY_READY),
            'ready': group(MaterialReadiness.READY),
            'fabrics': fabrics,
        })


class DesignerWorkQueueView(BaseWorkQueueView):
    def _payload(self, order):
        data = _base_order(order)
        customer_id = str(order.customer_id)
        data.update({
            'measurement_summary': _measurement_summary(order),
            'measurements_url': f'/measurements?order={order.id}',
            'estimate_url': f'/estimate?customer={customer_id}&order={order.id}',
        })
        return data

    def get(self, request):
        orders = self.orders().filter(status__in=[Order.Status.NEW, Order.Status.IN_WORK])
        today = timezone.localdate()

        needs_measurement = []
        measurement_done_needs_quote = []
        quote_in_progress = []
        overdue = []

        for order in orders:
            has_measurements = order.measurements.exists()
            quotes = _related_quotes(order)
            has_quote = bool(quotes)
            if not has_measurements:
                needs_measurement.append(self._payload(order))
            elif not has_quote:
                measurement_done_needs_quote.append(self._payload(order))
            elif any(quote.status in [Quote.Status.DRAFT, Quote.Status.SENT] for quote in quotes):
                quote_in_progress.append(self._payload(order))

            if order.planned_completion and order.planned_completion < today:
                overdue.append(self._payload(order))

        return Response({
            'needs_measurement': needs_measurement,
            'measurement_done_needs_quote': measurement_done_needs_quote,
            'quote_in_progress': quote_in_progress,
            'overdue': overdue,
        })


class QuotesWorkQueueView(BaseWorkQueueView):
    def get(self, request):
        orders = self.orders().filter(status__in=[Order.Status.NEW, Order.Status.IN_WORK])
        ready_for_quote = [
            {
                **_base_order(order),
                'measurement_summary': _measurement_summary(order),
                'estimate_url': f'/estimate?customer={order.customer_id}&order={order.id}',
            }
            for order in orders
            if order.measurements.exists() and not _related_quotes(order)
        ]

        quotes = Quote.objects.select_related('customer', 'order').prefetch_related('items').order_by('-created_at')

        return Response({
            'ready_for_quote': ready_for_quote,
            'draft_quotes': [_quote_payload(quote) for quote in quotes.filter(status=Quote.Status.DRAFT)],
            'pending_approval': [_quote_payload(quote) for quote in quotes.filter(status=Quote.Status.SENT)],
            'accepted_quotes': [_quote_payload(quote) for quote in quotes.filter(status=Quote.Status.APPROVED)],
        })


class OwnerWorkQueueView(BaseWorkQueueView):
    def get(self, request):
        orders = list(self.orders())
        today = timezone.localdate()

        def paid(order):
            return order.remaining_amount <= 0

        new_orders = [_base_order(order) for order in orders if order.status == Order.Status.NEW]
        needs_measurement = [_base_order(order) for order in orders if order.status in [Order.Status.NEW, Order.Status.IN_WORK] and not order.measurements.exists()]
        needs_quote = [_base_order(order) for order in orders if order.status in [Order.Status.NEW, Order.Status.IN_WORK] and order.measurements.exists() and not _related_quotes(order)]
        materials_not_ready = [_base_order(order) for order in orders if order.status in [Order.Status.IN_WORK, Order.Status.IN_PRODUCTION] and order.material_readiness != MaterialReadiness.READY]
        in_sewing = [_base_order(order) for order in orders if order.status == Order.Status.IN_PRODUCTION]
        on_installation = [_base_order(order) for order in orders if order.status in [Order.Status.READY, Order.Status.ON_INSTALLATION]]
        waiting_payment = [_base_order(order) for order in orders if order.status == Order.Status.WAITING_FINAL_PAYMENT and not paid(order)]
        paid_needs_completion = [_base_order(order) for order in orders if order.status == Order.Status.WAITING_FINAL_PAYMENT and paid(order)]
        overdue = [_base_order(order) for order in orders if order.planned_completion and order.planned_completion < today and order.status not in [Order.Status.COMPLETED, Order.Status.CANCELLED]]

        return Response({
            'counters': {
                'new_orders': len(new_orders),
                'needs_measurement': len(needs_measurement),
                'needs_quote': len(needs_quote),
                'materials_not_ready': len(materials_not_ready),
                'in_sewing': len(in_sewing),
                'on_installation': len(on_installation),
                'waiting_payment': len(waiting_payment),
                'paid_needs_completion': len(paid_needs_completion),
                'overdue': len(overdue),
            },
            'new_orders': new_orders[:10],
            'needs_measurement': needs_measurement[:10],
            'needs_quote': needs_quote[:10],
            'materials_not_ready': materials_not_ready[:10],
            'in_sewing': in_sewing[:10],
            'on_installation': on_installation[:10],
            'waiting_payment': waiting_payment[:10],
            'paid_needs_completion': paid_needs_completion[:10],
            'overdue': overdue[:10],
        })


class FinanceWorkQueueView(BaseWorkQueueView):
    def get(self, request):
        waiting_payment = []
        paid_needs_completion = []
        for order in self.orders().filter(status=Order.Status.WAITING_FINAL_PAYMENT):
            if order.remaining_amount <= 0:
                paid_needs_completion.append(_base_order(order))
            else:
                waiting_payment.append(_base_order(order))

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
            for payment in Payment.objects.select_related('order', 'order__customer').order_by('-received_at')[:20]
        ]

        return Response({
            'waiting_payment': waiting_payment,
            'paid_needs_completion': paid_needs_completion,
            'recent_payments': recent_payments,
        })


class TaskViewSet(viewsets.ModelViewSet):
    """
    Task API v1
    List/Retrieve: GET /api/v1/tasks/
    Create: POST /api/v1/tasks/
    State changes: POST /api/v1/tasks/{id}/change_status/ (via service layer)
    Convert to order: POST /api/v1/tasks/{id}/convert_to_order/
    """
    queryset = Task.objects.all().order_by('-created_at')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'client_phone']
    search_fields = ['task_number', 'client_name', 'client_phone']
    ordering_fields = ['created_at', 'scheduled_date']
    
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
                    created_by=request.user
                )
                uow.commit()
                
                response_serializer = TaskDetailSerializer(task)
                return Response(response_serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
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
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
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
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
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
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class InventoryAvailabilityViewSet(viewsets.ReadOnlyModelViewSet):
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
    filterset_fields = ['color', 'pattern', 'supplier', 'is_active']
    search_fields = ['hanger_number', 'name', 'color', 'pattern']
    ordering_fields = ['hanger_number', 'available_meters', 'price_per_meter']
    
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
            fabric = Fabric.objects.get(id=fabric_id, is_active=True)
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


class QuoteViewSet(viewsets.ModelViewSet):
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
        return queryset

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
            response_serializer = QuoteSerializer(quote)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

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
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

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
                {'error': str(e), 'hint': 'Run: pip install weasyprint'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

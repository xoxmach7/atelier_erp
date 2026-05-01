"""
Atelier ERP - API v1 Views
Minimal ViewSets with service layer integration
All state changes go through services
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from atelier_erp.api.permissions import IsManagerOrAdmin
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone

from atelier_erp.models import Order, Task, Fabric
from atelier_erp.services import OrderService, TaskService, UnitOfWork
from atelier_erp.services.exceptions import (
    OrderNotFoundError, InvalidOrderStatusTransition,
    TaskNotFoundError, InvalidTaskStatusTransition
)

from .serializers import (
    OrderListSerializer, OrderDetailSerializer, OrderCreateSerializer, OrderStatusUpdateSerializer,
    ChangeStatusSerializer, ChangeMaterialReadinessSerializer, ChangeProductionStageSerializer,
    ChangeHandoverStageSerializer, CancelOrderSerializer,
    TaskListSerializer, TaskDetailSerializer, TaskCreateSerializer, TaskStatusUpdateSerializer,
    FabricAvailabilitySerializer, InventoryCheckRequestSerializer, InventoryCheckResponseSerializer
)
from atelier_erp.constants import OrderFSMRules, OrderExecutionGuide, MaterialReadiness


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
        """Create requires Manager/Admin role"""
        if self.action == 'create':
            return [IsAuthenticated(), IsManagerOrAdmin()]
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

        # Build installation address dict from validated data
        installation_address = {
            'city': serializer.validated_data.get('installation_address_city', ''),
            'street': serializer.validated_data.get('installation_address_street', ''),
            'building': serializer.validated_data.get('installation_address_building', ''),
            'apartment': serializer.validated_data.get('installation_address_apartment', ''),
            'notes': serializer.validated_data.get('installation_address_notes', ''),
        }

        with UnitOfWork() as uow:
            service = OrderService(uow)
            try:
                order = service.create_order(
                    customer_id=serializer.validated_data['customer_id'],
                    order_number=order_number,
                    installation_address=installation_address,
                    created_by=request.user.id,
                    notes=serializer.validated_data.get('notes', ''),
                    planned_completion=serializer.validated_data.get('planned_completion'),
                    measurements=None  # Measurements added separately
                )
                
                # Set measurement_date if provided
                measurement_date = serializer.validated_data.get('measurement_date')
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
        """Update order notes and material_readiness via service layer"""
        order = self.get_object()
        
        # Handle material_readiness update directly on model
        material_readiness = request.data.get('material_readiness')
        if material_readiness:
            if material_readiness in [choice[0] for choice in MaterialReadiness.choices]:
                order.material_readiness = material_readiness
                order.save(update_fields=['material_readiness', 'updated_at'])
        
        with UnitOfWork() as uow:
            service = OrderService(uow)
            try:
                updated_order = service.update_order(
                    order_id=order.id,
                    notes=request.data.get('notes'),
                    updated_by=request.user
                )
                uow.commit()
                
                response_serializer = OrderDetailSerializer(updated_order)
                return Response(response_serializer.data)
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
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
        
        # Business rule checks
        from atelier_erp.constants import MaterialReadiness, ProductionStage
        
        # Cannot modify cancelled order
        if order.status == Order.Status.CANCELLED:
            return Response(
                {'detail': 'Нельзя изменить статус отменённого заказа.', 'code': 'cancelled_order'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Cannot modify completed order
        if order.status == Order.Status.COMPLETED:
            return Response(
                {'detail': 'Нельзя изменить статус завершённого заказа.', 'code': 'completed_order'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check for accepted quote and order items for in_work transition
        if new_status == Order.Status.IN_WORK:
            from atelier_erp.models import Quote
            has_accepted_quote = (
                (order.quote and order.quote.status == Quote.Status.APPROVED) or
                order.related_quotes.filter(status=Quote.Status.APPROVED).exists()
            )
            if not has_accepted_quote:
                return Response(
                    {'detail': 'Сначала примите КП и сформируйте позиции заказа.', 'code': 'quote_not_accepted'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if order.items.count() == 0:
                return Response(
                    {'detail': 'Сначала сформируйте позиции заказа из КП.', 'code': 'no_order_items'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Cannot start production without materials and order items
        if new_status == Order.Status.IN_PRODUCTION:
            if order.material_readiness == MaterialReadiness.NOT_READY:
                return Response(
                    {'detail': 'Нельзя начать производство: материалы не обеспечены.', 'code': 'material_not_ready'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if order.items.count() == 0:
                return Response(
                    {'detail': 'Сначала сформируйте позиции заказа из КП.', 'code': 'no_order_items'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Cannot mark ready if production not done
        if new_status == Order.Status.READY:
            if order.production_stage != ProductionStage.DONE:
                return Response(
                    {'detail': 'Нельзя отметить готовность: производство не завершено.', 'code': 'production_not_done'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Cannot complete if not paid
        if new_status == Order.Status.COMPLETED:
            balance_due = order.total_amount - order.paid_amount
            if balance_due > 0:
                return Response(
                    {
                        'detail': f'Нельзя завершить заказ: требуется оплата {balance_due}.',
                        'code': 'payment_required',
                        'balance_due': str(balance_due)
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        with UnitOfWork() as uow:
            service = OrderService(uow)
            try:
                order = service.transition_status(
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

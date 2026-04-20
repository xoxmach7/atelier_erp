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
    TaskListSerializer, TaskDetailSerializer, TaskCreateSerializer, TaskStatusUpdateSerializer,
    FabricAvailabilitySerializer, InventoryCheckRequestSerializer, InventoryCheckResponseSerializer
)


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
        return OrderDetailSerializer
    
    def create(self, request, *args, **kwargs):
        """Create order via OrderService"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Generate order number: О-YYYY-NNN
        year = timezone.now().year
        count = Order.objects.filter(created_at__year=year).count() + 1
        order_number = f"О-{year}-{count:03d}"

        with UnitOfWork() as uow:
            service = OrderService(uow)
            try:
                order = service.create_order(
                    customer_id=serializer.validated_data['customer_id'],
                    order_number=order_number,
                    created_by=request.user.id,
                    notes=serializer.validated_data.get('notes', ''),
                    planned_completion=serializer.validated_data.get('planned_completion')
                )
                uow.commit()
                
                response_serializer = OrderDetailSerializer(order)
                return Response(response_serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def update(self, request, *args, **kwargs):
        """Update order notes via service layer"""
        order = self.get_object()
        
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
                        performed_by=request.user,
                        reason=reason
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

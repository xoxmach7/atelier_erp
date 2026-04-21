"""
Atelier ERP - API Views
DRF ViewSets for the API
"""

from decimal import Decimal
from django.db.models import Q, Sum, Count
from django.utils import timezone
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django_filters.rest_framework import DjangoFilterBackend
from datetime import datetime, timedelta

from ..models import (
    Customer, Fabric, Cornice, Service, Order, OrderItem,
    Task, Quote, ProductionAssignment, Payment, ActivityLog
)
from ..services import (
    OrderService, InventoryService, ProductionService,
    PaymentService, TaskService, UnitOfWork
)
from ..services.exceptions import (
    OrderNotFoundError, InvalidOrderStatusTransition,
    InsufficientStockError, InvalidPaymentAmount
)
from .serializers import (
    CustomerSerializer, CustomerListSerializer,
    FabricSerializer, FabricListSerializer,
    CorniceSerializer, ServiceSerializer,
    OrderSerializer, OrderListSerializer, OrderCreateSerializer,
    TaskSerializer, TaskListSerializer,
    QuoteListSerializer,
    ProductionAssignmentSerializer,
    PaymentSerializer,
    DashboardSummarySerializer, InventoryAvailabilitySerializer,
    ActivityLogSerializer
)
from .permissions import IsManagerOrAdmin, IsWorkerOrManagerOrAdmin


class CustomerViewSet(viewsets.ModelViewSet):
    """Customer management API"""
    queryset = Customer.objects.filter(is_active=True)
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['address_city', 'is_active']
    search_fields = ['full_name', 'phone', 'email']
    ordering_fields = ['full_name', 'created_at', 'updated_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return CustomerListSerializer
        return CustomerSerializer


class FabricViewSet(viewsets.ModelViewSet):
    """Fabric inventory API"""
    queryset = Fabric.objects.filter(is_active=True)
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['color', 'pattern', 'supplier', 'is_active']
    search_fields = ['hanger_number', 'name']
    ordering_fields = ['hanger_number', 'created_at', 'stock_meters']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return FabricListSerializer
        return FabricSerializer
    
    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Get fabrics with low stock (< 10 meters)"""
        low_stock_fabrics = self.get_queryset().filter(stock_meters__lt=10)
        serializer = FabricListSerializer(low_stock_fabrics, many=True)
        return Response({
            'count': low_stock_fabrics.count(),
            'fabrics': serializer.data
        })


class CorniceViewSet(viewsets.ModelViewSet):
    """Cornice inventory API"""
    queryset = Cornice.objects.filter(is_active=True)
    serializer_class = CorniceSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['type', 'material', 'is_active']
    search_fields = ['sku', 'name']


class ServiceViewSet(viewsets.ReadOnlyModelViewSet):
    """Services API (read-only)"""
    queryset = Service.objects.filter(is_active=True)
    serializer_class = ServiceSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']


class OrderViewSet(viewsets.ModelViewSet):
    """Order management API with lifecycle actions"""
    queryset = Order.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'customer']
    search_fields = ['order_number', 'customer__full_name', 'customer__phone']
    ordering_fields = ['created_at', 'planned_completion', 'total_amount']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return OrderListSerializer
        elif self.action == 'create':
            return OrderCreateSerializer
        return OrderSerializer
    
    def get_permissions(self):
        """Different permissions for different actions"""
        if self.action in ['create', 'update', 'partial_update', 'destroy',
                          'confirm', 'cancel', 'complete']:
            return [IsManagerOrAdmin()]
        return [IsWorkerOrManagerOrAdmin()]
    
    def create(self, request, *args, **kwargs):
        """Block order creation in legacy API - use /api/v1/orders/ instead"""
        return Response(
            {
                'error': 'Order creation via legacy API is disabled.',
                'message': 'Use POST /api/v1/orders/ with OrderService.',
                'redirect_url': '/api/v1/orders/',
                'documentation': 'See API v1 documentation for proper Order lifecycle.'
            },
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )
    
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Confirm order (manager only)"""
        order = self.get_object()
        uow = UnitOfWork()
        order_service = OrderService(uow)
        
        try:
            with uow.atomic():
                # Update status via service
                order_service.update_status(
                    order_id=order.id,
                    new_status=Order.Status.APPROVED,
                    changed_by=str(request.user)
                )
            return Response({'status': 'confirmed'})
        except InvalidOrderStatusTransition as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def reserve_materials(self, request, pk=None):
        """Reserve materials for order"""
        order = self.get_object()
        uow = UnitOfWork()
        inventory_service = InventoryService(uow)
        
        try:
            # Get fabric items from order
            fabric_items = order.items.filter(item_type=OrderItem.ItemType.FABRIC)
            
            for item in fabric_items:
                if item.fabric:
                    inventory_service.reserve_fabric(
                        fabric_id=item.fabric.id,
                        order_id=order.id,
                        meters=item.quantity,
                        reserved_by=request.user
                    )
            
            return Response({'status': 'materials_reserved'})
        except InsufficientStockError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def start_production(self, request, pk=None):
        """Start production (assign to seamstress)"""
        order = self.get_object()
        seamstress_id = request.data.get('seamstress_id')
        
        if not seamstress_id:
            return Response(
                {'error': 'seamstress_id required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        uow = UnitOfWork()
        production_service = ProductionService(uow)
        
        try:
            with uow.atomic():
                assignment = production_service.create_assignment(
                    order_id=order.id,
                    seamstress_id=seamstress_id,
                    deadline=request.data.get('deadline'),
                    complexity=request.data.get('complexity', 'medium'),
                    priority=request.data.get('priority', 'normal')
                )
            
            return Response({
                'status': 'production_started',
                'assignment_id': str(assignment.id)
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Complete order (manager only)"""
        order = self.get_object()
        uow = UnitOfWork()
        order_service = OrderService(uow)
        
        try:
            with uow.atomic():
                order_service.complete_order(
                    order_id=order.id,
                    completed_by=request.user
                )
            return Response({'status': 'completed'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel order (manager only)"""
        order = self.get_object()
        uow = UnitOfWork()
        order_service = OrderService(uow)
        
        try:
            with uow.atomic():
                order_service.cancel_order(
                    order_id=order.id,
                    reason=request.data.get('reason', ''),
                    cancelled_by=str(request.user)
                )
            return Response({'status': 'cancelled'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class TaskViewSet(viewsets.ModelViewSet):
    """Task/Lead management API"""
    queryset = Task.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'priority', 'assigned_designer']
    search_fields = ['client_name', 'client_phone', 'task_number']
    ordering_fields = ['priority', 'created_at', 'measurement_date']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return TaskListSerializer
        return TaskSerializer
    
    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Start task work"""
        task = self.get_object()
        uow = UnitOfWork()
        task_service = TaskService(uow)
        
        try:
            with uow.atomic():
                task_service.start_measurement(task.id, started_by=request.user)
            return Response({'status': 'started'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Complete task/measurement"""
        task = self.get_object()
        uow = UnitOfWork()
        task_service = TaskService(uow)
        
        try:
            with uow.atomic():
                task_service.complete_measurement(task.id, completed_by=request.user)
            return Response({'status': 'measurement_completed'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class QuoteViewSet(viewsets.ReadOnlyModelViewSet):
    """Quotes API (read-only)"""
    queryset = Quote.objects.all()
    serializer_class = QuoteListSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status']


class ProductionAssignmentViewSet(viewsets.ModelViewSet):
    """Production assignments API"""
    queryset = ProductionAssignment.objects.all()
    serializer_class = ProductionAssignmentSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'assigned_to', 'complexity']
    ordering_fields = ['deadline', 'created_at', 'priority']


class PaymentViewSet(viewsets.ModelViewSet):
    """Payments API"""
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['order', 'payment_type', 'payment_method']
    ordering_fields = ['created_at', 'amount']
    
    def perform_create(self, serializer):
        """Record payment through service"""
        uow = UnitOfWork()
        payment_service = PaymentService(uow)
        
        try:
            with uow.atomic():
                payment = payment_service.record_payment(
                    order_id=serializer.validated_data['order'].id,
                    amount=serializer.validated_data['amount'],
                    payment_type=serializer.validated_data['payment_type'],
                    payment_method=serializer.validated_data.get('payment_method', 'cash'),
                    received_by=request.user,
                    notes=serializer.validated_data.get('notes', '')
                )
            return Response(PaymentSerializer(payment).data)
        except InvalidPaymentAmount as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class InventoryViewSet(viewsets.ViewSet):
    """Inventory operations API"""
    permission_classes = [IsWorkerOrManagerOrAdmin]
    
    @action(detail=False, methods=['get'])
    def availability(self, request):
        """Check fabric availability for a request"""
        fabric_requests = request.query_params.getlist('fabric')
        # Format: fabric_id:meters
        
        results = []
        for req in fabric_requests:
            try:
                fabric_id, meters = req.split(':')
                fabric = Fabric.objects.get(id=fabric_id, is_active=True)
                available = fabric.stock_meters - fabric.reserved_meters
                results.append({
                    'fabric_id': fabric_id,
                    'hanger_number': fabric.hanger_number,
                    'available_meters': available,
                    'requested_meters': Decimal(meters),
                    'can_fulfill': available >= Decimal(meters)
                })
            except (Fabric.DoesNotExist, ValueError):
                continue
        
        serializer = InventoryAvailabilitySerializer(data=results, many=True)
        serializer.is_valid()
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Get low stock alerts"""
        threshold = int(request.query_params.get('threshold', 10))
        low_stock = Fabric.objects.filter(
            is_active=True,
            stock_meters__lt=threshold
        ).order_by('stock_meters')
        
        serializer = FabricListSerializer(low_stock, many=True)
        return Response({
            'threshold': threshold,
            'count': low_stock.count(),
            'fabrics': serializer.data
        })


class DashboardViewSet(viewsets.ViewSet):
    """Dashboard summary API"""
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get dashboard summary"""
        today = timezone.now().date()
        month_start = today.replace(day=1)
        
        # Order stats
        orders = Order.objects.all()
        orders_by_status = dict(orders.values('status').annotate(
            count=Count('id')
        ).values_list('status', 'count'))
        
        # Revenue
        payments_today = Payment.objects.filter(
            created_at__date=today
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        payments_month = Payment.objects.filter(
            created_at__date__gte=month_start
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        # Low stock
        low_stock_count = Fabric.objects.filter(
            is_active=True,
            stock_meters__lt=10
        ).count()
        
        # Pending tasks
        pending_tasks = Task.objects.filter(
            status__in=[Task.Status.LEAD, Task.Status.MEASUREMENT_SCHEDULED]
        ).count()
        
        data = {
            'total_orders': orders.count(),
            'orders_by_status': orders_by_status,
            'total_customers': Customer.objects.filter(is_active=True).count(),
            'low_stock_fabrics': low_stock_count,
            'pending_tasks': pending_tasks,
            'revenue_today': payments_today,
            'revenue_month': payments_month
        }
        
        serializer = DashboardSummarySerializer(data)
        return Response(serializer.data)


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Activity log API (read-only)"""
    queryset = ActivityLog.objects.all()
    serializer_class = ActivityLogSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['entity_type', 'action', 'performed_by']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

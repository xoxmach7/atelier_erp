"""
Atelier Tasks API - Role-based permissions
Admin: full access
Manager: manage tasks
Worker: view and update only assigned tasks
"""
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.production.models import Task, WorkOrder
from core.permissions import (
    CanManageTasks,
    IsAssignedWorker,
    CanUpdateTaskStatus,
    is_manager_or_above,
    is_worker,
)


# ============ SERIALIZERS ============

class TaskSerializer(serializers.ModelSerializer):
    """Task with worker info."""
    assigned_to_name = serializers.CharField(
        source="assigned_to.get_full_name", read_only=True
    )
    task_type_display = serializers.CharField(source="get_task_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    work_order_number = serializers.CharField(source="work_order.work_order_number", read_only=True)

    class Meta:
        model = Task
        fields = [
            "id", "work_order", "work_order_number",
            "task_type", "task_type_display", "description", "sequence",
            "assigned_to", "assigned_to_name", "status", "status_display",
            "estimated_minutes", "actual_minutes",
            "started_at", "completed_at", "quality_score"
        ]


class TaskCreateSerializer(serializers.ModelSerializer):
    """Create task."""
    class Meta:
        model = Task
        fields = [
            "work_order", "task_type", "description", "sequence",
            "assigned_to", "estimated_minutes", "depends_on"
        ]


class TaskUpdateStatusSerializer(serializers.Serializer):
    """Update task status."""
    status = serializers.ChoiceField(choices=Task.Status.choices)
    actual_minutes = serializers.IntegerField(required=False, min_value=0)


class WorkOrderSerializer(serializers.ModelSerializer):
    """Work order with nested tasks."""
    tasks = TaskSerializer(many=True, read_only=True)
    assigned_to_name = serializers.CharField(source="assigned_to.get_full_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    order_number = serializers.CharField(source="order.order_number", read_only=True)

    class Meta:
        model = WorkOrder
        fields = [
            "id", "work_order_number", "order", "order_number",
            "product", "quantity_required", "quantity_completed",
            "assigned_to", "assigned_to_name", "status", "status_display",
            "priority", "planned_start", "actual_start", "actual_end",
            "estimated_hours", "actual_hours", "tasks"
        ]


# ============ VIEWSETS ============

class TaskViewSet(viewsets.ModelViewSet):
    """
    Tasks API with role-based access.
    
    Permissions:
    - Admin: full CRUD
    - Manager: full CRUD
    - Worker: read-only own tasks, update status of assigned tasks
    
    Endpoints:
    list: GET /api/v1/tasks/
    create: POST /api/v1/tasks/
    retrieve: GET /api/v1/tasks/{id}/
    update: PUT /api/v1/tasks/{id}/
    destroy: DELETE /api/v1/tasks/{id}/
    """
    
    def get_permissions(self):
        """Dynamic permissions based on action."""
        if self.action in ["create", "destroy"]:
            # Only admin and manager can create/delete tasks
            return [IsAuthenticated(), CanManageTasks()]
        
        if self.action in ["update", "partial_update"]:
            # Manager can edit, worker can only edit assigned tasks
            return [IsAuthenticated(), CanUpdateTaskStatus()]
        
        if self.action in ["start", "complete"]:
            # Worker can start/complete their assigned tasks
            return [IsAuthenticated(), IsAssignedWorker()]
        
        # list, retrieve - workers see only their tasks via queryset filter
        return [IsAuthenticated()]
    
    def get_queryset(self):
        """
        Filter tasks based on user role.
        - Admin/Manager: all tasks
        - Worker: only assigned tasks
        """
        user = self.request.user
        base_queryset = Task.objects.filter(is_active=True)
        
        # Admin and manager see all tasks
        if is_manager_or_above(user):
            queryset = base_queryset
        else:
            # Worker sees only their assigned tasks
            queryset = base_queryset.filter(assigned_to=user)
        
        # Apply query filters
        assigned_to = self.request.query_params.get("assigned_to")
        if assigned_to:
            queryset = queryset.filter(assigned_to_id=assigned_to)
        
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        work_order = self.request.query_params.get("work_order")
        if work_order:
            queryset = queryset.filter(work_order_id=work_order)
        
        return queryset
    
    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return TaskCreateSerializer
        return TaskSerializer
    
    def perform_create(self, serializer):
        """Create task and auto-assign if needed."""
        from apps.production.services import TaskService
        
        # If no worker assigned, try auto-assign
        if not serializer.validated_data.get("assigned_to"):
            # Create first, then auto-assign
            task = serializer.save()
            TaskService.auto_assign_task(str(task.id))
        else:
            serializer.save()
    
    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        """
        Assign task to worker.
        POST /api/v1/tasks/{id}/assign/
        Body: {"worker_id": "uuid"}
        Only manager/admin can assign.
        """
        from apps.production.services import TaskService
        from apps.users.models import User
        
        task = self.get_object()
        worker_id = request.data.get("worker_id")
        
        try:
            worker = User.objects.get(id=worker_id, is_active=True)
        except User.DoesNotExist:
            return Response(
                {"error": "Worker not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            task = TaskService.assign_task(
                task_id=str(task.id),
                worker=worker,
                assigned_by=request.user
            )
            return Response(TaskSerializer(task).data)
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        """
        Start task.
        POST /api/v1/tasks/{id}/start/
        Worker can only start their assigned tasks.
        """
        from apps.production.services import TaskService
        
        task = self.get_object()
        
        try:
            task = TaskService.start_task(str(task.id), request.user)
            return Response(TaskSerializer(task).data)
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        """
        Complete task.
        POST /api/v1/tasks/{id}/complete/
        Worker can only complete their assigned tasks.
        """
        from apps.production.services import TaskService
        
        task = self.get_object()
        serializer = TaskUpdateStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            task = TaskService.complete_task(
                task_id=str(task.id),
                worker=request.user,
                actual_minutes=serializer.validated_data.get("actual_minutes"),
                quality_score=serializer.validated_data.get("quality_score")
            )
            return Response(TaskSerializer(task).data)
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=["get"])
    def my_tasks(self, request):
        """
        Current user's assigned tasks.
        GET /api/v1/tasks/my_tasks/
        """
        if not is_worker(request.user):
            return Response(
                {"error": "Only workers can view their tasks"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        tasks = Task.objects.filter(
            assigned_to=request.user,
            is_active=True,
            status__in=[Task.Status.NEW, Task.Status.IN_PROGRESS]
        )
        serializer = TaskSerializer(tasks, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=["get"], permission_classes=[CanManageTasks])
    def available_workers(self, request):
        """
        Get workers who can accept new tasks.
        GET /api/v1/tasks/available_workers/
        Only manager/admin.
        """
        from apps.production.services import TaskService
        
        workers = TaskService.find_available_workers()
        data = []
        for w in workers:
            data.append({
                "worker_id": str(w["worker"].id),
                "worker_name": w["worker"].get_full_name(),
                "capacity": w["capacity"],
                "task_count_by_type": w["task_count_by_type"],
            })
        return Response(data)


class WorkOrderViewSet(viewsets.ModelViewSet):
    """
    Work orders API with role-based access.
    
    Permissions:
    - Admin: full CRUD
    - Manager: full CRUD
    - Worker: view-only work orders with their tasks
    
    Endpoints:
    list: GET /api/v1/work-orders/
    create: POST /api/v1/work-orders/
    retrieve: GET /api/v1/work-orders/{id}/
    """
    
    def get_permissions(self):
        """Dynamic permissions."""
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticated(), CanManageTasks()]
        return [IsAuthenticated()]
    
    def get_queryset(self):
        """
        Filter based on role.
        - Admin/Manager: all work orders
        - Worker: only work orders where they have tasks
        """
        user = self.request.user
        base_queryset = WorkOrder.objects.filter(is_active=True)
        
        if is_manager_or_above(user):
            queryset = base_queryset
        else:
            # Worker sees only work orders with their tasks
            queryset = base_queryset.filter(
                tasks__assigned_to=user,
                tasks__is_active=True
            ).distinct()
        
        # Filter by status
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by assigned worker
        assigned_to = self.request.query_params.get("assigned_to")
        if assigned_to:
            queryset = queryset.filter(assigned_to_id=assigned_to)
        
        return queryset
    
    serializer_class = WorkOrderSerializer


from django.utils import timezone

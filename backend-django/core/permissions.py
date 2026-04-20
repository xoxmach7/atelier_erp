from rest_framework import permissions

from apps.users.models import User


# =============================================================================
# Role-Based Permission Checks
# =============================================================================

def is_admin(user) -> bool:
    """Check if user is admin."""
    return user.is_authenticated and user.role == User.Role.ADMIN


def is_manager(user) -> bool:
    """Check if user is manager or admin."""
    return user.is_authenticated and user.role in [User.Role.MANAGER, User.Role.ADMIN]


def is_worker(user) -> bool:
    """Check if user is worker, cutter, or any production role."""
    return user.is_authenticated and user.role in [
        User.Role.WORKER,
        User.Role.CUTTER,
    ]


def is_manager_or_above(user) -> bool:
    """Check if user can manage orders (manager, admin)."""
    return user.is_authenticated and user.role in [
        User.Role.ADMIN,
        User.Role.MANAGER,
    ]


# =============================================================================
# Atelier Permission Classes
# =============================================================================

class IsAdminUser(permissions.BasePermission):
    """Full access for admin users only."""

    def has_permission(self, request, view):
        return is_admin(request.user)


class IsManagerOrAdmin(permissions.BasePermission):
    """Manager and admin can access."""

    def has_permission(self, request, view):
        return is_manager(request.user)


class CanManageOrders(permissions.BasePermission):
    """
    Admin and Manager: full order management.
    Worker: no access to order management.
    """

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return is_manager_or_above(request.user)


class CanViewOrders(permissions.BasePermission):
    """
    Admin, Manager: view all orders.
    Worker: view orders they have tasks for.
    """

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        # Admin and manager can view all
        if is_manager_or_above(request.user):
            return True
        # Workers can view (filtered in queryset)
        return is_worker(request.user)


class CanManageTasks(permissions.BasePermission):
    """
    Admin and Manager: create, assign, delete tasks.
    Worker: no management access.
    """

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return is_manager_or_above(request.user)


class IsAssignedWorker(permissions.BasePermission):
    """
    Worker can only access tasks assigned to them.
    Applies to retrieve, update, start, complete actions.
    """

    def has_object_permission(self, request, view, obj):
        # Admin and manager can access any task
        if is_manager_or_above(request.user):
            return True
        # Worker can only access their own tasks
        if is_worker(request.user):
            return obj.assigned_to == request.user
        return False


class CanUpdateTaskStatus(permissions.BasePermission):
    """
    Worker: can update status only for assigned tasks.
    Manager/Admin: can update any task.
    """

    def has_object_permission(self, request, view, obj):
        # Manager and admin can update any task
        if is_manager_or_above(request.user):
            return True
        # Worker can only update their assigned tasks
        if is_worker(request.user):
            return obj.assigned_to == request.user
        return False


class CanManageInventory(permissions.BasePermission):
    """
    Admin and Manager: full inventory control.
    Worker: view only.
    """

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        # Admin and manager have full access
        if is_manager_or_above(request.user):
            return True
        # Workers can only read
        if is_worker(request.user):
            return request.method in permissions.SAFE_METHODS
        return False


class CanRecordFabricUsage(permissions.BasePermission):
    """
    Admin, Manager, Cutter: record fabric usage.
    Worker: view only.
    """

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        # Admin and manager
        if is_manager_or_above(request.user):
            return True
        # Cutter can record usage
        if request.user.role == User.Role.CUTTER:
            return True
        # Workers can only read
        return request.method in permissions.SAFE_METHODS


class ReadOnly(permissions.BasePermission):
    """Read-only permission."""

    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS


# =============================================================================
# Legacy/Generic Permissions
# =============================================================================

class IsOwnerOrReadOnly(permissions.BasePermission):
    """Permission for object owners or read-only access."""

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return hasattr(obj, 'user_id') and obj.user_id == request.user.id


class IsSameUserOrAdmin(permissions.BasePermission):
    """Permission to only allow users to edit their own profile."""

    def has_object_permission(self, request, view, obj):
        return obj.id == request.user.id or is_admin(request.user)

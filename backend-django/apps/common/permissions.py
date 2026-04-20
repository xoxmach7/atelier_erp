from rest_framework import permissions


class IsAdminUser(permissions.BasePermission):
    """Permission for admin users only."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_staff
        )


class IsManagerOrAdmin(permissions.BasePermission):
    """Permission for managers or admins."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_staff or request.user.role in ["manager", "admin"])
        )


class IsOwnerOrReadOnly(permissions.BasePermission):
    """Permission for object owners or read-only access."""

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.user_id == request.user.id


class IsSameUserOrAdmin(permissions.BasePermission):
    """Permission to only allow users to edit their own profile."""

    def has_object_permission(self, request, view, obj):
        return obj.id == request.user.id or request.user.is_staff


class ReadOnly(permissions.BasePermission):
    """Read-only permission."""

    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS

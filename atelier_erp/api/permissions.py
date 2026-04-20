"""
Atelier ERP - Custom API Permissions
"""

from rest_framework import permissions


class IsManagerOrAdmin(permissions.BasePermission):
    """Allow only managers and admins"""
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return (
            request.user.is_superuser or 
            request.user.groups.filter(name='Manager').exists() or
            request.user.groups.filter(name='Admin').exists()
        )


class IsWorkerOrManagerOrAdmin(permissions.BasePermission):
    """Allow workers, managers, and admins (read + limited write)"""
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Safe methods allowed for all authenticated users
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write operations only for workers, managers, admins
        return (
            request.user.is_superuser or 
            request.user.groups.filter(name__in=['Worker', 'Manager', 'Admin']).exists()
        )


class IsSeamstressOwner(permissions.BasePermission):
    """Allow only the assigned seamstress or managers"""
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Managers and admins can access all
        if (
            request.user.is_superuser or 
            request.user.groups.filter(name__in=['Manager', 'Admin']).exists()
        ):
            return True
        
        # Seamstresses can only access their own assignments
        if request.user.groups.filter(name='Seamstress').exists():
            return obj.assigned_to == request.user
        
        return False

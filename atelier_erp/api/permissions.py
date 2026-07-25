"""
Atelier ERP - Custom API Permissions

Все имена групп берутся из единого реестра atelier_erp.roles.Roles.
Не хардкодить строки групп здесь — иначе снова разъедутся с сидером и фронтом.
Суперпользователь везде приравнивается к Owner (полный доступ).
"""

from rest_framework import permissions

from atelier_erp.roles import Roles, user_in


class IsManagerOrAdmin(permissions.BasePermission):
    """Только владелец/админ (полное управление)."""

    def has_permission(self, request, view):
        return user_in(request.user, Roles.OWNER)


class IsPlatformAdmin(permissions.BasePermission):
    """Только платформенный админ Sheber (Django is_superuser) — управление
    ателье как юридическими клиентами платформы, а не Owner конкретного
    ателье.

    В отличие от остальных классов в этом файле, НЕ идёт через user_in()
    (которая приравнивает is_superuser к Owner ради удобства владельца
    ателье) — здесь is_superuser это ЕДИНСТВЕННЫЙ признак доступа. Обычный
    Owner ателье (группа Owner, не superuser) сюда не проходит, иначе любой
    Owner мог бы создавать/видеть чужие ателье.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class IsWorkerOrManagerOrAdmin(permissions.BasePermission):
    """Чтение — всем авторизованным; запись — любой рабочей роли."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return user_in(request.user, *Roles.ALL)


class IsOwnerOrDesigner(permissions.BasePermission):
    """Только владелец/админ и дизайнер."""

    def has_permission(self, request, view):
        return user_in(request.user, Roles.OWNER, Roles.DESIGNER)


class CanAccessMeasurement(permissions.BasePermission):
    """
    Доступ к замерам.

    Owner/Designer — полный CRUD (они ведут замеры).
    Warehouse/Seamstress/Installer — чтение и частичное обновление: им нужно
    отмечать галочки по окну (`materials_ready` / `sewing_done` /
    `installation_done`) на своих экранах заказа.
    Набор полей, который им реально разрешено писать, ограничивается отдельно —
    сериализатором в MeasurementViewSet.get_serializer_class, чтобы склад не мог
    переписать размеры окна или ткань.

    Раньше здесь стоял IsOwnerOrDesigner, из-за чего складская галочка
    возвращала 403.
    """

    FULL_ACCESS = (Roles.OWNER, Roles.DESIGNER)
    CHECKBOX_ONLY = (Roles.WAREHOUSE, Roles.SEAMSTRESS, Roles.INSTALLER)

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if user_in(request.user, *self.FULL_ACCESS):
            return True
        if user_in(request.user, *self.CHECKBOX_ONLY):
            # Ни создания, ни удаления замеров — только чтение и отметка.
            return request.method in permissions.SAFE_METHODS or request.method == 'PATCH'
        return False


class IsWarehouseOrOwner(permissions.BasePermission):
    """Только склад и владелец/админ."""

    def has_permission(self, request, view):
        return user_in(request.user, Roles.WAREHOUSE, Roles.OWNER)


class IsInstallationOrOwner(permissions.BasePermission):
    """Только монтажник и владелец/админ."""

    def has_permission(self, request, view):
        return user_in(request.user, Roles.INSTALLER, Roles.OWNER)


class IsInstallationOrOwnerOrReadOnly(permissions.BasePermission):
    """Чтение — всем авторизованным; запись — монтажник/владелец."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return user_in(request.user, Roles.INSTALLER, Roles.OWNER)


class IsSeamstressOrOwner(permissions.BasePermission):
    """Только швейный цех и владелец/админ (для очереди производства)."""

    def has_permission(self, request, view):
        return user_in(request.user, Roles.SEAMSTRESS, Roles.OWNER)


class IsSeamstressOwner(permissions.BasePermission):
    """Только назначенная швея (по объекту) или владелец/админ."""

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        # Владелец/админ — доступ ко всему
        if user_in(request.user, Roles.OWNER):
            return True
        # Швея — только свои назначения
        if request.user.groups.filter(name=Roles.SEAMSTRESS).exists():
            return obj.assigned_to == request.user
        return False

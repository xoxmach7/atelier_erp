from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema
from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from core.pagination import StandardResultsSetPagination
from core.permissions import IsAdminUser, IsManagerOrAdmin, IsSameUserOrAdmin
from apps.users.filters import UserFilter
from apps.users.models import User
from apps.users.serializers import (
    MasterSerializer,
    PasswordChangeSerializer,
    ProfilePictureSerializer,
    UserCreateSerializer,
    UserDetailSerializer,
    UserListSerializer,
    UserRoleUpdateSerializer,
    UserSettingsSerializer,
    UserUpdateSerializer,
)
from apps.users.services import UserService


@extend_schema(tags=["Users"])
class UserViewSet(ModelViewSet):
    """User management viewset."""

    queryset = User.objects.filter(is_active=True)
    serializer_class = UserListSerializer
    pagination_class = StandardResultsSetPagination
    filterset_class = UserFilter
    filter_backends = [filters.OrderingFilter, filters.SearchFilter]
    search_fields = ["email", "first_name", "last_name", "phone"]
    ordering_fields = ["created_at", "last_name", "role"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ["update", "partial_update"]:
            return UserUpdateSerializer
        if self.action == "retrieve":
            return UserDetailSerializer
        return UserListSerializer

    def get_permissions(self):
        if self.action in ["list", "create", "destroy", "update_role"]:
            return [IsManagerOrAdmin()]
        if self.action in ["update", "partial_update"]:
            return [IsSameUserOrAdmin()]
        return [IsAuthenticated()]

    def perform_destroy(self, instance):
        """Soft delete user."""
        UserService.deactivate_user(str(instance.id))

    @extend_schema(summary="Get current user profile")
    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def me(self, request):
        """Get current user's profile."""
        serializer = UserDetailSerializer(request.user)
        return Response(serializer.data)

    @extend_schema(summary="Update current user profile")
    @action(detail=False, methods=["patch"], permission_classes=[IsAuthenticated])
    def update_me(self, request):
        """Update current user's profile."""
        serializer = UserUpdateSerializer(
            request.user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        user = UserService.update_user(request.user, **serializer.validated_data)
        return Response(UserDetailSerializer(user).data)

    @extend_schema(summary="Change password")
    @action(detail=False, methods=["post"], permission_classes=[IsAuthenticated])
    def change_password(self, request):
        """Change user's password."""
        serializer = PasswordChangeSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save()

        return Response(
            {"message": "Password changed successfully."},
            status=status.HTTP_200_OK,
        )

    @extend_schema(summary="Upload profile picture")
    @action(
        detail=False, methods=["post"], permission_classes=[IsAuthenticated]
    )
    def upload_avatar(self, request):
        """Upload profile picture."""
        serializer = ProfilePictureSerializer(
            request.user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @extend_schema(summary="Update user settings")
    @action(detail=False, methods=["patch"], permission_classes=[IsAuthenticated])
    def settings(self, request):
        """Update user settings."""
        serializer = UserSettingsSerializer(
            request.user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @extend_schema(summary="Update user role", request=UserRoleUpdateSerializer)
    @action(
        detail=True,
        methods=["patch"],
        permission_classes=[IsAdminUser],
        url_path="role",
    )
    def update_role(self, request, pk=None):
        """Update user role (admin only)."""
        user = self.get_object()
        serializer = UserRoleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated_user = UserService.change_role(
            str(user.id), serializer.validated_data["role"]
        )
        return Response(UserDetailSerializer(updated_user).data)

    @extend_schema(summary="List masters with stats")
    @action(
        detail=False,
        methods=["get"],
        permission_classes=[IsManagerOrAdmin],
        url_path="masters",
    )
    def masters(self, request):
        """List all masters with statistics."""
        masters = UserService.get_masters_with_stats()
        serializer = MasterSerializer(masters, many=True)
        return Response(serializer.data)

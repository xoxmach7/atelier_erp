from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import (
    TokenObtainPairView as BaseTokenObtainPairView,
)

from apps.authentication.serializers import (
    LogoutSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    TokenObtainPairResponseSerializer,
)
from core.exceptions import BadRequestException, ValidationError
from apps.users.models import User
from apps.users.serializers import UserDetailSerializer
from apps.users.services import UserService


@extend_schema(tags=["Authentication"])
class TokenObtainPairView(BaseTokenObtainPairView):
    """Custom login endpoint that returns tokens with user data."""

    serializer_class = TokenObtainPairResponseSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Get user and update last login
        user = serializer.user
        UserService.update_last_login(user)

        return Response(
            {
                "success": True,
                "message": "Login successful",
                "data": {
                    "access": serializer.validated_data["access"],
                    "refresh": serializer.validated_data["refresh"],
                    "user": UserDetailSerializer(user).data,
                },
            },
            status=status.HTTP_200_OK,
        )


@extend_schema(tags=["Authentication"])
class LogoutView(APIView):
    """Logout endpoint that blacklists the refresh token."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=LogoutSerializer, summary="Logout user")
    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            refresh_token = serializer.validated_data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()

            return Response(
                {"success": True, "message": "Logout successful"},
                status=status.HTTP_200_OK,
            )
        except TokenError:
            raise BadRequestException("Invalid or expired token")


@extend_schema(tags=["Authentication"])
class PasswordResetRequestView(APIView):
    """Request password reset email."""

    permission_classes = [AllowAny]

    @extend_schema(
        request=PasswordResetRequestSerializer,
        summary="Request password reset",
    )
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        user = User.objects.filter(email=email, is_active=True).first()

        if user:
            # Generate reset token
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))

            # Send email asynchronously
            from apps.authentication.tasks import send_password_reset_email

            send_password_reset_email.delay(email, uid, token)

        # Always return success to prevent email enumeration
        return Response(
            {
                "success": True,
                "message": "If an account exists with this email, you will receive a password reset link.",
            },
            status=status.HTTP_200_OK,
        )


@extend_schema(tags=["Authentication"])
class PasswordResetConfirmView(APIView):
    """Confirm password reset with token."""

    permission_classes = [AllowAny]

    @extend_schema(
        request=PasswordResetConfirmSerializer,
        summary="Confirm password reset",
    )
    def post(self, request):
        from django.utils.encoding import force_str
        from django.utils.http import urlsafe_base64_decode

        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            uid = force_str(urlsafe_base64_decode(serializer.validated_data["uid"]))
            user = User.objects.get(pk=uid, is_active=True)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            raise BadRequestException("Invalid reset link")

        token = serializer.validated_data["token"]

        if not default_token_generator.check_token(user, token):
            raise BadRequestException("Invalid or expired token")

        # Set new password
        user.set_password(serializer.validated_data["new_password"])
        user.save()

        return Response(
            {"success": True, "message": "Password has been reset successfully"},
            status=status.HTTP_200_OK,
        )

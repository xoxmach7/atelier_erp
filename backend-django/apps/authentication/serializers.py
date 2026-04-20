from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer as BaseTokenObtainPairSerializer,
)
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models import User


class TokenObtainPairSerializer(BaseTokenObtainPairSerializer):
    """Custom token serializer with email validation."""

    username_field = User.USERNAME_FIELD

    def validate(self, attrs):
        email = attrs.get("email", "").lower().strip()
        password = attrs.get("password", "")

        if not email or not password:
            raise serializers.ValidationError(
                "Must include 'email' and 'password'.",
                code="authorization",
            )

        # Check if user exists
        user = User.objects.filter(email=email, is_active=True).first()
        if not user:
            raise serializers.ValidationError(
                "No active account found with the given credentials",
                code="authorization",
            )

        # Authenticate
        credentials = {"email": email, "password": password}
        user = authenticate(**credentials)

        if user is None:
            raise serializers.ValidationError(
                "Invalid credentials",
                code="authorization",
            )

        # Generate tokens
        refresh = RefreshToken.for_user(user)

        data = {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": user,
        }

        return data

    @property
    def user(self):
        return self._user


class TokenObtainPairResponseSerializer(serializers.Serializer):
    """Response serializer for login."""

    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)


class LogoutSerializer(serializers.Serializer):
    """Serializer for logout request."""

    refresh = serializers.CharField(required=True, help_text="Refresh token to blacklist")


class PasswordResetRequestSerializer(serializers.Serializer):
    """Serializer for password reset request."""

    email = serializers.EmailField(required=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Serializer for password reset confirmation."""

    uid = serializers.CharField(required=True, help_text="Base64 encoded user ID")
    token = serializers.CharField(required=True, help_text="Password reset token")
    new_password = serializers.CharField(required=True, write_only=True)
    new_password_confirm = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "Passwords do not match."}
            )
        return attrs

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.users.models import User


class UserListSerializer(serializers.ModelSerializer):
    """Serializer for listing users."""

    full_name = serializers.CharField(source="get_full_name", read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "patronymic",
            "full_name",
            "role",
            "role_display",
            "phone",
            "avatar",
            "is_active",
            "last_login",
            "created_at",
        ]


class UserDetailSerializer(serializers.ModelSerializer):
    """Serializer for detailed user information."""

    full_name = serializers.CharField(source="get_full_name", read_only=True)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "patronymic",
            "full_name",
            "phone",
            "role",
            "avatar",
            "birth_date",
            "address",
            "emergency_contact",
            "notes",
            "employee_id",
            "hire_date",
            "hourly_rate",
            "commission_rate",
            "email_verified",
            "phone_verified",
            "two_factor_enabled",
            "language",
            "timezone",
            "is_active",
            "is_staff",
            "date_joined",
            "last_login",
            "permissions",
        ]
        read_only_fields = [
            "id",
            "email_verified",
            "phone_verified",
            "date_joined",
            "last_login",
            "permissions",
        ]

    def get_permissions(self, obj: User) -> dict:
        return {
            "is_admin": obj.is_admin,
            "is_manager": obj.is_manager,
            "is_master": obj.is_master,
        }


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating users."""

    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
    )
    password_confirm = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = [
            "email",
            "password",
            "password_confirm",
            "first_name",
            "last_name",
            "patronymic",
            "phone",
            "role",
            "employee_id",
        ]
        extra_kwargs = {
            "first_name": {"required": True},
            "last_name": {"required": True},
        }

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Passwords do not match."}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        return User.objects.create_user(**validated_data)


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating users."""

    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "patronymic",
            "phone",
            "birth_date",
            "address",
            "emergency_contact",
            "notes",
            "language",
            "timezone",
        ]


class UserRoleUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user role (admin only)."""

    class Meta:
        model = User
        fields = ["role", "is_staff"]


class PasswordChangeSerializer(serializers.Serializer):
    """Serializer for password change."""

    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "Passwords do not match."}
            )
        return attrs

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    """Serializer for password reset request."""

    email = serializers.EmailField(required=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Serializer for password reset confirmation."""

    token = serializers.CharField(required=True)
    uid = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "Passwords do not match."}
            )
        return attrs


class ProfilePictureSerializer(serializers.ModelSerializer):
    """Serializer for profile picture upload."""

    class Meta:
        model = User
        fields = ["avatar"]


class UserSettingsSerializer(serializers.ModelSerializer):
    """Serializer for user settings."""

    class Meta:
        model = User
        fields = [
            "language",
            "timezone",
            "two_factor_enabled",
        ]


class MasterSerializer(serializers.ModelSerializer):
    """Serializer for masters with statistics."""

    full_name = serializers.CharField(source="get_full_name", read_only=True)
    completed_orders = serializers.IntegerField(read_only=True)
    active_orders = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "phone",
            "avatar",
            "hourly_rate",
            "commission_rate",
            "completed_orders",
            "active_orders",
        ]

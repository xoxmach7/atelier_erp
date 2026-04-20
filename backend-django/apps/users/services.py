from typing import Optional

from django.core.cache import cache
from django.db import models, transaction

from core.exceptions import ConflictError, NotFoundError, ValidationError
from apps.users.models import User


class UserService:
    """Service layer for user-related business logic."""

    CACHE_PREFIX = "user"
    CACHE_TTL = 300  # 5 minutes

    @classmethod
    def get_by_id(cls, user_id: str) -> User:
        """Get user by ID with caching."""
        cache_key = f"{cls.CACHE_PREFIX}:{user_id}"
        user = cache.get(cache_key)

        if user is None:
            try:
                user = User.objects.get(id=user_id, is_active=True)
                cache.set(cache_key, user, cls.CACHE_TTL)
            except User.DoesNotExist:
                raise NotFoundError(f"User with id {user_id} not found")

        return user

    @classmethod
    def get_by_email(cls, email: str) -> Optional[User]:
        """Get user by email."""
        return User.objects.filter(email=email.lower(), is_active=True).first()

    @classmethod
    @transaction.atomic
    def create_user(
        cls,
        email: str,
        password: str,
        first_name: str,
        last_name: str,
        **kwargs
    ) -> User:
        """Create a new user."""
        email = email.lower().strip()

        if User.objects.filter(email=email).exists():
            raise ConflictError("User with this email already exists")

        user = User.objects.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            **kwargs
        )
        return user

    @classmethod
    @transaction.atomic
    def update_user(cls, user: User, **kwargs) -> User:
        """Update user fields."""
        email = kwargs.get("email")
        if email and email.lower() != user.email:
            if User.objects.filter(email=email.lower()).exclude(id=user.id).exists():
                raise ConflictError("Email already in use")
            kwargs["email"] = email.lower()

        for key, value in kwargs.items():
            if hasattr(user, key):
                setattr(user, key, value)

        user.save()
        cls.invalidate_cache(user.id)
        return user

    @classmethod
    @transaction.atomic
    def deactivate_user(cls, user_id: str) -> None:
        """Soft delete a user."""
        user = cls.get_by_id(user_id)
        user.is_active = False
        user.save(update_fields=["is_active"])
        cls.invalidate_cache(user_id)

    @classmethod
    def change_role(cls, user_id: str, new_role: str) -> User:
        """Change user role."""
        valid_roles = [choice[0] for choice in User.Role.choices]
        if new_role not in valid_roles:
            raise ValidationError(f"Invalid role. Must be one of: {', '.join(valid_roles)}")

        user = cls.get_by_id(user_id)
        user.role = new_role
        user.save(update_fields=["role"])
        cls.invalidate_cache(user_id)
        return user

    @classmethod
    def update_last_login(cls, user: User) -> None:
        """Update last login timestamp."""
        from django.utils import timezone

        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])

    @classmethod
    def invalidate_cache(cls, user_id: str) -> None:
        """Invalidate user cache."""
        cache_key = f"{cls.CACHE_PREFIX}:{user_id}"
        cache.delete(cache_key)

    @classmethod
    def list_users(
        cls,
        role: Optional[str] = None,
        is_active: Optional[bool] = True,
        search: Optional[str] = None,
    ):
        """List users with filters."""
        queryset = User.objects.all()

        if is_active is not None:
            queryset = queryset.filter(is_active=is_active)

        if role:
            queryset = queryset.filter(role=role)

        if search:
            queryset = queryset.filter(
                models.Q(first_name__icontains=search)
                | models.Q(last_name__icontains=search)
                | models.Q(email__icontains=search)
            )

        return queryset

    @classmethod
    def get_masters_with_stats(cls):
        """Get masters with work statistics."""
        from django.db.models import Count, Q

        return (
            User.objects.filter(role=User.Role.MASTER, is_active=True)
            .annotate(
                completed_orders=Count(
                    "assigned_orders",
                    filter=Q(assigned_orders__status="completed"),
                ),
                active_orders=Count(
                    "assigned_orders",
                    filter=Q(assigned_orders__status__in=["pending", "in_progress"]),
                ),
            )
            .order_by("-completed_orders")
        )


class UserProfileService:
    """Service for user profile operations."""

    @staticmethod
    def update_profile_picture(user: User, image) -> None:
        """Update user's profile picture."""
        if user.avatar:
            user.avatar.delete(save=False)
        user.avatar = image
        user.save(update_fields=["avatar"])

    @staticmethod
    def remove_profile_picture(user: User) -> None:
        """Remove user's profile picture."""
        if user.avatar:
            user.avatar.delete(save=True)

from typing import Optional

from django.contrib.auth.models import BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    """Custom user manager for email-based authentication."""

    def create_user(
        self,
        email: str,
        password: Optional[str] = None,
        first_name: str = "",
        last_name: str = "",
        **extra_fields
    ):
        if not email:
            raise ValueError("The Email field must be set")

        email = self.normalize_email(email)
        user = self.model(
            email=email,
            first_name=first_name,
            last_name=last_name,
            **extra_fields
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(
        self,
        email: str,
        password: Optional[str] = None,
        first_name: str = "",
        last_name: str = "",
        **extra_fields
    ):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "admin")
        extra_fields.setdefault("email_verified", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, first_name, last_name, **extra_fields)

    def get_active(self):
        """Return only active users."""
        return self.filter(is_active=True)

    def get_by_employee_id(self, employee_id: str):
        """Get user by employee ID."""
        return self.filter(employee_id=employee_id, is_active=True).first()

    def get_masters(self):
        """Return all master users."""
        return self.filter(role="master", is_active=True)

    def get_managers(self):
        """Return all manager and admin users."""
        return self.filter(role__in=["manager", "admin"], is_active=True)

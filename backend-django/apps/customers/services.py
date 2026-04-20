from typing import Any, Optional

from django.db import models, transaction

from core.exceptions import ConflictError, NotFoundError
from apps.customers.models import Customer


class CustomerService:
    """Service layer for customer-related business logic."""

    @classmethod
    def get_by_id(cls, customer_id: str) -> Customer:
        """Get customer by ID."""
        try:
            return Customer.objects.get(id=customer_id, is_active=True)
        except Customer.DoesNotExist:
            raise NotFoundError(f"Customer with id {customer_id} not found")

    @classmethod
    def find_by_phone(cls, phone: str):
        """Find customers by phone number."""
        return Customer.objects.filter(
            models.Q(phone__icontains=phone) | Q(phone_secondary__icontains=phone),
            is_active=True,
        )

    @classmethod
    @transaction.atomic
    def create_customer(cls, **kwargs) -> Customer:
        """Create a new customer."""
        created_by = kwargs.pop("created_by", None)

        # Check for duplicate phone
        phone = kwargs.get("phone")
        if phone and Customer.objects.filter(phone=phone, is_active=True).exists():
            existing = Customer.objects.get(phone=phone, is_active=True)
            raise ConflictError(
                f"Customer with phone {phone} already exists: {existing.display_name}"
            )

        customer = Customer.objects.create(**kwargs)
        return customer

    @classmethod
    @transaction.atomic
    def update_customer(cls, customer_id: str, **kwargs) -> Customer:
        """Update customer fields."""
        customer = cls.get_by_id(customer_id)

        for key, value in kwargs.items():
            if hasattr(customer, key):
                setattr(customer, key, value)

        customer.save()
        return customer

    @classmethod
    @transaction.atomic
    def deactivate_customer(cls, customer_id: str) -> None:
        """Soft delete a customer."""
        customer = cls.get_by_id(customer_id)
        customer.delete()

    @classmethod
    def get_customer_stats(cls, customer_id: str) -> dict:
        """Get customer statistics."""
        from apps.orders.models import Order

        customer = cls.get_by_id(customer_id)

        orders = Order.objects.filter(customer=customer)
        completed_orders = orders.filter(status=Order.Status.COMPLETED)

        return {
            "total_orders": orders.count(),
            "completed_orders": completed_orders.count(),
            "total_spent": completed_orders.aggregate(
                total=models.Sum("total_amount")
            )["total"]
            or 0,
            "average_order_value": completed_orders.aggregate(
                avg=models.Avg("total_amount")
            )["avg"]
            or 0,
            "last_order_date": orders.order_by("-created_at")
            .values_list("created_at", flat=True)
            .first(),
        }

    @classmethod
    def get_top_customers(cls, limit: int = 10):
        """Get top customers by total spent."""
        return Customer.objects.filter(is_active=True).order_by("-total_spent")[:limit]

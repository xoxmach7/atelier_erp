from typing import Optional

from django.db.models import Avg, Count, F, Q, Sum
from django.utils import timezone

from apps.orders.models import Order, OrderItem
from apps.payments.models import Payment
from apps.users.models import User


class ReportService:
    """Service for generating reports."""

    @classmethod
    def get_dashboard_summary(cls) -> dict:
        """Get dashboard summary statistics."""
        today = timezone.now().date()

        # Orders
        orders_today = Order.objects.filter(order_date__date=today).count()
        orders_pending = Order.objects.filter(
            status__in=[Order.Status.PENDING, Order.Status.CONFIRMED]
        ).count()
        orders_in_progress = Order.objects.filter(
            status=Order.Status.IN_PROGRESS
        ).count()
        orders_overdue = Order.objects.filter(
            deadline_date__lt=timezone.now(),
            status__in=[
                Order.Status.PENDING,
                Order.Status.CONFIRMED,
                Order.Status.IN_PROGRESS,
            ],
        ).count()

        # Payments
        payments_today = Payment.objects.filter(
            paid_at__date=today, status=Payment.Status.COMPLETED
        ).aggregate(total=Sum("amount"))["total"] or 0

        # Masters
        active_masters = User.objects.filter(
            role=User.Role.MASTER, is_active=True
        ).count()

        # Monthly stats
        month_start = today.replace(day=1)
        monthly_revenue = (
            Payment.objects.filter(
                paid_at__date__gte=month_start, status=Payment.Status.COMPLETED
            ).aggregate(total=Sum("amount"))["total"]
            or 0
        )

        return {
            "orders": {
                "today": orders_today,
                "pending": orders_pending,
                "in_progress": orders_in_progress,
                "overdue": orders_overdue,
            },
            "payments": {
                "today": payments_today,
                "monthly": monthly_revenue,
            },
            "staff": {
                "active_masters": active_masters,
            },
            "date": today.isoformat(),
        }

    @classmethod
    def get_sales_report(
        cls,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        group_by: str = "day",
    ) -> dict:
        """Get sales report."""
        queryset = Payment.objects.filter(status=Payment.Status.COMPLETED)

        if start_date:
            queryset = queryset.filter(paid_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(paid_at__date__lte=end_date)

        # Group by date
        from django.db.models.functions import TruncDate, TruncMonth, TruncWeek

        trunc_func = TruncDate
        if group_by == "week":
            trunc_func = TruncWeek
        elif group_by == "month":
            trunc_func = TruncMonth

        sales_by_period = (
            queryset.annotate(period=trunc_func("paid_at"))
            .values("period")
            .annotate(total=Sum("amount"), count=Count("id"))
            .order_by("period")
        )

        # By payment method
        by_method = (
            queryset.values("method")
            .annotate(total=Sum("amount"), count=Count("id"))
            .order_by("-total")
        )

        return {
            "periods": list(sales_by_period),
            "by_method": list(by_method),
            "total": queryset.aggregate(total=Sum("amount"))["total"] or 0,
            "count": queryset.count(),
        }

    @classmethod
    def get_orders_report(
        cls,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> dict:
        """Get orders report."""
        queryset = Order.objects.filter(is_active=True)

        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)

        # By status
        by_status = (
            queryset.values("status")
            .annotate(count=Count("id"), total=Sum("total_amount"))
            .order_by("status")
        )

        # By priority
        by_priority = (
            queryset.values("priority")
            .annotate(count=Count("id"))
            .order_by("priority")
        )

        return {
            "by_status": list(by_status),
            "by_priority": list(by_priority),
            "total_count": queryset.count(),
            "total_amount": queryset.aggregate(total=Sum("total_amount"))["total"]
            or 0,
            "avg_order_value": queryset.aggregate(avg=Avg("total_amount"))["avg"] or 0,
        }

    @classmethod
    def get_masters_performance(
        cls,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> dict:
        """Get masters performance report."""
        masters = User.objects.filter(role=User.Role.MASTER, is_active=True)

        result = []
        for master in masters:
            orders = Order.objects.filter(
                masters=master,
                status=Order.Status.COMPLETED,
                is_active=True,
            )

            if start_date:
                orders = orders.filter(completed_date__date__gte=start_date)
            if end_date:
                orders = orders.filter(completed_date__date__lte=end_date)

            items = OrderItem.objects.filter(
                assigned_to=master,
                status=OrderItem.Status.COMPLETED,
            )

            result.append(
                {
                    "id": str(master.id),
                    "name": master.get_full_name(),
                    "completed_orders": orders.count(),
                    "completed_items": items.count(),
                    "total_hours": items.aggregate(total=Sum("hours_spent"))["total"]
                    or 0,
                }
            )

        return {"masters": result}

    @classmethod
    def get_customers_report(cls) -> dict:
        """Get customers report."""
        from apps.customers.models import Customer

        total_customers = Customer.objects.filter(is_active=True).count()
        new_this_month = Customer.objects.filter(
            created_at__month=timezone.now().month, is_active=True
        ).count()

        # Top customers
        top_customers = Customer.objects.filter(is_active=True).order_by(
            "-total_spent"
        )[:10]

        return {
            "total": total_customers,
            "new_this_month": new_this_month,
            "top_customers": [
                {
                    "id": str(c.id),
                    "name": c.display_name,
                    "total_spent": c.total_spent,
                    "total_orders": c.total_orders,
                }
                for c in top_customers
            ],
        }

    @classmethod
    def get_user_performance(
        cls,
        user_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> dict:
        """Get specific user's performance."""
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return {"error": "User not found"}

        # Orders managed
        managed_orders = Order.objects.filter(manager=user, is_active=True)

        # Items assigned
        assigned_items = OrderItem.objects.filter(assigned_to=user)

        if start_date:
            managed_orders = managed_orders.filter(created_at__date__gte=start_date)
            assigned_items = assigned_items.filter(created_at__date__gte=start_date)
        if end_date:
            managed_orders = managed_orders.filter(created_at__date__lte=end_date)
            assigned_items = assigned_items.filter(created_at__date__lte=end_date)

        return {
            "user_id": str(user.id),
            "name": user.get_full_name(),
            "role": user.role,
            "managed_orders": managed_orders.count(),
            "assigned_items": assigned_items.count(),
            "completed_items": assigned_items.filter(
                status=OrderItem.Status.COMPLETED
            ).count(),
        }

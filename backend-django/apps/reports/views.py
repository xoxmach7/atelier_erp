from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsManagerOrAdmin
from apps.reports.services import ReportService


@extend_schema(tags=["Reports"])
@api_view(["GET"])
@permission_classes([IsManagerOrAdmin])
def dashboard_summary(request):
    """Get dashboard summary statistics."""
    return Response(ReportService.get_dashboard_summary())


@extend_schema(tags=["Reports"])
@api_view(["GET"])
@permission_classes([IsManagerOrAdmin])
def sales_report(request):
    """Get sales report."""
    start_date = request.query_params.get("start")
    end_date = request.query_params.get("end")
    group_by = request.query_params.get("group_by", "day")  # day, week, month

    return Response(
        ReportService.get_sales_report(start_date, end_date, group_by)
    )


@extend_schema(tags=["Reports"])
@api_view(["GET"])
@permission_classes([IsManagerOrAdmin])
def orders_report(request):
    """Get orders report."""
    start_date = request.query_params.get("start")
    end_date = request.query_params.get("end")

    return Response(ReportService.get_orders_report(start_date, end_date))


@extend_schema(tags=["Reports"])
@api_view(["GET"])
@permission_classes([IsManagerOrAdmin])
def masters_performance(request):
    """Get masters performance report."""
    start_date = request.query_params.get("start")
    end_date = request.query_params.get("end")

    return Response(ReportService.get_masters_performance(start_date, end_date))


@extend_schema(tags=["Reports"])
@api_view(["GET"])
@permission_classes([IsManagerOrAdmin])
def customers_report(request):
    """Get customers report."""
    return Response(ReportService.get_customers_report())


@extend_schema(tags=["Reports"])
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_performance(request):
    """Get current user's performance."""
    start_date = request.query_params.get("start")
    end_date = request.query_params.get("end")

    return Response(
        ReportService.get_user_performance(request.user.id, start_date, end_date)
    )

from django.urls import path

from apps.reports.views import (
    customers_report,
    dashboard_summary,
    masters_performance,
    my_performance,
    orders_report,
    sales_report,
)

urlpatterns = [
    path("dashboard/", dashboard_summary, name="dashboard-summary"),
    path("sales/", sales_report, name="sales-report"),
    path("orders/", orders_report, name="orders-report"),
    path("masters/", masters_performance, name="masters-performance"),
    path("customers/", customers_report, name="customers-report"),
    path("my-performance/", my_performance, name="my-performance"),
]

"""
API v1 URL Configuration - Atelier Management System
All endpoints under /api/v1/

Endpoints:
- /api/v1/orders/          - Order management
- /api/v1/tasks/           - Worker tasks
- /api/v1/work-orders/     - Production orders
- /api/v1/inventory/         - Fabric inventory
- /api/v1/inventory/usage/   - Fabric usage records
"""
from django.urls import include, path

from api.v1.routers import router


urlpatterns = [
    # Router-generated URLs (orders, tasks, inventory)
    path("", include(router.urls)),
    
    # Auth endpoints
    path("auth/", include("apps.authentication.urls")),
    
    # Additional modules
    path("users/", include("apps.users.urls")),
    path("customers/", include("apps.customers.urls")),
    path("payments/", include("apps.payments.urls")),
    path("reports/", include("apps.reports.urls")),
]

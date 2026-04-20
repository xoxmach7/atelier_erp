from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from apps.common.views import HealthCheckView

# Main URL Patterns
urlpatterns = [
    # Health Check
    path("health/", HealthCheckView.as_view(), name="health-check"),
    
    # Admin
    path("admin/", admin.site.urls),
    
    # API v1 - centralized in api.v1.urls
    path("api/v1/", include("api.v1.urls")),
    
    # API Documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
]

# Media & Static Files (Development only)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Custom Error Handlers
handler400 = "apps.common.views.bad_request_view"
handler403 = "apps.common.views.permission_denied_view"
handler404 = "apps.common.views.not_found_view"
handler500 = "apps.common.views.server_error_view"

from django.http import JsonResponse
from django.views import View
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
    ServiceUnavailableException,
)


class HealthCheckView(APIView):
    """Health check endpoint for monitoring."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response(
            {
                "status": "healthy",
                "service": "brigada-api",
                "version": "2.0.0",
            },
            status=status.HTTP_200_OK,
        )


class BaseAPIView(APIView):
    """Base API view with common functionality."""

    def success_response(self, data=None, message="Success", status_code=status.HTTP_200_OK):
        return Response(
            {"success": True, "message": message, "data": data},
            status=status_code,
        )

    def error_response(
        self, message="Error", code="error", details=None, status_code=status.HTTP_400_BAD_REQUEST
    ):
        return Response(
            {
                "success": False,
                "error": {"code": code, "message": message, "details": details},
            },
            status=status_code,
        )


# Error Handlers
def bad_request_view(request, exception=None):
    return JsonResponse(
        {"success": False, "error": {"code": "bad_request", "message": "Bad request"}},
        status=400,
    )


def permission_denied_view(request, exception=None):
    return JsonResponse(
        {"success": False, "error": {"code": "forbidden", "message": "Permission denied"}},
        status=403,
    )


def not_found_view(request, exception=None):
    return JsonResponse(
        {"success": False, "error": {"code": "not_found", "message": "Resource not found"}},
        status=404,
    )


def server_error_view(request):
    return JsonResponse(
        {"success": False, "error": {"code": "server_error", "message": "Internal server error"}},
        status=500,
    )

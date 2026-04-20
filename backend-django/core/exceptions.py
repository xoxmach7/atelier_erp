from typing import Any, Optional

from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import exception_handler


class ServiceError(Exception):
    """Base exception for service layer errors."""

    def __init__(self, message: str, code: Optional[str] = None) -> None:
        self.message = message
        self.code = code or "service_error"
        super().__init__(message)


class NotFoundError(ServiceError):
    """Resource not found error."""

    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(message, "not_found")


class ValidationError(ServiceError):
    """Validation error in service layer."""

    def __init__(self, message: str, field: Optional[str] = None) -> None:
        self.field = field
        super().__init__(message, "validation_error")


class BadRequestException(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Bad request"
    default_code = "bad_request"


class NotFoundException(APIException):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "Not found"
    default_code = "not_found"


def custom_exception_handler(exc: Exception, context: Any) -> Response:
    """Custom exception handler that wraps all errors in a standard format."""

    response = exception_handler(exc, context)

    if response is not None:
        if isinstance(response.data, dict):
            errors = response.data
        else:
            errors = {"detail": response.data}

        response.data = {
            "success": False,
            "error": {
                "code": getattr(exc, "default_code", "error"),
                "message": errors.get("detail", "An error occurred"),
                "details": errors if "detail" not in errors else None,
            },
            "data": None,
        }

    return response

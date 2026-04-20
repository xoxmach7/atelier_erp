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


class ValidationError(ServiceError):
    """Validation error in service layer."""

    def __init__(self, message: str, field: Optional[str] = None) -> None:
        self.field = field
        super().__init__(message, "validation_error")


class NotFoundError(ServiceError):
    """Resource not found error."""

    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(message, "not_found")


class PermissionError(ServiceError):
    """Permission denied error."""

    def __init__(self, message: str = "Permission denied") -> None:
        super().__init__(message, "permission_denied")


class ConflictError(ServiceError):
    """Resource conflict error."""

    def __init__(self, message: str = "Resource conflict") -> None:
        super().__init__(message, "conflict")


# API Exceptions
class BadRequestException(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Bad request"
    default_code = "bad_request"


class UnauthorizedException(APIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = "Unauthorized"
    default_code = "unauthorized"


class ForbiddenException(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "Forbidden"
    default_code = "forbidden"


class NotFoundException(APIException):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "Not found"
    default_code = "not_found"


class ConflictException(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Conflict"
    default_code = "conflict"


class UnprocessableEntityException(APIException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_detail = "Unprocessable entity"
    default_code = "unprocessable_entity"


class TooManyRequestsException(APIException):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_detail = "Too many requests"
    default_code = "too_many_requests"


class ServiceUnavailableException(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "Service unavailable"
    default_code = "service_unavailable"


def custom_exception_handler(exc: Exception, context: Any) -> Response:
    """Custom exception handler that wraps all errors in a standard format."""

    response = exception_handler(exc, context)

    if response is not None:
        # Format the response
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

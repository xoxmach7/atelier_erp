"""
Service Layer Exceptions
Business logic errors raised by services
"""


class ServiceError(Exception):
    """Base exception for service layer"""
    pass


# ============================================
# ORDER ERRORS
# ============================================

class OrderServiceError(ServiceError):
    """Order operation failed"""
    pass


class InvalidOrderStatusTransition(OrderServiceError):
    """FSM transition not allowed"""
    
    def __init__(self, current_status: str, requested_status: str, allowed: list = None):
        self.current_status = current_status
        self.requested_status = requested_status
        self.allowed = allowed or []
        
        allowed_str = ', '.join(self.allowed) if self.allowed else 'none'
        super().__init__(
            f"Cannot transition order from '{current_status}' to '{requested_status}'. "
            f"Allowed transitions: {allowed_str}"
        )


class OrderNotFoundError(OrderServiceError):
    """Order does not exist"""
    pass


class OrderValidationError(OrderServiceError):
    """Order data validation failed"""

    def __init__(self, message: str = "", code: str = "validation_error"):
        self.code = code
        super().__init__(message)


class OrderCannotBeModified(OrderServiceError):
    """Order is in state that prevents modification"""
    pass


class OrderCancellationError(OrderServiceError):
    """Cannot cancel order"""
    pass


class OrderNotPaidError(OrderServiceError):
    """Payment required for operation"""
    pass


# ============================================
# INVENTORY ERRORS
# ============================================

class InventoryServiceError(ServiceError):
    """Inventory operation failed"""
    pass


class InsufficientStockError(InventoryServiceError):
    """Not enough inventory to fulfill request"""
    
    def __init__(self, item_name: str, requested: float, available: float):
        self.item_name = item_name
        self.requested = requested
        self.available = available
        super().__init__(
            f"Insufficient stock for '{item_name}': "
            f"requested {requested}, available {available}"
        )


class FabricNotFoundError(InventoryServiceError):
    """Fabric does not exist"""
    pass


class CorniceNotFoundError(InventoryServiceError):
    """Cornice does not exist"""
    pass


class ReservationNotFoundError(InventoryServiceError):
    """Reservation does not exist or already processed"""
    pass


class ReservationExpiredError(InventoryServiceError):
    """Reservation has expired"""
    pass


class CannotConvertReservationError(InventoryServiceError):
    """Cannot convert reservation to deduction"""
    pass


# ============================================
# PAYMENT ERRORS
# ============================================

class PaymentServiceError(ServiceError):
    """Payment operation failed"""
    pass


class InvalidPaymentAmount(PaymentServiceError):
    """Payment amount validation failed"""
    pass


class DuplicatePaymentError(PaymentServiceError):
    """Payment with same idempotency key already exists"""
    pass


class PaymentNotFoundError(PaymentServiceError):
    """Payment does not exist"""
    pass


# ============================================
# TASK ERRORS
# ============================================

class TaskServiceError(ServiceError):
    """Task operation failed"""
    pass


class TaskNotFoundError(TaskServiceError):
    """Task does not exist"""
    pass


class TaskAlreadyConvertedError(TaskServiceError):
    """Task already converted to order"""
    pass


class InvalidTaskStatusTransition(TaskServiceError):
    """Task FSM transition not allowed"""
    pass


# ============================================
# PRODUCTION ERRORS
# ============================================

class ProductionServiceError(ServiceError):
    """Production operation failed"""
    pass


class SeamstressNotFoundError(ProductionServiceError):
    """Seamstress user does not exist or wrong role"""
    pass


class AssignmentNotFoundError(ProductionServiceError):
    """Production assignment does not exist"""
    pass


class InvalidProductionStatusTransition(ProductionServiceError):
    """Production workflow status transition not allowed"""
    pass


# ============================================
# QUOTE ERRORS
# ============================================

class QuoteServiceError(ServiceError):
    """Quote operation failed"""
    pass


class QuoteNotFoundError(QuoteServiceError):
    """Quote does not exist"""
    pass


class QuoteNotApprovedError(QuoteServiceError):
    """Quote not approved by customer"""
    pass


class QuoteExpiredError(QuoteServiceError):
    """Quote has expired"""
    pass


class QuoteValidationError(QuoteServiceError):
    """Quote data validation failed"""

    def __init__(self, message: str = "", code: str = "validation_error"):
        self.code = code
        super().__init__(message)

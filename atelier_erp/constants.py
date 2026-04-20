"""
Atelier ERP - Business Constants and Configuration
Centralized location for business rules and FSM configuration
"""

from decimal import Decimal


# ============================================
# FINANCIAL CONSTANTS
# ============================================

class FinancialConfig:
    """Financial and pricing constants"""
    
    # Default prepayment percentage
    DEFAULT_PREPAYMENT_PERCENT = Decimal('0.5')  # 50%
    
    # Minimum prepayment to start production
    MIN_PREPAYMENT_PERCENT = Decimal('0.5')  # 50%
    
    # Currency
    DEFAULT_CURRENCY = 'KZT'
    
    # Rounding precision for money
    MONEY_DECIMAL_PLACES = 2
    
    # Tax settings (if applicable)
    TAX_RATE = Decimal('0.0')  # No tax for now


# ============================================
# RESERVATION CONSTANTS
# ============================================

class ReservationConfig:
    """Fabric reservation settings"""
    
    # Default reservation TTL in days
    DEFAULT_EXPIRY_DAYS = 3
    
    # Maximum extension days
    MAX_EXTENSION_DAYS = 7
    
    # Grace period after expiration before auto-cancellation
    GRACE_PERIOD_HOURS = 24


# ============================================
# SEWING COMPLEXITY RATES (per meter)
# ============================================

class SewingRates:
    """Rates for sewing complexity levels"""
    
    SIMPLE = Decimal('2000')      # Basic curtains
    MEDIUM = Decimal('3500')      # With tiebacks, fringe
    COMPLEX = Decimal('5500')     # Lambrequins, festoons
    PREMIUM = Decimal('8000')     # Hand embroidery, lace
    
    @classmethod
    def get_rate(cls, complexity: str) -> Decimal:
        rates = {
            'simple': cls.SIMPLE,
            'medium': cls.MEDIUM,
            'complex': cls.COMPLEX,
            'premium': cls.PREMIUM,
        }
        return rates.get(complexity.lower(), cls.MEDIUM)


# ============================================
# GATHERING RATIOS
# ============================================

class GatheringRatios:
    """Fabric gathering coefficients for different curtain types"""
    
    TULLE = Decimal('2.0')        # Sheer curtains
    CURTAIN = Decimal('2.2')      # Regular curtains
    BLACKOUT = Decimal('2.0')     # Blackout curtains
    LAMBREQUIN = Decimal('2.5')   # Lambrequins
    
    @classmethod
    def get_ratio(cls, sewing_type: str) -> Decimal:
        ratios = {
            'тюль': cls.TULLE,
            'tulle': cls.TULLE,
            'шторы': cls.CURTAIN,
            'curtain': cls.CURTAIN,
            'blackout': cls.BLACKOUT,
            'блэкаут': cls.BLACKOUT,
            'ламбрекен': cls.LAMBREQUIN,
            'lambrequin': cls.LAMBREQUIN,
        }
        return ratios.get(sewing_type.lower(), cls.CURTAIN)


# ============================================
# MEASUREMENT CONSTANTS
# ============================================

class MeasurementConfig:
    """Measurement calculation constants"""
    
    # Hem allowances (cm)
    TOP_HEM_CM = 10
    BOTTOM_HEM_CM = 15
    TOTAL_HEM_CM = 25
    
    # Fold allowance per fold (%)
    FOLD_ALLOWANCE_PERCENT = Decimal('0.02')  # 2% per fold
    
    # Minimum and maximum dimensions
    MIN_WIDTH_CM = 10
    MAX_WIDTH_CM = 1000
    MIN_HEIGHT_CM = 10
    MAX_HEIGHT_CM = 500
    
    # Fabric width standards
    STANDARD_FABRIC_WIDTH_CM = 280


# ============================================
# INSTALLATION & DELIVERY RATES (by city)
# ============================================

class CityRates:
    """Service rates by city"""
    
    RATES = {
        'Алматы': {'installation': Decimal('15000'), 'delivery': Decimal('5000')},
        'Almaty': {'installation': Decimal('15000'), 'delivery': Decimal('5000')},
        'Астана': {'installation': Decimal('18000'), 'delivery': Decimal('6000')},
        'Astana': {'installation': Decimal('18000'), 'delivery': Decimal('6000')},
        'Шымкент': {'installation': Decimal('14000'), 'delivery': Decimal('4500')},
        'Shymkent': {'installation': Decimal('14000'), 'delivery': Decimal('4500')},
    }
    
    DEFAULT_CITY = 'Алматы'
    
    @classmethod
    def get_rates(cls, city: str) -> dict:
        return cls.RATES.get(city, cls.RATES[cls.DEFAULT_CITY])


# ============================================
# FSM TRANSITION RULES
# ============================================

class OrderFSMRules:
    """
    Order Finite State Machine transition rules
    Format: {current_state: [allowed_next_states]}
    """
    
    TRANSITIONS = {
        'draft': ['measurement', 'cancelled'],
        'measurement': ['design', 'cancelled'],
        'design': ['quoted', 'cancelled'],
        'quoted': ['approved', 'cancelled'],
        'approved': ['prepayment_received', 'cancelled'],
        'prepayment_received': ['fabric_reserved', 'cancelled'],
        'fabric_reserved': ['production', 'cancelled'],
        'production': ['ready', 'cancelled'],
        'ready': ['installation', 'cancelled'],
        'installation': ['completed', 'cancelled'],
        'completed': [],  # Terminal state
        'cancelled': [],  # Terminal state
    }
    
    @classmethod
    def can_transition(cls, from_state: str, to_state: str) -> bool:
        """Check if state transition is valid"""
        if from_state == to_state:
            return True
        allowed = cls.TRANSITIONS.get(from_state, [])
        return to_state in allowed
    
    @classmethod
    def get_allowed_transitions(cls, current_state: str) -> list:
        """Get list of allowed next states"""
        return cls.TRANSITIONS.get(current_state, [])


class TaskFSMRules:
    """Task FSM transition rules"""
    
    TRANSITIONS = {
        'lead': ['measurement_scheduled', 'lost', 'postponed', 'converted'],
        'measurement_scheduled': ['measurement_done', 'lost', 'postponed'],
        'measurement_done': ['quoting', 'lost', 'postponed'],
        'quoting': ['quote_sent', 'lost'],
        'quote_sent': ['converted', 'lost', 'quoting'],
        'converted': [],  # Terminal
        'lost': ['lead'],  # Can reactivate
        'postponed': ['lead'],  # Can reactivate
    }
    
    @classmethod
    def can_transition(cls, from_state: str, to_state: str) -> bool:
        if from_state == to_state:
            return True
        allowed = cls.TRANSITIONS.get(from_state, [])
        return to_state in allowed


# ============================================
# PRODUCTION CONFIG
# ============================================

class ProductionConfig:
    """Production workflow settings"""
    
    # Status sequence for production
    STATUS_SEQUENCE = [
        'assigned',
        'materials_prepared',
        'cutting',
        'sewing',
        'quality_check',
        'ready',
    ]
    
    # Complexity multipliers for payment calculation
    COMPLEXITY_MULTIPLIERS = {
        'low': Decimal('1.0'),
        'medium': Decimal('1.2'),
        'high': Decimal('1.5'),
    }
    
    # Base payment rates per complexity
    BASE_RATES = {
        'low': Decimal('5000'),
        'medium': Decimal('8000'),
        'high': Decimal('12000'),
    }


# ============================================
# ACCESSORIES DEFAULTS
# ============================================

class AccessoriesConfig:
    """Default accessories costs"""
    
    # Standard accessories (hooks, rings, tiebacks)
    DEFAULT_SET_COST = Decimal('2500')
    
    # Premium accessories multiplier
    PREMIUM_MULTIPLIER = Decimal('1.5')


# ============================================
# PAGINATION & PERFORMANCE
# ============================================

class PaginationConfig:
    """Pagination settings for large datasets"""
    
    # Admin list per page
    ADMIN_LIST_PER_PAGE = 50
    
    # API list per page
    API_LIST_PER_PAGE = 100
    
    # Max limit for API
    API_MAX_LIMIT = 1000


# ============================================
# VALIDATION PATTERNS
# ============================================

class ValidationPatterns:
    """Regex patterns for validation"""
    
    # Order number: О-YYYY-NNN
    ORDER_NUMBER = r'^О-\d{4}-\d{3}$'
    
    # Task number: З-YYYY-NNN
    TASK_NUMBER = r'^З-\d{4}-\d{3}$'
    
    # Quote number: КП-YYYY-NNN
    QUOTE_NUMBER = r'^КП-\d{4}-\d{3}$'
    
    # SKU: Alphanumeric uppercase
    SKU = r'^[A-Z0-9-]{3,50}$'
    
    # Hanger number: Alphanumeric
    HANGER_NUMBER = r'^[A-Z0-9-]{1,50}$'
    
    # Phone: Basic international format
    PHONE = r'^\+?[\d\s-]{10,20}$'


# ============================================
# CACHE KEYS
# ============================================

class CacheKeys:
    """Redis/cache key patterns"""
    
    PREFIX = 'atelier:'
    
    # Order locks
    ORDER_NUMBER_LOCK = f'{PREFIX}lock:order_number:{{year}}'
    TASK_NUMBER_LOCK = f'{PREFIX}lock:task_number:{{year}}'
    
    # Inventory locks
    FABRIC_RESERVATION_LOCK = f'{PREFIX}lock:fabric:{{fabric_id}}'
    
    # Data caching
    CUSTOMER_ORDERS = f'{PREFIX}customer:{{customer_id}}:orders'
    FABRIC_AVAILABILITY = f'{PREFIX}fabric:{{fabric_id}}:availability'
    
    # TTL settings
    LOCK_TTL_SECONDS = 10
    DATA_CACHE_TTL_MINUTES = 5

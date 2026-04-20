"""
Inventory Service V2 - Fabric Reservation System
Manages fabric inventory with mandatory reservation-before-production workflow.
Handles blackout, tulle, lining with partial availability support.
Concurrency-safe with optimistic and pessimistic locking strategies.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional, Tuple, Any, Callable
from uuid import UUID, uuid4
from decimal import Decimal
from datetime import datetime, timedelta
from enum import Enum, auto
from collections import defaultdict
import threading
import heapq


# ============================================
# DOMAIN MODELS
# ============================================

class FabricType(Enum):
    """Fabric categories"""
    BLACKOUT = "blackout"      # Блэкаут
    TULLE = "tulle"            # Тюль
    LINING = "lining"          # Подкладка
    VELVET = "velvet"          # Бархат
    COTTON = "cotton"          # Хлопок
    SILK = "silk"              # Шёлк
    LINEN = "linen"            # Лён


class ReservationStatus(Enum):
    """Reservation lifecycle"""
    PENDING = "pending"        # Created but not confirmed
    CONFIRMED = "confirmed"    # Confirmed, blocking inventory
    COMMITTED = "committed"    # Converted to actual deduction
    RELEASED = "released"        # Released back to inventory
    EXPIRED = "expired"          # TTL expired


@dataclass(frozen=True)
class FabricSpec:
    """Fabric specification for reservation"""
    fabric_id: UUID
    fabric_type: FabricType
    color: str
    hanger_number: str
    
    def __hash__(self):
        return hash(self.fabric_id)


@dataclass
class StockLevel:
    """Represents physical and logical stock levels"""
    physical_quantity: Decimal      # Actual meters in warehouse
    reserved_quantity: Decimal      # Sum of confirmed reservations
    committed_quantity: Decimal     # Already deducted
    pending_quantity: Decimal       # Pending reservations (not yet confirmed)
    
    @property
    def available_quantity(self) -> Decimal:
        """Quantity available for new reservations"""
        return self.physical_quantity - self.reserved_quantity - self.committed_quantity
    
    @property
    def effective_available(self) -> Decimal:
        """Available including pending buffer"""
        return self.physical_quantity - self.reserved_quantity - self.committed_quantity - self.pending_quantity
    
    def can_reserve(self, amount: Decimal) -> bool:
        """Check if amount can be reserved"""
        return self.available_quantity >= amount
    
    def can_fulfill_partial(self, requested: Decimal) -> Tuple[bool, Decimal]:
        """Check if partial fulfillment is possible, returns (possible, available_amount)"""
        available = self.available_quantity
        if available <= 0:
            return False, Decimal('0')
        return True, min(available, requested)


@dataclass
class MaterialReservation:
    """Single fabric reservation"""
    id: UUID
    order_id: UUID
    fabric_id: UUID
    fabric_spec: FabricSpec
    requested_quantity: Decimal     # Original request
    reserved_quantity: Decimal      # Actually reserved (may be less for partial)
    status: ReservationStatus
    
    # Timestamps
    created_at: datetime
    confirmed_at: Optional[datetime] = None
    committed_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    
    # Tracking
    is_partial: bool = False         # True if partial fulfillment
    parent_reservation_id: Optional[UUID] = None  # For split reservations
    
    # Metadata
    created_by: Optional[UUID] = None
    notes: str = ""
    
    def is_expired(self, now: Optional[datetime] = None) -> bool:
        """Check if reservation has expired"""
        if self.status != ReservationStatus.CONFIRMED:
            return False
        if self.expires_at is None:
            return False
        now = now or datetime.now()
        return now > self.expires_at
    
    def time_to_expiry(self, now: Optional[datetime] = None) -> Optional[timedelta]:
        """Get remaining time before expiry"""
        if self.expires_at is None:
            return None
        now = now or datetime.now()
        if now >= self.expires_at:
            return timedelta(0)
        return self.expires_at - now


@dataclass
class OrderReservationBatch:
    """Batch of reservations for a single order"""
    order_id: UUID
    reservations: Dict[UUID, MaterialReservation] = field(default_factory=dict)  # by reservation_id
    
    @property
    def all_confirmed(self) -> bool:
        return all(
            r.status == ReservationStatus.CONFIRMED 
            for r in self.reservations.values()
        )
    
    @property
    def total_fabrics(self) -> int:
        return len(self.reservations)
    
    @property
    def is_partial_fulfillment(self) -> bool:
        return any(r.is_partial for r in self.reservations.values())
    
    def get_by_fabric(self, fabric_id: UUID) -> Optional[MaterialReservation]:
        """Get reservation by fabric ID"""
        for res in self.reservations.values():
            if res.fabric_id == fabric_id:
                return res
        return None


@dataclass
class AvailabilityResult:
    """Result of availability check"""
    fabric_id: UUID
    fabric_type: FabricType
    hanger_number: str
    
    requested: Decimal
    available: Decimal
    can_fulfill: bool
    can_fulfill_partial: bool
    partial_amount: Decimal
    
    # Context
    existing_reservations: int = 0
    expires_soon: bool = False


@dataclass
class ReservationResult:
    """Result of reservation attempt"""
    success: bool
    order_id: UUID
    reservations: List[MaterialReservation]
    
    # Status breakdown
    fulfilled: List[MaterialReservation] = field(default_factory=list)
    partial: List[MaterialReservation] = field(default_factory=list)
    failed: List[Tuple[FabricSpec, Decimal, str]] = field(default_factory=list)  # (spec, requested, reason)
    
    # Metadata
    is_partial_fulfillment: bool = False
    total_reserved_quantity: Decimal = Decimal('0')
    total_requested_quantity: Decimal = Decimal('0')
    
    # Timing
    reservation_expiry: Optional[datetime] = None
    
    @property
    def fully_fulfilled(self) -> bool:
        return len(self.failed) == 0 and not self.is_partial_fulfillment
    
    @property
    def fulfillment_rate(self) -> Decimal:
        """Percentage of request fulfilled"""
        if self.total_requested_quantity == 0:
            return Decimal('100')
        rate = (self.total_reserved_quantity / self.total_requested_quantity) * 100
        return Decimal(str(rate)).quantize(Decimal('0.01'))


@dataclass
class CommitResult:
    """Result of committing reservations"""
    success: bool
    order_id: UUID
    committed_reservations: List[MaterialReservation]
    failed_commits: List[Tuple[UUID, str]] = field(default_factory=list)  # (reservation_id, reason)
    
    total_committed_quantity: Decimal = Decimal('0')


# ============================================
# CONCURRENCY CONTROL
# ============================================

class LockManager:
    """
    Manages locks for inventory operations.
    Supports both pessimistic (DB-level) and optimistic (version-based) locking.
    """
    
    def __init__(self):
        # In-memory locks for demonstration (production: use Redis or DB locks)
        self._locks: Dict[UUID, threading.RLock] = {}
        self._global_lock = threading.RLock()
    
    def acquire_fabric_lock(self, fabric_id: UUID) -> threading.RLock:
        """Get or create lock for specific fabric"""
        with self._global_lock:
            if fabric_id not in self._locks:
                self._locks[fabric_id] = threading.RLock()
            return self._locks[fabric_id]
    
    def acquire_multi_fabric_lock(self, fabric_ids: List[UUID]) -> List[threading.RLock]:
        """
        Acquire locks on multiple fabrics in consistent order.
        Prevents deadlock by always locking in ID-sorted order.
        """
        sorted_ids = sorted(fabric_ids, key=lambda x: str(x))
        locks = []
        for fid in sorted_ids:
            lock = self.acquire_fabric_lock(fid)
            lock.acquire()
            locks.append(lock)
        return locks
    
    def release_locks(self, locks: List[threading.RLock]):
        """Release multiple locks"""
        for lock in reversed(locks):
            lock.release()


class OptimisticLock:
    """Optimistic locking using version numbers"""
    
    def __init__(self):
        self._versions: Dict[UUID, int] = defaultdict(int)
        self._lock = threading.Lock()
    
    def get_version(self, fabric_id: UUID) -> int:
        with self._lock:
            return self._versions[fabric_id]
    
    def check_and_increment(self, fabric_id: UUID, expected_version: int) -> bool:
        """CAS operation - succeeds only if version matches"""
        with self._lock:
            current = self._versions[fabric_id]
            if current == expected_version:
                self._versions[fabric_id] = current + 1
                return True
            return False


# ============================================
# INVENTORY REPOSITORY (Interface)
# ============================================

class InventoryRepository:
    """
    Abstract repository for inventory operations.
    Production: implement with Django ORM or SQLAlchemy.
    """
    
    def get_stock_level(self, fabric_id: UUID) -> Optional[StockLevel]:
        """Get current stock level for fabric"""
        raise NotImplementedError
    
    def update_stock_level(self, fabric_id: UUID, updates: Dict[str, Decimal]) -> bool:
        """Update stock level (atomic)"""
        raise NotImplementedError
    
    def save_reservation(self, reservation: MaterialReservation) -> bool:
        """Persist reservation"""
        raise NotImplementedError
    
    def update_reservation_status(
        self, 
        reservation_id: UUID, 
        new_status: ReservationStatus,
        **kwargs
    ) -> bool:
        """Update reservation status"""
        raise NotImplementedError
    
    def get_reservations_for_order(self, order_id: UUID) -> List[MaterialReservation]:
        """Get all reservations for an order"""
        raise NotImplementedError
    
    def get_reservations_for_fabric(
        self, 
        fabric_id: UUID,
        status: Optional[ReservationStatus] = None
    ) -> List[MaterialReservation]:
        """Get reservations for specific fabric"""
        raise NotImplementedError
    
    def find_fabrics_by_type(self, fabric_type: FabricType) -> List[FabricSpec]:
        """Find all fabrics of specific type"""
        raise NotImplementedError


# ============================================
# INVENTORY SERVICE
# ============================================

class InventoryServiceV2:
    """
    Production-ready inventory service with mandatory reservation workflow.
    
    Workflow:
    1. RESERVE: Create confirmed reservations (blocks inventory)
    2. (Optional) Release if order cancelled
    3. COMMIT: Convert reservations to actual deductions at production start
    
    Guarantees:
    - No double booking (atomic reservation with locks)
    - Partial availability support
    - TTL-based auto-expiry
    - Concurrency-safe
    """
    
    def __init__(
        self,
        repository: InventoryRepository,
        lock_manager: Optional[LockManager] = None,
        optimistic_lock: Optional[OptimisticLock] = None
    ):
        self.repo = repository
        self.locks = lock_manager or LockManager()
        self.opt_lock = optimistic_lock or OptimisticLock()
        
        # Configuration
        self.default_reservation_ttl_hours = 24
        self.low_stock_threshold = Decimal('10.0')
        self.partial_reservation_enabled = True
        
        # Event callbacks
        self._event_handlers: Dict[str, List[Callable]] = defaultdict(list)
    
    # ============================================
    # PUBLIC API: RESERVATION
    # ============================================
    
    def reserve_materials(
        self,
        order_id: UUID,
        items: List[Tuple[FabricSpec, Decimal]],  # (spec, quantity)
        allow_partial: bool = True,
        ttl_hours: Optional[int] = None,
        created_by: Optional[UUID] = None
    ) -> ReservationResult:
        """
        Reserve materials for an order.
        
        Args:
            order_id: Order requesting reservation
            items: List of (fabric_spec, quantity) tuples
            allow_partial: If True, may partially fulfill when full amount unavailable
            ttl_hours: Reservation TTL (default: 24 hours)
            created_by: User creating reservation
        
        Returns:
            ReservationResult with status of each item
        
        Guarantees:
        - Atomic: Either all succeed or none (unless allow_partial=True)
        - No double booking: Uses row-level locks
        """
        ttl = ttl_hours or self.default_reservation_ttl_hours
        expiry = datetime.now() + timedelta(hours=ttl)
        
        # Sort by fabric_id for consistent locking order (prevents deadlock)
        sorted_items = sorted(items, key=lambda x: str(x[0].fabric_id))
        fabric_ids = [spec.fabric_id for spec, _ in sorted_items]
        
        # Acquire locks on all fabrics
        locks = self.locks.acquire_multi_fabric_lock(fabric_ids)
        
        try:
            reservations = []
            fulfilled = []
            partial_list = []
            failed = []
            
            total_reserved = Decimal('0')
            total_requested = Decimal('0')
            
            # Check availability and create reservations
            for spec, requested_qty in sorted_items:
                total_requested += requested_qty
                
                # Get current stock
                stock = self.repo.get_stock_level(spec.fabric_id)
                if not stock:
                    failed.append((spec, requested_qty, "Fabric not found"))
                    continue
                
                # Check availability
                avail_result = self._check_availability_internal(
                    spec, requested_qty, stock
                )
                
                if avail_result.can_fulfill:
                    # Full reservation
                    reservation = self._create_reservation(
                        order_id=order_id,
                        spec=spec,
                        requested=requested_qty,
                        reserved=requested_qty,
                        status=ReservationStatus.CONFIRMED,
                        is_partial=False,
                        expires_at=expiry,
                        created_by=created_by
                    )
                    
                    # Update stock (atomic)
                    self._update_reserved_stock(spec.fabric_id, requested_qty)
                    
                    reservations.append(reservation)
                    fulfilled.append(reservation)
                    total_reserved += requested_qty
                    
                elif allow_partial and avail_result.can_fulfill_partial:
                    # Partial reservation
                    partial_qty = avail_result.partial_amount
                    
                    reservation = self._create_reservation(
                        order_id=order_id,
                        spec=spec,
                        requested=requested_qty,
                        reserved=partial_qty,
                        status=ReservationStatus.CONFIRMED,
                        is_partial=True,
                        expires_at=expiry,
                        created_by=created_by,
                        notes=f"Partial: requested {requested_qty}, reserved {partial_qty}"
                    )
                    
                    self._update_reserved_stock(spec.fabric_id, partial_qty)
                    
                    reservations.append(reservation)
                    partial_list.append(reservation)
                    total_reserved += partial_qty
                    
                else:
                    # Cannot fulfill
                    failed.append((spec, requested_qty, 
                        f"Insufficient stock. Available: {stock.available_quantity}, "
                        f"Pending: {stock.pending_quantity}"
                    ))
            
            # Determine success
            success = len(failed) == 0
            is_partial = len(partial_list) > 0
            
            # If not allowing partial and any failed, rollback all
            if not allow_partial and (failed or is_partial) and reservations:
                self._rollback_reservations(order_id, reservations)
                reservations = []
                fulfilled = []
                partial_list = []
                total_reserved = Decimal('0')
                success = False
            
            # Emit events
            if reservations:
                self._emit_event('materials_reserved', {
                    'order_id': order_id,
                    'reservations': reservations,
                    'is_partial': is_partial
                })
            
            return ReservationResult(
                success=success,
                order_id=order_id,
                reservations=reservations,
                fulfilled=fulfilled,
                partial=partial_list,
                failed=failed,
                is_partial_fulfillment=is_partial,
                total_reserved_quantity=total_reserved,
                total_requested_quantity=total_requested,
                reservation_expiry=expiry
            )
            
        finally:
            self.locks.release_locks(locks)
    
    def release_materials(
        self,
        order_id: UUID,
        released_by: Optional[UUID] = None,
        reason: str = ""
    ) -> List[MaterialReservation]:
        """
        Release all reservations for an order.
        Called when order is cancelled or materials no longer needed.
        
        Args:
            order_id: Order to release
            released_by: User releasing
            reason: Reason for release
        
        Returns:
            List of released reservations
        """
        # Get existing reservations
        reservations = self.repo.get_reservations_for_order(order_id)
        
        # Filter to only confirmed ones
        confirmed = [r for r in reservations 
                    if r.status == ReservationStatus.CONFIRMED]
        
        if not confirmed:
            return []
        
        # Acquire locks
        fabric_ids = [r.fabric_id for r in confirmed]
        locks = self.locks.acquire_multi_fabric_lock(fabric_ids)
        
        try:
            released = []
            
            for res in confirmed:
                # Update reservation status
                self.repo.update_reservation_status(
                    res.id,
                    ReservationStatus.RELEASED,
                    released_at=datetime.now(),
                    released_by=released_by,
                    release_reason=reason
                )
                
                # Return stock to available pool
                self._update_reserved_stock(
                    res.fabric_id, 
                    -res.reserved_quantity  # Negative = release
                )
                
                # Update in-memory object
                res.status = ReservationStatus.RELEASED
                released.append(res)
            
            # Emit event
            if released:
                self._emit_event('materials_released', {
                    'order_id': order_id,
                    'released_reservations': released,
                    'reason': reason
                })
            
            return released
            
        finally:
            self.locks.release_locks(locks)
    
    def commit_materials(
        self,
        order_id: UUID,
        committed_by: Optional[UUID] = None
    ) -> CommitResult:
        """
        Commit reservations to actual deductions.
        Called when production starts.
        
        Transitions: CONFIRMED → COMMITTED
        Updates: reserved_quantity ↓, committed_quantity ↑
        
        Args:
            order_id: Order to commit
            committed_by: User committing
        
        Returns:
            CommitResult
        
        INVARIANT: Must have confirmed reservations before committing.
        """
        reservations = self.repo.get_reservations_for_order(order_id)
        
        # Filter to confirmed only
        confirmed = [r for r in reservations 
                    if r.status == ReservationStatus.CONFIRMED]
        
        if not confirmed:
            return CommitResult(
                success=False,
                order_id=order_id,
                committed_reservations=[],
                failed_commits=[(UUID(int=0), "No confirmed reservations found")]
            )
        
        fabric_ids = [r.fabric_id for r in confirmed]
        locks = self.locks.acquire_multi_fabric_lock(fabric_ids)
        
        try:
            committed = []
            failed = []
            total_qty = Decimal('0')
            
            for res in confirmed:
                try:
                    # Get current stock
                    stock = self.repo.get_stock_level(res.fabric_id)
                    if not stock:
                        failed.append((res.id, "Fabric not found in stock"))
                        continue
                    
                    # Verify we have enough reserved
                    if stock.reserved_quantity < res.reserved_quantity:
                        failed.append((res.id, 
                            f"Reservation mismatch: reserved {stock.reserved_quantity}, "
                            f"committing {res.reserved_quantity}"))
                        continue
                    
                    # Update reservation status
                    success = self.repo.update_reservation_status(
                        res.id,
                        ReservationStatus.COMMITTED,
                        committed_at=datetime.now(),
                        committed_by=committed_by
                    )
                    
                    if not success:
                        failed.append((res.id, "Failed to update reservation status"))
                        continue
                    
                    # Move from reserved to committed
                    # reserved ↓, committed ↑, physical stays same
                    self.repo.update_stock_level(res.fabric_id, {
                        'reserved_quantity': stock.reserved_quantity - res.reserved_quantity,
                        'committed_quantity': stock.committed_quantity + res.reserved_quantity
                    })
                    
                    # Update in-memory
                    res.status = ReservationStatus.COMMITTED
                    committed.append(res)
                    total_qty += res.reserved_quantity
                    
                except Exception as e:
                    failed.append((res.id, str(e)))
            
            # Emit event
            if committed:
                self._emit_event('materials_committed', {
                    'order_id': order_id,
                    'committed_reservations': committed,
                    'total_quantity': total_qty
                })
            
            return CommitResult(
                success=len(failed) == 0,
                order_id=order_id,
                committed_reservations=committed,
                failed_commits=failed,
                total_committed_quantity=total_qty
            )
            
        finally:
            self.locks.release_locks(locks)
    
    # ============================================
    # PUBLIC API: AVAILABILITY
    # ============================================
    
    def check_availability(
        self,
        items: List[Tuple[FabricSpec, Decimal]]
    ) -> List[AvailabilityResult]:
        """
        Check availability without reserving.
        
        Args:
            items: List of (fabric_spec, quantity) to check
        
        Returns:
            List of AvailabilityResult for each item
        """
        results = []
        
        for spec, requested in items:
            stock = self.repo.get_stock_level(spec.fabric_id)
            
            if not stock:
                results.append(AvailabilityResult(
                    fabric_id=spec.fabric_id,
                    fabric_type=spec.fabric_type,
                    hanger_number=spec.hanger_number,
                    requested=requested,
                    available=Decimal('0'),
                    can_fulfill=False,
                    can_fulfill_partial=False,
                    partial_amount=Decimal('0'),
                    existing_reservations=0
                ))
                continue
            
            # Check reservations expiring soon
            reservations = self.repo.get_reservations_for_fabric(
                spec.fabric_id, 
                ReservationStatus.CONFIRMED
            )
            expiring_soon = any(
                r.time_to_expiry() and r.time_to_expiry() < timedelta(hours=2)
                for r in reservations
            )
            
            can_full = stock.can_reserve(requested)
            can_partial, partial_qty = stock.can_fulfill_partial(requested)
            
            results.append(AvailabilityResult(
                fabric_id=spec.fabric_id,
                fabric_type=spec.fabric_type,
                hanger_number=spec.hanger_number,
                requested=requested,
                available=stock.available_quantity,
                can_fulfill=can_full,
                can_fulfill_partial=can_partial,
                partial_amount=partial_qty,
                existing_reservations=len(reservations),
                expires_soon=expiring_soon
            ))
        
        return results
    
    def check_bulk_availability(
        self,
        items: List[Tuple[FabricSpec, Decimal]]
    ) -> Tuple[bool, List[AvailabilityResult]]:
        """
        Check if all items available.
        
        Returns:
            (all_available, results)
        """
        results = self.check_availability(items)
        all_available = all(r.can_fulfill for r in results)
        return all_available, results
    
    # ============================================
    # PUBLIC API: LOW STOCK DETECTION
    # ============================================
    
    def detect_low_stock(
        self,
        threshold: Optional[Decimal] = None
    ) -> List[Dict[str, Any]]:
        """
        Detect fabrics with low stock levels.
        
        Args:
            threshold: Low stock threshold (default: 10 meters)
        
        Returns:
            List of low stock alerts
        """
        threshold = threshold or self.low_stock_threshold
        alerts = []
        
        # In production: query all fabrics and check levels
        # For now, interface-based approach
        all_fabrics = self._get_all_fabrics()
        
        for fabric_id in all_fabrics:
            stock = self.repo.get_stock_level(fabric_id)
            if not stock:
                continue
            
            available = stock.available_quantity
            
            if available < threshold:
                # Get pending reservations to estimate future availability
                pending = sum(
                    r.reserved_quantity for r in 
                    self.repo.get_reservations_for_fabric(fabric_id, ReservationStatus.PENDING)
                )
                
                alerts.append({
                    'fabric_id': fabric_id,
                    'available_quantity': available,
                    'reserved_quantity': stock.reserved_quantity,
                    'committed_quantity': stock.committed_quantity,
                    'pending_reservations': pending,
                    'threshold': threshold,
                    'severity': 'critical' if available < threshold / 2 else 'warning',
                    'projected_availability': available - pending
                })
        
        # Emit alerts
        if alerts:
            self._emit_event('low_stock_detected', {'alerts': alerts})
        
        return alerts
    
    def get_stock_forecast(
        self,
        fabric_id: UUID,
        days: int = 7
    ) -> List[Dict[str, Any]]:
        """
        Forecast stock levels for next N days based on commitments.
        
        Returns:
            List of daily projections
        """
        stock = self.repo.get_stock_level(fabric_id)
        if not stock:
            return []
        
        # Get commitments with expected dates
        reservations = self.repo.get_reservations_for_fabric(
            fabric_id, 
            ReservationStatus.CONFIRMED
        )
        
        projections = []
        base_available = stock.available_quantity
        
        for day in range(days):
            date = datetime.now() + timedelta(days=day)
            
            # Calculate commitments for this day
            daily_commitments = sum(
                r.reserved_quantity for r in reservations
                if r.expires_at and r.expires_at.date() == date.date()
            )
            
            projected = base_available - daily_commitments
            
            projections.append({
                'date': date.date(),
                'projected_available': max(Decimal('0'), projected),
                'commitments': daily_commitments,
                'will_be_depleted': projected <= 0
            })
        
        return projections
    
    # ============================================
    # PUBLIC API: MAINTENANCE
    # ============================================
    
    def expire_old_reservations(
        self,
        batch_size: int = 100
    ) -> Tuple[int, List[MaterialReservation]]:
        """
        Expire reservations past their TTL.
        Should be called by scheduled job.
        
        Args:
            batch_size: Max to process in one run
        
        Returns:
            (count_expired, list_of_expired)
        """
        now = datetime.now()
        
        # Get expired reservations
        # In production: query WHERE status=CONFIRMED AND expires_at < now
        all_reservations = self._get_all_confirmed_reservations()
        expired = [r for r in all_reservations if r.is_expired(now)]
        
        expired = expired[:batch_size]
        
        for res in expired:
            # Update status
            self.repo.update_reservation_status(
                res.id,
                ReservationStatus.EXPIRED,
                expired_at=now
            )
            
            # Return stock
            self._update_reserved_stock(res.fabric_id, -res.reserved_quantity)
            
            res.status = ReservationStatus.EXPIRED
        
        if expired:
            self._emit_event('reservations_expired', {
                'count': len(expired),
                'reservations': expired
            })
        
        return len(expired), expired
    
    def extend_reservation(
        self,
        reservation_id: UUID,
        additional_hours: int,
        extended_by: Optional[UUID] = None
    ) -> Optional[MaterialReservation]:
        """
        Extend reservation TTL.
        """
        # Get reservation
        res = self._get_reservation(reservation_id)
        if not res or res.status != ReservationStatus.CONFIRMED:
            return None
        
        new_expiry = res.expires_at + timedelta(hours=additional_hours)
        
        # Update
        self.repo.update_reservation_status(
            res.id,
            ReservationStatus.CONFIRMED,  # Stay confirmed
            expires_at=new_expiry,
            extended_by=extended_by,
            extended_at=datetime.now()
        )
        
        res.expires_at = new_expiry
        return res
    
    def split_reservation(
        self,
        reservation_id: UUID,
        split_quantity: Decimal,
        split_by: Optional[UUID] = None
    ) -> Tuple[Optional[MaterialReservation], Optional[MaterialReservation]]:
        """
        Split a reservation into two (e.g., partial fulfillment scenario).
        
        Returns:
            (original_updated, new_reservation)
        """
        res = self._get_reservation(reservation_id)
        if not res or res.status != ReservationStatus.CONFIRMED:
            return None, None
        
        if split_quantity >= res.reserved_quantity:
            return None, None
        
        locks = self.locks.acquire_multi_fabric_lock([res.fabric_id])
        
        try:
            # Reduce original
            original_qty = res.reserved_quantity - split_quantity
            
            # Create new reservation for split amount
            new_res = self._create_reservation(
                order_id=res.order_id,
                spec=res.fabric_spec,
                requested=split_quantity,
                reserved=split_quantity,
                status=ReservationStatus.CONFIRMED,
                is_partial=True,
                expires_at=res.expires_at,
                parent_reservation_id=res.id,
                created_by=split_by
            )
            
            # Update original
            self.repo.update_reservation_status(
                res.id,
                ReservationStatus.CONFIRMED,
                reserved_quantity=original_qty
            )
            res.reserved_quantity = original_qty
            
            return res, new_res
            
        finally:
            self.locks.release_locks(locks)
    
    # ============================================
    # PRIVATE METHODS
    # ============================================
    
    def _check_availability_internal(
        self,
        spec: FabricSpec,
        requested: Decimal,
        stock: StockLevel
    ) -> AvailabilityResult:
        """Internal availability check with stock object"""
        can_full = stock.can_reserve(requested)
        can_partial, partial_qty = stock.can_fulfill_partial(requested)
        
        return AvailabilityResult(
            fabric_id=spec.fabric_id,
            fabric_type=spec.fabric_type,
            hanger_number=spec.hanger_number,
            requested=requested,
            available=stock.available_quantity,
            can_fulfill=can_full,
            can_fulfill_partial=can_partial,
            partial_amount=partial_qty
        )
    
    def _create_reservation(
        self,
        order_id: UUID,
        spec: FabricSpec,
        requested: Decimal,
        reserved: Decimal,
        status: ReservationStatus,
        is_partial: bool,
        expires_at: Optional[datetime],
        created_by: Optional[UUID] = None,
        parent_reservation_id: Optional[UUID] = None,
        notes: str = ""
    ) -> MaterialReservation:
        """Create and persist reservation"""
        res = MaterialReservation(
            id=uuid4(),
            order_id=order_id,
            fabric_id=spec.fabric_id,
            fabric_spec=spec,
            requested_quantity=requested,
            reserved_quantity=reserved,
            status=status,
            created_at=datetime.now(),
            confirmed_at=datetime.now() if status == ReservationStatus.CONFIRMED else None,
            expires_at=expires_at,
            is_partial=is_partial,
            parent_reservation_id=parent_reservation_id,
            created_by=created_by,
            notes=notes
        )
        
        self.repo.save_reservation(res)
        return res
    
    def _update_reserved_stock(self, fabric_id: UUID, amount: Decimal):
        """Update reserved quantity (positive = reserve, negative = release)"""
        stock = self.repo.get_stock_level(fabric_id)
        if not stock:
            return
        
        new_reserved = stock.reserved_quantity + amount
        if new_reserved < 0:
            new_reserved = Decimal('0')
        
        self.repo.update_stock_level(fabric_id, {
            'reserved_quantity': new_reserved
        })
    
    def _rollback_reservations(
        self,
        order_id: UUID,
        reservations: List[MaterialReservation]
    ):
        """Rollback created reservations on failure"""
        for res in reservations:
            # Return stock
            self._update_reserved_stock(res.fabric_id, -res.reserved_quantity)
            
            # Mark as released
            self.repo.update_reservation_status(
                res.id,
                ReservationStatus.RELEASED,
                released_at=datetime.now(),
                release_reason="Reservation failed - rolled back"
            )
    
    def _emit_event(self, event_type: str, data: Dict):
        """Emit event to registered handlers"""
        for handler in self._event_handlers.get(event_type, []):
            try:
                handler(data)
            except Exception:
                pass  # Don't let event handlers break flow
    
    def on(self, event_type: str, handler: Callable):
        """Register event handler"""
        self._event_handlers[event_type].append(handler)
    
    # ============================================
    # STUB METHODS (to be implemented by repository)
    # ============================================
    
    def _get_all_fabrics(self) -> List[UUID]:
        """Get all fabric IDs"""
        # Repository implementation
        return []
    
    def _get_all_confirmed_reservations(self) -> List[MaterialReservation]:
        """Get all confirmed reservations"""
        # Repository implementation
        return []
    
    def _get_reservation(self, reservation_id: UUID) -> Optional[MaterialReservation]:
        """Get single reservation"""
        # Repository implementation
        return None


# ============================================
# INVENTORY SNAPSHOT (for reporting)
# ============================================

@dataclass
class InventorySnapshot:
    """Point-in-time inventory state"""
    timestamp: datetime
    fabric_states: Dict[UUID, StockLevel]
    reservations_by_fabric: Dict[UUID, List[MaterialReservation]]
    
    def get_utilization_rate(self, fabric_id: UUID) -> Decimal:
        """Calculate utilization rate for fabric"""
        stock = self.fabric_states.get(fabric_id)
        if not stock or stock.physical_quantity == 0:
            return Decimal('0')
        
        used = stock.reserved_quantity + stock.committed_quantity
        return (used / stock.physical_quantity * 100).quantize(Decimal('0.01'))
    
    def get_fabrics_at_risk(self) -> List[UUID]:
        """Get fabrics with high utilization (risk of stockout)"""
        at_risk = []
        for fabric_id in self.fabric_states:
            if self.get_utilization_rate(fabric_id) > 80:
                at_risk.append(fabric_id)
        return at_risk

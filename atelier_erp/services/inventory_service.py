"""
Inventory Service
Manages fabric reservations, stock deductions, and inventory operations
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID, uuid4

from django.db import models
from django.utils import timezone

from ..models import Fabric, FabricReservation, Cornice, Order
from ..constants import ReservationConfig
from ..events import (
    FabricReserved, FabricReservationConverted, FabricReservationCancelled,
    StockDeducted, StockReturned, LowStockAlert, DomainEvent, EventMetadata
)
from .exceptions import (
    InsufficientStockError, FabricNotFoundError, CorniceNotFoundError,
    ReservationNotFoundError, ReservationExpiredError, CannotConvertReservationError
)


class InventoryService:
    """
    Service for inventory management.
    Handles fabric reservations, stock deductions, and returns.
    """
    
    def __init__(self, unit_of_work):
        self.uow = unit_of_work
    
    # ============================================
    # FABRIC RESERVATION
    # ============================================
    
    def reserve_fabric(
        self,
        fabric_id: UUID,
        order_id: UUID,
        meters: Decimal,
        reserved_by: Optional[UUID] = None,
        expiry_days: int = None
    ) -> FabricReservation:
        """
        Reserve fabric for an order.
        
        Args:
            fabric_id: UUID of fabric to reserve
            order_id: UUID of order making reservation
            meters: Amount to reserve
            reserved_by: UUID of user making reservation
            expiry_days: Days until reservation expires (default: 3)
        
        Returns:
            FabricReservation object
        
        Raises:
            FabricNotFoundError: If fabric doesn't exist
            InsufficientStockError: If not enough available stock
        """
        if expiry_days is None:
            expiry_days = ReservationConfig.DEFAULT_EXPIRY_DAYS
        
        try:
            fabric = Fabric.objects.get(pk=fabric_id)
        except Fabric.DoesNotExist:
            raise FabricNotFoundError(f"Fabric {fabric_id} not found")
        
        # Calculate available stock (physical - reserved)
        available = fabric.available_meters
        
        if available < meters:
            raise InsufficientStockError(
                item_name=fabric.name,
                requested=float(meters),
                available=float(available)
            )
        
        # Create reservation
        expires_at = timezone.now() + timedelta(days=expiry_days)
        
        reservation = FabricReservation.objects.create(
            fabric=fabric,
            reserved_meters=meters,
            status=FabricReservation.Status.ACTIVE,
            expires_at=expires_at
        )
        
        # Update fabric reserved amount
        fabric.reserved_meters += meters
        fabric.save(update_fields=['reserved_meters', 'updated_at'])
        
        # Emit event
        available_before = fabric.available_meters
        available_after = available_before - meters
        self.uow.register_event(FabricReserved(
            metadata=EventMetadata(
                event_id=uuid4(),
                timestamp=timezone.now()
            ),
            reservation_id=reservation.id,
            fabric_id=fabric_id,
            fabric_name=fabric.name,
            hanger_number=fabric.hanger_number,
            order_id=order_id,
            reserved_meters=meters,
            available_before=available_before,
            available_after=available_after,
            expires_at=expires_at
        ))
        
        # Check for low stock alert
        self._check_low_stock(fabric)
        
        return reservation
    
    def reserve_fabrics_for_order(
        self,
        order_id: UUID,
        fabric_items: List[Dict[str, Any]],
        reserved_by: Optional[UUID] = None
    ) -> List[FabricReservation]:
        """
        Reserve multiple fabrics for an order.
        
        Args:
            order_id: UUID of order
            fabric_items: List of {fabric_id, meters} dicts
            reserved_by: UUID of user
        
        Returns:
            List of FabricReservation objects
        
        Note:
            Should be called within transaction with row locks on fabrics
        """
        reservations = []
        
        for item in fabric_items:
            reservation = self.reserve_fabric(
                fabric_id=item['fabric_id'],
                order_id=order_id,
                meters=item['meters'],
                reserved_by=reserved_by
            )
            reservations.append(reservation)
        
        return reservations
    
    def cancel_reservation(
        self,
        reservation_id: UUID,
        reason: str = "",
        cancelled_by: Optional[UUID] = None
    ) -> FabricReservation:
        """
        Cancel an active reservation.
        
        Args:
            reservation_id: UUID of reservation
            reason: Reason for cancellation
            cancelled_by: UUID of user
        
        Returns:
            Updated FabricReservation
        """
        try:
            reservation = FabricReservation.objects.select_related('fabric').get(
                pk=reservation_id,
                status=FabricReservation.Status.ACTIVE
            )
        except FabricReservation.DoesNotExist:
            raise ReservationNotFoundError(f"Active reservation {reservation_id} not found")
        
        fabric = reservation.fabric
        reserved_meters = reservation.reserved_meters
        
        # Update reservation status
        reservation.status = FabricReservation.Status.CANCELLED
        reservation.cancelled_reason = reason
        reservation.cancelled_at = timezone.now()
        reservation.save(update_fields=['status', 'cancelled_reason', 'cancelled_at'])
        
        # Release reserved stock
        fabric.reserved_meters -= reserved_meters
        fabric.save(update_fields=['reserved_meters', 'updated_at'])
        
        # Emit event
        self.uow.register_event(FabricReservationCancelled(
            reservation_id=reservation_id,
            fabric_id=fabric.id,
            released_meters=str(reserved_meters),
            reason=reason
        ))
        
        return reservation
    
    def convert_reservation_to_deduction(
        self,
        reservation_id: UUID,
        order_id: UUID
    ) -> Tuple[FabricReservation, Decimal]:
        """
        Convert active reservation to actual stock deduction.
        This is called when order moves to production.
        
        Args:
            reservation_id: UUID of reservation
            order_id: UUID of order (for verification)
        
        Returns:
            Tuple of (updated reservation, remaining stock)
        
        Raises:
            ReservationNotFoundError: If reservation not found
            ReservationExpiredError: If reservation expired
            CannotConvertReservationError: If reservation not active
        """
        try:
            reservation = FabricReservation.objects.select_related('fabric').get(
                pk=reservation_id
            )
        except FabricReservation.DoesNotExist:
            raise ReservationNotFoundError(f"Reservation {reservation_id} not found")
        
        # Validate reservation belongs to order
        if reservation.order_id != order_id:
            raise CannotConvertReservationError(
                f"Reservation {reservation_id} does not belong to order {order_id}"
            )
        
        # Check status
        if reservation.status == FabricReservation.Status.CONVERTED:
            raise CannotConvertReservationError("Reservation already converted")
        
        if reservation.status == FabricReservation.Status.EXPIRED:
            raise ReservationExpiredError(
                f"Reservation expired at {reservation.expires_at}"
            )
        
        if reservation.status == FabricReservation.Status.CANCELLED:
            raise CannotConvertReservationError("Reservation was cancelled")
        
        if reservation.status != FabricReservation.Status.ACTIVE:
            raise CannotConvertReservationError(
                f"Cannot convert reservation in status {reservation.status}"
            )
        
        fabric = reservation.fabric
        deducted_meters = reservation.reserved_meters
        
        # Deduct from physical stock
        fabric.stock_meters -= deducted_meters
        # Also reduce reserved (since it's now actually deducted)
        fabric.reserved_meters -= deducted_meters
        fabric.save(update_fields=['stock_meters', 'reserved_meters', 'updated_at'])
        
        # Update reservation
        reservation.status = FabricReservation.Status.CONVERTED
        reservation.converted_to_order_id = order_id
        reservation.converted_at = timezone.now()
        reservation.save(update_fields=['status', 'converted_to_order', 'converted_at'])
        
        # Emit event
        self.uow.register_event(FabricReservationConverted(
            reservation_id=reservation_id,
            fabric_id=fabric.id,
            order_id=order_id,
            deducted_meters=str(deducted_meters),
            remaining_stock=str(fabric.stock_meters)
        ))
        
        self.uow.register_event(StockDeducted(
            fabric_id=fabric.id,
            cornice_id=None,
            order_id=order_id,
            quantity_deducted=str(deducted_meters),
            remaining_stock=str(fabric.stock_meters)
        ))
        
        return reservation, fabric.stock_meters
    
    def convert_all_reservations(
        self,
        order_id: UUID
    ) -> List[Tuple[FabricReservation, Decimal]]:
        """
        Convert all active reservations for an order to deductions.
        Called when order enters production.
        
        Args:
            order_id: UUID of order
        
        Returns:
            List of (reservation, remaining_stock) tuples
        """
        reservations = FabricReservation.objects.filter(
            order_id=order_id,
            status=FabricReservation.Status.ACTIVE
        ).select_related('fabric')
        
        results = []
        for reservation in reservations:
            result = self.convert_reservation_to_deduction(reservation.id, order_id)
            results.append(result)
        
        return results
    
    # ============================================
    # CORNICE ALLOCATION
    # ============================================
    
    def allocate_cornice(
        self,
        cornice_id: UUID,
        order_id: UUID,
        quantity: int
    ) -> Cornice:
        """
        Allocate cornice stock for an order.
        Unlike fabric, cornices are deducted immediately (no reservation).
        
        Args:
            cornice_id: UUID of cornice
            order_id: UUID of order
            quantity: Number of units to allocate
        
        Returns:
            Updated Cornice
        """
        try:
            cornice = Cornice.objects.get(pk=cornice_id)
        except Cornice.DoesNotExist:
            raise CorniceNotFoundError(f"Cornice {cornice_id} not found")
        
        if cornice.stock_count < quantity:
            raise InsufficientStockError(
                item_name=cornice.name,
                requested=quantity,
                available=cornice.stock_count
            )
        
        # Deduct immediately
        cornice.stock_count -= quantity
        cornice.save(update_fields=['stock_count', 'updated_at'])
        
        # Emit event
        self.uow.register_event(StockDeducted(
            fabric_id=None,
            cornice_id=cornice_id,
            order_id=order_id,
            quantity_deducted=str(quantity),
            remaining_stock=str(cornice.stock_count)
        ))
        
        return cornice
    
    # ============================================
    # STOCK RETURNS (CANCELLATION)
    # ============================================
    
    def return_fabric_stock(
        self,
        fabric_id: UUID,
        order_id: UUID,
        quantity: Decimal
    ) -> Fabric:
        """
        Return fabric stock to inventory (on order cancellation).
        
        Args:
            fabric_id: UUID of fabric
            order_id: UUID of order (for audit)
            quantity: Amount to return
        
        Returns:
            Updated Fabric
        """
        try:
            fabric = Fabric.objects.get(pk=fabric_id)
        except Fabric.DoesNotExist:
            # Fabric may have been deleted - log but don't fail
            # This is a soft error that shouldn't block cancellation
            return None
        
        fabric.stock_meters += quantity
        fabric.save(update_fields=['stock_meters', 'updated_at'])
        
        # Emit event
        self.uow.register_event(StockReturned(
            fabric_id=fabric_id,
            cornice_id=None,
            order_id=order_id,
            quantity_returned=str(quantity),
            new_stock_level=str(fabric.stock_meters)
        ))
        
        return fabric
    
    def return_cornice_stock(
        self,
        cornice_id: UUID,
        order_id: UUID,
        quantity: int
    ) -> Cornice:
        """
        Return cornice stock to inventory (on order cancellation).
        """
        try:
            cornice = Cornice.objects.get(pk=cornice_id)
        except Cornice.DoesNotExist:
            return None
        
        cornice.stock_count += quantity
        cornice.save(update_fields=['stock_count', 'updated_at'])
        
        self.uow.register_event(StockReturned(
            fabric_id=None,
            cornice_id=cornice_id,
            order_id=order_id,
            quantity_returned=str(quantity),
            new_stock_level=str(cornice.stock_count)
        ))
        
        return cornice
    
    def release_all_reservations(self, order_id: UUID) -> List[FabricReservation]:
        """
        Release all reservations for an order (on cancellation).
        
        Args:
            order_id: UUID of order
        
        Returns:
            List of cancelled reservations
        """
        reservations = FabricReservation.objects.filter(
            order_id=order_id,
            status=FabricReservation.Status.ACTIVE
        ).select_related('fabric')
        
        cancelled = []
        for reservation in reservations:
            cancelled_res = self.cancel_reservation(
                reservation_id=reservation.id,
                reason="Order cancelled"
            )
            cancelled.append(cancelled_res)
        
        return cancelled
    
    # ============================================
    # QUERIES
    # ============================================
    
    def get_fabric_availability(self, fabric_id: UUID) -> Dict[str, Decimal]:
        """
        Get detailed availability for a fabric.
        
        Returns:
            Dict with physical_stock, reserved, available
        """
        try:
            fabric = Fabric.objects.get(pk=fabric_id)
        except Fabric.DoesNotExist:
            raise FabricNotFoundError(f"Fabric {fabric_id} not found")
        
        return {
            'physical_stock': fabric.stock_meters,
            'reserved': fabric.reserved_meters,
            'available': fabric.available_meters,
        }
    
    def check_bulk_availability(
        self,
        fabric_items: List[Dict[str, Any]]
    ) -> Dict[UUID, bool]:
        """
        Check if multiple fabrics are available in required quantities.
        
        Args:
            fabric_items: List of {fabric_id, meters} dicts
        
        Returns:
            Dict mapping fabric_id to availability (True/False)
        """
        results = {}
        
        fabric_ids = [item['fabric_id'] for item in fabric_items]
        fabrics = Fabric.objects.filter(pk__in=fabric_ids)
        fabric_map = {f.id: f for f in fabrics}
        
        for item in fabric_items:
            fabric_id = item['fabric_id']
            required = item['meters']
            
            fabric = fabric_map.get(fabric_id)
            if not fabric:
                results[fabric_id] = False
                continue
            
            results[fabric_id] = fabric.available_meters >= required
        
        return results
    
    # ============================================
    # PRIVATE METHODS
    # ============================================
    
    def _check_low_stock(self, fabric: Fabric):
        """Emit low stock alert if below threshold"""
        LOW_STOCK_THRESHOLD = Decimal('10.0')
        
        if fabric.stock_meters < LOW_STOCK_THRESHOLD:
            self.uow.register_event(LowStockAlert(
                fabric_id=fabric.id,
                fabric_name=fabric.name,
                hanger_number=fabric.hanger_number,
                current_stock=str(fabric.stock_meters),
                reserved_amount=str(fabric.reserved_meters),
                available=str(fabric.available_meters)
            ))
    
    def expire_old_reservations(self) -> int:
        """
        Background task: Expire reservations past their expiry date.
        
        Returns:
            Number of reservations expired
        """
        now = timezone.now()
        
        expired_reservations = FabricReservation.objects.filter(
            status=FabricReservation.Status.ACTIVE,
            expires_at__lt=now
        ).select_related('fabric')
        
        count = 0
        for reservation in expired_reservations:
            # Update status
            reservation.status = FabricReservation.Status.EXPIRED
            reservation.save(update_fields=['status'])
            
            # Release fabric reservation
            fabric = reservation.fabric
            fabric.reserved_meters -= reservation.reserved_meters
            fabric.save(update_fields=['reserved_meters', 'updated_at'])
            
            count += 1
        
        return count

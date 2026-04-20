"""
Unit of Work Pattern
Manages transaction boundaries and event dispatching
"""

from contextlib import contextmanager
from typing import List, Optional, Callable
from django.db import transaction, connection

from ..events import DomainEvent, get_event_bus


class UnitOfWork:
    """
    Unit of Work pattern implementation for Django.
    
    Manages:
    - Database transactions
    - Event collection and dispatch
    - Optimistic locking (version tracking)
    """
    
    def __init__(self):
        self._events: List[DomainEvent] = []
        self._event_bus = get_event_bus()
        self._transaction = None
        self._is_committed = False
        self._atomic_context = None
    
    def __enter__(self):
        """Context manager entry - starts atomic transaction"""
        self._atomic_context = self.atomic()
        return self._atomic_context.__enter__()
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - handles commit/rollback"""
        return self._atomic_context.__exit__(exc_type, exc_val, exc_tb)
    
    def register_event(self, event: DomainEvent):
        """Register event to be dispatched on commit"""
        self._events.append(event)
    
    def register_events(self, events: List[DomainEvent]):
        """Register multiple events"""
        self._events.extend(events)
    
    def _dispatch_events(self):
        """Dispatch all collected events"""
        for event in self._events:
            self._event_bus.publish(event)
        self._events.clear()
    
    @contextmanager
    def atomic(self, savepoint=True):
        """
        Context manager for atomic transaction.
        
        Usage:
            with unit_of_work.atomic():
                order = service.create_order(...)
                # Events dispatched automatically on success
        """
        with transaction.atomic(durable=False) as txn:
            self._transaction = txn
            try:
                yield self
                # Transaction succeeded - dispatch events
                self._dispatch_events()
                self._is_committed = True
            except Exception:
                # Transaction failed - clear events
                self._events.clear()
                raise
            finally:
                self._transaction = None
    
    @contextmanager
    def atomic_with_locks(self, lock_items: List[tuple]):
        """
        Atomic transaction with row-level locks.
        
        Args:
            lock_items: List of (model_class, pk) tuples to lock
        
        Usage:
            with unit_of_work.atomic_with_locks([(Fabric, 1), (Fabric, 2)]):
                # Rows are locked with SELECT FOR UPDATE
                service.reserve_materials(...)
        """
        with transaction.atomic():
            # Acquire locks first
            for model_class, pk in lock_items:
                # This will lock the row until transaction ends
                model_class.objects.select_for_update().get(pk=pk)
            
            try:
                yield self
                self._dispatch_events()
                self._is_committed = True
            except Exception:
                self._events.clear()
                raise
    
    def commit(self):
        """Mark as committed (actual commit happens on context exit)"""
        if not self._is_committed:
            self._dispatch_events()
            self._is_committed = True
    
    def is_active(self) -> bool:
        """Check if transaction is active"""
        return self._transaction is not None
    
    def is_committed(self) -> bool:
        """Check if transaction was committed"""
        return self._is_committed


@contextmanager
def unit_of_work_context():
    """
    Convenience context manager for creating Unit of Work.
    
    Usage:
        from atelier_erp.services import unit_of_work_context
        
        with unit_of_work_context() as uow:
            order_service = OrderService(uow)
            order = order_service.create_order(...)
    """
    uow = UnitOfWork()
    with uow.atomic():
        yield uow


class LockManager:
    """
    Manages distributed locks using Redis.
    Used for operations requiring global uniqueness (number generation).
    """
    
    def __init__(self, redis_client=None):
        self._redis = redis_client
        self._local_locks = set()
    
    def acquire_lock(self, lock_key: str, ttl_seconds: int = 10) -> bool:
        """Acquire distributed lock"""
        if self._redis:
            # Use Redis for distributed locking
            acquired = self._redis.set(
                f"lock:{lock_key}",
                "1",
                nx=True,  # Only if not exists
                ex=ttl_seconds
            )
            if acquired:
                self._local_locks.add(lock_key)
            return acquired
        else:
            # Fallback: thread-local locking (single process only)
            if lock_key in self._local_locks:
                return False
            self._local_locks.add(lock_key)
            return True
    
    def release_lock(self, lock_key: str):
        """Release distributed lock"""
        if self._redis:
            self._redis.delete(f"lock:{lock_key}")
        self._local_locks.discard(lock_key)
    
    @contextmanager
    def lock(self, lock_key: str, ttl_seconds: int = 10):
        """Context manager for lock"""
        if not self.acquire_lock(lock_key, ttl_seconds):
            raise LockAcquisitionError(f"Could not acquire lock: {lock_key}")
        try:
            yield
        finally:
            self.release_lock(lock_key)


class LockAcquisitionError(Exception):
    """Failed to acquire distributed lock"""
    pass

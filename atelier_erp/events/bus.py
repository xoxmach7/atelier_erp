"""
Event Bus Implementation
Sync and async event routing with priority handling
"""

from __future__ import annotations
from typing import Dict, List, Callable, Optional, Any, Set, Union
from dataclasses import dataclass, field
from collections import defaultdict
from queue import PriorityQueue, Queue, Empty
import threading
import asyncio
from concurrent.futures import ThreadPoolExecutor
import logging

from .definitions import DomainEvent, EventPriority


logger = logging.getLogger(__name__)

# Type alias for event handlers
EventHandler = Callable[[DomainEvent], Any]
EventFilter = Callable[[DomainEvent], bool]


@dataclass(order=True)
class PrioritizedEvent:
    """Wrapper for priority queue"""
    priority: int
    sequence: int
    event: DomainEvent = field(compare=False)
    
    def __post_init__(self):
        # Lower priority value = higher priority
        self.priority = self.event.priority.value


class SyncEventBus:
    """
    Synchronous event bus for in-process event routing.
    
    Features:
    - Priority-based processing
    - Filtered handlers
    - Exception isolation (one handler failure doesn't affect others)
    - Dead letter queue for failed events
    """
    
    def __init__(self, max_workers: int = 4):
        self._handlers: Dict[str, List[EventHandler]] = defaultdict(list)
        self._filters: Dict[str, List[EventFilter]] = defaultdict(list)
        self._global_handlers: List[EventHandler] = []
        self._dead_letter_queue: Queue = Queue()
        self._executor = ThreadPoolExecutor(max_workers=max_workers)
        self._sequence = 0
        self._lock = threading.RLock()
    
    def subscribe(
        self,
        event_type: str,
        handler: EventHandler,
        filter_fn: Optional[EventFilter] = None
    ):
        """
        Subscribe handler to event type.
        
        Args:
            event_type: Event type to subscribe to (or '*' for all)
            handler: Function to call when event occurs
            filter_fn: Optional filter function (returns True to handle)
        """
        with self._lock:
            if event_type == '*':
                self._global_handlers.append(handler)
            else:
                self._handlers[event_type].append(handler)
                if filter_fn:
                    self._filters[event_type].append(filter_fn)
    
    def unsubscribe(self, event_type: str, handler: EventHandler):
        """Unsubscribe handler from event type"""
        with self._lock:
            if event_type == '*':
                if handler in self._global_handlers:
                    self._global_handlers.remove(handler)
            else:
                if handler in self._handlers[event_type]:
                    self._handlers[event_type].remove(handler)
    
    def publish(self, event: DomainEvent) -> Dict[str, Any]:
        """
        Publish event to all subscribers.
        
        Returns:
            Dict with handling results
        """
        results = {
            'event_type': event.event_type,
            'handlers_called': 0,
            'handlers_succeeded': 0,
            'handlers_failed': 0,
            'errors': []
        }
        
        # Get handlers for this event type
        handlers = self._get_handlers(event)
        
        if not handlers:
            logger.debug(f"No handlers for event {event.event_type}")
            return results
        
        # Execute handlers
        for handler in handlers:
            results['handlers_called'] += 1
            
            try:
                # Check if handler accepts this event
                if self._should_handle(event, handler):
                    handler(event)
                    results['handlers_succeeded'] += 1
                else:
                    # Filtered out
                    results['handlers_called'] -= 1
                    
            except Exception as e:
                results['handlers_failed'] += 1
                results['errors'].append({
                    'handler': handler.__name__,
                    'error': str(e)
                })
                
                # Log but don't propagate
                logger.exception(f"Handler {handler.__name__} failed for {event.event_type}")
                
                # Add to dead letter queue for retry
                self._dead_letter_queue.put((event, handler, e))
        
        return results
    
    def publish_batch(self, events: List[DomainEvent]) -> List[Dict[str, Any]]:
        """Publish multiple events"""
        return [self.publish(e) for e in events]
    
    def _get_handlers(self, event: DomainEvent) -> List[EventHandler]:
        """Get all handlers for event"""
        with self._lock:
            handlers = []
            
            # Global handlers
            handlers.extend(self._global_handlers)
            
            # Type-specific handlers
            handlers.extend(self._handlers.get(event.event_type, []))
            
            return handlers
    
    def _should_handle(self, event: DomainEvent, handler: EventHandler) -> bool:
        """Check if handler should process this event"""
        # Get filters for this event type
        filters = self._filters.get(event.event_type, [])
        
        # If no filters, always handle
        if not filters:
            return True
        
        # Must pass all filters
        return all(f(event) for f in filters)
    
    def get_dead_letter_events(self, max_items: int = 100) -> List[tuple]:
        """Get failed events for retry"""
        items = []
        for _ in range(max_items):
            try:
                items.append(self._dead_letter_queue.get_nowait())
            except Empty:
                break
        return items


class AsyncEventBus:
    """
    Asynchronous event bus for non-blocking event processing.
    
    Features:
    - Priority-based async processing
    - Backpressure handling
    - Configurable concurrency
    - Graceful shutdown
    """
    
    def __init__(
        self,
        max_concurrent: int = 10,
        queue_size: int = 1000,
        batch_size: int = 10
    ):
        self._handlers: Dict[str, List[EventHandler]] = defaultdict(list)
        self._priority_queue: PriorityQueue = PriorityQueue(maxsize=queue_size)
        self._max_concurrent = max_concurrent
        self._batch_size = batch_size
        self._sequence = 0
        self._lock = asyncio.Lock()
        self._running = False
        self._worker_task: Optional[asyncio.Task] = None
        self._semaphore = asyncio.Semaphore(max_concurrent)
    
    async def start(self):
        """Start the event processor"""
        self._running = True
        self._worker_task = asyncio.create_task(self._process_events())
        logger.info("AsyncEventBus started")
    
    async def stop(self, timeout: float = 30.0):
        """Stop the event processor gracefully"""
        self._running = False
        
        if self._worker_task:
            try:
                await asyncio.wait_for(self._worker_task, timeout=timeout)
            except asyncio.TimeoutError:
                self._worker_task.cancel()
                try:
                    await self._worker_task
                except asyncio.CancelledError:
                    pass
        
        logger.info("AsyncEventBus stopped")
    
    def subscribe(self, event_type: str, handler: EventHandler):
        """Subscribe handler to event type"""
        self._handlers[event_type].append(handler)
    
    def unsubscribe(self, event_type: str, handler: EventHandler):
        """Unsubscribe handler"""
        if handler in self._handlers[event_type]:
            self._handlers[event_type].remove(handler)
    
    async def publish(self, event: DomainEvent) -> bool:
        """
        Publish event asynchronously.
        
        Returns:
            True if queued, False if queue full (backpressure)
        """
        try:
            self._sequence += 1
            prioritized = PrioritizedEvent(
                priority=event.priority.value,
                sequence=self._sequence,
                event=event
            )
            
            self._priority_queue.put_nowait(prioritized)
            return True
            
        except Exception:
            # Queue full - backpressure
            logger.warning(f"Event queue full, dropping {event.event_type}")
            return False
    
    async def publish_batch(self, events: List[DomainEvent]) -> List[bool]:
        """Publish multiple events"""
        return [await self.publish(e) for e in events]
    
    async def _process_events(self):
        """Main event processing loop"""
        while self._running:
            try:
                # Get event with timeout
                try:
                    prioritized = await asyncio.wait_for(
                        asyncio.get_event_loop().run_in_executor(
                            None, self._priority_queue.get, True, 1.0
                        ),
                        timeout=2.0
                    )
                except asyncio.TimeoutError:
                    continue
                
                # Process with semaphore for concurrency control
                async with self._semaphore:
                    await self._handle_event(prioritized.event)
                    
            except Exception as e:
                logger.exception(f"Error processing event: {e}")
    
    async def _handle_event(self, event: DomainEvent):
        """Handle single event"""
        handlers = self._handlers.get(event.event_type, [])
        
        if not handlers:
            return
        
        # Execute handlers concurrently
        tasks = [
            self._execute_handler(handler, event)
            for handler in handlers
        ]
        
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _execute_handler(self, handler: EventHandler, event: DomainEvent):
        """Execute single handler with error isolation"""
        try:
            # Run sync handler in thread pool
            if asyncio.iscoroutinefunction(handler):
                await handler(event)
            else:
                await asyncio.get_event_loop().run_in_executor(
                    None, handler, event
                )
        except Exception as e:
            logger.exception(f"Handler {handler.__name__} failed: {e}")
    
    def get_queue_size(self) -> int:
        """Get current queue size"""
        return self._priority_queue.qsize()


class EventBus:
    """
    Unified event bus combining sync and async capabilities.
    
    Usage:
    - Critical/High priority: Sync (immediate)
    - Normal/Low priority: Async (queued)
    """
    
    def __init__(
        self,
        sync_max_workers: int = 4,
        async_max_concurrent: int = 10
    ):
        self.sync_bus = SyncEventBus(max_workers=sync_max_workers)
        self.async_bus = AsyncEventBus(max_concurrent=async_max_concurrent)
        self._audit_callback: Optional[Callable[[DomainEvent], None]] = None
    
    async def start(self):
        """Start async processing"""
        await self.async_bus.start()
    
    async def stop(self):
        """Stop async processing"""
        await self.async_bus.stop()
    
    def on_audit(self, callback: Callable[[DomainEvent], None]):
        """Set audit logging callback"""
        self._audit_callback = callback
    
    def subscribe(
        self,
        event_type: str,
        handler: EventHandler,
        mode: str = "sync",  # sync, async, both
        filter_fn: Optional[EventFilter] = None
    ):
        """
        Subscribe handler to event.
        
        Args:
            event_type: Event type or '*' for all
            handler: Handler function
            mode: 'sync', 'async', or 'both'
            filter_fn: Optional filter
        """
        if mode in ("sync", "both"):
            self.sync_bus.subscribe(event_type, handler, filter_fn)
        
        if mode in ("async", "both"):
            self.async_bus.subscribe(event_type, handler)
    
    def unsubscribe(self, event_type: str, handler: EventHandler):
        """Unsubscribe handler"""
        self.sync_bus.unsubscribe(event_type, handler)
        self.async_bus.unsubscribe(event_type, handler)
    
    def publish(self, event: DomainEvent) -> Dict[str, Any]:
        """
        Publish event.
        
        Routing:
        - CRITICAL/HIGH priority: Sync (immediate)
        - NORMAL/LOW priority: Async (queued)
        """
        # Always audit
        if self._audit_callback:
            try:
                self._audit_callback(event)
            except Exception:
                logger.exception("Audit logging failed")
        
        # Route by priority
        if event.priority in (EventPriority.CRITICAL, EventPriority.HIGH):
            # Sync processing for critical events
            return self.sync_bus.publish(event)
        else:
            # Async processing for normal events (fallback to sync if no event loop)
            try:
                asyncio.create_task(self.async_bus.publish(event))
                return {
                    'event_type': event.event_type,
                    'mode': 'async',
                    'queued': True
                }
            except RuntimeError:
                # No event loop running (e.g., in tests), use sync fallback
                return self.sync_bus.publish(event)
    
    def publish_sync(self, event: DomainEvent) -> Dict[str, Any]:
        """Force synchronous publishing"""
        if self._audit_callback:
            self._audit_callback(event)
        return self.sync_bus.publish(event)
    
    async def publish_async(self, event: DomainEvent) -> bool:
        """Force asynchronous publishing"""
        if self._audit_callback:
            self._audit_callback(event)
        return await self.async_bus.publish(event)
    
    def publish_batch(self, events: List[DomainEvent]) -> List[Dict[str, Any]]:
        """Publish multiple events"""
        return [self.publish(e) for e in events]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get bus statistics"""
        return {
            'async_queue_size': self.async_bus.get_queue_size(),
            'sync_handler_count': sum(
                len(h) for h in self.sync_bus._handlers.values()
            ),
            'async_handler_count': sum(
                len(h) for h in self.async_bus._handlers.values()
            ),
            'dead_letter_count': self.sync_bus._dead_letter_queue.qsize()
        }


# ============================================
# UTILITY FUNCTIONS
# ============================================

def create_event_bus(
    enable_async: bool = True,
    sync_workers: int = 4,
    async_concurrent: int = 10
) -> EventBus:
    """Factory function to create configured event bus"""
    return EventBus(
        sync_max_workers=sync_workers,
        async_max_concurrent=async_concurrent
    )


# Global event bus instance
_global_bus: Optional[EventBus] = None


def get_event_bus() -> EventBus:
    """Get or create global event bus"""
    global _global_bus
    if _global_bus is None:
        _global_bus = create_event_bus()
    return _global_bus


def set_event_bus(bus: EventBus):
    """Set global event bus instance"""
    global _global_bus
    _global_bus = bus


# Decorator for event handlers
def event_handler(
    event_type: str,
    mode: str = "sync",
    filter_fn: Optional[EventFilter] = None
):
    """Decorator to register event handler"""
    def decorator(func: EventHandler) -> EventHandler:
        bus = get_event_bus()
        bus.subscribe(event_type, func, mode, filter_fn)
        return func
    return decorator

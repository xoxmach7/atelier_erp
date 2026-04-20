"""
Celery Integration for Event System
Async event processing with Celery tasks
"""

from __future__ import annotations
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass
from datetime import datetime
import json
import logging

# Celery imports (will be available in production environment)
try:
    from celery import Celery, Task
    from celery.exceptions import Retry
    CELERY_AVAILABLE = True
except ImportError:
    Celery = None
    Task = None
    Retry = Exception
    CELERY_AVAILABLE = False

from .definitions import DomainEvent, EventMetadata, EVENT_REGISTRY, deserialize_event
from .bus import EventHandler


logger = logging.getLogger(__name__)


@dataclass
class CeleryConfig:
    """Configuration for Celery event processing"""
    broker_url: str = "redis://localhost:6379/0"
    backend_url: str = "redis://localhost:6379/1"
    task_queue: str = "events"
    retry_queue: str = "events.retry"
    dlq_queue: str = "events.dlq"
    
    # Retry settings
    max_retries: int = 3
    retry_delay: int = 60  # seconds
    retry_backoff: bool = True
    
    # Task settings
    task_timeout: int = 300  # seconds
    acks_late: bool = True
    
    # Batch processing
    batch_size: int = 10
    batch_interval: int = 5  # seconds


class CeleryEventPublisher:
    """
    Publishes events to Celery for async processing.
    """
    
    def __init__(self, config: Optional[CeleryConfig] = None):
        self.config = config or CeleryConfig()
        self.celery: Optional[Celery] = None
        self._initialized = False
    
    def init_app(self, celery_app: Optional[Celery] = None):
        """Initialize with Celery app"""
        if celery_app:
            self.celery = celery_app
        elif CELERY_AVAILABLE and not self.celery:
            self.celery = Celery(
                'atelier_events',
                broker=self.config.broker_url,
                backend=self.config.backend_url
            )
            self._configure_celery()
        
        self._initialized = True
    
    def _configure_celery(self):
        """Configure Celery app"""
        if not self.celery:
            return
        
        self.celery.conf.update(
            task_serializer='json',
            accept_content=['json'],
            result_serializer='json',
            timezone='Asia/Almaty',
            enable_utc=True,
            task_acks_late=self.config.acks_late,
            task_reject_on_worker_lost=True,
            task_default_queue=self.config.task_queue,
            task_routes={
                'atelier.events.*': {'queue': self.config.task_queue},
                'atelier.events.retry': {'queue': self.config.retry_queue},
                'atelier.events.dlq': {'queue': self.config.dlq_queue},
            },
            beat_schedule={
                'process-event-queue': {
                    'task': 'atelier.events.process_queue',
                    'schedule': self.config.batch_interval,
                },
            }
        )
    
    def publish(self, event: DomainEvent, routing_key: Optional[str] = None) -> Optional[str]:
        """
        Publish event to Celery queue.
        
        Returns:
            Task ID if published, None if failed
        """
        if not self._initialized:
            self.init_app()
        
        if not self.celery:
            logger.error("Celery not available, cannot publish event")
            return None
        
        try:
            # Serialize event
            event_data = event.to_dict()
            
            # Determine routing
            priority = event.priority.value
            queue = routing_key or self._get_queue_for_priority(event.priority.value)
            
            # Send to Celery
            result = self.celery.send_task(
                'atelier.events.process_event',
                args=[event_data],
                queue=queue,
                priority=priority,
                countdown=0,
                headers={
                    'event_type': event.event_type,
                    'correlation_id': str(event.metadata.correlation_id) if event.metadata.correlation_id else None,
                }
            )
            
            logger.debug(f"Published {event.event_type} to Celery task {result.id}")
            return result.id
            
        except Exception as e:
            logger.exception(f"Failed to publish event: {e}")
            return None
    
    def publish_batch(self, events: List[DomainEvent]) -> List[Optional[str]]:
        """Publish multiple events"""
        return [self.publish(e) for e in events]
    
    def _get_queue_for_priority(self, priority: int) -> str:
        """Get appropriate queue for priority level"""
        if priority == 0:  # CRITICAL
            return "events.critical"
        elif priority == 1:  # HIGH
            return "events.high"
        elif priority <= 3:  # NORMAL, LOW
            return self.config.task_queue
        else:  # BATCH
            return "events.batch"
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get status of published event task"""
        if not self.celery:
            return None
        
        result = self.celery.AsyncResult(task_id)
        return {
            'task_id': task_id,
            'status': result.status,
            'result': result.result if result.ready() else None,
        }


class CeleryEventConsumer:
    """
    Consumes events from Celery and routes to handlers.
    """
    
    def __init__(self, config: Optional[CeleryConfig] = None):
        self.config = config or CeleryConfig()
        self.celery: Optional[Celery] = None
        self._handlers: Dict[str, List[EventHandler]] = {}
        self._initialized = False
    
    def init_app(self, celery_app: Optional[Celery] = None):
        """Initialize with Celery app"""
        if celery_app:
            self.celery = celery_app
        elif CELERY_AVAILABLE and not self.celery:
            self.celery = Celery(
                'atelier_events',
                broker=self.config.broker_url,
                backend=self.config.backend_url
            )
        
        self._initialized = True
        self._register_tasks()
    
    def _register_tasks(self):
        """Register Celery tasks"""
        if not self.celery:
            return
        
        @self.celery.task(
            bind=True,
            max_retries=self.config.max_retries,
            default_retry_delay=self.config.retry_delay,
            acks_late=self.config.acks_late
        )
        def process_event(task, event_data: Dict[str, Any]):
            """Process single event"""
            return self._handle_event(task, event_data)
        
        @self.celery.task
        def process_batch(events_data: List[Dict[str, Any]]):
            """Process batch of events"""
            results = []
            for event_data in events_data:
                result = self._handle_event(None, event_data)
                results.append(result)
            return results
        
        @self.celery.task
        def process_dlq(event_data: Dict[str, Any]):
            """Process event from dead letter queue"""
            # Log for manual review
            logger.error(f"DLQ event: {event_data}")
            return {'status': 'logged_to_dlq'}
    
    def _handle_event(
        self,
        task: Optional[Task],
        event_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle single event with retry logic"""
        try:
            # Deserialize
            event = deserialize_event(event_data)
            if not event:
                return {'status': 'error', 'reason': 'deserialization_failed'}
            
            # Get handlers
            handlers = self._handlers.get(event.event_type, [])
            
            if not handlers:
                logger.warning(f"No handlers for {event.event_type}")
                return {'status': 'no_handlers'}
            
            # Execute handlers
            results = []
            for handler in handlers:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        # Run async handler
                        import asyncio
                        asyncio.run(handler(event))
                    else:
                        handler(event)
                    results.append({'handler': handler.__name__, 'status': 'success'})
                except Exception as e:
                    logger.exception(f"Handler {handler.__name__} failed: {e}")
                    results.append({
                        'handler': handler.__name__,
                        'status': 'failed',
                        'error': str(e)
                    })
            
            return {
                'status': 'processed',
                'event_type': event.event_type,
                'handlers_executed': len(handlers),
                'results': results
            }
            
        except Exception as e:
            logger.exception(f"Event processing failed: {e}")
            
            # Retry if possible
            if task and event_data.get('metadata', {}).get('retry_count', 0) < self.config.max_retries:
                retry_count = event_data['metadata'].get('retry_count', 0) + 1
                event_data['metadata']['retry_count'] = retry_count
                
                countdown = self.config.retry_delay * (2 ** retry_count if self.config.retry_backoff else 1)
                
                task.retry(countdown=countdown, exc=e)
            
            return {'status': 'error', 'reason': str(e)}
    
    def register_handler(self, event_type: str, handler: EventHandler):
        """Register handler for event type"""
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)
    
    def start_consuming(self):
        """Start consuming events (for worker)"""
        if not self.celery:
            logger.error("Celery not initialized")
            return
        
        # Celery worker will automatically consume from queues
        logger.info("Celery event consumer ready")


# ============================================
# DECORATORS AND UTILITIES
# ============================================

def celery_task_handler(
    event_type: str,
    max_retries: int = 3,
    bind: bool = True
):
    """
    Decorator to create Celery task handler.
    
    Usage:
        @celery_task_handler('OrderConfirmed')
        def handle_order_confirmed(self, event):
            # Process event
            pass
    """
    def decorator(func: Callable) -> Callable:
        # Register with Celery if available
        if CELERY_AVAILABLE:
            # This would be registered as a Celery task
            # Implementation depends on specific Celery setup
            pass
        return func
    return decorator


def publish_to_celery(
    event: DomainEvent,
    config: Optional[CeleryConfig] = None
) -> Optional[str]:
    """
    Convenience function to publish event to Celery.
    
    Returns:
        Task ID or None if failed
    """
    publisher = CeleryEventPublisher(config)
    publisher.init_app()
    return publisher.publish(event)


# ============================================
# CELERY TASK DEFINITIONS (for celeryconfig)
# ============================================

CELERY_TASK_DEFINITIONS = """
# Celery tasks for Atelier ERP Event System
# Add these to your celeryconfig.py or tasks.py

from celery import shared_task
from atelier_erp.events import deserialize_event, get_handler_registry
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_event_task(self, event_data):
    \"\"\"Process single domain event\"\"\"
    try:
        # Deserialize
        event = deserialize_event(event_data)
        if not event:
            return {'status': 'error', 'reason': 'deserialization_failed'}
        
        # Get handlers
        handlers = get_handler_registry().get_handlers(event.event_type)
        
        # Execute
        for handler in handlers:
            try:
                handler(event)
            except Exception as e:
                logger.exception(f"Handler failed: {e}")
        
        return {'status': 'success', 'handlers': len(handlers)}
        
    except Exception as exc:
        # Retry
        if self.request.retries < 3:
            self.retry(countdown=60 * (2 ** self.request.retries), exc=exc)
        raise


@shared_task
def process_event_batch_task(events_data):
    \"\"\"Process batch of events\"\"\"
    results = []
    for event_data in events_data:
        result = process_event_task.delay(event_data)
        results.append(result.id)
    return {'status': 'batch_sent', 'task_ids': results}


@shared_task
def handle_dlq_event(event_data):
    \"\"\"Handle event from dead letter queue\"\"\"
    logger.error(f"DLQ Event received: {event_data}")
    
    # Log to database for manual review
    # send_alert_to_ops_team(event_data)
    
    return {'status': 'logged'}


# Scheduled tasks
@shared_task
def retry_failed_events():
    \"\"\"Retry events from dead letter queue\"\"\"
    # Implementation depends on DLQ storage
    pass


@shared_task
def cleanup_old_events(days=30):
    \"\"\"Clean up processed events older than N days\"\"\"
    # Implementation depends on event storage
    pass
"""


# ============================================
# SETUP HELPER
# ============================================

def setup_celery_integration(
    celery_app: Optional[Celery] = None,
    config: Optional[CeleryConfig] = None
) -> tuple:
    """
    Setup complete Celery integration.
    
    Returns:
        (publisher, consumer) tuple
    """
    publisher = CeleryEventPublisher(config)
    consumer = CeleryEventConsumer(config)
    
    if celery_app:
        publisher.init_app(celery_app)
        consumer.init_app(celery_app)
    else:
        publisher.init_app()
        consumer.init_app()
    
    return publisher, consumer

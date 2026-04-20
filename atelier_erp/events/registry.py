"""
Event Registry and Handler Mapping
Declarative event-to-handler binding
"""

from __future__ import annotations
from typing import Dict, List, Callable, Optional, Set, Any, Type
from dataclasses import dataclass, field
from collections import defaultdict
import logging

from .definitions import DomainEvent, EventPriority, EVENT_REGISTRY
from .bus import EventHandler, EventBus


logger = logging.getLogger(__name__)


@dataclass
class HandlerMapping:
    """Mapping between event type and handlers"""
    event_type: str
    handlers: List[EventHandler] = field(default_factory=list)
    handler_info: List[Dict[str, Any]] = field(default_factory=list)
    
    def add_handler(
        self,
        handler: EventHandler,
        description: str = "",
        produces_events: Optional[List[str]] = None,
        requires_services: Optional[List[str]] = None
    ):
        """Add handler with metadata"""
        self.handlers.append(handler)
        self.handler_info.append({
            'name': handler.__name__,
            'description': description,
            'produces_events': produces_events or [],
            'requires_services': requires_services or []
        })
    
    def remove_handler(self, handler: EventHandler):
        """Remove handler"""
        if handler in self.handlers:
            idx = self.handlers.index(handler)
            self.handlers.pop(idx)
            self.handler_info.pop(idx)


class HandlerRegistry:
    """
    Registry for event handlers with documentation.
    Provides declarative mapping of events to actions.
    """
    
    def __init__(self):
        self._mappings: Dict[str, HandlerMapping] = {}
        self._event_chains: Dict[str, List[str]] = defaultdict(list)  # event -> triggers these events
    
    def register(
        self,
        event_type: str,
        handler: EventHandler,
        description: str = "",
        produces_events: Optional[List[str]] = None,
        requires_services: Optional[List[str]] = None
    ):
        """
        Register handler for event type.
        
        Args:
            event_type: Event type to handle
            handler: Handler function
            description: What this handler does
            produces_events: Events this handler may emit
            requires_services: External services this handler needs
        """
        if event_type not in self._mappings:
            self._mappings[event_type] = HandlerMapping(event_type)
        
        self._mappings[event_type].add_handler(
            handler, description, produces_services, requires_services
        )
        
        # Track event chain
        if produces_events:
            self._event_chains[event_type].extend(produces_events)
        
        logger.info(f"Registered handler {handler.__name__} for {event_type}")
    
    def unregister(self, event_type: str, handler: EventHandler):
        """Unregister handler"""
        if event_type in self._mappings:
            self._mappings[event_type].remove_handler(handler)
    
    def get_handlers(self, event_type: str) -> List[EventHandler]:
        """Get all handlers for event type"""
        mapping = self._mappings.get(event_type)
        return mapping.handlers if mapping else []
    
    def get_handler_info(self, event_type: str) -> List[Dict[str, Any]]:
        """Get handler metadata"""
        mapping = self._mappings.get(event_type)
        return mapping.handler_info if mapping else []
    
    def get_triggered_events(self, event_type: str) -> List[str]:
        """Get events that may be triggered by this event"""
        return self._event_chains.get(event_type, [])
    
    def get_event_flow(self, start_event: str, max_depth: int = 5) -> Dict[str, Any]:
        """
        Get event flow/cascade starting from event.
        
        Returns tree structure showing what events trigger what.
        """
        visited = set()
        
        def build_tree(event: str, depth: int) -> Optional[Dict[str, Any]]:
            if depth > max_depth or event in visited:
                return None
            
            visited.add(event)
            
            triggered = self._event_chains.get(event, [])
            handlers = self.get_handler_info(event)
            
            children = []
            for triggered_event in triggered:
                child = build_tree(triggered_event, depth + 1)
                if child:
                    children.append(child)
            
            return {
                'event': event,
                'handlers': [h['name'] for h in handlers],
                'triggers': triggered,
                'children': children
            }
        
        return build_tree(start_event, 0)
    
    def get_all_mappings(self) -> Dict[str, HandlerMapping]:
        """Get all registered mappings"""
        return self._mappings.copy()
    
    def bind_to_bus(self, bus: EventBus, mode: str = "sync"):
        """Bind all registered handlers to event bus"""
        for event_type, mapping in self._mappings.items():
            for handler in mapping.handlers:
                bus.subscribe(event_type, handler, mode)
                logger.debug(f"Bound {handler.__name__} to {event_type}")


class EventRegistry:
    """
    Registry for event types with schema documentation.
    """
    
    def __init__(self):
        self._event_schemas: Dict[str, Dict[str, Any]] = {}
    
    def register_event(
        self,
        event_type: str,
        event_class: Type[DomainEvent],
        description: str = "",
        example_payload: Optional[Dict[str, Any]] = None,
        triggered_by: Optional[List[str]] = None,
        triggers: Optional[List[str]] = None
    ):
        """
        Register event type with documentation.
        
        Args:
            event_type: Event type name
            event_class: Event dataclass
            description: What this event represents
            example_payload: Example event data
            triggered_by: Events that typically trigger this
            triggers: Events this typically triggers
        """
        self._event_schemas[event_type] = {
            'class': event_class,
            'description': description,
            'example': example_payload,
            'triggered_by': triggered_by or [],
            'triggers': triggers or [],
            'fields': self._extract_fields(event_class)
        }
    
    def _extract_fields(self, event_class: Type[DomainEvent]) -> List[Dict[str, str]]:
        """Extract field info from dataclass"""
        import dataclasses
        fields = []
        
        for field in dataclasses.fields(event_class):
            if field.name not in ('metadata', 'event_type', 'event_version', 'priority', 'ttl_seconds'):
                fields.append({
                    'name': field.name,
                    'type': str(field.type),
                    'required': field.default is dataclasses.MISSING and 
                               field.default_factory is dataclasses.MISSING
                })
        
        return fields
    
    def get_event_info(self, event_type: str) -> Optional[Dict[str, Any]]:
        """Get event documentation"""
        return self._event_schemas.get(event_type)
    
    def get_all_events(self) -> List[str]:
        """Get all registered event types"""
        return list(self._event_schemas.keys())
    
    def get_event_class(self, event_type: str) -> Optional[Type[DomainEvent]]:
        """Get event class by type"""
        info = self._event_schemas.get(event_type)
        return info['class'] if info else None
    
    def generate_documentation(self) -> str:
        """Generate markdown documentation of all events"""
        lines = ["# Event Reference\n"]
        
        for event_type, info in sorted(self._event_schemas.items()):
            lines.append(f"## {event_type}\n")
            lines.append(f"{info['description']}\n")
            
            # Fields
            lines.append("### Fields\n")
            for field in info['fields']:
                req = " (required)" if field['required'] else ""
                lines.append(f"- `{field['name']}`: `{field['type']}`{req}")
            lines.append("")
            
            # Example
            if info['example']:
                lines.append("### Example\n")
                lines.append("```json")
                import json
                lines.append(json.dumps(info['example'], indent=2, default=str))
                lines.append("```\n")
            
            # Relationships
            if info['triggered_by']:
                lines.append(f"**Triggered by:** {', '.join(info['triggered_by'])}\n")
            if info['triggers']:
                lines.append(f"**Triggers:** {', '.join(info['triggers'])}\n")
            
            lines.append("---\n")
        
        return "\n".join(lines)


# ============================================
# PRE-BUILT HANDLER MAPS
# ============================================

class HandlerMaps:
    """
    Pre-built handler mappings for common ERP workflows.
    """
    
    @staticmethod
    def order_workflow(handler_registry: HandlerRegistry):
        """
        Order lifecycle event handlers.
        
        Events:
        - OrderConfirmed → Reserve materials, notify customer
        - OrderMaterialsReserved → Start production scheduling
        - OrderProductionStarted → Notify seamstress
        - OrderCompleted → Send completion email, request review
        - OrderCancelled → Release materials, notify customer
        """
        # These would be actual handler functions
        # Just documenting the mapping here
        
        handlers = {
            'OrderConfirmed': [
                ('reserve_materials_handler', 'Reserve inventory', 
                 ['OrderMaterialsReserved'], ['InventoryService']),
                ('notify_customer_confirmed', 'Send confirmation email',
                 ['EmailRequested'], ['EmailService']),
            ],
            'OrderMaterialsReserved': [
                ('schedule_production_handler', 'Create production assignments',
                 ['ProductionAssigned'], ['ProductionScheduler', 'TaskGenerator']),
            ],
            'OrderProductionStarted': [
                ('notify_seamstress_assigned', 'Notify assigned seamstress',
                 ['SMSRequested'], ['SMSService']),
            ],
            'OrderCompleted': [
                ('send_completion_email', 'Send completion notification',
                 ['EmailRequested'], ['EmailService']),
                ('request_review', 'Request customer review',
                 ['EmailRequested'], ['EmailService']),
            ],
            'OrderCancelled': [
                ('release_materials_handler', 'Release inventory reservations',
                 ['MaterialReservationReleased'], ['InventoryService']),
                ('notify_cancellation', 'Send cancellation email',
                 ['EmailRequested'], ['EmailService']),
            ],
        }
        
        return handlers
    
    @staticmethod
    def quality_control_workflow(handler_registry: HandlerRegistry):
        """
        Quality control event handlers.
        
        Events:
        - QCFailed → Notify manager, schedule rework, flag seamstress
        - QCPassed → Update order status, notify customer
        """
        handlers = {
            'QCFailed': [
                ('notify_qc_failure', 'Alert manager of QC failure',
                 ['EmailRequested'], ['EmailService']),
                ('schedule_rework', 'Create rework task',
                 ['TaskCreated'], ['TaskGenerator', 'ProductionScheduler']),
                ('flag_seamstress_record', 'Update seamstress quality record',
                 [], ['WorkerService']),
            ],
            'QCPassed': [
                ('update_order_ready', 'Mark order as ready',
                 ['OrderStatusChanged'], ['OrderService']),
                ('notify_customer_ready', 'Inform customer order is ready',
                 ['SMSRequested'], ['SMSService']),
            ],
        }
        
        return handlers
    
    @staticmethod
    def inventory_workflow(handler_registry: HandlerRegistry):
        """
        Inventory event handlers.
        
        Events:
        - LowStockAlert → Notify purchasing, check alternatives
        - MaterialReservationReleased → Update availability, notify waiting orders
        """
        handlers = {
            'LowStockAlert': [
                ('notify_purchasing', 'Alert purchasing department',
                 ['EmailRequested'], ['EmailService']),
                ('suggest_alternatives', 'Check for alternative fabrics',
                 [], ['InventoryService']),
                ('flag_for_reorder', 'Add to reorder queue',
                 [], ['ProcurementService']),
            ],
            'MaterialReservationReleased': [
                ('update_availability', 'Recalculate available stock',
                 [], ['InventoryService']),
                ('check_waiting_orders', 'Notify orders waiting for this fabric',
                 ['NotificationRequested'], ['OrderService']),
            ],
        }
        
        return handlers
    
    @staticmethod
    def worker_workflow(handler_registry: HandlerRegistry):
        """
        Worker management event handlers.
        
        Events:
        - WorkerOverloadDetected → Trigger rebalance, alert manager
        - TaskCompleted → Update workload, calculate payment
        """
        handlers = {
            'WorkerOverloadDetected': [
                ('trigger_rebalance', 'Redistribute workload',
                 [], ['ProductionScheduler']),
                ('alert_manager', 'Notify production manager',
                 ['EmailRequested'], ['EmailService']),
            ],
            'TaskCompleted': [
                ('update_workload', 'Decrement worker load counter',
                 [], ['ProductionScheduler']),
                ('calculate_payment', 'Calculate worker payment due',
                 ['PaymentCalculated'], ['PaymentService']),
                ('update_order_progress', 'Mark task complete in order',
                 ['OrderStatusChanged'], ['OrderService']),
            ],
        }
        
        return handlers


# ============================================
# REGISTRY INITIALIZATION
# ============================================

# Global registries
_handler_registry: Optional[HandlerRegistry] = None
_event_registry: Optional[EventRegistry] = None


def get_handler_registry() -> HandlerRegistry:
    """Get or create global handler registry"""
    global _handler_registry
    if _handler_registry is None:
        _handler_registry = HandlerRegistry()
    return _handler_registry


def get_event_registry() -> EventRegistry:
    """Get or create global event registry"""
    global _event_registry
    if _event_registry is None:
        _event_registry = EventRegistry()
        _register_default_events(_event_registry)
    return _event_registry


def _register_default_events(registry: EventRegistry):
    """Register default ERP events with documentation"""
    from .definitions import (
        OrderConfirmed, OrderMaterialsReserved, OrderCompleted,
        QCFailed, QCPassed, LowStockAlert, WorkerOverloadDetected,
        TaskCompleted
    )
    
    # Order events
    registry.register_event(
        'OrderConfirmed',
        OrderConfirmed,
        description='Order confirmed by customer, ready for material reservation',
        triggered_by=['QuoteApproved'],
        triggers=['OrderMaterialsReserved', 'EmailRequested'],
        example_payload={
            'order_id': '550e8400-e29b-41d4-a716-446655440000',
            'order_number': 'О-2024-001',
            'customer_id': '550e8400-e29b-41d4-a716-446655440001',
            'quote_id': '550e8400-e29b-41d4-a716-446655440002'
        }
    )
    
    registry.register_event(
        'OrderMaterialsReserved',
        OrderMaterialsReserved,
        description='Materials reserved for order, production can be scheduled',
        triggered_by=['OrderConfirmed'],
        triggers=['ProductionAssigned'],
        example_payload={
            'order_id': '550e8400-e29b-41d4-a716-446655440000',
            'order_number': 'О-2024-001',
            'total_fabrics': 3,
            'total_meters': '12.5'
        }
    )
    
    registry.register_event(
        'OrderCompleted',
        OrderCompleted,
        description='Order fully completed and delivered',
        triggered_by=['InstallationComplete', 'FinalPaymentReceived'],
        triggers=['EmailRequested', 'ReviewRequested'],
        example_payload={
            'order_id': '550e8400-e29b-41d4-a716-446655440000',
            'order_number': 'О-2024-001',
            'completion_date': '2024-01-15T14:30:00',
            'total_paid': '45000.00'
        }
    )
    
    # QC events
    registry.register_event(
        'QCFailed',
        QCFailed,
        description='Quality check failed, rework required',
        triggered_by=['QualityInspection'],
        triggers=['TaskCreated', 'EmailRequested'],
        example_payload={
            'order_id': '550e8400-e29b-41d4-a716-446655440000',
            'order_number': 'О-2024-001',
            'severity': 'major',
            'requires_rework': True,
            'failure_reason': 'Seams not aligned properly'
        }
    )
    
    registry.register_event(
        'QCPassed',
        QCPassed,
        description='Quality check passed, order ready for delivery',
        triggered_by=['QualityInspection'],
        triggers=['OrderStatusChanged', 'SMSRequested'],
        example_payload={
            'order_id': '550e8400-e29b-41d4-a716-446655440000',
            'order_number': 'О-2024-001',
            'quality_score': 95
        }
    )
    
    # Inventory events
    registry.register_event(
        'LowStockAlert',
        LowStockAlert,
        description='Fabric stock below reorder threshold',
        triggered_by=['StockDeducted', 'MaterialReservationConverted'],
        triggers=['EmailRequested'],
        example_payload={
            'fabric_id': '550e8400-e29b-41d4-a716-446655440003',
            'hanger_number': 'B-001',
            'current_stock': '8.5',
            'threshold': '20.0',
            'suggested_reorder_amount': '50.0'
        }
    )
    
    # Worker events
    registry.register_event(
        'WorkerOverloadDetected',
        WorkerOverloadDetected,
        description='Worker capacity exceeded, rebalance required',
        triggered_by=['TaskAssigned'],
        triggers=['EmailRequested'],
        example_payload={
            'worker_id': '550e8400-e29b-41d4-a716-446655440004',
            'worker_name': 'Alice',
            'current_load': 5,
            'max_capacity': 3,
            'utilization_percent': 166.7
        }
    )
    
    registry.register_event(
        'TaskCompleted',
        TaskCompleted,
        description='Production task completed by worker',
        triggered_by=['WorkerSubmission'],
        triggers=['OrderStatusChanged', 'PaymentCalculated'],
        example_payload={
            'task_id': '550e8400-e29b-41d4-a716-446655440005',
            'task_name': 'Sew curtains for Room A',
            'worker_id': '550e8400-e29b-41d4-a716-446655440004',
            'worker_name': 'Alice',
            'actual_duration_minutes': 120,
            'quality_score': 95
        }
    )


# Convenience functions
def register_handler(
    event_type: str,
    handler: EventHandler,
    description: str = "",
    produces_events: Optional[List[str]] = None,
    requires_services: Optional[List[str]] = None
):
    """Convenience function to register handler"""
    registry = get_handler_registry()
    registry.register(event_type, handler, description, produces_events, requires_services)


def unregister_handler(event_type: str, handler: EventHandler):
    """Convenience function to unregister handler"""
    registry = get_handler_registry()
    registry.unregister(event_type, handler)


def get_handlers_for_event(event_type: str) -> List[EventHandler]:
    """Get handlers for event type"""
    registry = get_handler_registry()
    return registry.get_handlers(event_type)


def bind_handlers_to_bus(bus: EventBus, mode: str = "sync"):
    """Bind all registered handlers to event bus"""
    registry = get_handler_registry()
    registry.bind_to_bus(bus, mode)

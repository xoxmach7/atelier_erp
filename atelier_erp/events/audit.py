"""
Event Audit System
Immutable audit trail for compliance and debugging
"""

from __future__ import annotations
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4
from enum import Enum
import json
import logging

from .definitions import DomainEvent, EventMetadata


logger = logging.getLogger(__name__)


class AuditLevel(Enum):
    """Audit importance levels"""
    DEBUG = "debug"       # Development only
    INFO = "info"         # Normal operations
    IMPORTANT = "important"  # Business significant
    CRITICAL = "critical" # Compliance required


@dataclass(frozen=True)
class AuditEntry:
    """Single audit log entry"""
    audit_id: UUID
    timestamp: datetime
    event_id: UUID
    event_type: str
    
    # Classification
    audit_level: AuditLevel
    entity_type: str  # order, task, material, worker
    entity_id: UUID
    
    # Action details
    action: str  # created, updated, status_changed, etc.
    actor_id: Optional[UUID]  # Who performed action
    actor_type: str  # user, system, service
    
    # Data
    before_state: Optional[Dict[str, Any]]  # Previous state
    after_state: Optional[Dict[str, Any]]   # New state
    changes: Dict[str, Any]  # Diff of changes
    
    # Context
    correlation_id: Optional[UUID]
    source_ip: Optional[str]
    user_agent: Optional[str]
    
    # Integrity
    integrity_hash: Optional[str] = None  # For tamper detection
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'audit_id': str(self.audit_id),
            'timestamp': self.timestamp.isoformat(),
            'event_id': str(self.event_id),
            'event_type': self.event_type,
            'audit_level': self.audit_level.value,
            'entity_type': self.entity_type,
            'entity_id': str(self.entity_id),
            'action': self.action,
            'actor_id': str(self.actor_id) if self.actor_id else None,
            'actor_type': self.actor_type,
            'before_state': self.before_state,
            'after_state': self.after_state,
            'changes': self.changes,
            'correlation_id': str(self.correlation_id) if self.correlation_id else None,
            'integrity_hash': self.integrity_hash
        }


class AuditStore:
    """
    Abstract audit storage interface.
    Production: implement with database
    """
    
    def save(self, entry: AuditEntry) -> bool:
        """Save audit entry"""
        raise NotImplementedError
    
    def query(
        self,
        entity_type: Optional[str] = None,
        entity_id: Optional[UUID] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        actor_id: Optional[UUID] = None,
        event_type: Optional[str] = None,
        limit: int = 100
    ) -> List[AuditEntry]:
        """Query audit entries"""
        raise NotImplementedError
    
    def get_by_event(self, event_id: UUID) -> Optional[AuditEntry]:
        """Get audit entry by event ID"""
        raise NotImplementedError
    
    def get_entity_history(
        self,
        entity_type: str,
        entity_id: UUID
    ) -> List[AuditEntry]:
        """Get complete history for entity"""
        raise NotImplementedError


class InMemoryAuditStore(AuditStore):
    """In-memory audit store for development/testing"""
    
    def __init__(self):
        self._entries: List[AuditEntry] = []
    
    def save(self, entry: AuditEntry) -> bool:
        self._entries.append(entry)
        return True
    
    def query(
        self,
        entity_type: Optional[str] = None,
        entity_id: Optional[UUID] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        actor_id: Optional[UUID] = None,
        event_type: Optional[str] = None,
        limit: int = 100
    ) -> List[AuditEntry]:
        results = self._entries
        
        if entity_type:
            results = [e for e in results if e.entity_type == entity_type]
        if entity_id:
            results = [e for e in results if e.entity_id == entity_id]
        if start_time:
            results = [e for e in results if e.timestamp >= start_time]
        if end_time:
            results = [e for e in results if e.timestamp <= end_time]
        if actor_id:
            results = [e for e in results if e.actor_id == actor_id]
        if event_type:
            results = [e for e in results if e.event_type == event_type]
        
        return sorted(results, key=lambda e: e.timestamp, reverse=True)[:limit]
    
    def get_by_event(self, event_id: UUID) -> Optional[AuditEntry]:
        for entry in self._entries:
            if entry.event_id == event_id:
                return entry
        return None
    
    def get_entity_history(self, entity_type: str, entity_id: UUID) -> List[AuditEntry]:
        return self.query(entity_type=entity_type, entity_id=entity_id, limit=1000)


class AuditLogger:
    """
    Audit logging for domain events.
    Provides immutable, tamper-evident audit trail.
    """
    
    def __init__(self, store: Optional[AuditStore] = None):
        self.store = store or InMemoryAuditStore()
        self._before_state_cache: Dict[str, Dict[str, Any]] = {}
    
    def log_event(
        self,
        event: DomainEvent,
        entity_type: str,
        entity_id: UUID,
        action: str,
        audit_level: AuditLevel = AuditLevel.INFO,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None
    ) -> AuditEntry:
        """
        Log event to audit trail.
        
        Args:
            event: Domain event
            entity_type: Type of entity (order, task, etc.)
            entity_id: Entity UUID
            action: Action description
            audit_level: Importance level
            before_state: State before change
            after_state: State after change
        """
        # Calculate changes
        changes = self._calculate_changes(before_state, after_state)
        
        # Create entry
        entry = AuditEntry(
            audit_id=uuid4(),
            timestamp=datetime.now(),
            event_id=event.metadata.event_id,
            event_type=event.event_type,
            audit_level=audit_level,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            actor_id=event.metadata.user_id,
            actor_type="user" if event.metadata.user_id else "system",
            before_state=before_state,
            after_state=after_state,
            changes=changes,
            correlation_id=event.metadata.correlation_id,
            source_ip=event.metadata.ip_address,
            user_agent=None,  # Would come from HTTP context
            integrity_hash=None  # Would be calculated for tamper detection
        )
        
        # Save
        self.store.save(entry)
        
        # Also log to application log
        logger.info(
            f"AUDIT: {entry.action} on {entry.entity_type}:{entry.entity_id} "
            f"by {entry.actor_id} at {entry.timestamp}"
        )
        
        return entry
    
    def log_order_event(
        self,
        event: DomainEvent,
        order_id: UUID,
        action: str,
        before_state: Optional[Dict] = None,
        after_state: Optional[Dict] = None
    ) -> AuditEntry:
        """Convenience: Log order-related event"""
        return self.log_event(
            event=event,
            entity_type="order",
            entity_id=order_id,
            action=action,
            audit_level=AuditLevel.IMPORTANT,
            before_state=before_state,
            after_state=after_state
        )
    
    def log_material_event(
        self,
        event: DomainEvent,
        fabric_id: UUID,
        action: str,
        before_state: Optional[Dict] = None,
        after_state: Optional[Dict] = None
    ) -> AuditEntry:
        """Convenience: Log material-related event"""
        return self.log_event(
            event=event,
            entity_type="material",
            entity_id=fabric_id,
            action=action,
            audit_level=AuditLevel.INFO,
            before_state=before_state,
            after_state=after_state
        )
    
    def capture_before_state(self, key: str, state: Dict[str, Any]):
        """Capture state before modification (for change tracking)"""
        self._before_state_cache[key] = state.copy()
    
    def get_before_state(self, key: str) -> Optional[Dict[str, Any]]:
        """Retrieve captured before state"""
        return self._before_state_cache.get(key)
    
    def _calculate_changes(
        self,
        before: Optional[Dict],
        after: Optional[Dict]
    ) -> Dict[str, Any]:
        """Calculate diff between before and after states"""
        if not before or not after:
            return {}
        
        changes = {}
        all_keys = set(before.keys()) | set(after.keys())
        
        for key in all_keys:
            before_val = before.get(key)
            after_val = after.get(key)
            
            if before_val != after_val:
                changes[key] = {
                    'from': before_val,
                    'to': after_val
                }
        
        return changes
    
    def query(
        self,
        entity_type: Optional[str] = None,
        entity_id: Optional[UUID] = None,
        **kwargs
    ) -> List[AuditEntry]:
        """Query audit trail"""
        return self.store.query(entity_type, entity_id, **kwargs)
    
    def get_entity_history(
        self,
        entity_type: str,
        entity_id: UUID
    ) -> List[AuditEntry]:
        """Get complete history for entity"""
        return self.store.get_entity_history(entity_type, entity_id)
    
    def generate_report(
        self,
        entity_type: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Generate audit report"""
        entries = self.store.query(
            entity_type=entity_type,
            start_time=start_time,
            end_time=end_time,
            limit=10000
        )
        
        # Group by type
        by_type: Dict[str, int] = {}
        by_actor: Dict[str, int] = {}
        by_level: Dict[str, int] = {}
        
        for entry in entries:
            by_type[entry.event_type] = by_type.get(entry.event_type, 0) + 1
            
            actor_key = str(entry.actor_id) if entry.actor_id else "system"
            by_actor[actor_key] = by_actor.get(actor_key, 0) + 1
            
            level_key = entry.audit_level.value
            by_level[level_key] = by_level.get(level_key, 0) + 1
        
        return {
            'period': {
                'start': start_time.isoformat() if start_time else None,
                'end': end_time.isoformat() if end_time else None
            },
            'total_entries': len(entries),
            'by_event_type': by_type,
            'by_actor': by_actor,
            'by_level': by_level,
            'entries': [e.to_dict() for e in entries[:100]]  # Sample
        }


class AuditTrail:
    """
    Context manager for capturing audit trail during operations.
    """
    
    def __init__(
        self,
        logger: AuditLogger,
        entity_type: str,
        entity_id: UUID,
        action: str,
        capture_changes: bool = True
    ):
        self.logger = logger
        self.entity_type = entity_type
        self.entity_id = entity_id
        self.action = action
        self.capture_changes = capture_changes
        
        self._before_state: Optional[Dict] = None
        self._event: Optional[DomainEvent] = None
        self._entry: Optional[AuditEntry] = None
    
    def __enter__(self):
        """Capture before state"""
        if self.capture_changes:
            # Would load current state from database
            self._before_state = self._load_current_state()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Log audit entry"""
        if exc_type is None and self._event:
            # Success - log the change
            after_state = self._load_current_state() if self.capture_changes else None
            
            self._entry = self.logger.log_event(
                event=self._event,
                entity_type=self.entity_type,
                entity_id=self.entity_id,
                action=self.action,
                before_state=self._before_state,
                after_state=after_state
            )
    
    def _load_current_state(self) -> Dict[str, Any]:
        """Load current entity state (placeholder)"""
        # In production: query database for entity state
        return {}
    
    def set_event(self, event: DomainEvent):
        """Set the event to log"""
        self._event = event
    
    def get_entry(self) -> Optional[AuditEntry]:
        """Get created audit entry"""
        return self._entry


# ============================================
# CONVENIENCE FUNCTIONS
# ============================================

_audit_logger: Optional[AuditLogger] = None


def get_audit_logger() -> AuditLogger:
    """Get or create global audit logger"""
    global _audit_logger
    if _audit_logger is None:
        _audit_logger = AuditLogger()
    return _audit_logger


def set_audit_logger(logger: AuditLogger):
    """Set global audit logger"""
    global _audit_logger
    _audit_logger = logger


def log_event(
    event: DomainEvent,
    entity_type: str,
    entity_id: UUID,
    action: str,
    **kwargs
) -> AuditEntry:
    """Convenience function to log event"""
    logger = get_audit_logger()
    return logger.log_event(event, entity_type, entity_id, action, **kwargs)


def get_event_history(
    entity_type: str,
    entity_id: UUID,
    **kwargs
) -> List[AuditEntry]:
    """Get event history for entity"""
    logger = get_audit_logger()
    return logger.get_entity_history(entity_type, entity_id)

"""
Production Scheduler Service
Assigns tasks to workers based on skills, priority, dependencies, and workload balancing.
Handles DAG ordering, specialization constraints, and overload detection.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional, Tuple, Any, Callable, Iterator
from uuid import UUID, uuid4
from enum import Enum, auto
from decimal import Decimal
from datetime import datetime, timedelta
from collections import defaultdict, deque
import heapq


# ============================================
# DOMAIN MODELS
# ============================================

class WorkerStatus(Enum):
    """Worker availability status"""
    AVAILABLE = "available"
    BUSY = "busy"
    OFFLINE = "offline"
    ON_BREAK = "on_break"
    OVERLOADED = "overloaded"


class AssignmentStrategy(Enum):
    """Strategies for task assignment"""
    SKILL_FIRST = "skill_first"      # Assign to most skilled first
    BALANCED = "balanced"            # Balance workload evenly
    FASTEST = "fastest"              # Minimize completion time
    CHEAPEST = "cheapest"            # Minimize labor cost
    ROUND_ROBIN = "round_robin"      # Simple round-robin


@dataclass
class WorkerProfile:
    """Worker with skills, capacity, and current state"""
    id: UUID
    name: str
    skills: Dict[str, int]  # skill_code -> level (1-5)
    hourly_rate: Decimal = Decimal('0')
    
    # Capacity
    max_concurrent_tasks: int = 1
    current_load: int = 0
    
    # Specialization (primary skill)
    primary_skill: Optional[str] = None
    secondary_skills: List[str] = field(default_factory=list)
    
    # Status
    status: WorkerStatus = WorkerStatus.AVAILABLE
    shift_start: Optional[datetime] = None
    shift_end: Optional[datetime] = None
    
    # Performance metrics (for optimization)
    avg_task_completion_time: Optional[float] = None
    tasks_completed_today: int = 0
    efficiency_rating: float = 1.0  # 0.5-1.5 multiplier
    
    def has_skill(self, skill_code: str, min_level: int = 1) -> bool:
        """Check if worker has skill at minimum level"""
        return self.skills.get(skill_code, 0) >= min_level
    
    def get_skill_level(self, skill_code: str) -> int:
        """Get skill level (0 if not possessed)"""
        return self.skills.get(skill_code, 0)
    
    def is_available(self, at_time: Optional[datetime] = None) -> bool:
        """Check if worker can take new task"""
        if self.status not in (WorkerStatus.AVAILABLE, WorkerStatus.BUSY):
            return False
        
        if self.current_load >= self.max_concurrent_tasks:
            return False
        
        # Check shift time
        if at_time and self.shift_start and self.shift_end:
            if not (self.shift_start <= at_time <= self.shift_end):
                return False
        
        return True
    
    def remaining_capacity(self) -> int:
        """Remaining task slots"""
        return max(0, self.max_concurrent_tasks - self.current_load)
    
    def calculate_skill_score(self, required_skills: Dict[str, int]) -> float:
        """
        Calculate how well worker matches required skills.
        Returns 0-100+ score.
        """
        if not required_skills:
            return 50.0  # Neutral if no specific requirements
        
        total_score = 0.0
        weights = 0
        
        for skill_code, required_level in required_skills.items():
            worker_level = self.get_skill_level(skill_code)
            weight = 10  # Base weight
            
            if worker_level == 0:
                # Cannot perform this task
                return 0.0
            
            # Score based on level difference
            level_diff = worker_level - required_level
            if level_diff >= 0:
                # Meets or exceeds requirement
                skill_score = 50 + (level_diff * 15)
            else:
                # Below requirement (shouldn't happen due to filter, but safety)
                skill_score = max(0, 50 + (level_diff * 20))
            
            # Bonus for primary specialization
            if skill_code == self.primary_skill:
                skill_score *= 1.2
                weight *= 1.5
            elif skill_code in self.secondary_skills:
                skill_score *= 1.1
            
            total_score += skill_score * weight
            weights += weight
        
        return total_score / weights if weights > 0 else 0.0
    
    def calculate_workload_score(self) -> float:
        """
        Calculate workload balance score.
        Lower is better (less loaded).
        """
        utilization = self.current_load / self.max_concurrent_tasks
        
        # Penalty for high utilization
        if utilization >= 0.8:
            return 100.0
        elif utilization >= 0.6:
            return 50.0
        elif utilization >= 0.4:
            return 25.0
        else:
            return 0.0
    
    def __hash__(self):
        return hash(self.id)
    
    def __eq__(self, other):
        return isinstance(other, WorkerProfile) and self.id == other.id


@dataclass
class TaskRequirements:
    """Requirements for task execution"""
    required_skills: Dict[str, int] = field(default_factory=dict)
    min_skill_level: int = 1
    preferred_skill_level: int = 3
    
    estimated_duration_minutes: int = 60
    priority: int = 1  # 1-5, higher = more urgent
    
    # Constraints
    must_assign_before: Optional[datetime] = None
    cannot_assign_after: Optional[datetime] = None
    required_worker_id: Optional[UUID] = None  # Specific worker required
    excluded_worker_ids: List[UUID] = field(default_factory=list)


@dataclass
class SchedulableTask:
    """Task ready for scheduling"""
    id: UUID
    name: str
    operation_type: str  # 'cutting', 'sewing', 'ironing', etc.
    
    requirements: TaskRequirements
    
    # DAG context
    depends_on: Set[UUID] = field(default_factory=set)
    depended_by: Set[UUID] = field(default_factory=set)
    
    # Scheduling state
    earliest_start: Optional[datetime] = None
    latest_start: Optional[datetime] = None
    is_critical_path: bool = False
    
    # Assignment
    assigned_worker_id: Optional[UUID] = None
    assigned_at: Optional[datetime] = None
    expected_completion: Optional[datetime] = None
    
    # Status
    status: str = "pending"  # pending, assigned, in_progress, completed, failed
    
    # Retry tracking
    assignment_attempts: int = 0
    last_failure_reason: Optional[str] = None
    
    def is_ready(self, completed_task_ids: Set[UUID]) -> bool:
        """Check if all dependencies are satisfied"""
        return self.depends_on.issubset(completed_task_ids)
    
    def calculate_slack(self, current_time: datetime) -> Optional[timedelta]:
        """Calculate scheduling slack"""
        if self.latest_start is None or self.earliest_start is None:
            return None
        
        earliest = max(self.earliest_start, current_time)
        if self.latest_start > earliest:
            return self.latest_start - earliest
        return timedelta(0)
    
    def __hash__(self):
        return hash(self.id)
    
    def __eq__(self, other):
        return isinstance(other, SchedulableTask) and self.id == other.id


@dataclass
class Assignment:
    """Task-to-worker assignment"""
    task_id: UUID
    worker_id: UUID
    assigned_at: datetime
    
    # Scoring
    skill_score: float
    workload_score: float
    priority_score: float
    total_score: float
    
    # Expected timing
    expected_start: datetime
    expected_completion: datetime
    
    # Reasoning
    assignment_reason: str = ""
    
    def is_valid(self, at_time: Optional[datetime] = None) -> bool:
        """Check if assignment is still valid"""
        at_time = at_time or datetime.now()
        return self.expected_start <= at_time < self.expected_completion


@dataclass
class Schedule:
    """Complete schedule with assignments"""
    assignments: Dict[UUID, Assignment] = field(default_factory=dict)  # task_id -> assignment
    worker_schedules: Dict[UUID, List[Tuple[datetime, datetime]]] = field(
        default_factory=lambda: defaultdict(list)
    )  # worker_id -> [(start, end), ...]
    
    def get_worker_tasks(self, worker_id: UUID) -> List[UUID]:
        """Get all tasks assigned to worker"""
        return [
            task_id for task_id, assignment in self.assignments.items()
            if assignment.worker_id == worker_id
        ]
    
    def get_task_assignment(self, task_id: UUID) -> Optional[Assignment]:
        """Get assignment for specific task"""
        return self.assignments.get(task_id)
    
    def detect_conflicts(self) -> List[Tuple[UUID, UUID, str]]:
        """
        Detect scheduling conflicts.
        Returns: [(task_a, task_b, conflict_type), ...]
        """
        conflicts = []
        
        for task_id, assignment in self.assignments.items():
            worker_id = assignment.worker_id
            worker_tasks = self.get_worker_tasks(worker_id)
            
            for other_task_id in worker_tasks:
                if other_task_id == task_id:
                    continue
                
                other = self.assignments[other_task_id]
                
                # Check overlap
                if (assignment.expected_start < other.expected_completion and
                    other.expected_start < assignment.expected_completion):
                    conflicts.append((task_id, other_task_id, "time_overlap"))
        
        return conflicts
    
    def calculate_makespan(self) -> Optional[timedelta]:
        """Calculate total schedule duration"""
        if not self.assignments:
            return None
        
        start_times = [a.expected_start for a in self.assignments.values()]
        end_times = [a.expected_completion for a in self.assignments.values()]
        
        if start_times and end_times:
            return max(end_times) - min(start_times)
        return None


@dataclass
class WorkerLoad:
    """Worker load analysis"""
    worker_id: UUID
    current_tasks: int
    max_capacity: int
    utilization_percent: float
    
    assigned_task_ids: List[UUID] = field(default_factory=list)
    upcoming_tasks: List[Tuple[UUID, datetime]] = field(default_factory=list)  # (task_id, start_time)
    
    @property
    def is_overloaded(self) -> bool:
        return self.utilization_percent >= 90.0
    
    @property
    def has_capacity(self) -> bool:
        return self.current_tasks < self.max_capacity
    
    def estimated_free_at(self) -> Optional[datetime]:
        """When worker will have capacity"""
        if self.has_capacity:
            return datetime.now()
        
        if self.upcoming_tasks:
            # Sort by completion time
            sorted_tasks = sorted(self.upcoming_tasks, key=lambda x: x[1])
            # Find when enough tasks complete to free capacity
            for i, (_, completion) in enumerate(sorted_tasks):
                if self.current_tasks - (i + 1) < self.max_capacity:
                    return completion
        
        return None


@dataclass
class AssignmentResult:
    """Result of assignment attempt"""
    success: bool
    assignment: Optional[Assignment]
    
    # If failed
    failure_reason: Optional[str] = None
    alternative_workers: List[Tuple[UUID, float]] = field(default_factory=list)  # (worker_id, score)
    
    # Impact
    worker_load_before: Optional[int] = None
    worker_load_after: Optional[int] = None


@dataclass
class RebalanceResult:
    """Result of workload rebalancing"""
    moves: List[Tuple[UUID, UUID, UUID]] = field(default_factory=list)  # (task_id, from_worker, to_worker)
    improved_balance_score: float = 0.0
    tasks_reassigned: int = 0


# ============================================
# PRODUCTION SCHEDULER
# ============================================

class ProductionScheduler:
    """
    Production task scheduler with workload balancing.
    
    Handles:
    - Skill-based task assignment
    - DAG dependency ordering
    - Workload balancing across workers
    - Overload detection and correction
    - Failed task reassignment
    """
    
    def __init__(
        self,
        strategy: AssignmentStrategy = AssignmentStrategy.BALANCED
    ):
        self.strategy = strategy
        self.workers: Dict[UUID, WorkerProfile] = {}
        self.tasks: Dict[UUID, SchedulableTask] = {}
        self.schedule: Schedule = Schedule()
        
        # Event handlers
        self._on_assign: Optional[Callable[[Assignment], None]] = None
        self._on_overload: Optional[Callable[[WorkerLoad], None]] = None
        self._on_rebalance: Optional[Callable[[RebalanceResult], None]] = None
    
    # ============================================
    # SETUP
    # ============================================
    
    def add_worker(self, worker: WorkerProfile):
        """Register a worker for scheduling"""
        self.workers[worker.id] = worker
    
    def add_workers(self, workers: List[WorkerProfile]):
        """Register multiple workers"""
        for worker in workers:
            self.add_worker(worker)
    
    def add_task(self, task: SchedulableTask):
        """Register a task for scheduling"""
        self.tasks[task.id] = task
    
    def add_tasks(self, tasks: List[SchedulableTask]):
        """Register multiple tasks"""
        for task in tasks:
            self.add_task(task)
    
    def set_strategy(self, strategy: AssignmentStrategy):
        """Change assignment strategy"""
        self.strategy = strategy
    
    def on_assign(self, callback: Callable[[Assignment], None]):
        """Set callback for assignment events"""
        self._on_assign = callback
    
    def on_overload(self, callback: Callable[[WorkerLoad], None]):
        """Set callback for overload detection"""
        self._on_overload = callback
    
    def on_rebalance(self, callback: Callable[[RebalanceResult], None]):
        """Set callback for rebalancing"""
        self._on_rebalance = callback
    
    # ============================================
    # CORE: ASSIGN TASK
    # ============================================
    
    def assign_task(
        self,
        task_id: UUID,
        preferred_worker_id: Optional[UUID] = None,
        force: bool = False
    ) -> AssignmentResult:
        """
        Assign a single task to best available worker.
        
        Args:
            task_id: Task to assign
            preferred_worker_id: Specific worker preference (if available)
            force: Assign even if worker at capacity (admin override)
        
        Returns:
            AssignmentResult
        """
        task = self.tasks.get(task_id)
        if not task:
            return AssignmentResult(
                success=False,
                assignment=None,
                failure_reason=f"Task {task_id} not found"
            )
        
        if task.status != "pending":
            return AssignmentResult(
                success=False,
                assignment=None,
                failure_reason=f"Task status is {task.status}, not pending"
            )
        
        # Find eligible workers
        eligible = self._find_eligible_workers(task)
        
        if not eligible:
            return AssignmentResult(
                success=False,
                assignment=None,
                failure_reason="No eligible workers found (skill mismatch)"
            )
        
        # Check preferred worker
        if preferred_worker_id and preferred_worker_id in [w.id for w in eligible]:
            preferred = self.workers.get(preferred_worker_id)
            if preferred and (preferred.is_available() or force):
                assignment = self._create_assignment(task, preferred)
                if assignment:
                    return self._finalize_assignment(task, assignment)
        
        # Specific worker required
        if task.requirements.required_worker_id:
            required_id = task.requirements.required_worker_id
            if required_id not in [w.id for w in eligible]:
                return AssignmentResult(
                    success=False,
                    assignment=None,
                    failure_reason=f"Required worker {required_id} cannot perform this task"
                )
            
            required_worker = self.workers.get(required_id)
            if required_worker and (required_worker.is_available() or force):
                assignment = self._create_assignment(task, required_worker)
                if assignment:
                    return self._finalize_assignment(task, assignment)
            else:
                return AssignmentResult(
                    success=False,
                    assignment=None,
                    failure_reason=f"Required worker {required_id} is not available"
                )
        
        # Score and rank eligible workers
        scored_workers = self._score_workers_for_task(task, eligible)
        
        if not scored_workers:
            return AssignmentResult(
                success=False,
                assignment=None,
                failure_reason="No workers meet requirements"
            )
        
        # Try to assign to best available worker
        for worker_id, score in scored_workers:
            worker = self.workers.get(worker_id)
            if not worker:
                continue
            
            if worker.is_available() or force:
                assignment = self._create_assignment(task, worker)
                if assignment:
                    return self._finalize_assignment(
                        task, assignment,
                        alternative_workers=scored_workers[:5]
                    )
        
        # No available workers
        available_alternatives = [
            (wid, score) for wid, score in scored_workers
            if self.workers.get(wid) and self.workers[wid].is_available()
        ]
        
        return AssignmentResult(
            success=False,
            assignment=None,
            failure_reason="All eligible workers at capacity",
            alternative_workers=available_alternatives[:5],
            worker_load_before=None
        )
    
    def assign_ready_tasks(
        self,
        completed_task_ids: Set[UUID],
        max_assignments: Optional[int] = None
    ) -> List[AssignmentResult]:
        """
        Assign all tasks that are ready (dependencies satisfied).
        
        Args:
            completed_task_ids: Set of completed task IDs
            max_assignments: Limit number of assignments (optional)
        
        Returns:
            List of assignment results
        """
        # Find ready tasks
        ready_tasks = [
            task for task in self.tasks.values()
            if task.status == "pending" and task.is_ready(completed_task_ids)
        ]
        
        # Sort by priority (highest first), then by critical path
        ready_tasks.sort(
            key=lambda t: (-t.requirements.priority, not t.is_critical_path)
        )
        
        results = []
        assigned_count = 0
        
        for task in ready_tasks:
            if max_assignments and assigned_count >= max_assignments:
                break
            
            result = self.assign_task(task.id)
            results.append(result)
            
            if result.success:
                assigned_count += 1
        
        return results
    
    def assign_all_dag(
        self,
        start_time: Optional[datetime] = None
    ) -> Schedule:
        """
        Assign all tasks in DAG respecting dependencies.
        
        Returns complete schedule.
        """
        start_time = start_time or datetime.now()
        completed: Set[UUID] = set()
        
        while len(completed) < len(self.tasks):
            # Find tasks ready to assign
            ready = [
                task for task in self.tasks.values()
                if task.id not in completed 
                and task.status in ("pending", "assigned")
                and task.is_ready(completed)
            ]
            
            if not ready:
                # Check for deadlock (circular dependency or stuck tasks)
                pending = [
                    task for task in self.tasks.values()
                    if task.id not in completed and task.status == "pending"
                ]
                if pending:
                    # Could not assign all tasks
                    break
                break
            
            # Sort by priority and critical path
            ready.sort(key=lambda t: (-t.requirements.priority, not t.is_critical_path))
            
            # Try to assign each ready task
            for task in ready:
                if task.status == "pending":
                    result = self.assign_task(task.id)
                    if not result.success:
                        # Mark for retry later
                        task.assignment_attempts += 1
            
            # Simulate completion for scheduling purposes
            # In real system, this would wait for actual completion
            for task in ready:
                if task.status == "assigned" and task.id not in completed:
                    completed.add(task.id)
        
        return self.schedule
    
    # ============================================
    # WORKLOAD BALANCING
    # ============================================
    
    def balance_workers(self, threshold: float = 0.8) -> RebalanceResult:
        """
        Rebalance workload across workers.
        
        Moves tasks from overloaded workers to underutilized ones.
        
        Args:
            threshold: Utilization threshold for considering "overloaded"
        
        Returns:
            RebalanceResult with moves made
        """
        result = RebalanceResult()
        
        # Calculate current load
        loads = self._calculate_worker_loads()
        
        # Find overloaded and underutilized workers
        overloaded = [load for load in loads.values() if load.is_overloaded]
        underutilized = [
            load for load in loads.values() 
            if load.has_capacity and load.utilization_percent < 50
        ]
        
        if not overloaded or not underutilized:
            return result
        
        # Sort by severity
        overloaded.sort(key=lambda x: x.utilization_percent, reverse=True)
        underutilized.sort(key=lambda x: x.utilization_percent)
        
        # Try to move tasks
        for over_load in overloaded:
            over_worker = self.workers.get(over_load.worker_id)
            if not over_worker:
                continue
            
            # Get tasks that can be reassigned
            movable = self._find_movable_tasks(over_worker.id)
            
            for task_id in movable:
                if not underutilized:
                    break
                
                task = self.tasks.get(task_id)
                if not task:
                    continue
                
                # Try to assign to underutilized worker
                for under_load in underutilized[:]:
                    under_worker = self.workers.get(under_load.worker_id)
                    if not under_worker:
                        continue
                    
                    # Check skill match
                    if not self._worker_can_do_task(under_worker, task):
                        continue
                    
                    # Move task
                    old_assignment = self.schedule.assignments.get(task_id)
                    if old_assignment:
                        del self.schedule.assignments[task_id]
                    
                    new_assignment = self._create_assignment(task, under_worker)
                    if new_assignment:
                        self._finalize_assignment(task, new_assignment)
                        
                        result.moves.append((
                            task_id, over_worker.id, under_worker.id
                        ))
                        result.tasks_reassigned += 1
                        
                        # Update loads
                        over_load.current_tasks -= 1
                        under_load.current_tasks += 1
                        
                        # Remove from lists if balanced
                        if not over_load.is_overloaded:
                            break
                        if not under_load.has_capacity:
                            underutilized.remove(under_load)
                            break
        
        # Calculate improvement
        if result.tasks_reassigned > 0:
            new_loads = self._calculate_worker_loads()
            old_variance = self._calculate_load_variance(loads)
            new_variance = self._calculate_load_variance(new_loads)
            result.improved_balance_score = old_variance - new_variance
        
        if result.tasks_reassigned > 0 and self._on_rebalance:
            self._on_rebalance(result)
        
        return result
    
    def detect_overload(self, threshold: float = 0.9) -> List[WorkerLoad]:
        """
        Detect overloaded workers.
        
        Args:
            threshold: Utilization threshold (default: 90%)
        
        Returns:
            List of WorkerLoad objects above threshold
        """
        loads = self._calculate_worker_loads()
        
        overloaded = [
            load for load in loads.values()
            if load.utilization_percent >= threshold * 100
        ]
        
        # Notify via callback
        if self._on_overload:
            for load in overloaded:
                self._on_overload(load)
        
        return overloaded
    
    def reassign_failed_tasks(
        self,
        max_retries: int = 3
    ) -> List[AssignmentResult]:
        """
        Retry assignment for tasks that previously failed.
        
        Args:
            max_retries: Maximum retry attempts per task
        
        Returns:
            List of new assignment results
        """
        failed_tasks = [
            task for task in self.tasks.values()
            if task.status == "pending"
            and task.last_failure_reason is not None
            and task.assignment_attempts < max_retries
        ]
        
        results = []
        
        for task in failed_tasks:
            # Try with force=True if multiple failures
            force = task.assignment_attempts >= 2
            
            result = self.assign_task(task.id, force=force)
            results.append(result)
            
            if not result.success:
                task.assignment_attempts += 1
                task.last_failure_reason = result.failure_reason
        
        return results
    
    # ============================================
    # QUERIES & ANALYTICS
    # ============================================
    
    def get_worker_schedule(self, worker_id: UUID) -> List[Tuple[UUID, datetime, datetime]]:
        """
        Get complete schedule for a worker.
        
        Returns:
            List of (task_id, start, end) tuples
        """
        assignments = [
            self.schedule.assignments[tid]
            for tid in self.schedule.get_worker_tasks(worker_id)
        ]
        
        return [
            (a.task_id, a.expected_start, a.expected_completion)
            for a in sorted(assignments, key=lambda x: x.expected_start)
        ]
    
    def get_schedule_stats(self) -> Dict[str, Any]:
        """Get statistics about current schedule"""
        total_tasks = len(self.tasks)
        assigned = len(self.schedule.assignments)
        pending = total_tasks - assigned
        
        # Worker utilization
        loads = self._calculate_worker_loads()
        avg_utilization = sum(l.utilization_percent for l in loads.values()) / len(loads) if loads else 0
        
        # Critical path
        critical_tasks = [t for t in self.tasks.values() if t.is_critical_path]
        critical_assigned = sum(1 for t in critical_tasks if t.id in self.schedule.assignments)
        
        # Makespan
        makespan = self.schedule.calculate_makespan()
        
        return {
            "total_tasks": total_tasks,
            "assigned_tasks": assigned,
            "pending_tasks": pending,
            "assignment_rate": assigned / total_tasks * 100 if total_tasks > 0 else 0,
            "worker_count": len(self.workers),
            "average_utilization": avg_utilization,
            "critical_path_progress": critical_assigned / len(critical_tasks) * 100 if critical_tasks else 0,
            "makespan_minutes": makespan.total_seconds() / 60 if makespan else None,
            "conflicts": len(self.schedule.detect_conflicts())
        }
    
    def find_bottlenecks(self) -> List[Dict[str, Any]]:
        """
        Identify scheduling bottlenecks.
        
        Returns:
            List of bottleneck descriptions
        """
        bottlenecks = []
        
        # Find overloaded workers
        overloaded = self.detect_overload(threshold=0.95)
        for load in overloaded:
            bottlenecks.append({
                "type": "worker_overload",
                "worker_id": load.worker_id,
                "severity": "high" if load.utilization_percent >= 100 else "medium",
                "description": f"Worker {load.worker_id} at {load.utilization_percent:.1f}% capacity"
            })
        
        # Find unassigned critical path tasks
        critical_unassigned = [
            t for t in self.tasks.values()
            if t.is_critical_path and t.id not in self.schedule.assignments
        ]
        
        if critical_unassigned:
            bottlenecks.append({
                "type": "critical_path_blocked",
                "task_count": len(critical_unassigned),
                "severity": "high",
                "description": f"{len(critical_unassigned)} critical tasks unassigned"
            })
        
        # Find skill gaps
        skill_demand = defaultdict(int)
        skill_supply = defaultdict(int)
        
        for task in self.tasks.values():
            if task.status == "pending":
                for skill in task.requirements.required_skills:
                    skill_demand[skill] += 1
        
        for worker in self.workers.values():
            for skill in worker.skills:
                if worker.is_available():
                    skill_supply[skill] += 1
        
        for skill, demand in skill_demand.items():
            supply = skill_supply.get(skill, 0)
            if demand > supply:
                bottlenecks.append({
                    "type": "skill_shortage",
                    "skill": skill,
                    "severity": "high" if demand > supply * 2 else "medium",
                    "description": f"Shortage of '{skill}': {demand} needed, {supply} available"
                })
        
        return bottlenecks
    
    # ============================================
    # PRIVATE HELPERS
    # ============================================
    
    def _find_eligible_workers(self, task: SchedulableTask) -> List[WorkerProfile]:
        """Find workers who can perform this task"""
        eligible = []
        
        for worker in self.workers.values():
            # Check excluded list
            if worker.id in task.requirements.excluded_worker_ids:
                continue
            
            # Check required skills
            if not self._worker_can_do_task(worker, task):
                continue
            
            # Check time constraints
            if task.requirements.must_assign_before:
                if not worker.is_available(task.requirements.must_assign_before):
                    continue
            
            eligible.append(worker)
        
        return eligible
    
    def _worker_can_do_task(self, worker: WorkerProfile, task: SchedulableTask) -> bool:
        """Check if worker has all required skills at minimum level"""
        for skill_code, required_level in task.requirements.required_skills.items():
            if worker.get_skill_level(skill_code) < required_level:
                return False
        return True
    
    def _score_workers_for_task(
        self,
        task: SchedulableTask,
        workers: List[WorkerProfile]
    ) -> List[Tuple[UUID, float]]:
        """
        Score workers for task assignment.
        Returns sorted list of (worker_id, score).
        """
        scores = []
        
        for worker in workers:
            # Skill match score
            skill_score = worker.calculate_skill_score(task.requirements.required_skills)
            
            # Workload score (lower is better, so invert)
            workload_score = 100 - worker.calculate_workload_score()
            
            # Priority boost for urgent tasks
            priority_score = task.requirements.priority * 10
            
            # Calculate total based on strategy
            if self.strategy == AssignmentStrategy.SKILL_FIRST:
                total = skill_score * 0.7 + workload_score * 0.2 + priority_score * 0.1
            elif self.strategy == AssignmentStrategy.BALANCED:
                total = skill_score * 0.4 + workload_score * 0.4 + priority_score * 0.2
            elif self.strategy == AssignmentStrategy.FASTEST:
                # Prefer high skill for speed
                total = skill_score * 0.6 + workload_score * 0.1 + priority_score * 0.3
            elif self.strategy == AssignmentStrategy.CHEAPEST:
                # Rate-based scoring
                rate_score = 100 - (worker.hourly_rate / Decimal('100') * 10)
                total = rate_score * 0.5 + skill_score * 0.3 + workload_score * 0.2
            else:
                total = skill_score * 0.5 + workload_score * 0.3 + priority_score * 0.2
            
            scores.append((worker.id, total))
        
        # Sort by score descending
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores
    
    def _create_assignment(
        self,
        task: SchedulableTask,
        worker: WorkerProfile
    ) -> Optional[Assignment]:
        """Create assignment object"""
        now = datetime.now()
        
        # Calculate expected timing
        duration = timedelta(minutes=task.requirements.estimated_duration_minutes)
        
        # Adjust duration based on worker skill (better workers = faster)
        skill_avg = sum(
            worker.get_skill_level(s) for s in task.requirements.required_skills
        ) / len(task.requirements.required_skills) if task.requirements.required_skills else 3
        
        # Efficiency multiplier: 0.8 (high skill) to 1.3 (low skill)
        efficiency = 1.5 - (skill_avg / 5) * 0.7
        adjusted_duration = duration * efficiency / worker.efficiency_rating
        
        expected_completion = now + adjusted_duration
        
        # Calculate component scores
        skill_score = worker.calculate_skill_score(task.requirements.required_skills)
        workload_score = worker.calculate_workload_score()
        priority_score = task.requirements.priority * 10
        
        if self.strategy == AssignmentStrategy.SKILL_FIRST:
            total_score = skill_score * 0.7 + (100 - workload_score) * 0.2 + priority_score * 0.1
        else:
            total_score = skill_score * 0.4 + (100 - workload_score) * 0.4 + priority_score * 0.2
        
        return Assignment(
            task_id=task.id,
            worker_id=worker.id,
            assigned_at=now,
            skill_score=skill_score,
            workload_score=workload_score,
            priority_score=priority_score,
            total_score=total_score,
            expected_start=now,
            expected_completion=expected_completion,
            assignment_reason=f"Strategy: {self.strategy.value}"
        )
    
    def _finalize_assignment(
        self,
        task: SchedulableTask,
        assignment: Assignment,
        alternative_workers: Optional[List[Tuple[UUID, float]]] = None
    ) -> AssignmentResult:
        """Finalize assignment and update state"""
        # Update task
        task.status = "assigned"
        task.assigned_worker_id = assignment.worker_id
        task.assigned_at = assignment.assigned_at
        task.expected_completion = assignment.expected_completion
        
        # Update worker
        worker = self.workers.get(assignment.worker_id)
        load_before = worker.current_load if worker else 0
        
        if worker:
            worker.current_load += 1
            if worker.current_load >= worker.max_concurrent_tasks:
                worker.status = WorkerStatus.BUSY
        
        # Add to schedule
        self.schedule.assignments[task.id] = assignment
        self.schedule.worker_schedules[assignment.worker_id].append(
            (assignment.expected_start, assignment.expected_completion)
        )
        
        # Emit event
        if self._on_assign:
            self._on_assign(assignment)
        
        return AssignmentResult(
            success=True,
            assignment=assignment,
            alternative_workers=alternative_workers or [],
            worker_load_before=load_before,
            worker_load_after=load_before + 1 if worker else None
        )
    
    def _calculate_worker_loads(self) -> Dict[UUID, WorkerLoad]:
        """Calculate current load for all workers"""
        loads = {}
        
        for worker_id, worker in self.workers.items():
            assigned_tasks = self.schedule.get_worker_tasks(worker_id)
            
            # Get upcoming task times
            upcoming = []
            for task_id in assigned_tasks:
                task = self.tasks.get(task_id)
                assignment = self.schedule.get_task_assignment(task_id)
                if task and assignment:
                    upcoming.append((task_id, assignment.expected_completion))
            
            utilization = (
                worker.current_load / worker.max_concurrent_tasks * 100
                if worker.max_concurrent_tasks > 0 else 0
            )
            
            loads[worker_id] = WorkerLoad(
                worker_id=worker_id,
                current_tasks=worker.current_load,
                max_capacity=worker.max_concurrent_tasks,
                utilization_percent=utilization,
                assigned_task_ids=assigned_tasks,
                upcoming_tasks=sorted(upcoming, key=lambda x: x[1])
            )
        
        return loads
    
    def _find_movable_tasks(self, worker_id: UUID) -> List[UUID]:
        """Find tasks that can be reassigned from worker"""
        movable = []
        
        for task_id in self.schedule.get_worker_tasks(worker_id):
            task = self.tasks.get(task_id)
            if not task:
                continue
            
            # Cannot move if already started
            if task.status not in ("pending", "assigned"):
                continue
            
            # Cannot move if critical path and assigned to best worker
            if task.is_critical_path:
                # Check if this is the best worker for critical task
                current_worker = self.workers.get(worker_id)
                if current_worker:
                    score = current_worker.calculate_skill_score(task.requirements.required_skills)
                    if score >= 80:  # Best worker, don't move
                        continue
            
            movable.append(task_id)
        
        return movable
    
    def _calculate_load_variance(self, loads: Dict[UUID, WorkerLoad]) -> float:
        """Calculate variance in worker utilization"""
        if not loads:
            return 0.0
        
        utilizations = [l.utilization_percent for l in loads.values()]
        mean = sum(utilizations) / len(utilizations)
        variance = sum((u - mean) ** 2 for u in utilizations) / len(utilizations)
        
        return variance


# ============================================
# SHIFT SCHEDULER
# ============================================

class ShiftScheduler:
    """
    Schedules workers into shifts.
    Optimizes shift composition based on skill requirements.
    """
    
    def __init__(self):
        self.shifts: List[Shift] = []
    
    def create_shift(
        self,
        shift_id: UUID,
        start_time: datetime,
        duration_hours: int,
        required_skills: Dict[str, int],
        min_workers: int,
        max_workers: int
    ) -> 'Shift':
        """Create new shift with requirements"""
        shift = Shift(
            id=shift_id,
            start_time=start_time,
            duration_hours=duration_hours,
            required_skills=required_skills,
            min_workers=min_workers,
            max_workers=max_workers
        )
        self.shifts.append(shift)
        return shift
    
    def assign_workers_to_shift(
        self,
        shift: Shift,
        available_workers: List[WorkerProfile]
    ) -> List[UUID]:
        """
        Assign workers to shift to meet requirements.
        
        Returns:
            List of assigned worker IDs
        """
        assigned = []
        
        # Score workers for this shift
        scored = []
        for worker in available_workers:
            score = 0
            for skill, min_level in shift.required_skills.items():
                worker_level = worker.get_skill_level(skill)
                if worker_level >= min_level:
                    score += worker_level * 10
            
            # Prefer workers who need hours
            if worker.current_load < worker.max_concurrent_tasks:
                score += 20
            
            scored.append((worker, score))
        
        # Sort by score
        scored.sort(key=lambda x: x[1], reverse=True)
        
        # Assign up to max_workers
        for worker, score in scored:
            if len(assigned) >= shift.max_workers:
                break
            
            # Check if worker already assigned to overlapping shift
            if self._has_overlap(worker.id, shift):
                continue
            
            assigned.append(worker.id)
        
        # Validate minimum
        if len(assigned) < shift.min_workers:
            # Could not meet requirements
            pass
        
        shift.assigned_workers = assigned
        return assigned
    
    def _has_overlap(self, worker_id: UUID, new_shift: Shift) -> bool:
        """Check if worker has overlapping shift"""
        for shift in self.shifts:
            if worker_id in shift.assigned_workers:
                if shift.overlaps_with(new_shift):
                    return True
        return False
    
    def get_shift_coverage(self, shift_id: UUID) -> Dict[str, Any]:
        """Analyze skill coverage for a shift"""
        shift = next((s for s in self.shifts if s.id == shift_id), None)
        if not shift:
            return {}
        
        coverage = {}
        for skill, required in shift.required_skills.items():
            actual = sum(
                1 for wid in shift.assigned_workers
                if wid in [w.id for w in self._get_workers()]
                and self._get_worker(wid).get_skill_level(skill) >= required
            )
            coverage[skill] = {
                "required": required,
                "actual": actual,
                "satisfied": actual >= required
            }
        
        return coverage
    
    def _get_workers(self) -> List[WorkerProfile]:
        """Get all workers (placeholder)"""
        return []
    
    def _get_worker(self, worker_id: UUID) -> Optional[WorkerProfile]:
        """Get worker by ID (placeholder)"""
        return None


@dataclass
class Shift:
    """Work shift definition"""
    id: UUID
    start_time: datetime
    duration_hours: int
    
    required_skills: Dict[str, int]
    min_workers: int
    max_workers: int
    
    assigned_workers: List[UUID] = field(default_factory=list)
    
    @property
    def end_time(self) -> datetime:
        return self.start_time + timedelta(hours=self.duration_hours)
    
    def overlaps_with(self, other: Shift) -> bool:
        """Check if shifts overlap"""
        return (
            self.start_time < other.end_time and
            other.start_time < self.end_time
        )


# ============================================
# EXAMPLE USAGE
# ============================================

def example_usage():
    """Example of using the production scheduler"""
    
    # Create scheduler
    scheduler = ProductionScheduler(strategy=AssignmentStrategy.BALANCED)
    
    # Add workers with skills
    workers = [
        WorkerProfile(
            id=uuid4(),
            name="Alice",
            skills={"sewing": 5, "ironing": 4, "quality_check": 3},
            primary_skill="sewing",
            max_concurrent_tasks=2,
            hourly_rate=Decimal("1500")
        ),
        WorkerProfile(
            id=uuid4(),
            name="Bob",
            skills={"cutting": 4, "sewing": 3},
            primary_skill="cutting",
            max_concurrent_tasks=3,
            hourly_rate=Decimal("1200")
        ),
        WorkerProfile(
            id=uuid4(),
            name="Carol",
            skills={"quality_check": 5, "packaging": 3},
            primary_skill="quality_check",
            max_concurrent_tasks=2,
            hourly_rate=Decimal("1400")
        )
    ]
    scheduler.add_workers(workers)
    
    # Add tasks with dependencies (DAG)
    task1 = SchedulableTask(
        id=uuid4(),
        name="Cut Fabric",
        operation_type="cutting",
        requirements=TaskRequirements(
            required_skills={"cutting": 3},
            estimated_duration_minutes=30,
            priority=3
        )
    )
    
    task2 = SchedulableTask(
        id=uuid4(),
        name="Sew Curtains",
        operation_type="sewing",
        requirements=TaskRequirements(
            required_skills={"sewing": 4},
            estimated_duration_minutes=120,
            priority=5
        ),
        depends_on={task1.id},
        is_critical_path=True
    )
    
    task3 = SchedulableTask(
        id=uuid4(),
        name="Quality Check",
        operation_type="quality_check",
        requirements=TaskRequirements(
            required_skills={"quality_check": 4},
            estimated_duration_minutes=15,
            priority=4
        ),
        depends_on={task2.id}
    )
    
    scheduler.add_tasks([task1, task2, task3])
    
    # Set up event handlers
    def on_assign(assignment):
        print(f"Assigned {assignment.task_id} to {assignment.worker_id}")
    
    def on_overload(load):
        print(f"⚠️ Worker {load.worker_id} overloaded: {load.utilization_percent}%")
    
    scheduler.on_assign(on_assign)
    scheduler.on_overload(on_overload)
    
    # Assign tasks respecting DAG
    completed = set()
    
    # Assign ready tasks
    results = scheduler.assign_ready_tasks(completed)
    for result in results:
        if result.success:
            completed.add(result.assignment.task_id)
    
    # Check stats
    stats = scheduler.get_schedule_stats()
    print(f"\nSchedule stats: {stats}")
    
    # Detect overloads
    overloaded = scheduler.detect_overload()
    if overloaded:
        print(f"\nOverloaded workers: {len(overloaded)}")
        
        # Rebalance
        rebalance_result = scheduler.balance_workers()
        print(f"Rebalanced {rebalance_result.tasks_reassigned} tasks")
    
    # Find bottlenecks
    bottlenecks = scheduler.find_bottlenecks()
    print(f"\nBottlenecks: {len(bottlenecks)}")
    for b in bottlenecks:
        print(f"  - {b['type']}: {b['description']}")
    
    return scheduler


if __name__ == "__main__":
    example_usage()

"""
Task Generator Service
Converts ProductTemplate into DAG of executable tasks
Handles dependency resolution, skill matching, and time estimation
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional, Tuple, Any, Iterator
from uuid import UUID, uuid4
from enum import Enum, auto
from decimal import Decimal
from datetime import timedelta
from collections import deque
import heapq


# ============================================
# DOMAIN MODELS (Value Objects)
# ============================================

class OperationType(Enum):
    """Types of manufacturing operations"""
    MEASUREMENT = auto()      # Замер
    CUTTING = auto()          # Раскрой
    SEWING = auto()           # Пошив
    IRONING = auto()          # Утюжка
    QUALITY_CHECK = auto()   # Контроль качества
    PACKAGING = auto()        # Упаковка
    INSTALLATION = auto()     # Установка


class SkillLevel(Enum):
    """Worker skill levels"""
    JUNIOR = 1
    MIDDLE = 2
    SENIOR = 3
    EXPERT = 4


@dataclass(frozen=True)
class SkillRequirement:
    """Skill required for operation"""
    skill_code: str           # e.g., 'sewing', 'cutting', 'installation'
    min_level: SkillLevel
    preferred_level: SkillLevel
    
    def matches(self, worker_skills: List[WorkerSkill]) -> bool:
        """Check if worker meets minimum requirement"""
        for ws in worker_skills:
            if ws.skill_code == self.skill_code and ws.level.value >= self.min_level.value:
                return True
        return False
    
    def match_score(self, worker_skills: List[WorkerSkill]) -> int:
        """Calculate match score (higher = better)"""
        for ws in worker_skills:
            if ws.skill_code == self.skill_code:
                # Score based on level difference
                level_diff = ws.level.value - self.min_level.value
                if level_diff >= 0:
                    return 10 + level_diff * 5  # Base 10 + bonus for higher skill
        return 0


@dataclass(frozen=True)
class WorkerSkill:
    """Worker's skill"""
    skill_code: str
    level: SkillLevel
    years_experience: float = 0.0


@dataclass
class Worker:
    """Worker entity for assignment"""
    id: UUID
    name: str
    skills: List[WorkerSkill]
    current_load: int = 0     # Number of active tasks
    max_capacity: int = 5     # Max concurrent tasks
    hourly_rate: Decimal = Decimal('0')
    
    def is_available(self) -> bool:
        return self.current_load < self.max_capacity
    
    def has_skill(self, requirement: SkillRequirement) -> bool:
        return requirement.matches(self.skills)
    
    def skill_score(self, requirement: SkillRequirement) -> int:
        return requirement.match_score(self.skills)


@dataclass
class OperationTemplate:
    """Template for a manufacturing operation"""
    id: UUID
    name: str
    operation_type: OperationType
    code: str                    # Unique code like "CUT-001"
    
    # Time estimation
    base_time_minutes: int       # Base time without complexity
    time_per_meter: float = 0.0  # Additional time per fabric meter
    time_per_window: float = 0.0 # Additional time per window
    
    # Skill requirements
    required_skills: List[SkillRequirement] = field(default_factory=list)
    
    # Dependencies (operation codes that must complete before this)
    depends_on: List[str] = field(default_factory=list)
    
    # Parallel execution settings
    max_parallel: int = 1        # How many can run in parallel
    
    def estimate_time(
        self,
        fabric_meters: float = 0,
        window_count: int = 1,
        complexity_multiplier: float = 1.0
    ) -> int:
        """Estimate operation time in minutes"""
        time = self.base_time_minutes
        time += self.time_per_meter * fabric_meters
        time += self.time_per_window * window_count
        time *= complexity_multiplier
        return int(time)


@dataclass
class ProductTemplate:
    """Template for manufacturing a product (e.g., "Curtain Set Type A")"""
    id: UUID
    name: str
    code: str
    description: str
    
    # Operations in this product
    operations: List[OperationTemplate] = field(default_factory=list)
    
    # Default complexity
    default_complexity: str = "medium"  # simple, medium, complex, premium
    
    # Complexity multipliers for time estimation
    complexity_multipliers: Dict[str, float] = field(default_factory=lambda: {
        "simple": 0.8,
        "medium": 1.0,
        "complex": 1.5,
        "premium": 2.0
    })


@dataclass
class GeneratedTask:
    """Generated task ready for assignment"""
    id: UUID
    template_id: UUID
    name: str
    operation_type: OperationType
    code: str
    
    # Execution
    estimated_minutes: int
    complexity: str
    
    # Dependencies (task IDs that must complete before this)
    depends_on: List[UUID] = field(default_factory=list)
    
    # Assignment
    required_skills: List[SkillRequirement] = field(default_factory=list)
    assigned_worker_id: Optional[UUID] = None
    
    # Scheduling
    earliest_start: Optional[int] = None   # Minutes from order start
    latest_start: Optional[int] = None     # Critical path calculation
    
    # Status tracking
    is_critical_path: bool = False
    
    def __hash__(self):
        return hash(self.id)
    
    def __eq__(self, other):
        if isinstance(other, GeneratedTask):
            return self.id == other.id
        return False


@dataclass
class TaskDAG:
    """Directed Acyclic Graph of tasks"""
    tasks: Dict[UUID, GeneratedTask] = field(default_factory=dict)
    edges: Dict[UUID, Set[UUID]] = field(default_factory=dict)  # task_id -> {dependent_task_ids}
    
    def add_task(self, task: GeneratedTask):
        """Add task to DAG"""
        self.tasks[task.id] = task
        if task.id not in self.edges:
            self.edges[task.id] = set()
    
    def add_dependency(self, from_task_id: UUID, to_task_id: UUID):
        """Add edge: from_task must complete before to_task"""
        if from_task_id in self.edges:
            self.edges[from_task_id].add(to_task_id)
    
    def get_dependencies(self, task_id: UUID) -> Set[UUID]:
        """Get task IDs that must complete before this task"""
        task = self.tasks.get(task_id)
        if task:
            return set(task.depends_on)
        return set()
    
    def get_dependents(self, task_id: UUID) -> Set[UUID]:
        """Get task IDs that depend on this task"""
        return self.edges.get(task_id, set())
    
    def topological_sort(self) -> List[UUID]:
        """
        Topological sort of tasks.
        Returns task IDs in execution order.
        """
        # Kahn's algorithm
        in_degree = {task_id: 0 for task_id in self.tasks}
        
        # Calculate in-degrees
        for task_id, dependents in self.edges.items():
            for dependent in dependents:
                if dependent in in_degree:
                    in_degree[dependent] += 1
        
        # Start with tasks that have no dependencies
        queue = deque([tid for tid, degree in in_degree.items() if degree == 0])
        result = []
        
        while queue:
            current = queue.popleft()
            result.append(current)
            
            # Reduce in-degree for dependents
            for dependent in self.edges.get(current, set()):
                in_degree[dependent] -= 1
                if in_degree[dependent] == 0:
                    queue.append(dependent)
        
        # Check for cycles
        if len(result) != len(self.tasks):
            raise ValueError("Cycle detected in task DAG")
        
        return result
    
    def calculate_critical_path(self) -> List[UUID]:
        """
        Calculate critical path (longest path through DAG).
        Tasks on critical path have zero slack.
        """
        # Forward pass: calculate earliest start/finish
        earliest_start = {tid: 0 for tid in self.tasks}
        earliest_finish = {}
        
        sorted_tasks = self.topological_sort()
        
        for task_id in sorted_tasks:
            task = self.tasks[task_id]
            # Earliest start is max of dependencies' finish times
            deps = self.get_dependencies(task_id)
            if deps:
                earliest_start[task_id] = max(
                    earliest_finish.get(dep, 0) for dep in deps
                )
            
            earliest_finish[task_id] = earliest_start[task_id] + task.estimated_minutes
        
        # Backward pass: calculate latest start/finish
        project_duration = max(earliest_finish.values()) if earliest_finish else 0
        
        latest_finish = {tid: project_duration for tid in self.tasks}
        latest_start = {}
        
        for task_id in reversed(sorted_tasks):
            task = self.tasks[task_id]
            latest_start[task_id] = latest_finish[task_id] - task.estimated_minutes
            
            # Update dependents
            for dependent in self.get_dependents(task_id):
                latest_finish[task_id] = min(
                    latest_finish[task_id],
                    latest_start.get(dependent, project_duration)
                )
        
        # Calculate slack and identify critical path
        critical_path = []
        for task_id in self.tasks:
            slack = latest_start[task_id] - earliest_start[task_id]
            task = self.tasks[task_id]
            task.earliest_start = earliest_start[task_id]
            task.latest_start = latest_start[task_id]
            
            if slack == 0:
                task.is_critical_path = True
                critical_path.append(task_id)
        
        return critical_path
    
    def get_parallel_groups(self) -> List[Set[UUID]]:
        """
        Group tasks that can be executed in parallel.
        Returns list of task ID sets that have no dependencies between them.
        """
        sorted_ids = self.topological_sort()
        groups = []
        current_group = set()
        completed = set()
        
        for task_id in sorted_ids:
            # Check if all dependencies are in completed set
            deps = self.get_dependencies(task_id)
            if deps.issubset(completed):
                current_group.add(task_id)
            else:
                # Start new group
                if current_group:
                    groups.append(current_group)
                    completed.update(current_group)
                current_group = {task_id}
        
        if current_group:
            groups.append(current_group)
        
        return groups
    
    def get_ready_tasks(self, completed_task_ids: Set[UUID]) -> Set[UUID]:
        """
        Get tasks that are ready to execute
        (all dependencies satisfied but not yet completed).
        """
        ready = set()
        for task_id, task in self.tasks.items():
            if task_id in completed_task_ids:
                continue
            deps = set(task.depends_on)
            if deps.issubset(completed_task_ids):
                ready.add(task_id)
        return ready


@dataclass
class AssignmentResult:
    """Result of task assignment"""
    task_id: UUID
    worker_id: Optional[UUID]
    assignment_score: int
    reason: str  # "assigned", "no_available_workers", "skill_mismatch"


@dataclass
class GenerationResult:
    """Result of task generation"""
    dag: TaskDAG
    tasks: List[GeneratedTask]
    total_estimated_minutes: int
    critical_path_length: int
    assignments: List[AssignmentResult]
    
    def get_tasks_by_worker(self, worker_id: UUID) -> List[GeneratedTask]:
        """Get all tasks assigned to specific worker"""
        return [
            self.dag.tasks[tid] for tid in self.dag.tasks
            if self.dag.tasks[tid].assigned_worker_id == worker_id
        ]
    
    def get_critical_path_tasks(self) -> List[GeneratedTask]:
        """Get tasks on critical path"""
        return [t for t in self.dag.tasks.values() if t.is_critical_path]


# ============================================
# TASK GENERATOR SERVICE
# ============================================

class TaskGenerator:
    """
    Generates task DAG from ProductTemplate.
    Handles dependency resolution, time estimation, and worker assignment.
    """
    
    def __init__(self):
        self._operation_index: Dict[str, OperationTemplate] = {}
    
    def generate(
        self,
        product_template: ProductTemplate,
        order_context: Dict[str, Any],
        available_workers: List[Worker],
        complexity_override: Optional[str] = None
    ) -> GenerationResult:
        """
        Generate tasks from product template.
        
        Args:
            product_template: Template with operations
            order_context: Context for estimation (fabric_meters, window_count, etc.)
            available_workers: List of workers for assignment
            complexity_override: Override template complexity
        
        Returns:
            GenerationResult with DAG and assignments
        """
        # Build operation index for dependency lookup
        self._operation_index = {
            op.code: op for op in product_template.operations
        }
        
        # Determine complexity
        complexity = complexity_override or product_template.default_complexity
        complexity_mult = product_template.complexity_multipliers.get(complexity, 1.0)
        
        # Create DAG
        dag = TaskDAG()
        
        # Generate tasks from operations
        for operation in product_template.operations:
            task = self._create_task(
                operation=operation,
                complexity=complexity,
                complexity_multiplier=complexity_mult,
                order_context=order_context
            )
            dag.add_task(task)
        
        # Build dependency graph
        self._build_dependencies(dag, product_template)
        
        # Validate DAG (no cycles)
        try:
            execution_order = dag.topological_sort()
        except ValueError as e:
            raise ValueError(f"Invalid product template: {e}")
        
        # Calculate critical path
        critical_path = dag.calculate_critical_path()
        
        # Assign workers
        assignments = self._assign_workers(dag, available_workers)
        
        # Calculate totals
        total_time = sum(t.estimated_minutes for t in dag.tasks.values())
        critical_time = sum(
            dag.tasks[tid].estimated_minutes for tid in critical_path
        )
        
        # Sort tasks by execution order
        sorted_tasks = [dag.tasks[tid] for tid in execution_order]
        
        return GenerationResult(
            dag=dag,
            tasks=sorted_tasks,
            total_estimated_minutes=total_time,
            critical_path_length=critical_time,
            assignments=assignments
        )
    
    def _create_task(
        self,
        operation: OperationTemplate,
        complexity: str,
        complexity_multiplier: float,
        order_context: Dict[str, Any]
    ) -> GeneratedTask:
        """Create GeneratedTask from OperationTemplate"""
        
        # Extract context
        fabric_meters = order_context.get('fabric_meters', 0)
        window_count = order_context.get('window_count', 1)
        
        # Estimate time
        estimated_minutes = operation.estimate_time(
            fabric_meters=fabric_meters,
            window_count=window_count,
            complexity_multiplier=complexity_multiplier
        )
        
        return GeneratedTask(
            id=uuid4(),
            template_id=operation.id,
            name=operation.name,
            operation_type=operation.operation_type,
            code=operation.code,
            estimated_minutes=estimated_minutes,
            complexity=complexity,
            required_skills=operation.required_skills.copy(),
            depends_on=[]  # Will be populated later
        )
    
    def _build_dependencies(self, dag: TaskDAG, template: ProductTemplate):
        """Build dependency edges between tasks"""
        
        # Map operation codes to task IDs
        code_to_task_id: Dict[str, UUID] = {}
        for task_id, task in dag.tasks.items():
            code_to_task_id[task.code] = task_id
        
        # Add dependencies
        for task_id, task in dag.tasks.items():
            operation = self._operation_index.get(task.code)
            if not operation:
                continue
            
            # Add explicit dependencies
            for dep_code in operation.depends_on:
                dep_task_id = code_to_task_id.get(dep_code)
                if dep_task_id:
                    task.depends_on.append(dep_task_id)
                    dag.add_dependency(dep_task_id, task_id)
            
            # Add implicit dependencies based on operation type
            self._add_implicit_dependencies(dag, task, operation, code_to_task_id)
    
    def _add_implicit_dependencies(
        self,
        dag: TaskDAG,
        task: GeneratedTask,
        operation: OperationTemplate,
        code_to_task_id: Dict[str, UUID]
    ):
        """Add implicit dependencies based on operation type logic"""
        
        # Cutting must happen before sewing
        if operation.operation_type == OperationType.SEWING:
            # Find cutting operations
            for other_id, other in dag.tasks.items():
                if other.operation_type == OperationType.CUTTING:
                    if other_id not in task.depends_on:
                        task.depends_on.append(other_id)
                        dag.add_dependency(other_id, task.id)
        
        # Sewing must happen before ironing
        if operation.operation_type == OperationType.IRONING:
            for other_id, other in dag.tasks.items():
                if other.operation_type == OperationType.SEWING:
                    if other_id not in task.depends_on:
                        task.depends_on.append(other_id)
                        dag.add_dependency(other_id, task.id)
        
        # Ironing must happen before quality check
        if operation.operation_type == OperationType.QUALITY_CHECK:
            for other_id, other in dag.tasks.items():
                if other.operation_type == OperationType.IRONING:
                    if other_id not in task.depends_on:
                        task.depends_on.append(other_id)
                        dag.add_dependency(other_id, task.id)
        
        # Quality check must happen before packaging
        if operation.operation_type == OperationType.PACKAGING:
            for other_id, other in dag.tasks.items():
                if other.operation_type == OperationType.QUALITY_CHECK:
                    if other_id not in task.depends_on:
                        task.depends_on.append(other_id)
                        dag.add_dependency(other_id, task.id)
    
    def _assign_workers(
        self,
        dag: TaskDAG,
        available_workers: List[Worker]
    ) -> List[AssignmentResult]:
        """
        Assign workers to tasks based on skills and availability.
        Uses greedy algorithm with skill scoring.
        """
        assignments = []
        
        # Sort tasks by critical path priority, then by start time
        task_list = sorted(
            dag.tasks.values(),
            key=lambda t: (not t.is_critical_path, t.earliest_start or 0)
        )
        
        for task in task_list:
            assignment = self._find_best_worker(task, available_workers)
            assignments.append(assignment)
            
            if assignment.worker_id:
                task.assigned_worker_id = assignment.worker_id
                # Update worker load
                for worker in available_workers:
                    if worker.id == assignment.worker_id:
                        worker.current_load += 1
                        break
        
        return assignments
    
    def _find_best_worker(
        self,
        task: GeneratedTask,
        workers: List[Worker]
    ) -> AssignmentResult:
        """Find best matching worker for task"""
        
        # Filter available workers with required skills
        candidates = []
        for worker in workers:
            if not worker.is_available():
                continue
            
            # Check all skill requirements
            skill_match = all(
                req.matches(worker.skills) for req in task.required_skills
            )
            
            if skill_match:
                # Calculate score
                score = sum(
                    req.match_score(worker.skills) for req in task.required_skills
                )
                # Bonus for less loaded workers
                score += (worker.max_capacity - worker.current_load) * 2
                candidates.append((worker, score))
        
        if not candidates:
            # No matching worker
            if not any(worker.is_available() for worker in workers):
                return AssignmentResult(
                    task_id=task.id,
                    worker_id=None,
                    assignment_score=0,
                    reason="no_available_workers"
                )
            else:
                return AssignmentResult(
                    task_id=task.id,
                    worker_id=None,
                    assignment_score=0,
                    reason="skill_mismatch"
                )
        
        # Select best candidate
        best_worker, best_score = max(candidates, key=lambda x: x[1])
        
        return AssignmentResult(
            task_id=task.id,
            worker_id=best_worker.id,
            assignment_score=best_score,
            reason="assigned"
        )
    
    def optimize_assignments(
        self,
        dag: TaskDAG,
        workers: List[Worker],
        strategy: str = "balanced"
    ) -> List[AssignmentResult]:
        """
        Optimize worker assignments with different strategies.
        
        Strategies:
        - "fastest": Minimize total duration (assign to most skilled)
        - "balanced": Balance workload across workers
        - "cheapest": Minimize cost (assign to lowest rate)
        """
        if strategy == "fastest":
            return self._assign_fastest(dag, workers)
        elif strategy == "balanced":
            return self._assign_balanced(dag, workers)
        elif strategy == "cheapest":
            return self._assign_cheapest(dag, workers)
        else:
            return self._assign_workers(dag, workers)
    
    def _assign_fastest(
        self,
        dag: TaskDAG,
        workers: List[Worker]
    ) -> List[AssignmentResult]:
        """Assign to most skilled workers for speed"""
        # Sort by skill level (descending)
        sorted_workers = sorted(
            workers,
            key=lambda w: max((s.level.value for s in w.skills), default=0),
            reverse=True
        )
        return self._assign_workers(dag, sorted_workers)
    
    def _assign_balanced(
        self,
        dag: TaskDAG,
        workers: List[Worker]
    ) -> List[AssignmentResult]:
        """Balance load across workers"""
        # Reset loads for calculation
        for worker in workers:
            worker.current_load = 0
        
        # Greedily assign to least loaded suitable worker
        assignments = []
        task_list = sorted(
            dag.tasks.values(),
            key=lambda t: (not t.is_critical_path, t.earliest_start or 0)
        )
        
        for task in task_list:
            # Find suitable workers sorted by load
            suitable = [
                w for w in workers
                if w.is_available() and all(
                    req.matches(w.skills) for req in task.required_skills
                )
            ]
            
            if not suitable:
                assignments.append(AssignmentResult(
                    task_id=task.id,
                    worker_id=None,
                    assignment_score=0,
                    reason="no_suitable_worker"
                ))
                continue
            
            # Pick least loaded
            best = min(suitable, key=lambda w: w.current_load)
            best.current_load += 1
            task.assigned_worker_id = best.id
            
            assignments.append(AssignmentResult(
                task_id=task.id,
                worker_id=best.id,
                assignment_score=100 - best.current_load,
                reason="assigned"
            ))
        
        return assignments
    
    def _assign_cheapest(
        self,
        dag: TaskDAG,
        workers: List[Worker]
    ) -> List[AssignmentResult]:
        """Assign to cheapest capable workers"""
        # Sort by hourly rate
        sorted_workers = sorted(workers, key=lambda w: w.hourly_rate)
        return self._assign_workers(dag, sorted_workers)


# ============================================
# SCHEDULING UTILITIES
# ============================================

class TaskScheduler:
    """
    Schedule tasks with resource constraints.
    Handles worker availability and shift times.
    """
    
    def __init__(self, dag: TaskDAG, workers: List[Worker]):
        self.dag = dag
        self.workers = {w.id: w for w in workers}
    
    def calculate_schedule(
        self,
        start_time: int = 0,  # Minutes from reference
        worker_shifts: Optional[Dict[UUID, List[Tuple[int, int]]]] = None
    ) -> Dict[UUID, Tuple[int, int]]:
        """
        Calculate task start/end times considering worker shifts.
        
        Args:
            start_time: Start time offset in minutes
            worker_shifts: Dict of worker_id -> [(start_min, end_min), ...]
        
        Returns:
            Dict of task_id -> (start_min, end_min)
        """
        schedule = {}
        task_completion = {}
        
        # Get execution order
        sorted_tasks = self.dag.topological_sort()
        
        for task_id in sorted_tasks:
            task = self.dag.tasks[task_id]
            worker_id = task.assigned_worker_id
            
            # Calculate earliest start based on dependencies
            deps = self.dag.get_dependencies(task_id)
            earliest = start_time
            for dep_id in deps:
                if dep_id in task_completion:
                    earliest = max(earliest, task_completion[dep_id])
            
            # Adjust for worker shift if specified
            if worker_shifts and worker_id in worker_shifts:
                earliest = self._adjust_for_shift(
                    earliest, task.estimated_minutes,
                    worker_shifts[worker_id]
                )
            
            end_time = earliest + task.estimated_minutes
            schedule[task_id] = (earliest, end_time)
            task_completion[task_id] = end_time
        
        return schedule
    
    def _adjust_for_shift(
        self,
        desired_start: int,
        duration: int,
        shifts: List[Tuple[int, int]]
    ) -> int:
        """Adjust start time to fit within worker shifts"""
        # Simple implementation: find first shift that can accommodate
        for shift_start, shift_end in sorted(shifts):
            if desired_start < shift_start:
                desired_start = shift_start
            
            if desired_start + duration <= shift_end:
                return desired_start
        
        # No suitable shift found, return original (will need handling)
        return desired_start
    
    def detect_conflicts(
        self,
        schedule: Dict[UUID, Tuple[int, int]]
    ) -> List[Tuple[UUID, UUID, str]]:
        """
        Detect scheduling conflicts.
        Returns list of (task_a, task_b, conflict_type).
        """
        conflicts = []
        
        # Group by worker
        by_worker: Dict[UUID, List[Tuple[UUID, int, int]]] = {}
        for task_id, (start, end) in schedule.items():
            task = self.dag.tasks[task_id]
            if task.assigned_worker_id:
                if task.assigned_worker_id not in by_worker:
                    by_worker[task.assigned_worker_id] = []
                by_worker[task.assigned_worker_id].append((task_id, start, end))
        
        # Check for overlapping tasks on same worker
        for worker_id, tasks in by_worker.items():
            sorted_tasks = sorted(tasks, key=lambda x: x[1])
            for i in range(len(sorted_tasks)):
                for j in range(i + 1, len(sorted_tasks)):
                    id1, start1, end1 = sorted_tasks[i]
                    id2, start2, end2 = sorted_tasks[j]
                    
                    # Check overlap
                    if start1 < end2 and start2 < end1:
                        conflicts.append((id1, id2, "worker_overlap"))
        
        return conflicts


# ============================================
# PROGRESS TRACKING
# ============================================

class DAGProgressTracker:
    """
    Track execution progress of a task DAG.
    """
    
    def __init__(self, dag: TaskDAG):
        self.dag = dag
        self.completed: Set[UUID] = set()
        self.in_progress: Set[UUID] = set()
        self.start_times: Dict[UUID, int] = {}
        self.end_times: Dict[UUID, int] = {}
    
    def start_task(self, task_id: UUID, time: int):
        """Mark task as started"""
        self.in_progress.add(task_id)
        self.start_times[task_id] = time
    
    def complete_task(self, task_id: UUID, time: int):
        """Mark task as completed"""
        self.in_progress.discard(task_id)
        self.completed.add(task_id)
        self.end_times[task_id] = time
    
    def get_progress(self) -> Dict[str, Any]:
        """Get current progress statistics"""
        total = len(self.dag.tasks)
        completed = len(self.completed)
        in_progress = len(self.in_progress)
        pending = total - completed - in_progress
        
        # Calculate time metrics
        total_estimated = sum(t.estimated_minutes for t in self.dag.tasks.values())
        completed_work = sum(
            self.dag.tasks[tid].estimated_minutes for tid in self.completed
        )
        
        # Critical path progress
        critical_tasks = [tid for tid, t in self.dag.tasks.items() if t.is_critical_path]
        critical_completed = len([tid for tid in critical_tasks if tid in self.completed])
        
        return {
            "total_tasks": total,
            "completed": completed,
            "in_progress": in_progress,
            "pending": pending,
            "percent_complete": (completed / total * 100) if total > 0 else 0,
            "estimated_total_minutes": total_estimated,
            "completed_work_minutes": completed_work,
            "critical_path_progress": (
                critical_completed / len(critical_tasks) * 100
                if critical_tasks else 0
            ),
            "ready_tasks": list(self.dag.get_ready_tasks(self.completed))
        }
    
    def get_estimated_completion(self) -> Optional[int]:
        """Estimate remaining time to completion"""
        if len(self.completed) == len(self.dag.tasks):
            return 0
        
        # Sum estimated time of pending tasks on critical path
        remaining_critical = sum(
            self.dag.tasks[tid].estimated_minutes
            for tid in self.dag.tasks
            if tid not in self.completed and self.dag.tasks[tid].is_critical_path
        )
        
        return remaining_critical


# ============================================
# EXAMPLE USAGE / BUILDERS
# ============================================

class ProductTemplateBuilder:
    """Builder for creating product templates"""
    
    def __init__(self, name: str, code: str):
        self.template = ProductTemplate(
            id=uuid4(),
            name=name,
            code=code,
            description=""
        )
    
    def with_operation(
        self,
        name: str,
        code: str,
        op_type: OperationType,
        base_time: int,
        depends_on: List[str] = None,
        skills: List[SkillRequirement] = None
    ) -> ProductTemplateBuilder:
        """Add operation to template"""
        op = OperationTemplate(
            id=uuid4(),
            name=name,
            operation_type=op_type,
            code=code,
            base_time_minutes=base_time,
            depends_on=depends_on or [],
            required_skills=skills or []
        )
        self.template.operations.append(op)
        return self
    
    def with_complexity(self, level: str, multiplier: float):
        """Set complexity multiplier"""
        self.template.complexity_multipliers[level] = multiplier
        return self
    
    def build(self) -> ProductTemplate:
        return self.template


def create_curtain_template() -> ProductTemplate:
    """Create example curtain product template"""
    return ProductTemplateBuilder("Curtain Set", "CUR-001") \
        .with_complexity("simple", 0.8) \
        .with_complexity("medium", 1.0) \
        .with_complexity("complex", 1.5) \
        .with_complexity("premium", 2.0) \
        .with_operation(
            name="Measurement",
            code="MEAS-001",
            op_type=OperationType.MEASUREMENT,
            base_time=30,
            skills=[SkillRequirement("measurement", SkillLevel.JUNIOR, SkillLevel.MIDDLE)]
        ) \
        .with_operation(
            name="Fabric Cutting",
            code="CUT-001",
            op_type=OperationType.CUTTING,
            base_time=20,
            time_per_meter=5.0,
            depends_on=["MEAS-001"],
            skills=[SkillRequirement("cutting", SkillLevel.MIDDLE, SkillLevel.MIDDLE)]
        ) \
        .with_operation(
            name="Sewing",
            code="SEW-001",
            op_type=OperationType.SEWING,
            base_time=60,
            time_per_meter=15.0,
            depends_on=["CUT-001"],
            skills=[SkillRequirement("sewing", SkillLevel.MIDDLE, SkillLevel.SENIOR)]
        ) \
        .with_operation(
            name="Ironing",
            code="IRON-001",
            op_type=OperationType.IRONING,
            base_time=15,
            time_per_meter=3.0,
            depends_on=["SEW-001"],
            skills=[SkillRequirement("ironing", SkillLevel.JUNIOR, SkillLevel.MIDDLE)]
        ) \
        .with_operation(
            name="Quality Check",
            code="QC-001",
            op_type=OperationType.QUALITY_CHECK,
            base_time=10,
            depends_on=["IRON-001"],
            skills=[SkillRequirement("quality_control", SkillLevel.SENIOR, SkillLevel.EXPERT)]
        ) \
        .with_operation(
            name="Packaging",
            code="PACK-001",
            op_type=OperationType.PACKAGING,
            base_time=5,
            depends_on=["QC-001"],
            skills=[SkillRequirement("packaging", SkillLevel.JUNIOR, SkillLevel.JUNIOR)]
        ) \
        .build()


# Example usage function
def example_usage():
    """Example of using the task generator"""
    
    # Create product template
    template = create_curtain_template()
    
    # Define available workers
    workers = [
        Worker(
            id=uuid4(),
            name="Alice",
            skills=[
                WorkerSkill("sewing", SkillLevel.SENIOR, 5.0),
                WorkerSkill("ironing", SkillLevel.MIDDLE, 2.0)
            ],
            current_load=1,
            max_capacity=3
        ),
        Worker(
            id=uuid4(),
            name="Bob",
            skills=[
                WorkerSkill("cutting", SkillLevel.MIDDLE, 3.0),
                WorkerSkill("sewing", SkillLevel.MIDDLE, 3.0)
            ],
            current_load=0,
            max_capacity=4
        ),
        Worker(
            id=uuid4(),
            name="Carol",
            skills=[
                WorkerSkill("quality_control", SkillLevel.EXPERT, 8.0),
                WorkerSkill("measurement", SkillLevel.SENIOR, 6.0)
            ],
            current_load=2,
            max_capacity=3
        )
    ]
    
    # Create generator
    generator = TaskGenerator()
    
    # Generate tasks
    order_context = {
        "fabric_meters": 8.5,
        "window_count": 2,
        "order_id": uuid4()
    }
    
    result = generator.generate(
        product_template=template,
        order_context=order_context,
        available_workers=workers,
        complexity_override="medium"
    )
    
    # Print results
    print(f"Generated {len(result.tasks)} tasks")
    print(f"Total estimated time: {result.total_estimated_minutes} minutes")
    print(f"Critical path: {result.critical_path_length} minutes")
    print("\nTask assignments:")
    for assignment in result.assignments:
        task = result.dag.tasks[assignment.task_id]
        print(f"  {task.name}: Worker {assignment.worker_id} (score: {assignment.assignment_score})")
    
    print("\nExecution order:")
    for i, task_id in enumerate(result.dag.topological_sort(), 1):
        task = result.dag.tasks[task_id]
        status = "CRITICAL" if task.is_critical_path else ""
        print(f"  {i}. {task.name} ({task.estimated_minutes}min) {status}")
    
    return result


if __name__ == "__main__":
    example_usage()

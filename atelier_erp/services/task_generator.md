# Task Generator Service

Converts ProductTemplate into executable DAG of tasks with dependency resolution, time estimation, and skill-based assignment.

## Overview

```
ProductTemplate → TaskGenerator → TaskDAG → GeneratedTask[] → Assignments
```

## Core Concepts

### ProductTemplate
Blueprint for manufacturing a product type. Contains:
- `operations`: List of OperationTemplates
- `complexity_multipliers`: Time adjustments per complexity level
- `default_complexity`: Default complexity for this product

### OperationTemplate
Single manufacturing step:
- `operation_type`: MEASUREMENT, CUTTING, SEWING, etc.
- `base_time_minutes`: Base duration
- `time_per_meter`: Additional time per fabric meter
- `depends_on`: Explicit dependencies (operation codes)
- `required_skills`: Skills needed for assignment

### GeneratedTask
Executable task instance:
- `id`: Unique UUID
- `estimated_minutes`: Calculated duration
- `depends_on`: Task IDs that must complete first
- `assigned_worker_id`: Assigned worker
- `is_critical_path`: On critical path (zero slack)

### TaskDAG
Directed Acyclic Graph of tasks:
- `topological_sort()`: Execution order
- `calculate_critical_path()`: Find bottlenecks
- `get_parallel_groups()`: Tasks that can run concurrently
- `get_ready_tasks()`: Tasks with satisfied dependencies

## Usage

### Basic Generation

```python
from atelier_erp.services.task_generator import (
    TaskGenerator, ProductTemplateBuilder, Worker, WorkerSkill,
    SkillLevel, SkillRequirement, OperationType
)

# Create product template
template = ProductTemplateBuilder("Curtains", "CUR-001") \
    .with_operation(
        name="Measurement",
        code="MEAS-001",
        op_type=OperationType.MEASUREMENT,
        base_time=30,
        skills=[SkillRequirement("measurement", SkillLevel.JUNIOR, SkillLevel.MIDDLE)]
    ) \
    .with_operation(
        name="Cutting",
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
    .build()

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
    )
]

# Generate tasks
generator = TaskGenerator()
result = generator.generate(
    product_template=template,
    order_context={
        "fabric_meters": 8.5,
        "window_count": 2
    },
    available_workers=workers,
    complexity_override="medium"
)

# Result contains:
print(f"Tasks: {len(result.tasks)}")
print(f"Total time: {result.total_estimated_minutes} min")
print(f"Critical path: {result.critical_path_length} min")
```

### Working with DAG

```python
# Get execution order
execution_order = result.dag.topological_sort()
for task_id in execution_order:
    task = result.dag.tasks[task_id]
    print(f"{task.name}: {task.estimated_minutes}min")

# Get critical path
critical_path = result.dag.calculate_critical_path()
for task_id in critical_path:
    task = result.dag.tasks[task_id]
    print(f"CRITICAL: {task.name}")

# Find ready tasks (dependencies satisfied)
completed = {task_id_1, task_id_2}  # Set of completed task IDs
ready = result.dag.get_ready_tasks(completed)
print(f"Ready to execute: {[result.dag.tasks[tid].name for tid in ready]}")

# Get parallel execution groups
parallel_groups = result.dag.get_parallel_groups()
for i, group in enumerate(parallel_groups):
    print(f"Group {i}: {[result.dag.tasks[tid].name for tid in group]}")
```

### Assignment Strategies

```python
# Default balanced assignment
result = generator.generate(...)

# Optimize for speed (assign to most skilled)
result = generator.optimize_assignments(
    result.dag, workers, strategy="fastest"
)

# Balance workload evenly
result = generator.optimize_assignments(
    result.dag, workers, strategy="balanced"
)

# Minimize cost (assign to cheapest)
result = generator.optimize_assignments(
    result.dag, workers, strategy="cheapest"
)
```

### Scheduling with Shifts

```python
from atelier_erp.services.task_generator import TaskScheduler

# Create scheduler
scheduler = TaskScheduler(result.dag, workers)

# Define worker shifts (start_minute, end_minute)
worker_shifts = {
    worker_1_id: [(480, 960), (1020, 1200)],  # 8:00-16:00, 17:00-20:00
    worker_2_id: [(540, 1020)],  # 9:00-17:00
}

# Calculate schedule
schedule = scheduler.calculate_schedule(
    start_time=480,  # Start at 8:00 (480 minutes from midnight)
    worker_shifts=worker_shifts
)

# Check for conflicts
conflicts = scheduler.detect_conflicts(schedule)
for task_a, task_b, conflict_type in conflicts:
    print(f"Conflict: {task_a} and {task_b} - {conflict_type}")
```

### Progress Tracking

```python
from atelier_erp.services.task_generator import DAGProgressTracker

# Create tracker
tracker = DAGProgressTracker(result.dag)

# Mark tasks as started/completed
tracker.start_task(task_id, time=600)  # Started at 10:00
tracker.complete_task(task_id, time=660)  # Completed at 11:00

# Get progress report
progress = tracker.get_progress()
print(f"Completed: {progress['percent_complete']:.1f}%")
print(f"Critical path progress: {progress['critical_path_progress']:.1f}%")
print(f"Ready tasks: {progress['ready_tasks']}")

# Estimate completion
remaining_minutes = tracker.get_estimated_completion()
print(f"Estimated remaining: {remaining_minutes} minutes")
```

## Implicit Dependencies

The generator automatically adds dependencies based on operation type:

```
Measurement → Cutting → Sewing → Ironing → Quality Check → Packaging
```

These are added in addition to explicit `depends_on` in OperationTemplate.

## Time Estimation Formula

```
total_time = base_time_minutes
           + (time_per_meter × fabric_meters)
           + (time_per_window × window_count)
           × complexity_multiplier
```

Complexity multipliers:
- `simple`: 0.8x
- `medium`: 1.0x (default)
- `complex`: 1.5x
- `premium`: 2.0x

## Skill Matching Algorithm

1. **Filter**: Workers must have all required skills at minimum level
2. **Score**: Higher level = better score (+5 per level above minimum)
3. **Load**: Less loaded workers preferred (+2 per available slot)
4. **Select**: Highest score wins

```python
Score = Σ(skill_match) + (max_capacity - current_load) × 2
```

## Data Structures

### OperationTemplate

```python
@dataclass
class OperationTemplate:
    id: UUID
    name: str
    operation_type: OperationType
    code: str                    # Unique identifier
    base_time_minutes: int
    time_per_meter: float = 0.0
    time_per_window: float = 0.0
    depends_on: List[str] = []   # Operation codes
    required_skills: List[SkillRequirement] = []
    max_parallel: int = 1
```

### GeneratedTask

```python
@dataclass
class GeneratedTask:
    id: UUID
    template_id: UUID
    name: str
    operation_type: OperationType
    code: str
    estimated_minutes: int
    complexity: str
    depends_on: List[UUID] = []  # Task IDs
    required_skills: List[SkillRequirement] = []
    assigned_worker_id: Optional[UUID] = None
    earliest_start: Optional[int] = None
    latest_start: Optional[int] = None
    is_critical_path: bool = False
```

### GenerationResult

```python
@dataclass
class GenerationResult:
    dag: TaskDAG                          # Task graph
    tasks: List[GeneratedTask]            # Sorted by execution order
    total_estimated_minutes: int
    critical_path_length: int
    assignments: List[AssignmentResult]
```

## Error Handling

```python
from atelier_erp.services.task_generator import TaskGenerator

try:
    result = generator.generate(template, context, workers)
except ValueError as e:
    # Cycle detected in dependencies
    print(f"Invalid template: {e}")
```

## Integration with ORM

The service is pure Python (no ORM). To persist:

```python
from atelier_erp.models import ProductionTask

# After generation
for task in result.tasks:
    ProductionTask.objects.create(
        order_id=order_id,
        name=task.name,
        operation_type=task.operation_type.name,
        estimated_minutes=task.estimated_minutes,
        assigned_to_id=task.assigned_worker_id,
        depends_on=[str(tid) for tid in task.depends_on],
        is_critical_path=task.is_critical_path
    )
```

## Performance

- DAG building: O(V + E) where V = operations, E = dependencies
- Topological sort: O(V + E)
- Critical path: O(V + E)
- Worker assignment: O(V × W) where W = workers

Optimized for products with up to 50 operations and 20 workers.

## Testing

```python
import pytest
from atelier_erp.services.task_generator import (
    TaskGenerator, ProductTemplateBuilder, OperationType
)

def test_critical_path():
    # Linear chain: A → B → C
    template = ProductTemplateBuilder("Linear", "LIN-001") \
        .with_operation("A", "A-001", OperationType.CUTTING, 10) \
        .with_operation("B", "B-001", OperationType.SEWING, 20, depends_on=["A-001"]) \
        .with_operation("C", "C-001", OperationType.IRONING, 15, depends_on=["B-001"]) \
        .build()
    
    generator = TaskGenerator()
    result = generator.generate(template, {}, [])
    
    assert result.critical_path_length == 45  # 10 + 20 + 15
    assert len(result.dag.calculate_critical_path()) == 3

def test_parallel_execution():
    # A → [B, C] → D
    template = ProductTemplateBuilder("Parallel", "PAR-001") \
        .with_operation("A", "A-001", OperationType.CUTTING, 10) \
        .with_operation("B", "B-001", OperationType.SEWING, 20, depends_on=["A-001"]) \
        .with_operation("C", "C-001", OperationType.SEWING, 25, depends_on=["A-001"]) \
        .with_operation("D", "D-001", OperationType.IRONING, 15, depends_on=["B-001", "C-001"]) \
        .build()
    
    generator = TaskGenerator()
    result = generator.generate(template, {}, [])
    
    # Critical path is A → C → D (10 + 25 + 15 = 50)
    assert result.critical_path_length == 50
    
    # B and C can run in parallel
    parallel_groups = result.dag.get_parallel_groups()
    assert any(len(group) == 2 for group in parallel_groups)
```

## License

Internal use only.

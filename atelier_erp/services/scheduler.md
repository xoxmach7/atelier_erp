# Production Scheduler Service

Advanced task scheduling with skill-based assignment, workload balancing, and DAG dependency resolution.

## Overview

```
Tasks (with skills, priority, dependencies)
                    ↓
            ProductionScheduler
                    ↓
        ┌──────────┼──────────┐
        ↓          ↓          ↓
   assign_task() balance()  detect_overload()
        ↓          ↓          ↓
   Worker A   Worker B    Rebalance
```

## Features

- **Skill-Based Assignment**: Match tasks to workers by skill level
- **DAG Ordering**: Respect task dependencies (cutting → sewing → QC)
- **Workload Balancing**: Distribute load evenly across workers
- **Overload Detection**: Identify and correct bottlenecks
- **Multiple Strategies**: Skill-first, balanced, fastest, cheapest, round-robin
- **Failed Task Retry**: Reassign failed tasks with escalation

## Quick Start

```python
from atelier_erp.services.scheduler import (
    ProductionScheduler, WorkerProfile, SchedulableTask,
    TaskRequirements, AssignmentStrategy
)
from uuid import uuid4
from decimal import Decimal

# Create scheduler
scheduler = ProductionScheduler(strategy=AssignmentStrategy.BALANCED)

# Add workers
scheduler.add_worker(WorkerProfile(
    id=uuid4(),
    name="Alice",
    skills={"sewing": 5, "ironing": 4, "quality_check": 3},
    primary_skill="sewing",
    max_concurrent_tasks=2,
    hourly_rate=Decimal("1500")
))

scheduler.add_worker(WorkerProfile(
    id=uuid4(),
    name="Bob",
    skills={"cutting": 4, "sewing": 3},
    primary_skill="cutting",
    max_concurrent_tasks=3,
    hourly_rate=Decimal("1200")
))

# Add task with requirements
task = SchedulableTask(
    id=uuid4(),
    name="Sew Curtains",
    operation_type="sewing",
    requirements=TaskRequirements(
        required_skills={"sewing": 4},
        estimated_duration_minutes=120,
        priority=5
    )
)
scheduler.add_task(task)

# Assign
result = scheduler.assign_task(task.id)
if result.success:
    print(f"Assigned to {result.assignment.worker_id}")
```

## Core Methods

### 1. assign_task()

Assign a single task to best available worker.

```python
result = scheduler.assign_task(
    task_id=task_uuid,
    preferred_worker_id=None,  # Optional specific worker
    force=False                # Bypass capacity check (admin)
)

# Result fields:
result.success              # Boolean
result.assignment          # Assignment object (if success)
result.failure_reason      # String (if failed)
result.alternative_workers # List of (worker_id, score) tuples
result.worker_load_before  # Int
result.worker_load_after   # Int
```

**Assignment Logic:**
1. Find workers with required skills
2. Filter by availability
3. Score workers based on strategy:
   - `SKILL_FIRST`: 70% skill + 20% workload + 10% priority
   - `BALANCED`: 40% skill + 40% workload + 20% priority
   - `FASTEST`: 60% skill + 10% workload + 30% priority
   - `CHEAPEST`: 50% rate + 30% skill + 20% workload
4. Assign to highest scoring available worker

### 2. assign_ready_tasks()

Assign all tasks ready for execution (dependencies satisfied).

```python
completed_tasks = {task1_id, task2_id}  # Already done

results = scheduler.assign_ready_tasks(
    completed_task_ids=completed_tasks,
    max_assignments=10  # Optional limit
)

# Results for each ready task
for result in results:
    if result.success:
        print(f"✓ {result.assignment.task_id}")
    else:
        print(f"✗ {result.failure_reason}")
```

**Ordering:**
- Priority (highest first)
- Critical path (critical tasks first)
- Dependencies (DAG order)

### 3. balance_workers()

Rebalance workload across workers.

```python
result = scheduler.balance_workers(threshold=0.8)

print(f"Moved {result.tasks_reassigned} tasks")
for task_id, from_w, to_w in result.moves:
    print(f"  {task_id}: {from_w} → {to_w}")

print(f"Balance improved by {result.improved_balance_score}")
```

**Algorithm:**
1. Identify overloaded workers (>80% utilization)
2. Find underutilized workers (<50% utilization)
3. Move non-critical tasks from overloaded → underutilized
4. Ensure skill match for moved tasks

### 4. detect_overload()

Detect overloaded workers.

```python
overloaded = scheduler.detect_overload(threshold=0.9)

for load in overloaded:
    print(f"⚠️ Worker {load.worker_id}")
    print(f"   Tasks: {load.current_tasks}/{load.max_capacity}")
    print(f"   Utilization: {load.utilization_percent}%")
    print(f"   Free at: {load.estimated_free_at()}")
```

**Triggers:**
- Callback fired when worker exceeds threshold
- Can trigger automatic rebalancing
- Used for alerting

### 5. reassign_failed_tasks()

Retry assignment for previously failed tasks.

```python
results = scheduler.reassign_failed_tasks(max_retries=3)

success_count = sum(1 for r in results if r.success)
print(f"Reassigned {success_count}/{len(results)} failed tasks")
```

**Retry Strategy:**
- Attempt 1-2: Normal assignment
- Attempt 3+: Force assignment (ignore capacity)
- After max retries: Task marked as requiring admin intervention

## DAG Scheduling

### Task Dependencies

```python
# Task A (cutting) must complete before Task B (sewing)
task_a = SchedulableTask(
    id=uuid4(),
    name="Cut Fabric",
    operation_type="cutting",
    requirements=TaskRequirements(required_skills={"cutting": 3})
)

task_b = SchedulableTask(
    id=uuid4(),
    name="Sew Curtains",
    operation_type="sewing",
    requirements=TaskRequirements(required_skills={"sewing": 4}),
    depends_on={task_a.id},  # Wait for A
    is_critical_path=True      # On critical path
)
```

### Critical Path

Tasks on critical path:
- Zero slack (any delay delays project)
- Assigned first
- Assigned to most skilled worker

```python
# Mark critical path tasks
for task in critical_tasks:
    task.is_critical_path = True

# Scheduler prioritizes these
```

### Execution Order

```python
# Assign all respecting DAG
schedule = scheduler.assign_all_dag(start_time=datetime.now())

# Check order
for task_id in sorted_tasks:
    task = scheduler.tasks[task_id]
    print(f"{task.name} (deps: {len(task.depends_on)})")
```

## Skill Matching

### Skill Requirements

```python
TaskRequirements(
    required_skills={
        "sewing": 4,         # Min level 4
        "quality_check": 3   # Min level 3
    },
    min_skill_level=1,
    preferred_skill_level=3,
    estimated_duration_minutes=120,
    priority=5
)
```

### Worker Skills

```python
WorkerProfile(
    id=uuid4(),
    name="Alice",
    skills={
        "sewing": 5,         # Level 5 (expert)
        "ironing": 4,
        "quality_check": 3
    },
    primary_skill="sewing",      # 20% bonus
    secondary_skills=["ironing"],  # 10% bonus
    max_concurrent_tasks=2,
    efficiency_rating=1.2        # 20% faster
)
```

### Scoring Formula

```python
# Skill score (per skill)
if worker_level >= required_level:
    score = 50 + (level_diff * 15)
else:
    score = max(0, 50 + (level_diff * 20))

# Primary skill bonus: × 1.2
# Secondary skill bonus: × 1.1

# Workload score (lower is better)
utilization = current_load / max_concurrent_tasks
if utilization >= 0.8: score = 100
elif utilization >= 0.6: score = 50
elif utilization >= 0.4: score = 25
else: score = 0

# Total based on strategy
SKILL_FIRST:  0.7 * skill + 0.2 * (100 - workload) + 0.1 * priority
BALANCED:     0.4 * skill + 0.4 * (100 - workload) + 0.2 * priority
FASTEST:      0.6 * skill + 0.1 * (100 - workload) + 0.3 * priority
CHEAPEST:     0.5 * rate + 0.3 * skill + 0.2 * (100 - workload)
```

## Workload Balancing

### Strategies

```python
# Set strategy
scheduler.set_strategy(AssignmentStrategy.BALANCED)

# Available strategies:
# - SKILL_FIRST: Assign to most skilled first
# - BALANCED: Even distribution (recommended)
# - FASTEST: Minimize completion time
# - CHEAPEST: Minimize labor cost
# - ROUND_ROBIN: Simple rotation
```

### Capacity Management

```python
# Worker capacity
worker.max_concurrent_tasks = 3  # Can do 3 tasks simultaneously
worker.current_load = 2          # Currently has 2 tasks

# Check availability
if worker.is_available():
    # current_load < max_concurrent_tasks
    # Status is AVAILABLE or BUSY
    # Within shift hours
    pass
```

### Rebalancing

```python
# Manual rebalance
result = scheduler.balance_workers(threshold=0.8)

# Automatic on overload
def on_overload(load):
    if load.utilization_percent > 90:
        scheduler.balance_workers()

scheduler.on_overload(on_overload)
```

## Event System

```python
# Assignment event
def on_assign(assignment):
    print(f"Task {assignment.task_id} → Worker {assignment.worker_id}")
    print(f"Expected completion: {assignment.expected_completion}")
    print(f"Total score: {assignment.total_score}")

scheduler.on_assign(on_assign)

# Overload event
def on_overload(worker_load):
    send_alert(f"Worker {worker_load.worker_id} at {worker_load.utilization_percent}%")

scheduler.on_overload(on_overload)

# Rebalance event
def on_rebalance(result):
    print(f"Rebalanced {result.tasks_reassigned} tasks")
    for task_id, from_w, to_w in result.moves:
        log_move(task_id, from_w, to_w)

scheduler.on_rebalance(on_rebalance)
```

## Analytics & Queries

### Schedule Statistics

```python
stats = scheduler.get_schedule_stats()

print(f"Total tasks: {stats['total_tasks']}")
print(f"Assigned: {stats['assigned_tasks']}")
print(f"Pending: {stats['pending_tasks']}")
print(f"Assignment rate: {stats['assignment_rate']:.1f}%")
print(f"Avg utilization: {stats['average_utilization']:.1f}%")
print(f"Critical path progress: {stats['critical_path_progress']:.1f}%")
print(f"Makespan: {stats['makespan_minutes']} minutes")
print(f"Conflicts: {stats['conflicts']}")
```

### Find Bottlenecks

```python
bottlenecks = scheduler.find_bottlenecks()

for b in bottlenecks:
    print(f"⚠️ {b['type']}: {b['description']}")
    print(f"   Severity: {b['severity']}")
    
    # Types:
    # - worker_overload: Worker at capacity
    # - critical_path_blocked: Critical task unassigned
    # - skill_shortage: Not enough workers with skill
```

### Worker Schedule

```python
# Get worker's schedule
schedule = scheduler.get_worker_schedule(worker_id)

for task_id, start, end in schedule:
    task = scheduler.tasks[task_id]
    print(f"{task.name}: {start.strftime('%H:%M')} - {end.strftime('%H:%M')}")
```

## Shift Scheduling

```python
from atelier_erp.services.scheduler import ShiftScheduler, Shift

shift_scheduler = ShiftScheduler()

# Create shift
shift = shift_scheduler.create_shift(
    shift_id=uuid4(),
    start_time=datetime(2024, 1, 15, 8, 0),
    duration_hours=8,
    required_skills={
        "cutting": 2,    # Need 2 cutters
        "sewing": 3,     # Need 3 sewers
        "quality_check": 1
    },
    min_workers=5,
    max_workers=8
)

# Assign workers
assigned = shift_scheduler.assign_workers_to_shift(
    shift=shift,
    available_workers=all_workers
)

print(f"Assigned {len(assigned)} workers to shift")

# Check coverage
coverage = shift_scheduler.get_shift_coverage(shift.id)
for skill, data in coverage.items():
    status = "✓" if data['satisfied'] else "✗"
    print(f"{status} {skill}: {data['actual']}/{data['required']}")
```

## Specialization Handling

### Primary vs Secondary Skills

```python
# Worker specialization
worker.primary_skill = "sewing"      # 20% score bonus
worker.secondary_skills = ["ironing"]  # 10% score bonus

# Task requires cutting
task.requirements.required_skills = {"cutting": 4}

# Worker with cutting as primary gets priority
# Even if another worker has same level
```

### Operation Type Routing

```python
# Automatic routing based on operation type
if task.operation_type == "cutting":
    # Prefer workers with cutting as primary
    pass
elif task.operation_type == "sewing":
    # Prefer workers with sewing as primary
    pass
```

## Error Handling

```python
result = scheduler.assign_task(task_id)

if not result.success:
    if "No eligible workers" in result.failure_reason:
        # Skill mismatch - need training or hire
        pass
    elif "All eligible workers at capacity" in result.failure_reason:
        # Need to scale up or rebalance
        scheduler.balance_workers()
    elif "Required worker" in result.failure_reason:
        # Specific worker not available
        pass
    
    # See alternatives
    for worker_id, score in result.alternative_workers:
        print(f"Alternative: {worker_id} (score: {score})")
```

## Testing

```python
import pytest
from datetime import datetime

def test_skill_matching():
    scheduler = ProductionScheduler()
    
    # Worker with sewing=5
    worker = WorkerProfile(
        id=uuid4(), name="Alice",
        skills={"sewing": 5}
    )
    scheduler.add_worker(worker)
    
    # Task requiring sewing=4
    task = SchedulableTask(
        id=uuid4(), name="Sew",
        operation_type="sewing",
        requirements=TaskRequirements(required_skills={"sewing": 4})
    )
    scheduler.add_task(task)
    
    result = scheduler.assign_task(task.id)
    assert result.success
    assert result.assignment.worker_id == worker.id

def test_dag_ordering():
    """Ensure cutting happens before sewing"""
    scheduler = ProductionScheduler()
    
    cut_task = SchedulableTask(..., depends_on=set())
    sew_task = SchedulableTask(..., depends_on={cut_task.id})
    
    scheduler.add_tasks([cut_task, sew_task])
    
    # Assign - only cut_task should be ready
    results = scheduler.assign_ready_tasks(set())
    assigned_ids = [r.assignment.task_id for r in results if r.success]
    assert cut_task.id in assigned_ids
    assert sew_task.id not in assigned_ids

def test_workload_balancing():
    """Test that tasks are distributed evenly"""
    scheduler = ProductionScheduler(strategy=AssignmentStrategy.BALANCED)
    
    # Two identical workers
    w1 = WorkerProfile(id=uuid4(), skills={"sewing": 3}, max_concurrent_tasks=5)
    w2 = WorkerProfile(id=uuid4(), skills={"sewing": 3}, max_concurrent_tasks=5)
    scheduler.add_workers([w1, w2])
    
    # 6 identical tasks
    tasks = [SchedulableTask(...) for _ in range(6)]
    scheduler.add_tasks(tasks)
    
    # Assign all
    for task in tasks:
        scheduler.assign_task(task.id)
    
    # Check balance
    loads = scheduler._calculate_worker_loads()
    assert abs(loads[w1.id].current_tasks - loads[w2.id].current_tasks) <= 1
```

## Integration with Task Generator

```python
from atelier_erp.services import TaskGenerator, ProductionScheduler

# Generate tasks from product template
generator = TaskGenerator()
result = generator.generate(template, context, workers)

# Convert to schedulable tasks
schedulable_tasks = []
for gen_task in result.tasks:
    task = SchedulableTask(
        id=gen_task.id,
        name=gen_task.name,
        operation_type=gen_task.operation_type.name.lower(),
        requirements=TaskRequirements(
            required_skills={
                skill.skill_code: skill.min_level.value
                for skill in gen_task.required_skills
            },
            estimated_duration_minutes=gen_task.estimated_minutes,
            priority=5 if gen_task.is_critical_path else 3
        ),
        depends_on=set(gen_task.depends_on),
        is_critical_path=gen_task.is_critical_path
    )
    schedulable_tasks.append(task)

# Schedule
scheduler = ProductionScheduler()
scheduler.add_tasks(schedulable_tasks)
scheduler.add_workers(available_workers)

# Assign respecting DAG
schedule = scheduler.assign_all_dag()
```

## Performance

- **assign_task()**: O(w) where w = number of workers
- **assign_ready_tasks()**: O(t × w) where t = ready tasks
- **balance_workers()**: O(t × w) in worst case
- **detect_overload()**: O(w)

Optimized for up to 100 workers and 1000 tasks.

## Best Practices

1. **Set primary skill** for each worker for better routing
2. **Use BALANCED strategy** for general production
3. **Use SKILL_FIRST** for complex/high-value orders
4. **Set realistic max_concurrent_tasks** (usually 1-3)
5. **Monitor bottlenecks** daily and adjust
6. **Rebalance proactively** before workers hit 90% utilization
7. **Set task priorities** correctly (5 = urgent, 1 = low)

## License

Internal use only.

# Brigada Atelier Management System

A production-ready Django backend for managing tailoring shops and ateliers. Streamlines order workflow, worker assignments, inventory tracking, and production scheduling.

[![Django](https://img.shields.io/badge/Django-4.2-green.svg)](https://djangoproject.com)
[![DRF](https://img.shields.io/badge/DRF-3.14-blue.svg)](https://www.django-rest-framework.org/)
[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://python.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)](https://postgresql.org)
[![License](https://img.shields.io/badge/license-Proprietary-lightgrey.svg)]()

---

## The Problem

Running an atelier involves complex coordination:
- Tracking orders through multiple production stages
- Assigning tasks to workers without overloading them
- Managing fabric inventory and usage
- Monitoring deadlines and progress
- Preventing lost orders and missed deadlines

Traditional spreadsheets and manual tracking lead to errors, delays, and unhappy customers.

## The Solution

Brigada is a comprehensive atelier management system that automates workflow from order intake to delivery:

- **Order Lifecycle Management** - Track orders from new → in progress → done
- **Smart Task Assignment** - Auto-assign tasks with overload prevention
- **Real-time Progress Tracking** - Monitor completion at order and task level
- **Inventory Control** - Track fabric stock with usage recording
- **Role-based Access** - Admin, manager, worker, and cutter permissions

---

## Features

### Order Management
- Create and track customer orders
- Automatic status updates based on task completion
- Deadline tracking with overdue alerts
- Payment status monitoring
- Order history and customer relationship tracking

### Production Workflow
- Create work orders linked to customer orders
- Break down work into individual tasks (cutting, sewing, finishing)
- Assign tasks to workers with automatic capacity checks
- Task dependencies (e.g., cutting must finish before sewing)
- Real-time progress reporting

### Worker Management
- Role-based system: admin, manager, worker, cutter
- Task assignment with overload prevention (max 5 active tasks per worker)
- Auto-assignment to available workers
- Workload visibility and capacity reporting
- Performance tracking (estimated vs actual time)

### Inventory Tracking
- Fabric catalog with type, color, dimensions
- Stock level monitoring with low stock alerts
- Usage recording per order
- Cost calculation based on price per meter
- Supplier tracking

### API & Integration
- RESTful API with 40+ endpoints
- JWT authentication with refresh tokens
- Auto-generated Swagger/OpenAPI documentation
- CORS support for frontend integration
- Rate limiting and security protections

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        API Layer                             │
│  /api/v1/orders/  /api/v1/tasks/  /api/v1/inventory/         │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Service Layer                            │
│  OrderService    TaskService    InventoryService            │
│  - Business logic                                            │
│  - Auto-status updates                                       │
│  - Overload prevention                                       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Models Layer                            │
│  Order  Task  WorkOrder  Fabric  User                        │
│  - Data structure                                            │
│  - Relationships (FK, M2M)                                 │
└─────────────────────────────────────────────────────────────┘
```

### Clean Architecture Principles

1. **Service Layer** - Business logic separated from views
2. **Model Methods** - Domain logic in models
3. **Custom Permissions** - Role-based access control
4. **Environment-based Config** - Same code, different settings

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Backend** | Django 4.2 + Django REST Framework |
| **Database** | PostgreSQL 15 |
| **Cache** | Redis 7 |
| **Queue** | Celery + Redis |
| **Auth** | JWT (SimpleJWT) |
| **Docs** | drf-spectacular (OpenAPI 3) |
| **Security** | django-defender, CORS headers |
| **Production** | Gunicorn, Whitenoise, Docker |
| **Monitoring** | Sentry (optional) |

---

## Quick Start

### Prerequisites
- Python 3.11+
- PostgreSQL 15+
- Redis 7+ (or Docker)

### Local Development

```bash
# 1. Setup environment
cd backend-django
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 3. Start services (Docker)
docker-compose -f docker-compose.dev.yml up -d

# 4. Initialize database
python manage.py migrate
python manage.py create_superuser --email admin@atelier.kz --password admin123

# 5. Run server
python manage.py runserver
```

API available at `http://localhost:8000/api/v1/`

Documentation at `http://localhost:8000/api/docs/`

### Docker Production

```bash
# Start all services
docker-compose up --build -d

# Run migrations
docker-compose exec api python manage.py migrate

# Create admin user
docker-compose exec api python manage.py create_superuser --email admin@atelier.kz --password admin123
```

---

## Project Structure

```
backend-django/
├── apps/
│   ├── users/              # User management with roles
│   ├── orders/             # Order lifecycle
│   ├── inventory/          # Fabric tracking
│   └── production/         # Tasks and work orders
├── core/
│   ├── models.py          # Base models (TimeStampedModel)
│   ├── permissions.py     # Role-based permissions
│   └── exceptions.py      # Custom exceptions
├── config/
│   ├── settings/
│   │   ├── base.py       # Shared settings
│   │   ├── development.py  # Local dev
│   │   └── production.py # Production
│   └── urls.py            # API routing
├── Dockerfile             # Multi-stage build
├── docker-compose.yml     # Full stack
└── requirements.txt       # Dependencies
```

---

## API Examples

### Create Order
```bash
curl -X POST http://localhost:8000/api/v1/orders/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customer": "uuid",
    "priority": "high",
    "deadline_date": "2024-01-15",
    "total_amount": "15000.00",
    "items": [{"description": "Dress sewing", "quantity": 1, "unit_price": "15000"}]
  }'
```

### Assign Task
```bash
curl -X POST http://localhost:8000/api/v1/tasks/456/assign/ \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"worker_id": "worker-uuid"}'
```

### Record Fabric Usage
```bash
curl -X POST http://localhost:8000/api/v1/inventory/usage/record_usage/ \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "fabric": "fabric-uuid",
    "order": "order-uuid",
    "length_used": "2.5"
  }'
```

---

## Configuration

### Environment Variables

Key variables in `.env`:

```bash
# Django
DJANGO_SECRET_KEY=your-secret-key
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=api.yourdomain.com

# Database
DATABASE_URL=postgres://user:password@db:5432/atelier_db

# Redis
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/2

# Security
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True

# CORS
CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

### Role Permissions

| Role | Orders | Tasks | Inventory |
|------|--------|-------|-----------|
| **Admin** | CRUD | CRUD | CRUD |
| **Manager** | CRUD | CRUD | CRUD |
| **Worker** | Read (own) | Read/Update (own) | Read |
| **Cutter** | Read (own) | Read/Update (own) | Read + Record Usage |

---

## Testing

```bash
# Run tests
pytest

# With coverage
pytest --cov=apps --cov-report=html

# Type checking
mypy apps

# Code formatting
black apps core
isort apps core
```

---

## License

Proprietary - All rights reserved

---

## Support

For questions or support, contact the development team.


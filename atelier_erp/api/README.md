# Atelier ERP API Documentation

## Base URL
```
/api/
```

## Authentication

Default: Django Session Authentication (via `api/auth/`)

For production, configure JWT or Token authentication in settings.

## Endpoints

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orders/` | List orders |
| POST | `/api/orders/` | Create order |
| GET | `/api/orders/{id}/` | Get order details |
| POST | `/api/orders/{id}/confirm/` | Confirm order |
| POST | `/api/orders/{id}/reserve-materials/` | Reserve materials |
| POST | `/api/orders/{id}/start-production/` | Start production |
| POST | `/api/orders/{id}/complete/` | Complete order |
| POST | `/api/orders/{id}/cancel/` | Cancel order |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks/` | List tasks |
| POST | `/api/tasks/` | Create task |
| GET | `/api/tasks/{id}/` | Get task details |
| POST | `/api/tasks/{id}/start/` | Start task |
| POST | `/api/tasks/{id}/complete/` | Complete task |

### Inventory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/fabrics/` | List fabrics |
| GET | `/api/fabrics/low_stock/` | Low stock fabrics |
| GET | `/api/cornices/` | List cornices |
| GET | `/api/services/` | List services |
| GET | `/api/inventory/availability/?fabric={id}:{meters}` | Check availability |
| GET | `/api/inventory/low_stock/` | Low stock alerts |

### Customers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers/` | List customers |
| POST | `/api/customers/` | Create customer |
| GET | `/api/customers/{id}/` | Get customer |
| PUT | `/api/customers/{id}/` | Update customer |

### Production
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/production-assignments/` | List assignments |
| GET | `/api/production-assignments/{id}/` | Get assignment |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payments/` | List payments |
| POST | `/api/payments/` | Record payment |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/summary/` | Dashboard summary |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health/` | Health check |

## Permissions

- **IsAuthenticated**: All endpoints require authentication
- **IsManagerOrAdmin**: Order state changes (confirm, cancel, complete)
- **IsWorkerOrManagerOrAdmin**: Read access, limited write access

## Filtering & Search

All list endpoints support:

```
?search={query}        # Search by name, phone, etc.
?ordering=-created_at  # Sort order
?page=1&page_size=100  # Pagination
```

Example:
```
GET /api/orders/?status=production&search=Иван&ordering=-created_at
```

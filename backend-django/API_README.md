# Atelier REST API - Django REST Framework

## Quick Start

```python
# Run server
python manage.py runserver

# API available at:
# http://localhost:8000/api/v1/
# http://localhost:8000/api/docs/ (Swagger)
```

---

## File Structure

```
backend-django/
├── api/v1/
│   ├── routers.py          # Router configuration
│   ├── urls.py             # URL patterns
│   └── serializers.py      # Shared serializers
│
├── apps/
│   ├── orders/
│   │   └── api.py          # OrderViewSet + Serializers
│   ├── production/
│   │   └── api.py          # TaskViewSet + WorkOrderViewSet
│   └── inventory/
│       └── api.py          # FabricViewSet + FabricUsageViewSet
```

---

## API Endpoints

### Orders (`/api/v1/orders/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/orders/` | List all orders |
| POST | `/orders/` | Create new order |
| GET | `/orders/{id}/` | Get order details |
| PUT | `/orders/{id}/` | Update order |
| PATCH | `/orders/{id}/` | Partial update |
| DELETE | `/orders/{id}/` | Delete order |
| POST | `/orders/{id}/status/` | Update status |
| GET | `/orders/by_status/?status=new` | Filter by status |

**Example:**
```bash
# Create order
curl -X POST http://localhost:8000/api/v1/orders/ \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "uuid-here",
    "priority": "high",
    "deadline_date": "2024-01-15",
    "total_amount": "15000.00",
    "items": [
      {"description": "Dress sewing", "quantity": 1, "unit_price": "15000"}
    ]
  }'

# Update status
curl -X POST http://localhost:8000/api/v1/orders/123/status/ \
  -d '{"status": "in_progress"}'
```

---

### Tasks (`/api/v1/tasks/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks/` | List tasks |
| POST | `/tasks/` | Create task |
| GET | `/tasks/{id}/` | Task details |
| PUT | `/tasks/{id}/` | Update task |
| DELETE | `/tasks/{id}/` | Delete task |
| POST | `/tasks/{id}/start/` | Start task |
| POST | `/tasks/{id}/complete/` | Complete task |
| GET | `/tasks/my_tasks/` | Current user's tasks |

**Query Parameters:**
- `?assigned_to={user_id}` - Filter by worker
- `?status=new` - Filter by status
- `?work_order={id}` - Filter by work order

**Example:**
```bash
# Get my pending tasks
curl http://localhost:8000/api/v1/tasks/my_tasks/

# Start task
curl -X POST http://localhost:8000/api/v1/tasks/456/start/

# Complete task
curl -X POST http://localhost:8000/api/v1/tasks/456/complete/ \
  -d '{"status": "done", "actual_minutes": 120}'
```

---

### Work Orders (`/api/v1/work-orders/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/work-orders/` | List work orders |
| POST | `/work-orders/` | Create work order |
| GET | `/work-orders/{id}/` | Get details (includes tasks) |
| PUT | `/work-orders/{id}/` | Update |
| DELETE | `/work-orders/{id}/` | Delete |

**Query Parameters:**
- `?status=new` - Filter by status
- `?assigned_to={user_id}` - Filter by assigned worker

---

### Inventory - Fabric (`/api/v1/inventory/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/inventory/` | List fabrics |
| POST | `/inventory/` | Add new fabric |
| GET | `/inventory/{id}/` | Fabric details |
| PUT | `/inventory/{id}/` | Update fabric |
| DELETE | `/inventory/{id}/` | Delete fabric |
| GET | `/inventory/low_stock/` | Low stock alert |
| POST | `/inventory/{id}/add_stock/` | Add stock |
| POST | `/inventory/{id}/remove_stock/` | Remove stock |

**Query Parameters:**
- `?type=cotton` - Filter by fabric type
- `?color=red` - Filter by color
- `?low_stock=true` - Show only low stock

**Example:**
```bash
# Add new fabric
curl -X POST http://localhost:8000/api/v1/inventory/ \
  -d '{
    "code": "SILK-001",
    "name": "Premium Silk",
    "fabric_type": "silk",
    "color": "Red",
    "length_in_stock": "50.00",
    "price_per_meter": "2500.00"
  }'

# Add stock
curl -X POST http://localhost:8000/api/v1/inventory/123/add_stock/ \
  -d '{"length": "10.5", "reason": "New delivery"}'

# Check low stock
curl http://localhost:8000/api/v1/inventory/low_stock/
```

---

### Inventory Usage (`/api/v1/inventory/usage/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/inventory/usage/` | List usage records |
| GET | `/inventory/usage/{id}/` | Usage details |
| POST | `/inventory/usage/record_usage/` | Record fabric usage |

**Query Parameters:**
- `?order={order_id}` - Filter by order
- `?fabric={fabric_id}` - Filter by fabric

**Example:**
```bash
# Record fabric usage (auto-deducts stock)
curl -X POST http://localhost:8000/api/v1/inventory/usage/record_usage/ \
  -d '{
    "fabric": "uuid-here",
    "order": "order-uuid",
    "length_used": "2.5",
    "pieces_cut": 5
  }'
```

---

## Serializers

### Order Serializers

```python
# List view - lightweight
class OrderListSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.display_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

# Detail view - includes nested items
class OrderDetailSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source="customer.display_name", read_only=True)
    
# Create view - accepts nested items
class OrderCreateSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)
```

### Task Serializers

```python
class TaskSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source="assigned_to.get_full_name", read_only=True)
    task_type_display = serializers.CharField(source="get_task_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
```

### Fabric Serializers

```python
class FabricSerializer(serializers.ModelSerializer):
    fabric_type_display = serializers.CharField(source="get_fabric_type_display", read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
```

---

## Frontend Integration

### JavaScript/Fetch Example

```javascript
// Config
const API_URL = 'http://localhost:8000/api/v1';
const headers = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + token
};

// Orders API
const ordersApi = {
  list: () => fetch(`${API_URL}/orders/`, { headers }),
  create: (data) => fetch(`${API_URL}/orders/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  }),
  updateStatus: (id, status) => fetch(`${API_URL}/orders/${id}/status/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ status })
  })
};

// Tasks API
const tasksApi = {
  myTasks: () => fetch(`${API_URL}/tasks/my_tasks/`, { headers }),
  start: (id) => fetch(`${API_URL}/tasks/${id}/start/`, {
    method: 'POST',
    headers
  }),
  complete: (id, minutes) => fetch(`${API_URL}/tasks/${id}/complete/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ status: 'done', actual_minutes: minutes })
  })
};

// Inventory API
const inventoryApi = {
  list: () => fetch(`${API_URL}/inventory/`, { headers }),
  lowStock: () => fetch(`${API_URL}/inventory/low_stock/`, { headers }),
  addStock: (id, length) => fetch(`${API_URL}/inventory/${id}/add_stock/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ length })
  }),
  useFabric: (data) => fetch(`${API_URL}/inventory/usage/record_usage/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  })
};
```

### React Hook Example

```javascript
// useOrders.js
import { useQuery, useMutation } from '@tanstack/react-query';

export const useOrders = () => {
  return useQuery(['orders'], () => 
    fetch('/api/v1/orders/').then(r => r.json())
  );
};

export const useUpdateOrderStatus = () => {
  return useMutation(({ id, status }) =>
    fetch(`/api/v1/orders/${id}/status/`, {
      method: 'POST',
      body: JSON.stringify({ status })
    }).then(r => r.json())
  );
};

export const useMyTasks = () => {
  return useQuery(['my-tasks'], () =>
    fetch('/api/v1/tasks/my_tasks/').then(r => r.json())
  );
};
```

---

## Authentication

All endpoints require JWT authentication:

```bash
# Login
curl -X POST http://localhost:8000/api/v1/auth/login/ \
  -d '{"email": "user@atelier.kz", "password": "pass"}'

# Response: {"access": "token", "refresh": "token"}

# Use token in requests
curl http://localhost:8000/api/v1/orders/ \
  -H "Authorization: Bearer {access_token}"
```

---

## Error Responses

```json
// Validation Error (400)
{
  "success": false,
  "error": {
    "code": "validation_error",
    "message": "Invalid data",
    "details": {
      "status": ["Invalid choice"]
    }
  }
}

// Not Found (404)
{
  "success": false,
  "error": {
    "code": "not_found",
    "message": "Order not found"
  }
}
```

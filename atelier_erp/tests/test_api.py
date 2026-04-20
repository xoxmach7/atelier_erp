"""
API Integration Tests
"""

import pytest
from decimal import Decimal

from atelier_erp.models import Customer, Order, Fabric, Task


@pytest.mark.django_db
class TestCustomerAPI:
    """Customer API tests"""
    
    def test_list_customers(self, authenticated_client, customer):
        """Test listing customers"""
        response = authenticated_client.get('/api/customers/')
        
        assert response.status_code == 200
        assert len(response.data) >= 1
        assert response.data[0]['full_name'] == customer.full_name
    
    def test_create_customer(self, authenticated_client):
        """Test creating customer"""
        data = {
            'full_name': 'Новый Клиент',
            'phone': '+7 777 555 4444',
            'address_city': 'Астана',
            'address_street': 'пр. Тауелсиздик'
        }
        response = authenticated_client.post('/api/customers/', data)
        
        assert response.status_code == 201
        assert response.data['full_name'] == 'Новый Клиент'
    
    def test_create_customer_invalid_phone(self, authenticated_client):
        """Test creating customer with invalid phone"""
        data = {
            'full_name': 'Тест',
            'phone': 'invalid-phone'
        }
        response = authenticated_client.post('/api/customers/', data)
        
        assert response.status_code == 400
    
    def test_unauthorized_access(self, api_client):
        """Test unauthorized access is blocked"""
        response = api_client.get('/api/customers/')
        
        assert response.status_code == 403


@pytest.mark.django_db
class TestOrderAPI:
    """Order API tests"""
    
    def test_list_orders(self, authenticated_client, draft_order):
        """Test listing orders"""
        response = authenticated_client.get('/api/orders/')
        
        assert response.status_code == 200
        assert len(response.data) >= 1
    
    def test_get_order_detail(self, authenticated_client, draft_order):
        """Test getting order details"""
        response = authenticated_client.get(f'/api/orders/{draft_order.id}/')
        
        assert response.status_code == 200
        assert response.data['order_number'] == draft_order.order_number
    
    def test_confirm_order(self, authenticated_client, draft_order):
        """Test confirming order"""
        response = authenticated_client.post(f'/api/orders/{draft_order.id}/confirm/')
        
        assert response.status_code == 200
        assert response.data['status'] == 'confirmed'
    
    def test_confirm_order_invalid_transition(self, authenticated_client, draft_order):
        """Test confirming already confirmed order fails"""
        # First confirm
        authenticated_client.post(f'/api/orders/{draft_order.id}/confirm/')
        
        # Try again
        response = authenticated_client.post(f'/api/orders/{draft_order.id}/confirm/')
        
        assert response.status_code == 400
    
    def test_cancel_order(self, authenticated_client, draft_order):
        """Test cancelling order"""
        response = authenticated_client.post(
            f'/api/orders/{draft_order.id}/cancel/',
            {'reason': 'Клиент передумал'}
        )
        
        assert response.status_code == 200
    
    def test_worker_cannot_confirm_order(self, api_client, worker_user, draft_order):
        """Test worker cannot confirm order"""
        api_client.force_authenticate(user=worker_user)
        response = api_client.post(f'/api/orders/{draft_order.id}/confirm/')
        
        assert response.status_code == 403
    
    def test_filter_orders_by_status(self, authenticated_client, draft_order):
        """Test filtering orders"""
        response = authenticated_client.get('/api/orders/?status=draft')
        
        assert response.status_code == 200


@pytest.mark.django_db
class TestInventoryAPI:
    """Inventory API tests"""
    
    def test_list_fabrics(self, authenticated_client, fabric):
        """Test listing fabrics"""
        response = authenticated_client.get('/api/fabrics/')
        
        assert response.status_code == 200
        assert len(response.data) >= 1
    
    def test_low_stock_endpoint(self, authenticated_client, low_stock_fabric):
        """Test low stock endpoint"""
        response = authenticated_client.get('/api/fabrics/low_stock/')
        
        assert response.status_code == 200
        assert response.data['count'] >= 1
    
    def test_inventory_availability_check(self, authenticated_client, fabric):
        """Test availability check"""
        response = authenticated_client.get(
            f'/api/inventory/availability/?fabric={fabric.id}:10.00'
        )
        
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['can_fulfill'] is True
    
    def test_inventory_low_stock(self, authenticated_client, low_stock_fabric):
        """Test inventory low stock endpoint"""
        response = authenticated_client.get('/api/inventory/low_stock/')
        
        assert response.status_code == 200
        assert response.data['threshold'] == 10


@pytest.mark.django_db
class TestTaskAPI:
    """Task API tests"""
    
    def test_list_tasks(self, authenticated_client, task):
        """Test listing tasks"""
        response = authenticated_client.get('/api/tasks/')
        
        assert response.status_code == 200
    
    def test_start_task(self, authenticated_client, task):
        """Test starting task"""
        response = authenticated_client.post(f'/api/tasks/{task.id}/start/')
        
        assert response.status_code == 200
        assert response.data['status'] == 'started'
    
    def test_complete_task(self, authenticated_client, task):
        """Test completing task"""
        response = authenticated_client.post(f'/api/tasks/{task.id}/complete/')
        
        assert response.status_code == 200


@pytest.mark.django_db
class TestDashboardAPI:
    """Dashboard API tests"""
    
    def test_dashboard_summary(self, authenticated_client, draft_order, customer):
        """Test dashboard summary"""
        response = authenticated_client.get('/api/dashboard/summary/')
        
        assert response.status_code == 200
        assert 'total_orders' in response.data
        assert 'total_customers' in response.data
    
    def test_health_check(self, api_client):
        """Test health endpoint"""
        response = api_client.get('/health/')
        
        assert response.status_code == 200
        assert response.data['status'] == 'healthy'


@pytest.mark.django_db
class TestOrderLifecycleIntegration:
    """Integration tests for full order lifecycle"""
    
    def test_happy_path_flow(self, authenticated_client, customer, fabric):
        """Test complete happy path: create → confirm → reserve → start production"""
        # 1. Create order
        order_data = {
            'customer': str(customer.id),
            'items': [
                {
                    'item_type': 'fabric',
                    'fabric': str(fabric.id),
                    'fabric_meters': '10.00',
                    'unit_price': '2500.00',
                    'quantity': 1
                }
            ]
        }
        response = authenticated_client.post('/api/orders/', order_data)
        assert response.status_code == 201
        order_id = response.data['id']
        
        # 2. Confirm order
        response = authenticated_client.post(f'/api/orders/{order_id}/confirm/')
        assert response.status_code == 200
        
        # 3. Reserve materials
        response = authenticated_client.post(f'/api/orders/{order_id}/reserve-materials/')
        assert response.status_code == 200
        
        fabric.refresh_from_db()
        assert fabric.reserved_meters > 0
    
    def test_cancel_before_reserve(self, authenticated_client, customer, fabric):
        """Test cancelling before reservation"""
        # Create and confirm
        order_data = {'customer': str(customer.id), 'items': []}
        response = authenticated_client.post('/api/orders/', order_data)
        order_id = response.data['id']
        authenticated_client.post(f'/api/orders/{order_id}/confirm/')
        
        # Cancel
        response = authenticated_client.post(
            f'/api/orders/{order_id}/cancel/',
            {'reason': 'Тестовая отмена'}
        )
        assert response.status_code == 200
    
    def test_insufficient_stock_blocks(self, authenticated_client, customer, fabric):
        """Test reservation blocked when stock insufficient"""
        # Create order requesting more than available
        order_data = {
            'customer': str(customer.id),
            'items': [
                {
                    'item_type': 'fabric',
                    'fabric': str(fabric.id),
                    'fabric_meters': '1000.00',  # Too much
                    'unit_price': '2500.00',
                    'quantity': 1
                }
            ]
        }
        response = authenticated_client.post('/api/orders/', order_data)
        order_id = response.data['id']
        
        authenticated_client.post(f'/api/orders/{order_id}/confirm/')
        
        # Try to reserve - should fail
        response = authenticated_client.post(f'/api/orders/{order_id}/reserve-materials/')
        assert response.status_code == 400
        assert 'error' in response.data

"""
Tests for Measurement fabric fields (Phase 3)

Measurement = what selected and how much needed (no prices)
These tests verify:
- curtain_fabric + curtain_meters are saved correctly
- tulle_fabric + tulle_meters are saved correctly
- Measurement does NOT contain price/cost/total fields
- API returns new fields
- Legacy selected_fabric compatibility
"""

import pytest
from decimal import Decimal
from django.test import TestCase

from django.contrib.auth import get_user_model
from atelier_erp.models import Measurement, Order, Customer, Fabric

User = get_user_model()


@pytest.mark.django_db
class TestMeasurementFabricFields(TestCase):
    """Test Measurement model fabric fields"""

    def setUp(self):
        """Set up test data"""
        self.customer = Customer.objects.create(
            full_name="Test Customer",
            phone="+79001234567"
        )
        self.order = Order.objects.create(
            customer=self.customer,
            order_number="О-2024-001"
        )
        self.fabric1 = Fabric.objects.create(
            name="Velvet Red",
            hanger_number="V-001",
            price_per_meter=Decimal("1500.00"),
            width_cm=280
        )
        self.fabric2 = Fabric.objects.create(
            name="Tulle White",
            hanger_number="T-001",
            price_per_meter=Decimal("800.00"),
            width_cm=300
        )

    def test_measurement_saves_curtain_fabric_and_meters(self):
        """Test that Measurement saves curtain_fabric and curtain_meters"""
        measurement = Measurement.objects.create(
            order=self.order,
            room_name="Living Room",
            window_name="Window 1",
            width_cm=200,
            height_cm=150,
            curtain_fabric=self.fabric1,
            curtain_meters=Decimal("5.5"),
        )

        # Reload from DB
        measurement.refresh_from_db()

        assert measurement.curtain_fabric == self.fabric1
        assert measurement.curtain_meters == Decimal("5.5")
        assert measurement.room_name == "Living Room"
        assert measurement.window_name == "Window 1"

    def test_measurement_saves_tulle_fabric_and_meters(self):
        """Test that Measurement saves tulle_fabric and tulle_meters"""
        measurement = Measurement.objects.create(
            order=self.order,
            room_name="Bedroom",
            window_name="Window 2",
            width_cm=180,
            height_cm=140,
            tulle_fabric=self.fabric2,
            tulle_meters=Decimal("4.2"),
        )

        measurement.refresh_from_db()

        assert measurement.tulle_fabric == self.fabric2
        assert measurement.tulle_meters == Decimal("4.2")

    def test_measurement_saves_both_fabrics(self):
        """Test saving both curtain and tulle fabrics in one measurement"""
        measurement = Measurement.objects.create(
            order=self.order,
            room_name="Kitchen",
            window_name="Window 3",
            width_cm=120,
            height_cm=100,
            curtain_fabric=self.fabric1,
            curtain_meters=Decimal("3.0"),
            tulle_fabric=self.fabric2,
            tulle_meters=Decimal("2.5"),
        )

        measurement.refresh_from_db()

        # Verify both fabrics saved
        assert measurement.curtain_fabric == self.fabric1
        assert measurement.curtain_meters == Decimal("3.0")
        assert measurement.tulle_fabric == self.fabric2
        assert measurement.tulle_meters == Decimal("2.5")

    def test_measurement_fabrics_optional(self):
        """Test that fabric fields are optional"""
        measurement = Measurement.objects.create(
            order=self.order,
            room_name="Bathroom",
            window_name="Window 4",
            width_cm=80,
            height_cm=60,
        )

        assert measurement.curtain_fabric is None
        assert measurement.curtain_meters == Decimal("0")
        assert measurement.tulle_fabric is None
        assert measurement.tulle_meters == Decimal("0")

    def test_measurement_no_price_fields(self):
        """Test that Measurement does NOT contain price/cost/total fields"""
        # Get all Measurement fields
        fields = [f.name for f in Measurement._meta.get_fields()]

        # Price/cost fields should NOT exist in Measurement
        price_fields = [
            'price_per_meter', 'fabric_cost', 'tulle_cost',
            'sewing_cost', 'cornice_cost', 'installation_price',
            'line_total', 'discount', 'total'
        ]

        for field in price_fields:
            assert field not in fields, f"Price field '{field}' should NOT exist in Measurement"

    def test_legacy_selected_fabric_still_works(self):
        """Test legacy selected_fabric field still works for compatibility"""
        measurement = Measurement.objects.create(
            order=self.order,
            room_name="Study",
            window_name="Window 5",
            width_cm=150,
            height_cm=120,
            selected_fabric=self.fabric1,  # Legacy field
        )

        measurement.refresh_from_db()
        assert measurement.selected_fabric == self.fabric1

    def test_related_names(self):
        """Test related_names for fabric relationships"""
        Measurement.objects.create(
            order=self.order,
            room_name="Test Room",
            window_name="Test Window",
            width_cm=100,
            height_cm=80,
            curtain_fabric=self.fabric1,
            tulle_fabric=self.fabric2,
        )

        # Check related_names work
        assert self.fabric1.curtain_measurements.count() == 1
        assert self.fabric2.tulle_measurements.count() == 1


@pytest.mark.django_db
class TestMeasurementAPI(TestCase):
    """Test Measurement API returns new fields"""

    def setUp(self):
        """Set up test data with API client"""
        from rest_framework.test import APIClient

        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123"
        )
        self.client.force_authenticate(user=self.user)

        self.customer = Customer.objects.create(
            full_name="API Test Customer",
            phone="+79001234568"
        )
        self.order = Order.objects.create(
            customer=self.customer,
            order_number="О-2024-002"
        )
        self.fabric = Fabric.objects.create(
            name="API Fabric",
            hanger_number="API-001",
            price_per_meter=Decimal("1200.00"),
            width_cm=280
        )

    def test_api_returns_curtain_fabric_fields(self):
        """Test API returns curtain_fabric and curtain_meters"""
        measurement = Measurement.objects.create(
            order=self.order,
            room_name="API Room",
            window_name="API Window",
            width_cm=200,
            height_cm=150,
            curtain_fabric=self.fabric,
            curtain_meters=Decimal("4.5"),
        )

        response = self.client.get(f'/api/measurements/{measurement.id}/')
        assert response.status_code == 200

        data = response.json()
        assert 'curtain_fabric' in data
        assert 'curtain_fabric_details' in data
        assert 'curtain_meters' in data
        assert data['curtain_fabric'] == str(self.fabric.id)
        assert Decimal(str(data['curtain_meters'])) == Decimal("4.5")

    def test_api_returns_tulle_fabric_fields(self):
        """Test API returns tulle_fabric and tulle_meters"""
        tulle_fabric = Fabric.objects.create(
            name="API Tulle",
            hanger_number="API-T-001",
            price_per_meter=Decimal("600.00"),
            width_cm=300
        )

        measurement = Measurement.objects.create(
            order=self.order,
            room_name="API Room 2",
            window_name="API Window 2",
            width_cm=180,
            height_cm=140,
            tulle_fabric=tulle_fabric,
            tulle_meters=Decimal("3.8"),
        )

        response = self.client.get(f'/api/measurements/{measurement.id}/')
        assert response.status_code == 200

        data = response.json()
        assert 'tulle_fabric' in data
        assert 'tulle_fabric_details' in data
        assert 'tulle_meters' in data
        assert data['tulle_fabric'] == str(tulle_fabric.id)

    def test_api_list_includes_fabric_fields(self):
        """Test API list endpoint includes fabric fields"""
        Measurement.objects.create(
            order=self.order,
            room_name="List Room",
            window_name="List Window",
            width_cm=150,
            height_cm=120,
            curtain_fabric=self.fabric,
            curtain_meters=Decimal("3.0"),
        )

        response = self.client.get('/api/measurements/')
        assert response.status_code == 200

        data = response.json()
        assert 'results' in data
        if len(data['results']) > 0:
            item = data['results'][0]
            assert 'curtain_fabric_hanger' in item
            assert 'curtain_fabric_name' in item
            assert 'curtain_meters' in item

    def test_api_no_price_fields_in_response(self):
        """Test API does NOT return price/cost fields"""
        measurement = Measurement.objects.create(
            order=self.order,
            room_name="Price Test Room",
            window_name="Price Test Window",
            width_cm=100,
            height_cm=80,
            curtain_fabric=self.fabric,
            curtain_meters=Decimal("2.0"),
        )

        response = self.client.get(f'/api/measurements/{measurement.id}/')
        assert response.status_code == 200

        data = response.json()

        # Price fields should NOT be in response
        price_fields = [
            'price_per_meter', 'fabric_cost', 'tulle_cost',
            'sewing_cost', 'cornice_cost', 'installation_price',
            'line_total', 'discount', 'total'
        ]

        for field in price_fields:
            assert field not in data, f"Price field '{field}' should NOT be in API response"

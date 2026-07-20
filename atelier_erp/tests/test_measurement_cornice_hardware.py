"""
Тесты «Крепление» (cornice_item) и «Фурнитура» (hardware_item) на замере.

2026-07-20: заменили абстрактный mounting_type (текстовый выбор из
MOUNTING_OPTIONS на фронте) на конкретную позицию склада категории «Карниз» —
и добавили отдельное поле «Фурнитура» из категории «Фурнитура». Обе позиции
берутся из InventoryItem, а не заводят свой справочник.
"""

import pytest
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from atelier_erp.models import Customer, InventoryItem, Measurement, Order
from atelier_erp.roles import Roles

User = get_user_model()


@pytest.mark.django_db
class TestMeasurementCorniceHardwareModel(TestCase):
    def setUp(self):
        self.customer = Customer.objects.create(full_name="C", phone="+79001112233")
        self.order = Order.objects.create(customer=self.customer, order_number="О-2024-980")
        self.cornice = InventoryItem.objects.create(
            name="Карниз потолочный 3м", category=InventoryItem.Category.CORNICE,
            unit=InventoryItem.Unit.PIECE, quantity=Decimal("10"),
        )
        self.hardware = InventoryItem.objects.create(
            name="Крючки", category=InventoryItem.Category.ACCESSORY,
            unit=InventoryItem.Unit.PIECE, quantity=Decimal("100"),
        )

    def test_saves_cornice_and_hardware(self):
        m = Measurement.objects.create(
            order=self.order, room_name="Гостиная", window_name="Окно 1",
            width_cm=200, height_cm=150,
            cornice_item=self.cornice, cornice_quantity=Decimal("1"),
            hardware_item=self.hardware, hardware_quantity=Decimal("8"),
        )
        m.refresh_from_db()
        assert m.cornice_item == self.cornice
        assert m.cornice_quantity == Decimal("1")
        assert m.hardware_item == self.hardware
        assert m.hardware_quantity == Decimal("8")

    def test_optional_by_default(self):
        m = Measurement.objects.create(
            order=self.order, room_name="Кухня", window_name="Окно 1",
            width_cm=100, height_cm=100,
        )
        assert m.cornice_item is None
        assert m.cornice_quantity == Decimal("0")
        assert m.hardware_item is None
        assert m.hardware_quantity == Decimal("0")


@pytest.mark.django_db
class TestMeasurementCorniceHardwareAPI(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="own1", password="pass12345")
        group, _ = Group.objects.get_or_create(name=Roles.OWNER)
        self.user.groups.add(group)
        self.client.force_authenticate(user=self.user)

        self.customer = Customer.objects.create(full_name="C2", phone="+79001112244")
        self.order = Order.objects.create(customer=self.customer, order_number="О-2024-981")
        self.cornice = InventoryItem.objects.create(
            name="Карниз шинный", category=InventoryItem.Category.CORNICE,
            unit=InventoryItem.Unit.METER, quantity=Decimal("50"),
        )
        self.hardware = InventoryItem.objects.create(
            name="Люверсы", category=InventoryItem.Category.ACCESSORY,
            unit=InventoryItem.Unit.PIECE, quantity=Decimal("200"),
        )
        self.wrong_category_item = InventoryItem.objects.create(
            name="Ткань лён", category=InventoryItem.Category.FABRIC,
            unit=InventoryItem.Unit.METER, quantity=Decimal("30"),
        )

    def _create_payload(self, **overrides):
        payload = {
            "order": str(self.order.id),
            "room_name": "Спальня",
            "window_name": "Окно 1",
            "width_cm": 180,
            "height_cm": 140,
            "cornice_item": str(self.cornice.id),
            "cornice_quantity": "2.5",
            "hardware_item": str(self.hardware.id),
            "hardware_quantity": "12",
        }
        payload.update(overrides)
        return payload

    def test_create_measurement_with_cornice_and_hardware(self):
        resp = self.client.post("/api/v1/measurements/", self._create_payload(), format="json")
        assert resp.status_code == 201, resp.content
        created = resp.json()
        assert created["cornice_item"] == str(self.cornice.id)
        assert Decimal(str(created["cornice_quantity"])) == Decimal("2.5")
        assert created["hardware_item"] == str(self.hardware.id)
        assert Decimal(str(created["hardware_quantity"])) == Decimal("12")

        # Детали (name/unit) отдаёт только read-серилайзер (GET), не write (POST).
        detail = self.client.get(f'/api/v1/measurements/{created["id"]}/').json()
        assert detail["cornice_item_details"]["name"] == "Карниз шинный"
        assert detail["cornice_item_details"]["unit_display"] == "м"
        assert detail["hardware_item_details"]["name"] == "Люверсы"

    def test_cornice_item_must_be_cornice_category(self):
        resp = self.client.post(
            "/api/v1/measurements/",
            self._create_payload(cornice_item=str(self.wrong_category_item.id)),
            format="json",
        )
        assert resp.status_code == 400, resp.content
        assert "cornice_item" in resp.json()

    def test_hardware_item_must_be_accessory_category(self):
        resp = self.client.post(
            "/api/v1/measurements/",
            self._create_payload(hardware_item=str(self.wrong_category_item.id)),
            format="json",
        )
        assert resp.status_code == 400, resp.content
        assert "hardware_item" in resp.json()

    def test_cornice_and_hardware_are_optional(self):
        payload = self._create_payload()
        del payload["cornice_item"], payload["cornice_quantity"]
        del payload["hardware_item"], payload["hardware_quantity"]
        resp = self.client.post("/api/v1/measurements/", payload, format="json")
        assert resp.status_code == 201, resp.content
        data = resp.json()
        assert data["cornice_item"] is None
        assert data["hardware_item"] is None

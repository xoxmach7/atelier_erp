"""
Tests for M2.2 — авторасчёт метража ткани/тюля из замеров.

Метраж вычисляется сервером из ширины окна и коэффициента сборки; клиент его
не задаёт. См. services.measurement_calc и action orders/{id}/measurements/.
"""

import pytest
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from atelier_erp.models import Measurement, Order, Customer, Fabric
from atelier_erp.roles import Roles
from atelier_erp.services.measurement_calc import compute_meters, ceil_to_tenth

User = get_user_model()


class TestMeterageFormula(TestCase):
    """Юнит-тесты формулы метража (без БД)."""

    def test_basic(self):
        # 300 см × 2.2 / 100 = 6.6 м
        assert compute_meters(300, Decimal('2.2'), has_fabric=True) == Decimal('6.6')

    def test_rounds_up_to_tenth(self):
        # 305 × 2.2 / 100 = 6.71 → округл. вверх до 6.8
        assert compute_meters(305, Decimal('2.2'), has_fabric=True) == Decimal('6.8')

    def test_exact_value_not_rounded_up(self):
        # 100 × 2.0 / 100 = 2.0 ровно — не должно уйти в 2.1
        assert compute_meters(100, Decimal('2.0'), has_fabric=True) == Decimal('2.0')

    def test_zero_when_no_fabric(self):
        assert compute_meters(300, Decimal('2.2'), has_fabric=False) == Decimal('0')

    def test_ceil_helper(self):
        assert ceil_to_tenth(Decimal('6.61')) == Decimal('6.7')
        assert ceil_to_tenth(Decimal('6.60')) == Decimal('6.6')


@pytest.mark.django_db
class TestMeasurementCreateEndpoint(TestCase):
    """POST /orders/{id}/measurements/ вычисляет метраж и игнорирует присланный."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="meas", password="pass12345")
        owner, _ = Group.objects.get_or_create(name=Roles.OWNER)
        self.user.groups.add(owner)
        self.client.force_authenticate(user=self.user)

        self.customer = Customer.objects.create(full_name="C", phone="+79990000000")
        self.order = Order.objects.create(customer=self.customer, order_number="О-2024-777")
        self.curtain = Fabric.objects.create(
            name="Бархат", hanger_number="B-1", price_per_meter=Decimal('1500'), width_cm=280
        )
        self.tulle = Fabric.objects.create(
            name="Тюль Белый", hanger_number="T-1", price_per_meter=Decimal('800'), width_cm=300
        )

    def _post(self, body):
        return self.client.post(
            f'/api/v1/orders/{self.order.id}/measurements/', body, format='json'
        )

    def test_computes_both_meterages(self):
        resp = self._post({
            'room_name': 'Гостиная', 'window_number': 'Окно 1',
            'width': 300, 'height': 250,
            'curtain_fabric_name': 'Бархат', 'curtain_gathering': '2.2',
            'tulle_fabric_name': 'Тюль Белый', 'tulle_gathering': '2.0',
        })
        assert resp.status_code == 201, resp.content
        m = Measurement.objects.get(order=self.order)
        assert m.curtain_fabric == self.curtain
        assert m.tulle_fabric == self.tulle
        assert m.curtain_meters == Decimal('6.6')   # 300 × 2.2 / 100
        assert m.tulle_meters == Decimal('6.0')     # 300 × 2.0 / 100
        assert m.curtain_gathering == Decimal('2.2')
        assert m.tulle_gathering == Decimal('2.0')

    def test_uses_default_gathering_when_omitted(self):
        resp = self._post({
            'room_name': 'Спальня', 'width': 200, 'height': 220,
            'curtain_fabric_name': 'Бархат',
        })
        assert resp.status_code == 201, resp.content
        m = Measurement.objects.get(order=self.order)
        assert m.curtain_meters == Decimal('4.4')   # 200 × 2.2(default) / 100
        assert m.tulle_meters == Decimal('0')       # тюль не выбран

    def test_patch_recomputes_meters_and_ignores_client_value(self):
        """PATCH /measurements/{id}/ (веб-путь) тоже считает метраж сам."""
        resp = self._post({
            'room_name': 'Зал', 'width': 200, 'height': 220,
            'curtain_fabric_name': 'Бархат', 'curtain_gathering': '2.0',
        })
        assert resp.status_code == 201, resp.content
        m = Measurement.objects.get(order=self.order)
        assert m.curtain_meters == Decimal('4.0')

        # Меняем сборку и пытаемся навязать метраж — сервер пересчитает сам.
        patch = self.client.patch(
            f'/api/v1/measurements/{m.id}/',
            {'curtain_gathering': '2.5', 'curtain_meters': '999'},
            format='json',
        )
        assert patch.status_code == 200, patch.content
        m.refresh_from_db()
        assert m.curtain_gathering == Decimal('2.5')
        assert m.curtain_meters == Decimal('5.0')   # 200 × 2.5 / 100, не 999

    def test_client_supplied_meters_ignored(self):
        # Клиент пытается навязать метраж — сервер его игнорирует и считает сам.
        resp = self._post({
            'room_name': 'Кухня', 'width': 100, 'height': 100,
            'curtain_fabric_name': 'Бархат', 'curtain_gathering': '2.0',
            'curtain_meters': '999', 'tulle_meters': '999',
        })
        assert resp.status_code == 201, resp.content
        m = Measurement.objects.get(order=self.order)
        assert m.curtain_meters == Decimal('2.0')   # 100 × 2.0 / 100, не 999

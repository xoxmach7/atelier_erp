"""
Метраж ткани/тюля в замере — ручной ввод (2026-07-20).

Раньше метраж вычислялся сервером из ширины окна и коэффициента сборки
(M2.2). По прямому запросу владельца формула была признана сырой и
отключена везде: и на вебе (MeasurementWriteSerializer), и в мобилке
(MeasurementCreateSerializer, action orders/{id}/measurements/). Метраж —
обычное писабельное поле, ничем не отличающееся от прочих; клиент
задаёт число сам (или оставляет 0/не указывает).
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
    """Формула compute_meters всё ещё используется — seed_demo.py генерирует
    правдоподобные демо-данные тем же расчётом. API её больше не вызывает."""

    def test_basic(self):
        assert compute_meters(300, Decimal('2.2'), has_fabric=True) == Decimal('6.6')

    def test_rounds_up_to_tenth(self):
        assert compute_meters(305, Decimal('2.2'), has_fabric=True) == Decimal('6.8')

    def test_exact_value_not_rounded_up(self):
        assert compute_meters(100, Decimal('2.0'), has_fabric=True) == Decimal('2.0')

    def test_zero_when_no_fabric(self):
        assert compute_meters(300, Decimal('2.2'), has_fabric=False) == Decimal('0')

    def test_ceil_helper(self):
        assert ceil_to_tenth(Decimal('6.61')) == Decimal('6.7')
        assert ceil_to_tenth(Decimal('6.60')) == Decimal('6.6')


@pytest.mark.django_db
class TestMeasurementCreateEndpoint(TestCase):
    """POST /orders/{id}/measurements/ (мобильный путь) — метраж ручной."""

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

    def test_saves_manually_supplied_meters(self):
        resp = self._post({
            'room_name': 'Гостиная', 'window_number': 'Окно 1',
            'width': 300, 'height': 250,
            'curtain_fabric_name': 'Бархат', 'curtain_meters': '8',
            'tulle_fabric_name': 'Тюль Белый', 'tulle_meters': '5.5',
        })
        assert resp.status_code == 201, resp.content
        m = Measurement.objects.get(order=self.order)
        assert m.curtain_fabric == self.curtain
        assert m.tulle_fabric == self.tulle
        assert m.curtain_meters == Decimal('8.00')
        assert m.tulle_meters == Decimal('5.50')

    def test_defaults_to_zero_when_meters_omitted(self):
        resp = self._post({
            'room_name': 'Спальня', 'width': 200, 'height': 220,
            'curtain_fabric_name': 'Бархат',
        })
        assert resp.status_code == 201, resp.content
        m = Measurement.objects.get(order=self.order)
        assert m.curtain_meters == Decimal('0.00')
        assert m.tulle_meters == Decimal('0.00')

    def test_patch_saves_manual_meters(self):
        """PATCH /measurements/{id}/ (веб- и мобайл-путь MeasurementWriteSerializer)."""
        resp = self._post({
            'room_name': 'Зал', 'width': 200, 'height': 220,
            'curtain_fabric_name': 'Бархат',
        })
        assert resp.status_code == 201, resp.content
        m = Measurement.objects.get(order=self.order)
        assert m.curtain_meters == Decimal('0.00')

        patch = self.client.patch(
            f'/api/v1/measurements/{m.id}/', {'curtain_meters': '8'}, format='json',
        )
        assert patch.status_code == 200, patch.content
        m.refresh_from_db()
        assert m.curtain_meters == Decimal('8.00')

    def test_patch_without_meters_key_keeps_existing_value(self):
        """Ключ не передан — значение не трогается (не пересчитывается и не обнуляется)."""
        resp = self._post({
            'room_name': 'Кухня', 'width': 200, 'height': 220,
            'curtain_fabric_name': 'Бархат', 'curtain_meters': '6',
        })
        assert resp.status_code == 201, resp.content
        m = Measurement.objects.get(order=self.order)
        assert m.curtain_meters == Decimal('6.00')

        patch = self.client.patch(
            f'/api/v1/measurements/{m.id}/', {'notes': 'просто комментарий'}, format='json',
        )
        assert patch.status_code == 200, patch.content
        m.refresh_from_db()
        assert m.curtain_meters == Decimal('6.00')

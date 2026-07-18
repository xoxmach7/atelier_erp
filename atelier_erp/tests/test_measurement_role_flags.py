"""
Права на замеры для склада и швеи.

Складу нужна галочка `materials_ready`, швее — `sewing_done`, но обеим ролям
нельзя править сам замер (размеры, ткани, коэффициенты). Раньше на вьюхе стоял
IsOwnerOrDesigner, из-за чего складская галочка молча возвращала 403.
"""

import pytest
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import Group
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from atelier_erp.models import Order, Customer, Measurement, Fabric
from atelier_erp.roles import Roles

User = get_user_model()


@pytest.mark.django_db
class TestMeasurementRoleFlags(TestCase):
    def setUp(self):
        self.customer = Customer.objects.create(full_name="R", phone="+70000000040")
        self.order = Order.objects.create(
            customer=self.customer, order_number="О-2024-950",
            status=Order.Status.IN_PRODUCTION,
        )
        self.fabric = Fabric.objects.create(
            name="Блэкаут", hanger_number="BL-950",
            price_per_meter=Decimal('3000'), width_cm=280,
        )
        self.measurement = Measurement.objects.create(
            order=self.order, room_name="Гостиная", window_name="Окно 1",
            width_cm=100, height_cm=150, curtain_fabric=self.fabric,
        )

    def _client_for(self, role):
        group, _ = Group.objects.get_or_create(name=role)
        user = User.objects.create_user(username=f"u_{role}", password="pwd12345")
        user.groups.add(group)
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def _url(self):
        return f"/api/v1/measurements/{self.measurement.id}/"

    def test_warehouse_can_set_materials_ready(self):
        client = self._client_for(Roles.WAREHOUSE)
        resp = client.patch(self._url(), {'materials_ready': True}, format='json')
        assert resp.status_code == 200, resp.content
        self.measurement.refresh_from_db()
        assert self.measurement.materials_ready is True

    def test_seamstress_can_set_sewing_done(self):
        client = self._client_for(Roles.SEAMSTRESS)
        resp = client.patch(self._url(), {'sewing_done': True}, format='json')
        assert resp.status_code == 200, resp.content
        self.measurement.refresh_from_db()
        assert self.measurement.sewing_done is True

    def test_warehouse_cannot_edit_window_dimensions(self):
        """Галочка — да, переписать замер — нет."""
        client = self._client_for(Roles.WAREHOUSE)
        resp = client.patch(
            self._url(), {'materials_ready': True, 'width_cm': 999}, format='json',
        )
        assert resp.status_code == 200, resp.content
        self.measurement.refresh_from_db()
        assert self.measurement.materials_ready is True
        # Лишнее поле проигнорировано узким сериализатором.
        assert self.measurement.width_cm == 100

    def test_seamstress_cannot_flip_warehouse_flag(self):
        """Швея не отмечает материалы за склад."""
        client = self._client_for(Roles.SEAMSTRESS)
        resp = client.patch(self._url(), {'materials_ready': True}, format='json')
        assert resp.status_code == 200, resp.content
        self.measurement.refresh_from_db()
        assert self.measurement.materials_ready is False

    def test_warehouse_cannot_delete_measurement(self):
        client = self._client_for(Roles.WAREHOUSE)
        resp = client.delete(self._url())
        assert resp.status_code == 403

    def test_seamstress_cannot_create_measurement(self):
        client = self._client_for(Roles.SEAMSTRESS)
        resp = client.post(
            "/api/v1/measurements/",
            {'order': str(self.order.id), 'room_name': "X", 'window_name': "Y",
             'width_cm': 100, 'height_cm': 100},
            format='json',
        )
        assert resp.status_code == 403

    def test_designer_still_has_full_edit(self):
        client = self._client_for(Roles.DESIGNER)
        resp = client.patch(self._url(), {'width_cm': 220}, format='json')
        assert resp.status_code == 200, resp.content
        self.measurement.refresh_from_db()
        assert self.measurement.width_cm == 220

    def test_installer_has_no_access(self):
        client = self._client_for(Roles.INSTALLER)
        resp = client.patch(self._url(), {'sewing_done': True}, format='json')
        assert resp.status_code == 403

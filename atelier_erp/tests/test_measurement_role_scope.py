"""
Замеры не шире заказов.

`MeasurementViewSet` не сужал выборку по роли: исполнитель не видел чужой заказ
в списке, но мог прочитать и отметить галочку на его замере по прямому id.
С автопродвижением статусов (services/status_automation.py) это уже не вопрос
дисциплины — ошибочная галочка двигает статус чужого заказа.

Правило одно на заказы и замеры и живёт в `api/v1/role_scope.py`.
"""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIClient

from atelier_erp.models import Customer, Measurement, Order
from atelier_erp.roles import Roles

User = get_user_model()


def _client_for(role, username):
    group, _ = Group.objects.get_or_create(name=role)
    user = User.objects.create_user(username=username, password='pwd12345')
    user.groups.add(group)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestMeasurementRoleScope(TestCase):
    def setUp(self):
        self.customer = Customer.objects.create(full_name='S', phone='+70000000077')

        # Заказ в производстве — виден цеху; установщику тоже (2026-07-20:
        # видимость установщика включает группу «В работе», не только монтаж).
        self.sewing_order = Order.objects.create(
            customer=self.customer, order_number='О-2024-970',
            status=Order.Status.IN_PRODUCTION,
        )
        self.sewing_m = Measurement.objects.create(
            order=self.sewing_order, room_name='Гостиная', window_name='Окно 1',
            width_cm=100, height_cm=150,
        )

        # Заказ на монтаже — виден установщику, не виден цеху.
        self.install_order = Order.objects.create(
            customer=self.customer, order_number='О-2024-971',
            status=Order.Status.ON_INSTALLATION,
        )
        self.install_m = Measurement.objects.create(
            order=self.install_order, room_name='Кухня', window_name='Окно 1',
            width_cm=120, height_cm=140,
        )

        # Черновик — не виден никому из исполнителей.
        self.new_order = Order.objects.create(
            customer=self.customer, order_number='О-2024-972',
            status=Order.Status.NEW,
        )
        self.new_m = Measurement.objects.create(
            order=self.new_order, room_name='Спальня', window_name='Окно 1',
            width_cm=90, height_cm=200,
        )

    def _url(self, measurement):
        return f'/api/v1/measurements/{measurement.id}/'

    def test_seamstress_cannot_read_measurement_of_invisible_order(self):
        client = _client_for(Roles.SEAMSTRESS, 'scope_seam')
        assert client.get(self._url(self.sewing_m)).status_code == 200
        assert client.get(self._url(self.install_m)).status_code == 404
        assert client.get(self._url(self.new_m)).status_code == 404

    def test_seamstress_cannot_flag_measurement_of_invisible_order(self):
        """Главный кейс: галочка на чужом заказе двигала бы его статус."""
        client = _client_for(Roles.SEAMSTRESS, 'scope_seam2')
        resp = client.patch(
            self._url(self.install_m), {'sewing_done': True}, format='json',
        )
        assert resp.status_code == 404, resp.content
        self.install_m.refresh_from_db()
        assert self.install_m.sewing_done is False

    def test_installer_sees_in_work_group_but_not_waiting(self):
        """
        Установщик видит группу «В работе» (2026-07-20), не только монтаж —
        но черновик (`new`) без просрочки ему по-прежнему не нужен.
        """
        client = _client_for(Roles.INSTALLER, 'scope_inst')
        assert client.get(self._url(self.install_m)).status_code == 200
        assert client.get(self._url(self.sewing_m)).status_code == 200
        assert client.get(self._url(self.new_m)).status_code == 404

    def test_installer_sees_overdue_draft_too(self):
        """Просроченный черновик — исключение: должен всплыть даже установщику."""
        from datetime import timedelta
        from django.utils import timezone

        self.new_order.planned_completion = timezone.localtime(timezone.now()).date() - timedelta(days=1)
        self.new_order.save(update_fields=['planned_completion'])
        client = _client_for(Roles.INSTALLER, 'scope_inst_overdue')
        assert client.get(self._url(self.new_m)).status_code == 200

    def test_list_is_narrowed_too(self):
        """Не только доступ по id — список тоже не должен показывать лишнее."""
        client = _client_for(Roles.SEAMSTRESS, 'scope_seam3')
        resp = client.get('/api/v1/measurements/')
        assert resp.status_code == 200
        body = resp.json()
        rows = body['results'] if isinstance(body, dict) and 'results' in body else body
        returned = {row['id'] for row in rows}
        assert str(self.sewing_m.id) in returned
        assert str(self.install_m.id) not in returned
        assert str(self.new_m.id) not in returned

    def test_designer_still_sees_everything(self):
        """Сужение не должно задеть тех, кто ведёт замеры."""
        client = _client_for(Roles.DESIGNER, 'scope_designer')
        for m in (self.sewing_m, self.install_m, self.new_m):
            assert client.get(self._url(m)).status_code == 200

    def test_role_without_group_sees_nothing(self):
        """
        Default deny: пользователь без роли не получает ни одного замера.

        Здесь срабатывает раньше разрешение `CanAccessMeasurement` (403), до
        ролевого сужения queryset (оно дало бы 404). Проверяем факт отказа, а
        не конкретный код — обе линии защиты рабочие, и порядок их срабатывания
        не то, что стоит закреплять тестом.
        """
        user = User.objects.create_user(username='scope_nobody', password='pwd12345')
        client = APIClient()
        client.force_authenticate(user=user)
        assert client.get(self._url(self.sewing_m)).status_code in (403, 404)
        assert client.get('/api/v1/measurements/').status_code in (403, 404)

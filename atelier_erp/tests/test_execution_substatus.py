"""
Ролевой подстатус «Исполнение».

Швейный цех: появляется, когда склад отметил материалы готовыми; пропадает,
когда сшиты все изделия.
Установщик: появляется, когда сшиты все изделия; пропадает после загрузки АВР.

Один и тот же заказ одновременно «в исполнении» для одной роли и нет для
другой — это и проверяем.
"""

import pytest
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import Group
from django.contrib.auth import get_user_model

from atelier_erp.models import Order, Customer, Measurement, OrderCompletionAct
from atelier_erp.constants import MaterialReadiness
from atelier_erp.api.v1.substatus import (
    get_execution_substatus, execution_substatus_annotations,
    EXECUTION, PREPARATION, INSTALLATION, DONE,
)
from atelier_erp.roles import Roles

User = get_user_model()


def _user(role):
    group, _ = Group.objects.get_or_create(name=role)
    user = User.objects.create_user(username=f"sub_{role}", password="pwd12345")
    user.groups.add(group)
    return user


@pytest.mark.django_db
class TestExecutionSubstatus(TestCase):
    def setUp(self):
        self.customer = Customer.objects.create(full_name="Sub", phone="+70000000050")
        self.order = Order.objects.create(
            customer=self.customer, order_number="О-2024-960",
            status=Order.Status.IN_PRODUCTION,
            material_readiness=MaterialReadiness.READY,
        )
        self.w1 = Measurement.objects.create(
            order=self.order, room_name="Гостиная", window_name="Окно 1",
            width_cm=100, height_cm=150,
        )
        self.w2 = Measurement.objects.create(
            order=self.order, room_name="Спальня", window_name="Окно 1",
            width_cm=200, height_cm=200,
        )
        self.seamstress = _user(Roles.SEAMSTRESS)
        self.installer = _user(Roles.INSTALLER)

    def _fresh(self):
        """Заказ из аннотированного queryset — как его отдаёт OrderViewSet."""
        return (
            Order.objects.filter(pk=self.order.pk)
            .annotate(**execution_substatus_annotations())
            .first()
        )

    # ── Швейный цех ──────────────────────────────────────────────────────────

    def test_seamstress_sees_execution_when_materials_ready(self):
        assert get_execution_substatus(self._fresh(), self.seamstress) == EXECUTION

    def test_seamstress_no_execution_until_materials_ready(self):
        self.order.material_readiness = MaterialReadiness.NOT_READY
        self.order.save(update_fields=['material_readiness'])
        assert get_execution_substatus(self._fresh(), self.seamstress) is None

    def test_seamstress_execution_persists_while_some_windows_left(self):
        self.w1.sewing_done = True
        self.w1.save(update_fields=['sewing_done'])
        assert get_execution_substatus(self._fresh(), self.seamstress) == EXECUTION

    def test_seamstress_execution_gone_when_all_windows_sewn(self):
        Measurement.objects.filter(order=self.order).update(sewing_done=True)
        assert get_execution_substatus(self._fresh(), self.seamstress) is None

    # ── Установщик: 3 стадии, всегда одна из них (2026-07-21) ───────────────

    def test_installer_preparation_while_not_everything_sewn(self):
        self.w1.sewing_done = True
        self.w1.save(update_fields=['sewing_done'])
        assert get_execution_substatus(self._fresh(), self.installer) == PREPARATION

    def test_installer_installation_when_all_sewn(self):
        Measurement.objects.filter(order=self.order).update(sewing_done=True)
        assert get_execution_substatus(self._fresh(), self.installer) == INSTALLATION

    def test_installer_done_after_act_uploaded(self):
        Measurement.objects.filter(order=self.order).update(sewing_done=True)
        OrderCompletionAct.objects.create(order=self.order, is_active=True)
        assert get_execution_substatus(self._fresh(), self.installer) == DONE

    # ── Разграничение ────────────────────────────────────────────────────────

    def test_handoff_between_roles_is_exclusive(self):
        """Пока шьют — исполнение у цеха, установщик в «Подготовке»; дошили — установщик переходит в «Установку»."""
        order = self._fresh()
        assert get_execution_substatus(order, self.seamstress) == EXECUTION
        assert get_execution_substatus(order, self.installer) == PREPARATION

        Measurement.objects.filter(order=self.order).update(sewing_done=True)

        order = self._fresh()
        assert get_execution_substatus(order, self.seamstress) is None
        assert get_execution_substatus(order, self.installer) == INSTALLATION

    def test_other_roles_never_get_substatus(self):
        order = self._fresh()
        for role in (Roles.OWNER, Roles.DESIGNER, Roles.WAREHOUSE):
            assert get_execution_substatus(order, _user(role)) is None

    def test_order_without_windows_seamstress_has_no_substatus_installer_is_preparation(self):
        """Швея: без замеров шить нечего — None. Установщик: всё ещё «Подготовка», монтаж не начат."""
        Measurement.objects.filter(order=self.order).delete()
        assert get_execution_substatus(self._fresh(), self.seamstress) is None
        assert get_execution_substatus(self._fresh(), self.installer) == PREPARATION

    def test_works_without_annotations(self):
        """Фолбэк-путь: объект получен в обход аннотированного queryset."""
        plain = Order.objects.get(pk=self.order.pk)
        assert get_execution_substatus(plain, self.seamstress) == EXECUTION

    # ── Сквозной путь через API ──────────────────────────────────────────────

    def test_substatus_reaches_the_list_endpoint(self):
        """Аннотации + контекст сериализатора работают на реальном запросе."""
        from rest_framework.test import APIClient

        client = APIClient()
        client.force_authenticate(user=self.seamstress)
        resp = client.get('/api/v1/orders/')
        assert resp.status_code == 200, resp.content

        rows = {r['order_number']: r for r in resp.json()['results']}
        assert self.order.order_number in rows, 'цех не видит свой заказ в списке'
        assert rows[self.order.order_number]['execution_substatus'] == EXECUTION

    def test_owner_list_has_null_substatus(self):
        from rest_framework.test import APIClient

        client = APIClient()
        client.force_authenticate(user=_user(Roles.OWNER))
        resp = client.get('/api/v1/orders/')
        assert resp.status_code == 200, resp.content
        row = next(r for r in resp.json()['results'] if r['order_number'] == self.order.order_number)
        assert row['execution_substatus'] is None

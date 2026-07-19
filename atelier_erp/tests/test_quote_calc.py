"""
Расчёт цены окна из выбранных тканей.

Цена перестала быть ручным вводом: метраж × цена ткани за метр, отдельно по
шторам и тюлю, затем × количество изделий. Формула живёт в одном месте
(services/quote_calc.py) и отдаётся клиентам готовой — веб и мобилка своей
копии не держат.
"""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIClient

from atelier_erp.models import Customer, Fabric, Measurement, Order
from atelier_erp.roles import Roles
from atelier_erp.services.quote_calc import window_price, window_price_breakdown

User = get_user_model()


@pytest.mark.django_db
class TestQuoteCalc(TestCase):
    def setUp(self):
        self.customer = Customer.objects.create(full_name='C', phone='+70000000111')
        self.order = Order.objects.create(
            customer=self.customer, order_number='О-2024-980', status=Order.Status.NEW,
        )
        self.curtain = Fabric.objects.create(
            name='Лён', hanger_number='LN-1',
            price_per_meter=Decimal('5000.00'), width_cm=280,
        )
        self.tulle = Fabric.objects.create(
            name='Вуаль', hanger_number='VL-1',
            price_per_meter=Decimal('3000.00'), width_cm=300,
        )

    def _measurement(self, **kwargs):
        defaults = dict(
            order=self.order, room_name='Гостиная', window_name='Окно 1',
            width_cm=100, height_cm=150,
        )
        defaults.update(kwargs)
        return Measurement.objects.create(**defaults)

    def test_price_is_meters_times_price_per_meter(self):
        m = self._measurement(
            curtain_fabric=self.curtain, curtain_meters=Decimal('2.20'),
        )
        # 2.2 м × 5000 = 11 000
        assert window_price(m) == Decimal('11000.00')

    def test_curtain_and_tulle_are_summed(self):
        m = self._measurement(
            curtain_fabric=self.curtain, curtain_meters=Decimal('2.20'),
            tulle_fabric=self.tulle, tulle_meters=Decimal('2.00'),
        )
        # 2.2×5000 + 2.0×3000 = 11 000 + 6 000
        assert window_price(m) == Decimal('17000.00')

    def test_quantity_multiplies_total(self):
        """Повторяющиеся окна не заводят отдельно — растят количество."""
        m = self._measurement(
            curtain_fabric=self.curtain, curtain_meters=Decimal('2.00'), quantity=3,
        )
        assert window_price(m) == Decimal('30000.00')

    def test_breakdown_keeps_layers_separate(self):
        """В КП стоимость слоёв хранится отдельными полями."""
        m = self._measurement(
            curtain_fabric=self.curtain, curtain_meters=Decimal('2.00'),
            tulle_fabric=self.tulle, tulle_meters=Decimal('1.00'),
            quantity=2,
        )
        b = window_price_breakdown(m)
        assert b['curtain_cost'] == Decimal('10000.00')
        assert b['tulle_cost'] == Decimal('3000.00')
        assert b['per_item'] == Decimal('13000.00')
        assert b['quantity'] == 2
        assert b['total'] == Decimal('26000.00')

    def test_no_fabric_selected_costs_nothing(self):
        """Пустой каталог тканей — цена 0, а не падение расчёта."""
        m = self._measurement(curtain_meters=Decimal('2.20'))
        assert window_price(m) == Decimal('0.00')

    def test_fabric_without_meters_costs_nothing(self):
        m = self._measurement(curtain_fabric=self.curtain, curtain_meters=Decimal('0'))
        assert window_price(m) == Decimal('0.00')

    def test_only_tulle_selected(self):
        m = self._measurement(tulle_fabric=self.tulle, tulle_meters=Decimal('2.50'))
        assert window_price(m) == Decimal('7500.00')

    def test_api_returns_calculated_price(self):
        """Клиент получает готовую цену, а не считает сам."""
        m = self._measurement(
            curtain_fabric=self.curtain, curtain_meters=Decimal('2.20'),
            tulle_fabric=self.tulle, tulle_meters=Decimal('2.00'),
        )
        group, _ = Group.objects.get_or_create(name=Roles.DESIGNER)
        user = User.objects.create_user(username='calc_designer', password='pwd12345')
        user.groups.add(group)
        client = APIClient()
        client.force_authenticate(user=user)

        resp = client.get(f'/api/v1/measurements/{m.id}/')
        assert resp.status_code == 200, resp.content
        body = resp.json()
        assert Decimal(body['calculated_price']) == Decimal('17000.00')
        assert Decimal(body['price_breakdown']['curtain_cost']) == Decimal('11000.00')
        assert body['price_breakdown']['quantity'] == 1

    def test_execution_summary_carries_price(self):
        """Мобильный экран заказа читает цену из execution summary."""
        from atelier_erp.services.order_execution_service import OrderExecutionService

        self._measurement(
            curtain_fabric=self.curtain, curtain_meters=Decimal('2.00'),
        )
        summary = OrderExecutionService().get_order_execution_summary(self.order)
        rows = summary['measurements']
        assert Decimal(rows[0]['calculated_price']) == Decimal('10000.00')

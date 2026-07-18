"""
Свой номер заказа при создании.

Ателье ведёт нумерацию по-своему, поэтому номер можно задать руками; если поле
пустое — работает прежний атомарный нумератор.
"""

import pytest
from django.test import TestCase
from django.contrib.auth.models import Group
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from atelier_erp.models import Order, Customer
from atelier_erp.roles import Roles

User = get_user_model()


@pytest.mark.django_db
class TestCustomOrderNumber(TestCase):
    def setUp(self):
        self.customer = Customer.objects.create(full_name="N", phone="+70000000080")
        group, _ = Group.objects.get_or_create(name=Roles.OWNER)
        user = User.objects.create_user(username="owner_num", password="pwd12345")
        user.groups.add(group)
        self.client_api = APIClient()
        self.client_api.force_authenticate(user=user)

    def _create(self, **extra):
        payload = {"customer_id": str(self.customer.id)}
        payload.update(extra)
        return self.client_api.post("/api/v1/orders/", payload, format="json")

    def test_custom_number_is_used_as_is(self):
        resp = self._create(order_number="ЗАКАЗ-А1")
        assert resp.status_code == 201, resp.content
        assert Order.objects.get(id=resp.json()["id"]).order_number == "ЗАКАЗ-А1"

    def test_blank_number_falls_back_to_generator(self):
        resp = self._create(order_number="")
        assert resp.status_code == 201, resp.content
        number = Order.objects.get(id=resp.json()["id"]).order_number
        assert number.startswith("О-")

    def test_omitted_number_falls_back_to_generator(self):
        resp = self._create()
        assert resp.status_code == 201, resp.content
        assert Order.objects.get(id=resp.json()["id"]).order_number.startswith("О-")

    def test_generator_survives_four_digit_numbers(self):
        """
        Регрессия: валидатор требовал ровно 3 цифры (`О-\\d{4}-\\d{3}$`), а
        next_number форматирует как {:03d} — на тысячном заказе получалось
        «О-2026-1000», и создание заказов ломалось совсем.
        """
        from atelier_erp.services.order_service import OrderService

        assert OrderService._validate_order_number("О-2026-1000") is True
        assert OrderService._validate_order_number("О-2026-999") is True

    def test_empty_number_is_invalid(self):
        from atelier_erp.services.order_service import OrderService

        assert OrderService._validate_order_number("") is False
        assert OrderService._validate_order_number("   ") is False

    def test_duplicate_number_is_rejected(self):
        assert self._create(order_number="ДУБЛЬ-1").status_code == 201
        resp = self._create(order_number="ДУБЛЬ-1")
        assert resp.status_code == 400
        assert Order.objects.filter(order_number="ДУБЛЬ-1").count() == 1

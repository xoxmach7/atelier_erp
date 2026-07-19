"""
Регресс: создание КП с веба/мобилки никогда не двигало статус заказа.

create-kp-modal.tsx (и мобильный экран КП) шлют POST /api/v1/quotes/ с
status="draft" и ничего больше не вызывают — ни approve, ни генерацию
позиций. У этого ателье нет отдельного шага «отправить клиенту / клиент
одобрил» в интерфейсе, поэтому Quote навсегда оставался в draft, а
order.status — в new: auto_advance в in_work требует ОДНОВРЕМЕННО
одобренного КП и сформированных позиций (см. status_automation.py).
"""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIClient

from atelier_erp.models import Customer, Order, OrderItem, Quote
from atelier_erp.roles import Roles

User = get_user_model()


@pytest.mark.django_db
class TestQuoteCreationAutoApprovesAndAdvancesOrder(TestCase):
    def setUp(self):
        group, _ = Group.objects.get_or_create(name=Roles.OWNER)
        user = User.objects.create_user(username="owner_kp", password="pwd12345")
        user.groups.add(group)
        self.client = APIClient()
        self.client.force_authenticate(user=user)

        self.customer = Customer.objects.create(full_name="К. Тестов", phone="+70000000099")
        self.order = Order.objects.create(
            customer=self.customer, order_number="О-2024-961",
            status=Order.Status.NEW,
        )

    def _create_quote_payload(self):
        return {
            "order_id": str(self.order.id),
            "status": "draft",
            "items": [
                {
                    "room_name": "Кухня",
                    "window_name": "Окно 1",
                    "line_total": 50000,
                }
            ],
        }

    def test_quote_is_approved_immediately(self):
        resp = self.client.post("/api/v1/quotes/", self._create_quote_payload(), format="json")
        assert resp.status_code == 201, resp.content
        assert resp.data["status"] == "approved"

    def test_order_items_generated_from_new_quote(self):
        resp = self.client.post("/api/v1/quotes/", self._create_quote_payload(), format="json")
        assert resp.status_code == 201, resp.content
        assert OrderItem.objects.filter(order=self.order).exists()

    def test_order_status_advances_to_in_work(self):
        resp = self.client.post("/api/v1/quotes/", self._create_quote_payload(), format="json")
        assert resp.status_code == 201, resp.content
        self.order.refresh_from_db()
        assert self.order.status == Order.Status.IN_WORK

    def test_quote_object_matches_approved_quote(self):
        resp = self.client.post("/api/v1/quotes/", self._create_quote_payload(), format="json")
        quote = Quote.objects.get(id=resp.data["id"])
        assert quote.status == Quote.Status.APPROVED

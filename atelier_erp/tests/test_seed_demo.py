"""Дымовой тест сидера: команда должна отрабатывать и наполнять все сущности."""
import pytest
from django.test import TestCase
from django.core.management import call_command
from django.contrib.auth.models import Group
from django.contrib.auth import get_user_model
from io import StringIO

from atelier_erp.models import Order, Customer, Measurement, Quote, QuoteItem

User = get_user_model()


@pytest.mark.django_db
class TestSeedDemo(TestCase):
    def setUp(self):
        g, _ = Group.objects.get_or_create(name="Designer")
        u = User.objects.create_user(username="d1", password="pwd12345")
        u.groups.add(g)

    def test_seed_creates_full_orders(self):
        out = StringIO()
        call_command("seed_demo", stdout=out)

        assert Order.objects.count() == 12
        assert Measurement.objects.count() > 0
        assert Quote.objects.count() == 12
        assert QuoteItem.objects.count() == Measurement.objects.count()

        # у каждого заказа есть адрес, даты и замеры
        for o in Order.objects.all():
            assert o.installation_address_city
            assert o.measurement_date is not None
            assert o.measurements.count() > 0
            assert o.total_amount > 0 or o.status == Order.Status.NEW

        # разные статусы представлены
        statuses = set(Order.objects.values_list("status", flat=True))
        assert len(statuses) >= 6

        # флаги по окнам расставлены по стадиям
        assert Measurement.objects.filter(materials_ready=True).exists()
        assert Measurement.objects.filter(sewing_done=True).exists()
        assert Measurement.objects.filter(installation_done=True).exists()
        assert Measurement.objects.filter(sewing_done=False).exists()

    def test_reset_is_idempotent(self):
        call_command("seed_demo", stdout=StringIO())
        call_command("seed_demo", "--reset", stdout=StringIO())
        assert Order.objects.count() == 12
        assert Customer.objects.count() == 3

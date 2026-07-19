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

    def test_fabrics_have_stock(self):
        """
        Раньше ткани создавались без stock_meters (по умолчанию 0): экран
        «Материалы» показывал «0 м / На исходе» по каждой ткани одновременно
        с тем, что заказы демонстрировали «Собран»/«В сборке» — выглядело
        как склад пуст, а материалы для заказов якобы уже есть.
        """
        from atelier_erp.models import Fabric

        call_command("seed_demo", stdout=StringIO())
        demo_fabrics = Fabric.objects.filter(name__startswith="[DEMO]")
        assert demo_fabrics.exists()
        for fabric in demo_fabrics:
            assert fabric.stock_meters > 0, fabric.name

    def test_fabric_stock_fixable_without_touching_orders(self):
        """
        `_ensure_fabrics` чинит уже засеянные ткани сама по себе, не завязана
        на --reset и не создаёт заказов. Важно для прода: полная команда
        `Order.objects.create()` без наличия ключа идемпотентности — повторный
        вызов `seed_demo` без --reset задублировал бы все 12 заказов, поэтому
        точечный фикс остатка ткани на проде обязан идти в обход всей команды
        (напрямую через `_ensure_fabrics` или прямым UPDATE), а не повторным
        запуском сидера.
        """
        from atelier_erp.management.commands.seed_demo import Command
        from atelier_erp.models import Fabric

        call_command("seed_demo", stdout=StringIO())
        Fabric.objects.filter(name__startswith="[DEMO]").update(stock_meters=0)
        orders_before = Order.objects.count()

        Command()._ensure_fabrics(tenant=None)

        assert Order.objects.count() == orders_before
        for fabric in Fabric.objects.filter(name__startswith="[DEMO]"):
            assert fabric.stock_meters > 0, fabric.name

    def test_data_is_bound_to_tenant(self):
        """
        Без tenant демо-данные не видны никому: TenantManager фильтрует
        filter(tenant_id=<текущий>), а записи с NULL под это не подпадают.
        """
        from atelier_erp.models import Tenant, Fabric

        tenant = Tenant.objects.create(name="Ателье", slug="atelier-1")
        # Тенантов в базе больше одного (миграция создаёт «sheber»),
        # поэтому slug указываем явно — автоопределение здесь и не должно
        # срабатывать, иначе данные уехали бы не тому ателье.
        call_command("seed_demo", "--tenant-slug", "atelier-1", stdout=StringIO())

        assert Order.objects.filter(tenant=tenant).count() == 12
        assert Order.objects.filter(tenant__isnull=True).count() == 0
        assert Customer.objects.filter(tenant=tenant).count() == 3
        assert Fabric.objects.filter(tenant=tenant).exists()

    def test_no_tenant_mode_creates_null_tenant_rows(self):
        """
        Пилотные аккаунты пока без TenantMembership — их контекст тенанта None,
        и видны им только записи с tenant IS NULL.
        """
        from atelier_erp.models import Tenant

        Tenant.objects.create(name="Ателье", slug="atelier-1")
        call_command("seed_demo", "--no-tenant", stdout=StringIO())

        assert Order.objects.filter(tenant__isnull=True).count() == 12
        assert Customer.objects.filter(tenant__isnull=True).count() == 3

    def test_unknown_tenant_slug_aborts_without_writing(self):
        err = StringIO()
        call_command("seed_demo", "--tenant-slug", "нет-такого", stdout=StringIO(), stderr=err)
        assert "не найден" in err.getvalue()
        assert Order.objects.count() == 0

    def test_reset_is_idempotent(self):
        call_command("seed_demo", stdout=StringIO())
        call_command("seed_demo", "--reset", stdout=StringIO())
        assert Order.objects.count() == 12
        assert Customer.objects.count() == 3

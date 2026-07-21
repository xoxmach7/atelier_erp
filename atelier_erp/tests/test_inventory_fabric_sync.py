"""
Регресс: материал со склада не появлялся в списке тканей при создании замера.

Measurement.curtain_fabric/tulle_fabric — FK на Fabric, а экран «Материалы»
создаёт только InventoryItem (единая CRUD-форма для всех категорий склада).
Без синхронизации добавленная ткань/тюль никогда не попадала в
/api/v1/inventory/, откуда фронт берёт список для формы замера.
"""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIClient

from atelier_erp.models import Fabric, InventoryItem
from atelier_erp.roles import Roles

User = get_user_model()


@pytest.mark.django_db
class TestInventoryItemSyncsToFabric(TestCase):
    def setUp(self):
        group, _ = Group.objects.get_or_create(name=Roles.WAREHOUSE)
        user = User.objects.create_user(username="wh_sync", password="pwd12345")
        user.groups.add(group)
        self.client = APIClient()
        self.client.force_authenticate(user=user)

    def test_creating_fabric_category_item_creates_matching_fabric(self):
        resp = self.client.post(
            "/api/v1/inventory-items/",
            {
                "sku": "blackout-01",
                "name": "Блэкаут синий",
                "category": InventoryItem.Category.FABRIC,
                "unit": InventoryItem.Unit.METER,
                "quantity": "45.5",
                "price_per_unit": "3200",
            },
            format="json",
        )
        assert resp.status_code == 201, resp.content

        fabric = Fabric.objects.get(hanger_number="BLACKOUT-01")
        assert fabric.name == "Блэкаут синий"
        assert fabric.stock_meters == Decimal("45.50")
        assert fabric.price_per_meter == Decimal("3200")
        assert fabric.is_active is True

    def test_non_fabric_category_does_not_create_fabric(self):
        resp = self.client.post(
            "/api/v1/inventory-items/",
            {
                "sku": "hook-01",
                "name": "Крючок карнизный",
                "category": InventoryItem.Category.ACCESSORY,
                "unit": InventoryItem.Unit.PIECE,
                "quantity": "100",
                "price_per_unit": "50",
            },
            format="json",
        )
        assert resp.status_code == 201, resp.content
        assert not Fabric.objects.filter(hanger_number="HOOK-01").exists()

    def test_updating_item_updates_matching_fabric(self):
        resp = self.client.post(
            "/api/v1/inventory-items/",
            {
                "sku": "tulle-07",
                "name": "Тюль белый",
                "category": InventoryItem.Category.TULLE,
                "unit": InventoryItem.Unit.METER,
                "quantity": "10",
                "price_per_unit": "1000",
            },
            format="json",
        )
        item_id = resp.data["id"]

        resp2 = self.client.patch(
            f"/api/v1/inventory-items/{item_id}/",
            {"quantity": "25", "price_per_unit": "1200"},
            format="json",
        )
        assert resp2.status_code == 200, resp2.content

        fabric = Fabric.objects.get(hanger_number="TULLE-07")
        assert fabric.stock_meters == Decimal("25.00")
        assert fabric.price_per_meter == Decimal("1200")

    def test_soft_deleting_item_deactivates_fabric(self):
        resp = self.client.post(
            "/api/v1/inventory-items/",
            {
                "sku": "silk-09",
                "name": "Шёлк",
                "category": InventoryItem.Category.FABRIC,
                "unit": InventoryItem.Unit.METER,
                "quantity": "5",
                "price_per_unit": "9000",
            },
            format="json",
        )
        item_id = resp.data["id"]

        resp2 = self.client.delete(f"/api/v1/inventory-items/{item_id}/")
        assert resp2.status_code in (200, 204), resp2.content

        fabric = Fabric.objects.get(hanger_number="SILK-09")
        assert fabric.is_active is False

    def test_created_fabric_visible_in_measurement_fabric_list(self):
        self.client.post(
            "/api/v1/inventory-items/",
            {
                "sku": "velv-02",
                "name": "Велюр зелёный",
                "category": InventoryItem.Category.FABRIC,
                "unit": InventoryItem.Unit.METER,
                "quantity": "30",
                "price_per_unit": "4500",
            },
            format="json",
        )
        resp = self.client.get("/api/v1/inventory/")
        assert resp.status_code == 200, resp.content
        names = [f["name"] for f in resp.data.get("results", resp.data)]
        assert "Велюр зелёный" in names

    def test_cyrillic_sku_items_do_not_collide_on_fabric_mirror(self):
        """
        Раньше нелатинский артикул после чистки давал пустую строку и
        подставлялась константа 'MAT' — второй такой же материал затирал
        Fabric-зеркало первого через update_or_create(hanger_number='MAT').
        """
        resp1 = self.client.post(
            "/api/v1/inventory-items/",
            {
                "sku": "тест-1",
                "name": "Ткань один",
                "category": InventoryItem.Category.FABRIC,
                "unit": InventoryItem.Unit.METER,
                "quantity": "10",
                "price_per_unit": "1000",
            },
            format="json",
        )
        assert resp1.status_code == 201, resp1.content

        resp2 = self.client.post(
            "/api/v1/inventory-items/",
            {
                "sku": "тест-2",
                "name": "Ткань два",
                "category": InventoryItem.Category.FABRIC,
                "unit": InventoryItem.Unit.METER,
                "quantity": "20",
                "price_per_unit": "2000",
            },
            format="json",
        )
        assert resp2.status_code == 201, resp2.content

        names = set(Fabric.objects.values_list("name", flat=True))
        assert {"Ткань один", "Ткань два"}.issubset(names)
        assert Fabric.objects.filter(name="Ткань один").exists()
        assert Fabric.objects.filter(name="Ткань два").exists()

    def test_fabric_category_matches_source_item_category(self):
        self.client.post(
            "/api/v1/inventory-items/",
            {
                "sku": "fab-cat-1", "name": "Ткань категорийная",
                "category": InventoryItem.Category.FABRIC,
                "unit": InventoryItem.Unit.METER, "quantity": "5", "price_per_unit": "100",
            },
            format="json",
        )
        self.client.post(
            "/api/v1/inventory-items/",
            {
                "sku": "tul-cat-1", "name": "Тюль категорийный",
                "category": InventoryItem.Category.TULLE,
                "unit": InventoryItem.Unit.METER, "quantity": "5", "price_per_unit": "100",
            },
            format="json",
        )
        assert Fabric.objects.get(hanger_number="FAB-CAT-1").category == Fabric.Category.FABRIC
        assert Fabric.objects.get(hanger_number="TUL-CAT-1").category == Fabric.Category.TULLE

    def test_measurement_fabric_list_filters_by_category(self):
        self.client.post(
            "/api/v1/inventory-items/",
            {
                "sku": "fab-filt-1", "name": "Только ткань",
                "category": InventoryItem.Category.FABRIC,
                "unit": InventoryItem.Unit.METER, "quantity": "5", "price_per_unit": "100",
            },
            format="json",
        )
        self.client.post(
            "/api/v1/inventory-items/",
            {
                "sku": "tul-filt-1", "name": "Только тюль",
                "category": InventoryItem.Category.TULLE,
                "unit": InventoryItem.Unit.METER, "quantity": "5", "price_per_unit": "100",
            },
            format="json",
        )
        resp = self.client.get("/api/v1/inventory/", {"category": "fabric"})
        names = [f["name"] for f in resp.data.get("results", resp.data)]
        assert "Только ткань" in names
        assert "Только тюль" not in names

    def test_sku_change_updates_hanger_number_without_duplicate(self):
        """
        Раньше синк матчился по hanger_number: смена sku пересчитывала
        hanger_number и update_or_create() заводил ВТОРУЮ Fabric-запись
        вместо обновления первой — старая оставалась осиротевшим дублем.
        Прямая ссылка source_item держит связь стабильной при смене sku.
        """
        resp = self.client.post(
            "/api/v1/inventory-items/",
            {
                "sku": "old-sku", "name": "Меняющийся артикул",
                "category": InventoryItem.Category.FABRIC,
                "unit": InventoryItem.Unit.METER, "quantity": "5", "price_per_unit": "100",
            },
            format="json",
        )
        item_id = resp.data["id"]
        assert Fabric.objects.filter(name="Меняющийся артикул").count() == 1

        resp2 = self.client.patch(
            f"/api/v1/inventory-items/{item_id}/", {"sku": "new-sku"}, format="json",
        )
        assert resp2.status_code == 200, resp2.content

        matching = Fabric.objects.filter(name="Меняющийся артикул")
        assert matching.count() == 1
        assert matching.first().hanger_number == "NEW-SKU"


@pytest.mark.django_db
class TestDeleteOrphanFabric(TestCase):
    """
    Осиротевшая Fabric-запись (source_item пуст, живой InventoryItem за ней
    не стоит) не имеет своего write-API вообще — раньше её можно было убрать
    только руками из БД (см. CLAUDE.md, запись про 'йцуйцу (MAT)'). Экран
    «Материалы» получил кнопку удаления именно для таких строк.
    """

    def setUp(self):
        group, _ = Group.objects.get_or_create(name=Roles.WAREHOUSE)
        self.user = User.objects.create_user(username="wh_orphan", password="pwd12345")
        self.user.groups.add(group)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_deletes_orphan_without_source_item(self):
        fabric = Fabric.objects.create(
            name="йцуйцу", hanger_number="MAT",
            price_per_meter=Decimal("25000"), is_active=True,
        )
        resp = self.client.delete(f"/api/v1/inventory/{fabric.id}/delete-orphan/")
        assert resp.status_code == 204, resp.content
        fabric.refresh_from_db()
        assert fabric.is_active is False

    def test_refuses_to_delete_fabric_with_live_source_item(self):
        resp = self.client.post(
            "/api/v1/inventory-items/",
            {
                "sku": "56446", "name": "Тюль 1",
                "category": InventoryItem.Category.TULLE,
                "unit": InventoryItem.Unit.METER, "quantity": "30", "price_per_unit": "5000",
            },
            format="json",
        )
        assert resp.status_code == 201, resp.content
        fabric = Fabric.objects.get(name="Тюль 1")
        resp = self.client.delete(f"/api/v1/inventory/{fabric.id}/delete-orphan/")
        assert resp.status_code == 400, resp.content
        assert resp.data["code"] == "fabric_has_source_item"
        fabric.refresh_from_db()
        assert fabric.is_active is True

    def test_forbidden_for_seamstress(self):
        seamstress_group, _ = Group.objects.get_or_create(name=Roles.SEAMSTRESS)
        seamstress = User.objects.create_user(username="seam_orphan", password="pwd12345")
        seamstress.groups.add(seamstress_group)
        self.client.force_authenticate(user=seamstress)

        fabric = Fabric.objects.create(
            name="йцуйцу2", hanger_number="MAT2", price_per_meter=Decimal("10000"), is_active=True,
        )
        resp = self.client.delete(f"/api/v1/inventory/{fabric.id}/delete-orphan/")
        assert resp.status_code == 403

from decimal import Decimal

import pytest

from atelier_erp.constants import HandoverStage, MaterialReadiness, ProductionStage
from atelier_erp.models import Customer, Fabric, Measurement, Order, OrderCompletionAct, Quote, QuoteItem


pytestmark = pytest.mark.django_db


def create_customer(phone="+7 700 000 0001"):
    return Customer.objects.create(full_name="Test Customer", phone=phone)


def create_fabric(code="WF001", name="Test Fabric", stock=Decimal("20.00")):
    return Fabric.objects.create(
        hanger_number=code,
        name=name,
        stock_meters=stock,
        reserved_meters=Decimal("0.00"),
        price_per_meter=Decimal("1000.00"),
    )


def create_order(number, customer, **kwargs):
    defaults = {
        "status": Order.Status.IN_WORK,
        "total_amount": Decimal("100000.00"),
        "paid_amount": Decimal("0.00"),
    }
    defaults.update(kwargs)
    return Order.objects.create(order_number=number, customer=customer, **defaults)


def add_measurement(order, fabric):
    return Measurement.objects.create(
        order=order,
        room_name="Living room",
        window_name="Window 1",
        width_cm=260,
        height_cm=245,
        curtain_fabric=fabric,
        curtain_meters=Decimal("6.50"),
        tulle_fabric=fabric,
        tulle_meters=Decimal("6.00"),
        notes="Designer note",
    )


def add_quote(order, fabric, status=Quote.Status.APPROVED):
    quote = Quote.objects.create(
        quote_number=f"КП-2099-{Quote.objects.count() + 1:03d}",
        customer=order.customer,
        order=order,
        status=status,
        total=Decimal("100000.00"),
    )
    QuoteItem.objects.create(
        quote=quote,
        room_name="Living room",
        window_name="Window 1",
        window_width_cm=260,
        window_height_cm=245,
        fabric=fabric,
        fabric_meters=Decimal("6.50"),
        tulle_fabric=fabric,
        tulle_meters=Decimal("6.00"),
        sewing_type="Curtains",
        line_total=Decimal("100000.00"),
    )
    return quote


def test_production_queue_returns_items_to_sew(authenticated_client):
    customer = create_customer()
    fabric = create_fabric()
    order = create_order(
        "Рћ-2099-001",
        customer,
        status=Order.Status.IN_PRODUCTION,
        production_stage=ProductionStage.SEWING,
        material_readiness=MaterialReadiness.READY,
    )
    add_measurement(order, fabric)
    add_quote(order, fabric)

    response = authenticated_client.get("/api/v1/work/production/")

    assert response.status_code == 200
    assert response.data["in_sewing"][0]["order_number"] == "Рћ-2099-001"
    assert response.data["in_sewing"][0]["items_to_sew"][0]["fabric_name"] == "Test Fabric"


def test_installation_queue_returns_address_items_photo_and_avr(authenticated_client):
    customer = create_customer("+7 700 000 0002")
    fabric = create_fabric("WF002")
    order = create_order(
        "Рћ-2099-002",
        customer,
        status=Order.Status.ON_INSTALLATION,
        handover_stage=HandoverStage.IN_PROGRESS,
        installation_address_city="Almaty",
        installation_address_street="Abay",
        installation_address_building="10",
    )
    add_measurement(order, fabric)
    OrderCompletionAct.objects.create(order=order, act_number="AVR-2099-002", status=OrderCompletionAct.Status.DRAFT)

    response = authenticated_client.get("/api/v1/work/installation/")

    assert response.status_code == 200
    item = response.data["in_installation"][0]
    assert item["installation_address"] == "Almaty, Abay, 10"
    assert item["items_to_install"][0]["room_name"] == "Living room"
    assert item["photo_report_status"] == "missing"
    assert item["completion_act_status"] == "draft"


def test_warehouse_queue_returns_selected_materials(authenticated_client):
    customer = create_customer("+7 700 000 0003")
    fabric = create_fabric("WF003")
    order = create_order(
        "Рћ-2099-003",
        customer,
        status=Order.Status.IN_WORK,
        material_readiness=MaterialReadiness.NOT_READY,
    )
    add_measurement(order, fabric)

    response = authenticated_client.get("/api/v1/work/warehouse/")

    assert response.status_code == 200
    assert response.data["not_ready"][0]["selected_materials"][0]["fabric_meters"] == "6.50"


def test_designer_queue_returns_measurement_summary(authenticated_client):
    customer = create_customer("+7 700 000 0004")
    fabric = create_fabric("WF004")
    order = create_order("Рћ-2099-004", customer, status=Order.Status.IN_WORK)
    add_measurement(order, fabric)

    response = authenticated_client.get("/api/v1/work/designer/")

    assert response.status_code == 200
    assert response.data["measurement_done_needs_quote"][0]["measurement_summary"][0]["tulle_meters"] == "6.00"


def test_owner_queue_classifies_paid_waiting_payment_as_needs_completion(authenticated_client):
    customer = create_customer("+7 700 000 0005")
    create_order(
        "Рћ-2099-005",
        customer,
        status=Order.Status.WAITING_FINAL_PAYMENT,
        total_amount=Decimal("100000.00"),
        paid_amount=Decimal("100000.00"),
    )

    response = authenticated_client.get("/api/v1/work/owner/")

    assert response.status_code == 200
    assert response.data["counters"]["waiting_payment"] == 0
    assert response.data["counters"]["paid_needs_completion"] == 1
    assert response.data["paid_needs_completion"][0]["status_label"] == "Оплата закрыта"

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from atelier_erp.constants import HandoverStage, MaterialReadiness, ProductionStage, SupplyMode
from atelier_erp.models import (
    Cornice,
    Customer,
    Fabric,
    Measurement,
    Order,
    OrderCompletionAct,
    OrderItem,
    Payment,
    PhotoReport,
    ProductionAssignment,
    Quote,
    QuoteItem,
)


DEMO = "[DEMO]"
DEMO_CUSTOMER_PHONES = ("77000000001", "77000000002", "77000000003")
DEMO_FABRIC_HANGERS = (
    "DEMO-FAB-01",
    "DEMO-FAB-02",
    "DEMO-FAB-03",
    "DEMO-FAB-04",
    "DEMO-FAB-05",
)
DEMO_CORNICE_SKU = "DEMO-CORN-01"
DEMO_SEAMSTRESS_USERNAME = "demo_seamstress"
DEMO_ORDER_SEQUENCE = range(901, 910)
PNG_1X1 = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
    b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\xf8\x0f\x00\x01\x01\x01\x00"
    b"\x18\xdd\x8d\xb0\x00\x00\x00\x00IEND\xaeB`\x82"
)


class Command(BaseCommand):
    help = "Seed safe Sheber ERP demo workflow data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-demo",
            action="store_true",
            help="Delete existing demo workflow data before seeding.",
        )

    def handle(self, *args, **options):
        if options["reset_demo"]:
            self.reset_demo()

        with transaction.atomic():
            customers = self.seed_customers()
            fabrics = self.seed_fabrics()
            cornice = self.seed_cornice()
            seamstress = self.get_demo_seamstress()
            orders = self.seed_orders(customers, fabrics, cornice, seamstress)

        self.stdout.write(self.style.SUCCESS("Demo workflow seeded successfully."))
        self.stdout.write("")
        self.stdout.write("Demo orders:")
        for key, order in orders.items():
            self.stdout.write(f"- {key}: {order.order_number} | {order.customer.full_name} | {order.status}")

    def reset_demo(self):
        with transaction.atomic():
            year = timezone.now().year
            demo_order_numbers = [f"О-{year}-{number}" for number in DEMO_ORDER_SEQUENCE]
            # КП-<year>-910 is a legacy demo quote number from an earlier seed iteration.
            demo_quote_numbers = [f"КП-{year}-{number}" for number in range(901, 911)]

            demo_customers = Customer.objects.filter(
                phone__in=DEMO_CUSTOMER_PHONES,
                full_name__startswith=DEMO,
            )
            demo_customer_ids = list(demo_customers.values_list("id", flat=True))

            demo_orders = Order.objects.filter(
                order_number__in=demo_order_numbers,
                notes__startswith=DEMO,
            )
            demo_order_ids = list(demo_orders.values_list("id", flat=True))

            demo_quotes = Quote.objects.filter(
                Q(order_id__in=demo_order_ids)
                | Q(customer_id__in=demo_customer_ids, quote_number__in=demo_quote_numbers)
            )
            demo_quote_ids = list(demo_quotes.values_list("id", flat=True))

            PhotoReport.objects.filter(order_id__in=demo_order_ids).delete()
            OrderCompletionAct.objects.filter(order_id__in=demo_order_ids).delete()
            ProductionAssignment.objects.filter(order_id__in=demo_order_ids).delete()
            Payment.objects.filter(order_id__in=demo_order_ids).delete()
            OrderItem.objects.filter(order_id__in=demo_order_ids).delete()
            Measurement.objects.filter(order_id__in=demo_order_ids).delete()
            QuoteItem.objects.filter(quote_id__in=demo_quote_ids).delete()
            demo_orders.update(quote=None)
            demo_quotes.delete()
            demo_orders.delete()

            Fabric.objects.filter(hanger_number__in=DEMO_FABRIC_HANGERS, name__startswith=DEMO).delete()
            Cornice.objects.filter(sku=DEMO_CORNICE_SKU, name__startswith=DEMO).delete()
            demo_customers.delete()

            User = get_user_model()
            User.objects.filter(username=DEMO_SEAMSTRESS_USERNAME).delete()

        self.stdout.write(self.style.WARNING("Existing demo workflow data removed."))

    def seed_customers(self):
        rows = {
            "aigul": {
                "full_name": f"{DEMO} Айгуль Садыкова",
                "phone": "77000000001",
                "address_city": "Алматы",
                "address_street": "Демо-адрес 1",
                "address_building": "1",
                "notes": f"{DEMO} Demo workflow customer",
            },
            "erlan": {
                "full_name": f"{DEMO} Ерлан Нурбаев",
                "phone": "77000000002",
                "address_city": "Алматы",
                "address_street": "Демо-адрес 2",
                "address_building": "2",
                "notes": f"{DEMO} Demo workflow customer",
            },
            "aisha": {
                "full_name": f"{DEMO} Салон Aisha Home",
                "phone": "77000000003",
                "address_city": "Алматы",
                "address_street": "Демо-адрес 3",
                "address_building": "3",
                "notes": f"{DEMO} Demo workflow customer",
            },
        }
        return {
            key: Customer.objects.update_or_create(phone=data["phone"], defaults=data)[0]
            for key, data in rows.items()
        }

    def seed_fabrics(self):
        rows = {
            "velvet": ("DEMO-FAB-01", f"{DEMO} Бархат песочный", "песочный", "120000.00", "65.00"),
            "linen": ("DEMO-FAB-02", f"{DEMO} Лен молочный", "молочный", "85000.00", "80.00"),
            "tulle": ("DEMO-FAB-03", f"{DEMO} Тюль белый", "белый", "25000.00", "120.00"),
            "blackout": ("DEMO-FAB-04", f"{DEMO} Blackout графит", "графит", "140000.00", "55.00"),
            "cornice_material": ("DEMO-FAB-05", f"{DEMO} Карниз алюминиевый", "алюминий", "45000.00", "30.00"),
        }
        fabrics = {}
        for key, (hanger, name, color, price, stock) in rows.items():
            fabrics[key] = Fabric.objects.update_or_create(
                hanger_number=hanger,
                defaults={
                    "name": name,
                    "composition": "Демо-материал",
                    "width_cm": 280,
                    "stock_meters": Decimal(stock),
                    "reserved_meters": Decimal("0.00"),
                    "price_per_meter": Decimal(price),
                    "color": color,
                    "supplier": f"{DEMO} Demo supplier",
                    "location": "DEMO",
                    "is_active": True,
                },
            )[0]
        return fabrics

    def seed_cornice(self):
        return Cornice.objects.update_or_create(
            sku="DEMO-CORN-01",
            defaults={
                "name": f"{DEMO} Карниз алюминиевый",
                "type": "ceiling",
                "material": "aluminum",
                "color": "white",
                "length_cm": 300,
                "stock_count": 20,
                "price": Decimal("45000.00"),
                "supplier": f"{DEMO} Demo supplier",
                "is_active": True,
            },
        )[0]

    def get_demo_seamstress(self):
        User = get_user_model()
        user, _ = User.objects.update_or_create(
            username=DEMO_SEAMSTRESS_USERNAME,
            defaults={
                "first_name": "[DEMO]",
                "last_name": "Швея",
                "email": "demo-seamstress@example.invalid",
                "is_active": True,
            },
        )
        if not user.has_usable_password():
            user.set_unusable_password()
            user.save(update_fields=["password"])
        return user

    def seed_orders(self, customers, fabrics, cornice, seamstress):
        year = timezone.now().year
        today = timezone.localdate()

        scenarios = {
            "A. Новый заказ": {
                "number": f"О-{year}-901",
                "customer": customers["aigul"],
                "status": Order.Status.NEW,
                "material": MaterialReadiness.NOT_READY,
                "production": ProductionStage.NOT_STARTED,
                "handover": HandoverStage.NOT_REQUIRED,
                "total": "0.00",
                "paid": "0.00",
                "notes": "Новый заказ без замера. Следующий шаг: добавить замер.",
            },
            "B. Заказ с замером": {
                "number": f"О-{year}-902",
                "customer": customers["erlan"],
                "status": Order.Status.IN_WORK,
                "material": MaterialReadiness.NOT_READY,
                "production": ProductionStage.NOT_STARTED,
                "handover": HandoverStage.NOT_REQUIRED,
                "total": "0.00",
                "paid": "0.00",
                "measurements": True,
                "notes": "Есть замеры без цен. Следующий шаг: создать КП.",
            },
            "C. Заказ с КП": {
                "number": f"О-{year}-903",
                "customer": customers["aisha"],
                "status": Order.Status.IN_WORK,
                "material": MaterialReadiness.NOT_READY,
                "production": ProductionStage.NOT_STARTED,
                "handover": HandoverStage.NOT_REQUIRED,
                "total": "420000.00",
                "paid": "0.00",
                "measurements": True,
                "quote_status": Quote.Status.DRAFT,
                "notes": "Есть черновик КП. Следующий шаг: согласовать КП.",
            },
            "D. Принятое КП / материалы частично": {
                "number": f"О-{year}-904",
                "customer": customers["aigul"],
                "status": Order.Status.IN_WORK,
                "material": MaterialReadiness.PARTIALLY_READY,
                "production": ProductionStage.NOT_STARTED,
                "handover": HandoverStage.NOT_REQUIRED,
                "total": "510000.00",
                "paid": "255000.00",
                "measurements": True,
                "quote_status": Quote.Status.APPROVED,
                "items": True,
                "payment": ("prepayment", "kaspi", "255000.00"),
                "notes": "КП принято, материалы обеспечены частично.",
            },
            "E. Заказ в производстве": {
                "number": f"О-{year}-905",
                "customer": customers["erlan"],
                "status": Order.Status.IN_PRODUCTION,
                "material": MaterialReadiness.READY,
                "production": ProductionStage.SEWING,
                "handover": HandoverStage.NOT_REQUIRED,
                "total": "560000.00",
                "paid": "280000.00",
                "measurements": True,
                "quote_status": Quote.Status.APPROVED,
                "items": True,
                "assignment": ProductionAssignment.Status.SEWING,
                "payment": ("prepayment", "card", "280000.00"),
                "notes": "Заказ в пошиве. Видим в производственной очереди.",
            },
            "F. Готов к установке": {
                "number": f"О-{year}-906",
                "customer": customers["aisha"],
                "status": Order.Status.READY,
                "material": MaterialReadiness.READY,
                "production": ProductionStage.DONE,
                "handover": HandoverStage.SCHEDULED,
                "total": "610000.00",
                "paid": "305000.00",
                "measurements": True,
                "quote_status": Quote.Status.APPROVED,
                "items": True,
                "payment": ("prepayment", "transfer", "305000.00"),
                "notes": "Производство завершено, установка запланирована.",
            },
            "G. Фотоотчёт и АВР": {
                "number": f"О-{year}-907",
                "customer": customers["aigul"],
                "status": Order.Status.WAITING_FINAL_PAYMENT,
                "material": MaterialReadiness.READY,
                "production": ProductionStage.DONE,
                "handover": HandoverStage.DONE,
                "total": "580000.00",
                "paid": "300000.00",
                "measurements": True,
                "quote_status": Quote.Status.APPROVED,
                "items": True,
                "payment": ("prepayment", "kaspi", "300000.00"),
                "photo": True,
                "act": "signed",
                "notes": "Установка выполнена, есть демо-фотоотчёт и АВР.",
            },
            "H. Ожидает финальную оплату": {
                "number": f"О-{year}-908",
                "customer": customers["erlan"],
                "status": Order.Status.WAITING_FINAL_PAYMENT,
                "material": MaterialReadiness.READY,
                "production": ProductionStage.DONE,
                "handover": HandoverStage.DONE,
                "total": "500000.00",
                "paid": "300000.00",
                "measurements": True,
                "quote_status": Quote.Status.APPROVED,
                "items": True,
                "payment": ("prepayment", "cash", "300000.00"),
                "act": "draft",
                "notes": "Ожидает финальную оплату 200000 KZT.",
            },
            "I. Завершённый заказ": {
                "number": f"О-{year}-909",
                "customer": customers["aisha"],
                "status": Order.Status.COMPLETED,
                "material": MaterialReadiness.READY,
                "production": ProductionStage.DONE,
                "handover": HandoverStage.DONE,
                "total": "450000.00",
                "paid": "450000.00",
                "measurements": True,
                "quote_status": Quote.Status.APPROVED,
                "items": True,
                "payment": ("final", "transfer", "450000.00"),
                "photo": True,
                "act": "signed",
                "completed": True,
                "notes": "Заказ завершён и полностью оплачен.",
            },
        }

        created = {}
        for index, (label, data) in enumerate(scenarios.items(), start=1):
            order = self.upsert_order(data, today, index)
            if data.get("measurements"):
                self.replace_measurements(order, fabrics)
            if data.get("quote_status"):
                quote = self.upsert_quote(order, data["quote_status"], fabrics, cornice, year, index)
                order.quote = quote
                order.save(update_fields=["quote"])
            if data.get("items"):
                self.replace_order_items(order, fabrics)
            if data.get("payment"):
                self.replace_payment(order, data["payment"])
            if data.get("assignment"):
                self.upsert_assignment(order, seamstress, data["assignment"], today)
            if data.get("photo"):
                self.replace_photo_report(order)
            if data.get("act"):
                self.upsert_completion_act(order, data["act"])
            created[label] = order
        return created

    def upsert_order(self, data, today, index):
        existing = Order.objects.filter(order_number=data["number"]).first()
        if existing and DEMO not in existing.notes:
            raise CommandError(
                f"Order number {data['number']} already exists and is not marked as demo. Aborting."
            )

        defaults = {
            "customer": data["customer"],
            "status": data["status"],
            "material_readiness": data["material"],
            "production_stage": data["production"],
            "handover_stage": data["handover"],
            "installation_address_city": data["customer"].address_city,
            "installation_address_street": data["customer"].address_street,
            "installation_address_building": data["customer"].address_building,
            "installation_address_notes": f"{DEMO} Демо-адрес установки",
            "measurement_date": today - timedelta(days=max(1, 12 - index)),
            "planned_completion": today + timedelta(days=index),
            "installation_date": today + timedelta(days=index + 3),
            "actual_completion": today if data.get("completed") else None,
            "total_amount": Decimal(data["total"]),
            "paid_amount": Decimal(data["paid"]),
            "notes": f"{DEMO} {data['notes']}",
        }
        order, _ = Order.objects.update_or_create(order_number=data["number"], defaults=defaults)
        return order

    def replace_measurements(self, order, fabrics):
        order.measurements.all().delete()
        rows = [
            ("Гостиная", "Окно 1", 260, 245, fabrics["velvet"], Decimal("6.50"), fabrics["tulle"], Decimal("6.00"), "ceiling"),
            ("Спальня", "Окно 1", 210, 235, fabrics["linen"], Decimal("5.40"), fabrics["tulle"], Decimal("5.00"), "wall"),
        ]
        for room, window, width, height, curtain, curtain_m, tulle, tulle_m, mounting in rows:
            Measurement.objects.create(
                order=order,
                room_name=f"{DEMO} {room}",
                window_name=window,
                width_cm=width,
                height_cm=height,
                depth_cm=18,
                ceiling_height_cm=280,
                mounting_type=mounting,
                curtain_fabric=curtain,
                curtain_meters=curtain_m,
                tulle_fabric=tulle,
                tulle_meters=tulle_m,
                notes=f"{DEMO} Замер для demo workflow",
            )

    def upsert_quote(self, order, status, fabrics, cornice, year, index):
        quote_number = f"КП-{year}-{900 + index:03d}"
        existing = Quote.objects.filter(quote_number=quote_number).first()
        if existing and not existing.customer.full_name.startswith(DEMO):
            raise CommandError(
                f"Quote number {quote_number} already exists and is not marked as demo. Aborting."
            )

        quote, _ = Quote.objects.update_or_create(
            quote_number=quote_number,
            defaults={
                "customer": order.customer,
                "order": order,
                "status": status,
                "subtotal": Decimal("0.00"),
                "discount_amount": Decimal("0.00"),
                "installation_cost": Decimal("0.00"),
                "delivery_cost": Decimal("0.00"),
                "total": Decimal("0.00"),
                "prepayment_percent": Decimal("0.50"),
                "valid_until": timezone.localdate() + timedelta(days=14),
            },
        )
        quote.items.all().delete()
        total = Decimal("0.00")
        measurements = list(order.measurements.all())
        target_total = order.total_amount or Decimal("0.00")
        line_target = (target_total / max(len(measurements), 1)).quantize(Decimal("0.01"))

        for index, measurement in enumerate(measurements, start=1):
            current_line_target = line_target
            if index == len(measurements):
                current_line_target = target_total - total

            fabric_cost = (current_line_target * Decimal("0.45")).quantize(Decimal("0.01"))
            tulle_cost = (current_line_target * Decimal("0.15")).quantize(Decimal("0.01"))
            sewing_cost = (current_line_target * Decimal("0.20")).quantize(Decimal("0.01"))
            cornice_cost = (current_line_target * Decimal("0.08")).quantize(Decimal("0.01"))
            installation_price = (current_line_target * Decimal("0.08")).quantize(Decimal("0.01"))
            accessories_cost = (current_line_target * Decimal("0.03")).quantize(Decimal("0.01"))
            additional_services_total = current_line_target - (
                fabric_cost
                + tulle_cost
                + sewing_cost
                + cornice_cost
                + installation_price
                + accessories_cost
            )
            line_total = current_line_target
            QuoteItem.objects.create(
                quote=quote,
                room_name=measurement.room_name,
                window_name=measurement.window_name,
                window_width_cm=measurement.width_cm,
                window_height_cm=measurement.height_cm,
                folds_count=2,
                fabric=measurement.curtain_fabric,
                fabric_meters=measurement.curtain_meters,
                fabric_cost=fabric_cost,
                tulle_fabric=measurement.tulle_fabric,
                tulle_meters=measurement.tulle_meters,
                tulle_cost=tulle_cost,
                supply_mode=SupplyMode.IN_STOCK,
                sewing_type="standard",
                complexity="medium",
                sewing_cost=sewing_cost,
                cornice=cornice,
                cornice_length_m=Decimal("3.00"),
                cornice_cost=cornice_cost,
                installation_price=installation_price,
                accessories_cost=accessories_cost,
                additional_services_total=additional_services_total,
                line_total=line_total,
            )
            total += line_total
        quote.subtotal = total
        quote.total = total
        quote.save(update_fields=["subtotal", "total", "updated_at"])
        return quote

    def replace_order_items(self, order, fabrics):
        order.items.all().delete()
        for quote_item in order.quote.items.all():
            OrderItem.objects.create(
                order=order,
                item_type=OrderItem.ItemType.FABRIC,
                room_name=quote_item.room_name,
                window_name=quote_item.window_name,
                fabric=quote_item.fabric,
                quantity=Decimal("1.00"),
                unit_price=quote_item.line_total,
                total_price=quote_item.line_total,
                sewing_type=quote_item.sewing_type,
                window_width_cm=quote_item.window_width_cm,
                window_height_cm=quote_item.window_height_cm,
                folds_count=quote_item.folds_count,
                notes=f"{DEMO} Позиция исполнения из КП",
            )

        fabrics["velvet"].reserved_meters = Decimal("4.00")
        fabrics["velvet"].save(update_fields=["reserved_meters", "updated_at"])

    def replace_payment(self, order, payment_data):
        order.payments.filter(notes__contains=DEMO).delete()
        payment_type, method, amount = payment_data
        Payment.objects.create(
            order=order,
            amount=Decimal(amount),
            payment_type=payment_type,
            payment_method=method,
            idempotency_key=f"demo-{order.order_number}-{payment_type}",
            received_at=timezone.now(),
            notes=f"{DEMO} Demo workflow payment",
        )

    def upsert_assignment(self, order, seamstress, status, today):
        ProductionAssignment.objects.update_or_create(
            order=order,
            defaults={
                "assigned_to": seamstress,
                "status": status,
                "complexity": ProductionAssignment.Complexity.MEDIUM,
                "priority": 3,
                "deadline": today + timedelta(days=5),
                "started_at": timezone.now() if status != ProductionAssignment.Status.ASSIGNED else None,
                "completed_at": timezone.now() if status == ProductionAssignment.Status.READY else None,
                "base_payment": Decimal("65000.00"),
                "complexity_bonus": Decimal("15000.00"),
                "total_payment": Decimal("80000.00"),
                "notes": f"{DEMO} Demo workflow assignment",
            },
        )

    def replace_photo_report(self, order):
        order.photo_reports.filter(caption__contains=DEMO).delete()
        first_item = order.items.first()
        PhotoReport.objects.create(
            order=order,
            order_item=first_item,
            file=ContentFile(PNG_1X1, name=f"demo-photo-{order.order_number}.png"),
            caption=f"{DEMO} Демо-фотоотчёт: изделие установлено",
        )

    def upsert_completion_act(self, order, status):
        act_status = (
            OrderCompletionAct.Status.SIGNED
            if status == "signed"
            else OrderCompletionAct.Status.DRAFT
        )
        act, _ = OrderCompletionAct.objects.update_or_create(
            order=order,
            defaults={
                "act_number": f"АВР-{order.order_number}",
                "status": act_status,
                "signed_at": timezone.now() if act_status == OrderCompletionAct.Status.SIGNED else None,
                "notes": f"{DEMO} Demo workflow completion act",
                "is_active": True,
            },
        )
        if act_status == OrderCompletionAct.Status.SIGNED and not act.signed_file:
            act.signed_file.save(
                f"demo-act-{order.order_number}.png",
                ContentFile(PNG_1X1),
                save=True,
            )

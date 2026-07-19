"""
Management command: наполнить БД демо-данными для проверки экранов всех ролей.

Раньше сидер создавал только клиентов и «пустые» заказы — без замеров, КП,
адресов и дат. Из-за этого экраны выглядели незаполненными («Замеры ещё не
добавлены», «Дата замера: —»), а проверить складские/швейные/монтажные
галочки и подстатус «Исполнение» было не на чем.

Теперь каждый заказ раскладывается по стадии целиком:
адрес и даты → замеры с тканями и метражом → КП с позициями → флаги по окнам
(materials_ready / sewing_done / installation_done), соответствующие статусу.

Usage:
    python manage.py seed_demo            # добавить демо-данные
    python manage.py seed_demo --reset    # сперва удалить прежние демо-данные
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from atelier_erp.models import (
    Customer, Order, Measurement, Quote, QuoteItem, Fabric, Tenant,
)
from atelier_erp.constants import MaterialReadiness, ProductionStage, HandoverStage
from atelier_erp.services.numbering import next_number
from atelier_erp.services.measurement_calc import compute_meters

DEMO_TAG = "[DEMO]"

# Ткани каталога: нужны и замерам, и позициям КП.
FABRICS = [
    ("Блэкаут графит", "BL-101", Decimal("4500"), 280),
    ("Лён натуральный", "LN-202", Decimal("3200"), 300),
    ("Бархат изумруд", "BR-303", Decimal("6800"), 280),
    ("Тюль вуаль", "TL-404", Decimal("1900"), 300),
]

# Комнаты и окна, из которых собираются замеры заказа.
WINDOW_SETS = [
    [("Гостиная", "Окно 1", 100, 150), ("Гостиная", "Окно 2", 100, 150), ("Спальня", "Окно 1", 200, 200)],
    [("Кухня", "Окно 1", 120, 140), ("Детская", "Окно 1", 160, 180)],
    [("Зал", "Окно 1", 250, 220), ("Зал", "Окно 2", 250, 220), ("Кабинет", "Окно 1", 140, 160), ("Спальня", "Окно 1", 180, 200)],
]

ADDRESSES = [
    ("Алматы", "ул. Кармысова", "56а", "12"),
    ("Алматы", "пр. Достык", "134", "45"),
    ("Астана", "ул. Кунаева", "12/1", "301"),
]


class Command(BaseCommand):
    help = "Наполнить БД демо-данными: клиенты, заказы, замеры, КП, флаги по окнам"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Удалить прежние демо-данные ([DEMO]) перед созданием новых",
        )
        parser.add_argument(
            "--tenant-slug",
            type=str,
            default="",
            help=(
                "Slug ателье, которому принадлежат демо-данные. Если не указан "
                "и тенант в базе ровно один — берётся он."
            ),
        )
        parser.add_argument(
            "--no-tenant",
            action="store_true",
            help=(
                "Создать данные с tenant=NULL. Нужно, когда сотрудники ещё не "
                "привязаны к тенанту (нет TenantMembership): их контекст тенанта "
                "равен None, и они видят ровно записи без тенанта."
            ),
        )

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()
        designers = list(User.objects.filter(groups__name="Designer").order_by("id"))
        if not designers:
            self.stderr.write(
                self.style.ERROR(
                    "Нет дизайнеров (группа Designer пуста). Сначала: python manage.py seed_pilot --atelier test_atelie"
                )
            )
            return

        if options["no_tenant"]:
            tenant = None
            self.stdout.write(self.style.WARNING(
                "Режим --no-tenant: данные создаются с tenant=NULL "
                "(видны сотрудникам без TenantMembership)."
            ))
        else:
            tenant = self._resolve_tenant(options["tenant_slug"])
            if tenant is False:  # явная ошибка, сообщение уже выведено
                return

        if options["reset"]:
            # Порядок важен: Quote.customer стоит на PROTECT, поэтому клиента
            # нельзя удалить, пока на него ссылается хоть одно КП. Сначала КП,
            # потом заказы (с замерами каскадом), потом клиенты.
            demo_orders = Order.objects.filter(notes__startswith=DEMO_TAG)
            d_quotes = Quote.objects.filter(order__in=demo_orders).delete()
            d_orders = demo_orders.delete()

            # Демо-клиента могли переиспользовать в заказе, созданном руками
            # через приложение — такой заказ не помечен [DEMO] и удалять его
            # нельзя. Поэтому чистим только клиентов, на которых уже никто не
            # ссылается: иначе PROTECT роняет всю команду (и так и было).
            kept = 0
            removed = 0
            for customer in Customer.objects.filter(full_name__startswith=DEMO_TAG):
                if customer.orders.exists() or Quote.objects.filter(customer=customer).exists():
                    kept += 1
                    continue
                customer.delete()
                removed += 1

            d_fab = Fabric.objects.filter(name__startswith=DEMO_TAG).delete()
            self.stdout.write(
                f"Удалено демо: КП {d_quotes[0]}, заказы {d_orders[0]}, "
                f"клиенты {removed} (оставлено занятых: {kept}), ткани {d_fab[0]}"
            )

        fabrics = self._ensure_fabrics(tenant)
        customers = self._create_customers(tenant)
        today = timezone.localdate()
        year = today.year

        # (статус, оплачено %, сдвиг планового завершения, набор окон)
        S = Order.Status
        specs = [
            (S.NEW,                   0,   14, 0),
            (S.NEW,                   0,   -3, 1),   # просрочен и ещё не начат
            (S.IN_WORK,               50,   7, 0),
            (S.IN_WORK,               50,  -5, 2),   # просрочен
            (S.IN_PRODUCTION,         50,  10, 0),
            (S.IN_PRODUCTION,         50,   4, 1),
            (S.READY,                 50,   3, 2),
            (S.ON_INSTALLATION,       50,   2, 0),
            (S.WAITING_FINAL_PAYMENT, 50,  -2, 1),   # ждёт оплаты + просрочен
            (S.COMPLETED,            100, -10, 0),
            (S.COMPLETED,            100,  -6, 2),
            (S.CANCELLED,              0,  -8, 1),
        ]

        created = 0
        for i, (status, paid_pct, off, window_set) in enumerate(specs):
            customer = customers[i % len(customers)]
            city, street, building, apartment = ADDRESSES[i % len(ADDRESSES)]
            windows = WINDOW_SETS[window_set]

            order = Order.objects.create(
                order_number=next_number("order", year),
                customer=customer,
                status=status,
                responsible_user=designers[i % len(designers)],
                planned_completion=today + timedelta(days=off),
                measurement_date=today - timedelta(days=abs(off) + 5),
                installation_address_city=city,
                installation_address_street=street,
                installation_address_building=building,
                installation_address_apartment=apartment,
                notes=f"{DEMO_TAG} demo order",
                tenant=tenant,
                **self._stage_fields(status),
            )

            measurements = self._create_measurements(order, windows, fabrics, status)
            subtotal = self._create_quote(order, customer, measurements, fabrics, status, today)

            # Суммы заказа держим согласованными с КП, иначе баланс и
            # автозавершение по оплате будут считаться от воздуха.
            order.total_amount = subtotal
            order.paid_amount = (subtotal * Decimal(paid_pct) / Decimal(100)).quantize(Decimal("1"))
            order.save(update_fields=["total_amount", "paid_amount"])
            created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"\nГотово! Клиентов: {len(customers)}, заказов: {created}, "
                f"замеров: {Measurement.objects.filter(order__notes__startswith=DEMO_TAG).count()}, "
                f"КП: {Quote.objects.filter(order__notes__startswith=DEMO_TAG).count()}.\n"
                f"Дизайнеры: {', '.join(u.username for u in designers)}"
            )
        )

    # ── helpers ──────────────────────────────────────────────────────────

    def _resolve_tenant(self, slug: str):
        """
        Тенант, которому принадлежат демо-данные.

        Без него изоляция не работает так, как ожидается: TenantManager
        фильтрует `filter(tenant_id=<текущий>)`, поэтому записи с tenant=NULL
        не видны ни одному сотруднику ателье — демо просто «пропадёт».
        Возвращает None, если тенантов в базе нет вообще (одиночная установка),
        и False при явной ошибке.
        """
        tenants = list(Tenant.objects.all())
        if slug:
            match = next((t for t in tenants if t.slug == slug), None)
            if not match:
                self.stderr.write(self.style.ERROR(
                    f"Тенант со slug '{slug}' не найден. Есть: "
                    + (", ".join(t.slug for t in tenants) or "ни одного")
                ))
                return False
            self.stdout.write(f"Тенант: {match.name} ({match.slug})")
            return match

        if not tenants:
            self.stdout.write(self.style.WARNING(
                "Тенантов в базе нет — данные создаются без привязки (tenant=NULL)."
            ))
            return None
        if len(tenants) == 1:
            self.stdout.write(f"Тенант определён автоматически: {tenants[0].name} ({tenants[0].slug})")
            return tenants[0]

        self.stderr.write(self.style.ERROR(
            "Тенантов несколько — укажите --tenant-slug=<slug>. Есть: "
            + ", ".join(t.slug for t in tenants)
        ))
        return False

    def _ensure_fabrics(self, tenant) -> list:
        """
        Ткани каталога с реальным остатком на складе.

        Раньше здесь не задавался `stock_meters` (по умолчанию 0), и
        `get_or_create` не обновлял его на повторных запусках. Итог — экран
        «Материалы» показывал 0 м / «На исходе» по каждой ткани, хотя
        заказы одновременно демонстрировали статусы «Собран»/«В сборке»
        (materials_ready — независимый ручной флаг склада по заказу, не
        связан с остатком Fabric). Со стороны выглядело как явное
        противоречие: склад пуст, а заказы якобы обеспечены материалом.
        `update_or_create` с ненулевым остатком чинит и новые окружения, и
        уже засеянные (повторный запуск обновляет остаток на месте).
        """
        fabrics = []
        for name, hanger, price, width in FABRICS:
            fabric, _ = Fabric.objects.update_or_create(
                hanger_number=hanger,
                defaults={
                    "name": f"{DEMO_TAG} {name}",
                    "price_per_meter": price,
                    "width_cm": width,
                    "tenant": tenant,
                    "stock_meters": Decimal('80'),
                },
            )
            fabrics.append(fabric)
        return fabrics

    def _create_customers(self, tenant) -> list:
        cust_data = [
            ("Ерлан Нурбаев", "+77011234567"),
            ("Айгерим Сапарова", "+77019876543"),
            ("Данияр Ахметов", "+77001112233"),
        ]
        # get_or_create по телефону: он уникален, а часть демо-клиентов могла
        # уцелеть при --reset (на них ссылаются заказы, созданные вручную).
        # Раньше здесь был create() и команда падала на duplicate key.
        customers = []
        for name, phone in cust_data:
            customer, created = Customer.objects.get_or_create(
                phone=phone,
                defaults={
                    "full_name": f"{DEMO_TAG} {name}",
                    "address_city": "Алматы",
                    "tenant": tenant,
                },
            )
            if not created and customer.tenant_id != (tenant.id if tenant else None):
                customer.tenant = tenant
                customer.save(update_fields=["tenant"])
            customers.append(customer)
        return customers

    def _stage_fields(self, status) -> dict:
        """
        Операционные стадии под статус заказа.

        Держим согласованными: заказ в производстве без обеспеченных материалов
        или готовый заказ с незавершённым пошивом — состояния, которые FSM не
        пропустил бы, и на них ломались бы проверки завершения.
        """
        S = Order.Status
        if status in (S.NEW,):
            return {}
        if status == S.IN_WORK:
            return {"material_readiness": MaterialReadiness.PARTIALLY_READY}
        if status == S.IN_PRODUCTION:
            return {
                "material_readiness": MaterialReadiness.READY,
                "production_stage": ProductionStage.SEWING,
            }
        if status == S.READY:
            return {
                "material_readiness": MaterialReadiness.READY,
                "production_stage": ProductionStage.DONE,
            }
        if status in (S.ON_INSTALLATION, S.WAITING_FINAL_PAYMENT, S.COMPLETED):
            return {
                "material_readiness": MaterialReadiness.READY,
                "production_stage": ProductionStage.DONE,
                "handover_stage": HandoverStage.DONE,
            }
        return {}

    def _create_measurements(self, order, windows, fabrics, status) -> list:
        """
        Замеры с обеими тканями и посчитанным метражом.

        Флаги по окнам расставляются по стадии: склад собирает материалы
        раньше, чем цех шьёт, а монтаж вешает последним. На заказе «в
        производстве» часть окон намеренно не дошита — так виден подстатус
        «Исполнение» у цеха.
        """
        S = Order.Status
        curtain, linen, velvet, tulle = fabrics
        created = []

        for idx, (room, window, width, height) in enumerate(windows):
            curtain_fabric = [curtain, linen, velvet][idx % 3]
            gathering_c = Decimal("2.2")
            gathering_t = Decimal("2.0")

            materials_ready = status not in (S.NEW, S.CANCELLED) and not (
                status == S.IN_WORK and idx > 0  # на in_work часть окон ещё в закупе
            )
            sewing_done = status in (S.READY, S.ON_INSTALLATION, S.WAITING_FINAL_PAYMENT, S.COMPLETED) or (
                status == S.IN_PRODUCTION and idx == 0
            )
            installation_done = status in (S.WAITING_FINAL_PAYMENT, S.COMPLETED) or (
                status == S.ON_INSTALLATION and idx == 0
            )

            created.append(Measurement.objects.create(
                order=order,
                room_name=room,
                window_name=window,
                width_cm=width,
                height_cm=height,
                mounting_type="Потолочный карниз" if idx % 2 == 0 else "Настенный карниз",
                curtain_fabric=curtain_fabric,
                curtain_gathering=gathering_c,
                curtain_meters=compute_meters(width, gathering_c, True),
                tulle_fabric=tulle,
                tulle_gathering=gathering_t,
                tulle_meters=compute_meters(width, gathering_t, True),
                notes="" if idx % 2 else "Без люверсов, сборка на тесьму",
                materials_ready=materials_ready,
                sewing_done=sewing_done,
                installation_done=installation_done,
            ))
        return created

    def _create_quote(self, order, customer, measurements, fabrics, status, today) -> Decimal:
        """КП с позициями по окнам. Возвращает сумму позиций (предытог)."""
        S = Order.Status
        quote_status = {
            S.NEW: Quote.Status.SENT,
            S.CANCELLED: Quote.Status.REJECTED,
        }.get(status, Quote.Status.APPROVED)

        subtotal = Decimal("0")
        items = []
        for idx, m in enumerate(measurements):
            # Цена окна: ткань по метражу + пошив. КП считается вручную
            # (авторасчёт цены запаркован), поэтому здесь просто правдоподобные суммы.
            fabric_cost = (m.curtain_meters or Decimal("0")) * m.curtain_fabric.price_per_meter
            sewing_cost = Decimal("12000") + Decimal(m.width_cm) * Decimal("120")
            line_total = (fabric_cost + sewing_cost).quantize(Decimal("1"))
            subtotal += line_total
            items.append((m, line_total))

        installation_cost = Decimal("15000") if status != S.NEW else Decimal("0")
        discount = (subtotal * Decimal("0.1")).quantize(Decimal("1")) if len(measurements) > 2 else Decimal("0")
        total = subtotal + installation_cost - discount

        quote = Quote.objects.create(
            quote_number=next_number("quote", today.year),
            order=order,
            customer=customer,
            status=quote_status,
            subtotal=subtotal,
            installation_cost=installation_cost,
            discount_amount=discount,
            total=total,
            prepayment_percent=Decimal("0.5"),
            valid_until=today + timedelta(days=14),
        )

        for m, line_total in items:
            QuoteItem.objects.create(
                quote=quote,
                room_name=m.room_name,
                window_name=m.window_name,
                window_width_cm=m.width_cm,
                window_height_cm=m.height_cm,
                fabric=m.curtain_fabric,
                fabric_meters=m.curtain_meters,
                tulle_fabric=m.tulle_fabric,
                tulle_meters=m.tulle_meters,
                sewing_type="Шторы на тесьме",
                line_total=line_total,
            )

        return total

"""
Management command: наполнить БД демо-данными (клиенты + заказы) для проверки
дашборда и списков. Заказы привязываются к дизайнерам (группа Designer) и
раскладываются по статусам, чтобы дашборд показал «Завершено / В работе»,
«Ожидают оплаты», «Просрочено» и т.д.

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

from atelier_erp.models import Customer, Order
from atelier_erp.services.numbering import next_number

DEMO_TAG = "[DEMO]"


class Command(BaseCommand):
    help = "Наполнить БД демо-клиентами и заказами для проверки дашборда/списков"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Удалить прежние демо-данные ([DEMO]) перед созданием новых",
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

        if options["reset"]:
            d_orders = Order.objects.filter(notes__startswith=DEMO_TAG).delete()
            d_cust = Customer.objects.filter(full_name__startswith=DEMO_TAG).delete()
            self.stdout.write(f"Удалено демо: заказы {d_orders[0]}, клиенты {d_cust[0]}")

        # --- клиенты ---
        cust_data = [
            ("Ерлан Нурбаев", "+77011234567"),
            ("Айгерим Сапарова", "+77019876543"),
            ("Данияр Ахметов", "+77001112233"),
        ]
        customers = [
            Customer.objects.create(
                full_name=f"{DEMO_TAG} {name}", phone=phone, address_city="Алматы"
            )
            for name, phone in cust_data
        ]

        # --- заказы: (статус, сумма, оплачено, сдвиг планового завершения в днях) ---
        S = Order.Status
        specs = [
            (S.COMPLETED, 250000, 250000, -10),
            (S.COMPLETED, 180000, 180000, -6),
            (S.IN_WORK, 300000, 150000, 7),
            (S.IN_PRODUCTION, 420000, 210000, 10),
            (S.READY, 150000, 75000, 3),
            (S.WAITING_FINAL_PAYMENT, 200000, 100000, -2),  # ждёт оплаты + просрочен
            (S.NEW, 0, 0, 14),
            (S.IN_WORK, 95000, 0, -3),                       # просрочен
        ]

        today = timezone.localdate()
        year = today.year
        created = 0
        for i, (status, total, paid, off) in enumerate(specs):
            Order.objects.create(
                order_number=next_number("order", year),
                customer=customers[i % len(customers)],
                status=status,
                total_amount=Decimal(total),
                paid_amount=Decimal(paid),
                responsible_user=designers[i % len(designers)],
                planned_completion=today + timedelta(days=off),
                notes=f"{DEMO_TAG} demo order",
            )
            created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"\nГотово! Клиентов: {len(customers)}, заказов: {created}. "
                f"Дизайнеры: {', '.join(u.username for u in designers)}"
            )
        )

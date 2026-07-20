"""
Редактирование/удаление позиции заказа (manage_item) пересчитывало
order.total_amount только суммой позиций, без installation_cost/
delivery_cost/скидки исходного КП — сумма заказа откатывалась бы ниже
реальной суммы КП. Формула вынесена в
OrderItemGenerationService.recalculate_order_total(), используется и здесь,
и при генерации позиций (см. CLAUDE.md, 2026-07-20).
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework import status
from rest_framework.test import APITestCase

from atelier_erp.models import Customer, Order, Quote, QuoteItem, Fabric
from atelier_erp.roles import Roles
from atelier_erp.services import OrderItemGenerationService

User = get_user_model()


class ManageItemRecalculatesOrderTotalTests(APITestCase):
    def setUp(self):
        self.customer = Customer.objects.create(full_name='Item Total Test', phone='+7 700 555 3344')
        self.owner = User.objects.create_user(username='owner_item', password='x')
        group, _ = Group.objects.get_or_create(name=Roles.OWNER)
        self.owner.groups.add(group)

        self.order = Order.objects.create(
            order_number='О-2026-932', customer=self.customer, status=Order.Status.NEW,
        )
        self.quote = Quote.objects.create(
            order=self.order, customer=self.customer, quote_number='КП-2026-932',
            status=Quote.Status.APPROVED,
            subtotal=Decimal('15000'), installation_cost=Decimal('5000'),
            discount_amount=Decimal('1000'), total=Decimal('19000'),
        )
        fabric = Fabric.objects.create(
            name='Шёлк', hanger_number='H-932',
            price_per_meter=Decimal('900'), width_cm=280,
        )
        QuoteItem.objects.create(
            quote=self.quote, room_name='Зал', window_name='Окно 1',
            window_width_cm=300, window_height_cm=250, fabric=fabric,
            line_total=Decimal('15000'),
        )
        OrderItemGenerationService().generate_order_items_from_quote(order=self.order, quote=self.quote)
        self.order.refresh_from_db()
        self.item = self.order.items.first()

    def test_generation_includes_installation_and_discount(self):
        # 15000 (позиция) + 5000 (установка) - 1000 (скидка) = 19000
        self.assertEqual(self.order.total_amount, Decimal('19000'))

    def test_editing_item_price_keeps_installation_and_discount(self):
        self.client.force_authenticate(user=self.owner)
        resp = self.client.patch(
            f'/api/v1/orders/{self.order.id}/items/{self.item.id}/',
            {'unit_price': '20000'}, format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.order.refresh_from_db()
        # 20000 (новая цена позиции) + 5000 - 1000 = 24000, а не голые 20000
        self.assertEqual(self.order.total_amount, Decimal('24000'))

    def test_deleting_item_keeps_installation_and_discount(self):
        self.client.force_authenticate(user=self.owner)
        resp = self.client.delete(f'/api/v1/orders/{self.order.id}/items/{self.item.id}/')
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.order.refresh_from_db()
        # Позиций не осталось: 0 + 5000 - 1000 = 4000, а не 0
        self.assertEqual(self.order.total_amount, Decimal('4000'))

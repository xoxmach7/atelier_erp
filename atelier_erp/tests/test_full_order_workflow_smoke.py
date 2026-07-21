"""
Сквозной прогон полного цикла заказа через реальные v1 API — new → completed.

Повторяет вручную проведённую проверку 2026-07-20 (см. CLAUDE.md), которая
тогда нашла 3 реальных бага (total_amount не синхронизировался с КП,
PaymentViewSet.create не обновлял paid_amount, ready→on_installation не
автоматизирован). Юнит-тесты по отдельным сервисам их не ловили — только
сквозной путь через API вскрывает разрыв между слоями. Закреплено тестом,
чтобы не повторять руками при каждой правке замера/КП/статусов.
"""
import io
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from atelier_erp.models import (
    Customer, Order, Fabric, InventoryItem, Quote, QuoteItem, Measurement,
    OrderStatusHistory,
)
from atelier_erp.roles import Roles

User = get_user_model()


class FullOrderWorkflowSmokeTest(APITestCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._hosts = settings.ALLOWED_HOSTS
        settings.ALLOWED_HOSTS = ['*', 'testserver', 'localhost', '127.0.0.1']

    @classmethod
    def tearDownClass(cls):
        settings.ALLOWED_HOSTS = cls._hosts
        super().tearDownClass()

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_wf', password='x')
        owner_group, _ = Group.objects.get_or_create(name=Roles.OWNER)
        self.owner.groups.add(owner_group)

        self.customer = Customer.objects.create(
            full_name='Смоук Клиент', phone='+7 700 111 2233', address_city='Алматы',
        )

        self.curtain_fabric = Fabric.objects.create(
            name='Бархат смоук', hanger_number='SMK-1',
            price_per_meter=Decimal('2000'), width_cm=280, category=Fabric.Category.FABRIC,
        )
        self.cornice_item = InventoryItem.objects.create(
            name='Карниз смоук', category=InventoryItem.Category.CORNICE,
            unit=InventoryItem.Unit.METER, quantity=Decimal('50'), price_per_unit=Decimal('1000'),
        )
        self.hardware_item = InventoryItem.objects.create(
            name='Фурнитура смоук', category=InventoryItem.Category.ACCESSORY,
            unit=InventoryItem.Unit.PIECE, quantity=Decimal('50'), price_per_unit=Decimal('300'),
        )

    def test_full_lifecycle_new_to_completed(self):
        self.client.force_authenticate(user=self.owner)

        # 1. Создать заказ
        resp = self.client.post(
            '/api/v1/orders/', {'customer_id': str(self.customer.id)}, format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        order_id = resp.data['id']
        order = Order.objects.get(id=order_id)
        self.assertEqual(order.status, Order.Status.NEW)

        # 2. Замер: ручной метраж + крепление + фурнитура (веб-путь MeasurementWriteSerializer)
        resp = self.client.post(
            '/api/v1/measurements/',
            {
                'order': order_id,
                'room_name': 'Гостиная', 'window_name': 'Гостиная',
                'width_cm': 300, 'height_cm': 250,
                'curtain_fabric': str(self.curtain_fabric.id),
                'curtain_meters': '7.5',
                'cornice_item': str(self.cornice_item.id), 'cornice_quantity': '3',
                'hardware_item': str(self.hardware_item.id), 'hardware_quantity': '10',
            },
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        measurement = Measurement.objects.get(order=order)
        self.assertEqual(measurement.curtain_meters, Decimal('7.50'))
        self.assertEqual(measurement.cornice_item, self.cornice_item)
        self.assertEqual(measurement.hardware_item, self.hardware_item)

        # 3. КП: создать позицию по замеру, одобрить и сгенерировать OrderItem
        quote = Quote.objects.create(
            order=order, customer=self.customer, status=Quote.Status.DRAFT,
        )
        QuoteItem.objects.create(
            quote=quote, room_name='Гостиная', window_name='Гостиная',
            fabric=self.curtain_fabric,
            window_width_cm=300, window_height_cm=250,
            fabric_cost=Decimal('15000'),
            sewing_type='standard', line_total=Decimal('15000'),
        )
        quote.installation_cost = Decimal('2000')
        quote.delivery_cost = Decimal('500')
        quote.discount_percent = Decimal('0')
        quote.save()

        from atelier_erp.services.quote_service import QuoteService
        from atelier_erp.services.order_item_generation_service import OrderItemGenerationService

        QuoteService(unit_of_work=None).approve_quote(quote.id)
        OrderItemGenerationService(user=self.owner.id).generate_order_items_from_quote(order)

        order.refresh_from_db()
        quote.refresh_from_db()
        self.assertGreater(order.items.count(), 0)
        item = order.items.first()
        self.assertEqual(item.room_name, 'Гостиная')
        self.assertEqual(item.window_name, 'Гостиная')
        # total_amount = сумма позиций + installation_cost/delivery_cost - discount
        # (см. OrderItemGenerationService.recalculate_order_total)
        self.assertEqual(order.total_amount, Decimal('17500.00'))
        self.assertEqual(order.status, Order.Status.IN_WORK)

        # 4. Позиция редактируется — она находима по паре room/window (не «сирота»)
        resp = self.client.get(f'/api/v1/orders/{order_id}/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)

        # 5. Склад отмечает материалы готовыми → in_production
        resp = self.client.post(
            f'/api/v1/orders/{order_id}/change-material-readiness/',
            {'material_readiness': 'ready'}, format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.IN_PRODUCTION)

        # 6. Швея отмечает пошив окна done + завершает стадию производства → каскад ready → on_installation
        resp = self.client.patch(
            f'/api/v1/measurements/{measurement.id}/', {'sewing_done': True}, format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)

        resp = self.client.post(
            f'/api/v1/orders/{order_id}/change-production-stage/', {'production_stage': 'done'}, format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.ON_INSTALLATION)

        # 7. Установщик отмечает установку окна done + завершает handover → waiting_final_payment
        resp = self.client.patch(
            f'/api/v1/measurements/{measurement.id}/', {'installation_done': True}, format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)

        resp = self.client.post(
            f'/api/v1/orders/{order_id}/change-handover-stage/', {'handover_stage': 'done'}, format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.WAITING_FINAL_PAYMENT)

        # 7b. Установщик прикладывает фотоотчёт (обязателен для завершения заказа)
        from PIL import Image
        buf = io.BytesIO()
        Image.new('RGB', (10, 10), color='white').save(buf, format='PNG')
        buf.seek(0)
        photo = SimpleUploadedFile('act.png', buf.read(), content_type='image/png')
        resp = self.client.post(
            f'/api/v1/orders/{order_id}/photo-reports/', {'file': photo}, format='multipart',
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)

        # 7c. Установщик загружает подписанный АВР (обязателен для завершения заказа)
        buf2 = io.BytesIO()
        Image.new('RGB', (10, 10), color='white').save(buf2, format='PNG')
        buf2.seek(0)
        signed_act = SimpleUploadedFile('avr.png', buf2.read(), content_type='image/png')
        resp = self.client.post(
            f'/api/v1/orders/{order_id}/completion-act/upload-signed/',
            {'signed_file': signed_act}, format='multipart',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)

        # 8. Платёж через реальный API-путь (PaymentViewSet.create → PaymentService.record_payment)
        resp = self.client.post(
            '/api/v1/payments/',
            {
                'order': order_id, 'amount': str(order.total_amount),
                'payment_type': 'final', 'payment_method': 'cash',
            },
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        order.refresh_from_db()
        self.assertEqual(order.paid_amount, order.total_amount)

        # 9. Заказ должен дойти до completed (полная оплата + установка отмечена)
        self.assertEqual(order.status, Order.Status.COMPLETED)

        # 10. История статусов реально записана на каждый автопереход,
        # а не просто "заказ телепортировался в completed". Каждая запись
        # автопродвижения помечена префиксом [авто] (см. status_automation.py).
        history_notes = list(
            OrderStatusHistory.objects.filter(order=order).order_by('created_at').values_list('notes', flat=True)
        )
        auto_transitions = [n for n in history_notes if n.startswith('[авто]')]
        self.assertGreaterEqual(
            len(auto_transitions), 5,
            f'Ожидались автопереходы в истории (in_work/in_production/ready/on_installation/completed), получено: {history_notes}',
        )
        self.assertEqual(order.status_history.filter(new_status=Order.Status.IN_WORK).count(), 1)
        self.assertEqual(order.status_history.filter(new_status=Order.Status.COMPLETED).count(), 1)

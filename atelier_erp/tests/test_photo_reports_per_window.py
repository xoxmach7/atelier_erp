"""
Фотоотчёт установщика по конкретному окну.

Экран установщика показывает в карточке окна только его снимки, поэтому фото
привязывается к замеру, а не к заказу целиком. Плюс проверяем послабление
правила загрузки: снимать окна нужно ПОКА вешаешь, а не после того, как
монтаж отмечен завершённым.
"""

import pytest
from io import BytesIO
from django.test import TestCase
from django.contrib.auth.models import Group
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from atelier_erp.models import Order, Customer, Measurement, PhotoReport
from atelier_erp.roles import Roles

User = get_user_model()

# Загрузка проверяет реальное содержимое через Pillow, а не расширение
# (см. security-фикс 419533f), поэтому картинку генерируем настоящую.
def _png_bytes() -> bytes:
    from PIL import Image

    buf = BytesIO()
    Image.new('RGB', (4, 4), (120, 120, 130)).save(buf, format='PNG')
    return buf.getvalue()


def _png(name='window.png'):
    return SimpleUploadedFile(name, _png_bytes(), content_type='image/png')


@pytest.mark.django_db
class TestPhotoReportsPerWindow(TestCase):
    def setUp(self):
        self.customer = Customer.objects.create(full_name="P", phone="+70000000060")
        self.order = Order.objects.create(
            customer=self.customer, order_number="О-2024-970",
            status=Order.Status.ON_INSTALLATION,
        )
        self.w1 = Measurement.objects.create(
            order=self.order, room_name="Гостиная", window_name="Окно 1",
            width_cm=100, height_cm=150,
        )
        self.w2 = Measurement.objects.create(
            order=self.order, room_name="Спальня", window_name="Окно 1",
            width_cm=200, height_cm=200,
        )
        group, _ = Group.objects.get_or_create(name=Roles.INSTALLER)
        self.user = User.objects.create_user(username="inst", password="pwd12345")
        self.user.groups.add(group)
        self.client_api = APIClient()
        self.client_api.force_authenticate(user=self.user)

    def _url(self):
        return f"/api/v1/orders/{self.order.id}/photo-reports/"

    def test_upload_allowed_during_installation(self):
        """Раньше фото пускались только после отметки «установка завершена»."""
        resp = self.client_api.post(
            self._url(),
            {'file': _png(), 'measurement': str(self.w1.id)},
            format='multipart',
        )
        assert resp.status_code == 201, resp.content
        photo = PhotoReport.objects.get(order=self.order)
        assert photo.measurement_id == self.w1.id

    def test_photos_are_filtered_by_window(self):
        self.client_api.post(
            self._url(), {'file': _png('a.png'), 'measurement': str(self.w1.id)},
            format='multipart',
        )
        self.client_api.post(
            self._url(), {'file': _png('b.png'), 'measurement': str(self.w2.id)},
            format='multipart',
        )

        resp = self.client_api.get(self._url() + f"?measurement={self.w1.id}")
        assert resp.status_code == 200, resp.content
        assert resp.json()['count'] == 1

        # Без фильтра — все фото заказа.
        assert self.client_api.get(self._url()).json()['count'] == 2

    def test_measurement_from_other_order_is_rejected(self):
        other_order = Order.objects.create(
            customer=self.customer, order_number="О-2024-971",
            status=Order.Status.ON_INSTALLATION,
        )
        alien = Measurement.objects.create(
            order=other_order, room_name="Чужая", window_name="Окно 1",
            width_cm=100, height_cm=100,
        )
        resp = self.client_api.post(
            self._url(), {'file': _png(), 'measurement': str(alien.id)},
            format='multipart',
        )
        assert resp.status_code == 400
        assert resp.json()['code'] == 'measurement_not_found'

    def test_delete_is_soft(self):
        created = self.client_api.post(
            self._url(), {'file': _png(), 'measurement': str(self.w1.id)},
            format='multipart',
        ).json()

        resp = self.client_api.delete(f"{self._url()}{created['id']}/")
        assert resp.status_code == 204, resp.content

        photo = PhotoReport.objects.get(id=created['id'])
        assert photo.is_active is False
        assert self.client_api.get(self._url()).json()['count'] == 0

    def test_corrupt_image_is_rejected_with_400_not_500(self):
        """
        Pillow отвечает на битую структуру PNG исключением SyntaxError, которое
        не попадало в except — повреждённый файл ронял ручку в 500.
        """
        broken = bytearray(_png_bytes())
        broken[30:40] = b'\x00' * 10  # портим данные, оставляя PNG-сигнатуру
        resp = self.client_api.post(
            self._url(),
            {'file': SimpleUploadedFile('bad.png', bytes(broken), content_type='image/png'),
             'measurement': str(self.w1.id)},
            format='multipart',
        )
        assert resp.status_code == 400, resp.status_code

    def test_photos_reach_execution_summary(self):
        self.client_api.post(
            self._url(), {'file': _png(), 'measurement': str(self.w1.id)},
            format='multipart',
        )
        from atelier_erp.services.order_execution_service import OrderExecutionService

        summary = OrderExecutionService().get_order_execution_summary(self.order)
        rows = {m['window_name'] + m['room_name']: m for m in summary['measurements']}
        w1 = rows['Окно 1' + 'Гостиная']
        assert len(w1['photos']) == 1
        assert w1['photos'][0]['url']
        assert rows['Окно 1' + 'Спальня']['photos'] == []

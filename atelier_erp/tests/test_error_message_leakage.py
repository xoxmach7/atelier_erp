"""
Необработанные ошибки не выносят внутренности наружу.

Раньше 17 обработчиков `except Exception as e` отдавали клиенту `str(e)`.
В текст такой ошибки попадают имена ограничений БД, пути файлов и внутренние
сообщения ORM — по ним видно устройство схемы. Теперь настоящая ошибка уходит
в лог, а клиент получает обобщённую формулировку и машиночитаемый `code`.
"""

from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIClient

from atelier_erp.api.v1.views import UNEXPECTED_ERROR_MESSAGE
from atelier_erp.models import Customer, Order
from atelier_erp.roles import Roles

User = get_user_model()

# Текст, который не должен долетать до клиента: так выглядит утечка схемы.
SECRET_INTERNALS = 'duplicate key value violates unique constraint "orderitem_valid_reference"'


@pytest.mark.django_db
class TestErrorMessageLeakage(TestCase):
    def setUp(self):
        group, _ = Group.objects.get_or_create(name=Roles.OWNER)
        self.user = User.objects.create_user(username='leak_owner', password='pwd12345')
        self.user.groups.add(group)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.customer = Customer.objects.create(full_name='L', phone='+70000000099')
        self.order = Order.objects.create(
            customer=self.customer, order_number='О-2024-960', status=Order.Status.NEW,
        )

    def test_unexpected_error_does_not_leak_internals(self):
        """Смена статуса упала неожиданно — наружу общий текст, не текст исключения."""
        with patch(
            'atelier_erp.services.order_service.OrderService.transition_status_mvp',
            side_effect=RuntimeError(SECRET_INTERNALS),
        ):
            resp = self.client.post(
                f'/api/v1/orders/{self.order.id}/change-status/',
                {'status': Order.Status.IN_WORK},
                format='json',
            )

        assert resp.status_code == 400, resp.content
        body = resp.content.decode()
        assert SECRET_INTERNALS not in body
        assert 'orderitem_valid_reference' not in body
        assert UNEXPECTED_ERROR_MESSAGE in body

    def test_machine_readable_code_survives(self):
        """Фронтенд разбирает `code`, а не текст — код должен остаться прежним."""
        with patch(
            'atelier_erp.services.order_service.OrderService.transition_status_mvp',
            side_effect=RuntimeError('boom'),
        ):
            resp = self.client.post(
                f'/api/v1/orders/{self.order.id}/change-status/',
                {'status': Order.Status.IN_WORK},
                format='json',
            )

        assert resp.json().get('code') == 'status_change_error'

    def test_real_error_is_logged(self):
        """Ошибку не проглатываем: она должна попасть в лог со стеком."""
        with patch(
            'atelier_erp.services.order_service.OrderService.transition_status_mvp',
            side_effect=RuntimeError(SECRET_INTERNALS),
        ):
            with self.assertLogs('atelier_erp.api.v1.views', level='ERROR') as logs:
                self.client.post(
                    f'/api/v1/orders/{self.order.id}/change-status/',
                    {'status': Order.Status.IN_WORK},
                    format='json',
                )

        assert any(SECRET_INTERNALS in line for line in logs.output)

    def test_business_errors_keep_their_message(self):
        """
        Осмысленные ошибки правил остаются понятными — их текст писали для людей.

        Подмена всех сообщений на обобщённое сломала бы интерфейс: «Сначала
        примите КП» пользователю помогает, «Не удалось выполнить операцию» — нет.
        Обобщается только необработанное исключение.
        """
        resp = self.client.post(
            f'/api/v1/orders/{self.order.id}/change-status/',
            {'status': Order.Status.IN_WORK},
            format='json',
        )
        assert resp.status_code == 400, resp.content
        body = resp.json()
        assert UNEXPECTED_ERROR_MESSAGE not in str(body)
        # Осталось человеческое объяснение, а не пустой код.
        assert len(body.get('detail', '')) > 10

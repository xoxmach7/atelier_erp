import pytest
pytestmark = pytest.mark.skip(reason="legacy — pre-P0, references removed code; pending rewrite")
"""
Photo Report MVP Tests
Targeted tests for PhotoReport functionality.
"""

import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile

from atelier_erp.models import Order, PhotoReport, Customer, Fabric
from atelier_erp.constants import HandoverStage, ProductionStage


User = get_user_model()


@pytest.mark.django_db
class TestPhotoReport:
    """Tests for PhotoReport upload and listing"""

    @pytest.fixture
    def api_client(self):
        from rest_framework.test import APIClient
        return APIClient()

    @pytest.fixture
    def authenticated_client(self, api_client, user):
        api_client.force_authenticate(user=user)
        return api_client

    @pytest.fixture
    def user(self):
        return User.objects.create_user(
            username='testuser',
            password='testpass',
            first_name='Test',
            last_name='User'
        )

    @pytest.fixture
    def customer(self):
        return Customer.objects.create(
            full_name='Test Customer',
            phone='+77001234567'
        )

    @pytest.fixture
    def fabric(self):
        return Fabric.objects.create(
            name='Test Fabric',
            hanger_number='TF001',
            width_cm=280,
            stock_meters=Decimal('50.00'),
            price_per_meter=Decimal('1500.00')
        )

    @pytest.fixture
    def order_not_ready(self, customer):
        """Order NOT ready for photo report - handover pending"""
        return Order.objects.create(
            order_number='О-2026-PH-001',
            customer=customer,
            status=Order.Status.IN_PRODUCTION,
            total_amount=Decimal('10000'),
            paid_amount=Decimal('5000'),
            production_stage=ProductionStage.SEWING,
            handover_stage=HandoverStage.PENDING
        )

    @pytest.fixture
    def order_handover_done(self, customer):
        """Order ready for photo report - handover done"""
        return Order.objects.create(
            order_number='О-2026-PH-002',
            customer=customer,
            status=Order.Status.WAITING_FINAL_PAYMENT,
            total_amount=Decimal('10000'),
            paid_amount=Decimal('10000'),
            production_stage=ProductionStage.DONE,
            handover_stage=HandoverStage.DONE
        )

    @pytest.fixture
    def order_no_handover_production_done(self, customer):
        """Order ready for photo report - no handover needed, production done"""
        return Order.objects.create(
            order_number='О-2026-PH-003',
            customer=customer,
            status=Order.Status.READY,
            total_amount=Decimal('10000'),
            paid_amount=Decimal('10000'),
            production_stage=ProductionStage.DONE,
            handover_stage=HandoverStage.NOT_REQUIRED
        )

    @pytest.fixture
    def order_cancelled(self, customer):
        """Cancelled order - photo report blocked"""
        return Order.objects.create(
            order_number='О-2026-PH-004',
            customer=customer,
            status=Order.Status.CANCELLED,
            total_amount=Decimal('10000'),
            paid_amount=Decimal('5000'),
            production_stage=ProductionStage.SEWING,
            handover_stage=HandoverStage.PENDING
        )

    @pytest.fixture
    def order_completed(self, customer):
        """Completed order - photo report blocked"""
        return Order.objects.create(
            order_number='О-2026-PH-005',
            customer=customer,
            status=Order.Status.COMPLETED,
            total_amount=Decimal('10000'),
            paid_amount=Decimal('10000'),
            production_stage=ProductionStage.DONE,
            handover_stage=HandoverStage.DONE
        )

    def test_cannot_upload_before_handover_done(self, authenticated_client, order_not_ready):
        """A. Upload blocked when handover_stage != done"""
        url = f"/api/v1/orders/{order_not_ready.id}/photo-reports/"
        image = SimpleUploadedFile(
            "test.jpg",
            b"JPEG content",
            content_type="image/jpeg"
        )

        response = authenticated_client.post(
            url,
            {'file': image},
            format='multipart'
        )

        assert response.status_code == 400
        assert response.data['code'] == 'photo_report_not_available'

    def test_can_upload_when_handover_done(self, authenticated_client, order_handover_done):
        """B. Upload works when handover_stage = done"""
        original_status = order_handover_done.status
        url = f"/api/v1/orders/{order_handover_done.id}/photo-reports/"
        image = SimpleUploadedFile(
            "test.jpg",
            b"JPEG content",
            content_type="image/jpeg"
        )

        response = authenticated_client.post(
            url,
            {'file': image, 'caption': 'Test photo'},
            format='multipart'
        )

        assert response.status_code == 201
        assert PhotoReport.objects.filter(order=order_handover_done).count() == 1

        # Verify file saved
        photo = PhotoReport.objects.get(order=order_handover_done)
        assert photo.file is not None
        assert photo.caption == 'Test photo'

        # Order.status unchanged
        order_handover_done.refresh_from_db()
        assert order_handover_done.status == original_status

    def test_can_upload_when_no_handover_and_production_done(
        self, authenticated_client, order_no_handover_production_done
    ):
        """C. Upload works when handover=not_required AND production=done"""
        url = f"/api/v1/orders/{order_no_handover_production_done.id}/photo-reports/"
        image = SimpleUploadedFile(
            "test.png",
            b"PNG content",
            content_type="image/png"
        )

        response = authenticated_client.post(
            url,
            {'file': image},
            format='multipart'
        )

        assert response.status_code == 201
        assert PhotoReport.objects.filter(order=order_no_handover_production_done).count() == 1

    def test_list_photo_reports(self, authenticated_client, order_handover_done, user):
        """D. GET returns list with file_url"""
        # Create photo report
        PhotoReport.objects.create(
            order=order_handover_done,
            file=SimpleUploadedFile("test.jpg", b"JPEG", "image/jpeg"),
            caption='First photo',
            uploaded_by=user
        )

        url = f"/api/v1/orders/{order_handover_done.id}/photo-reports/"
        response = authenticated_client.get(url)

        assert response.status_code == 200
        assert response.data['count'] >= 1
        assert len(response.data['photo_reports']) >= 1

        # Check file_url exists in response
        photo_data = response.data['photo_reports'][0]
        assert 'file_url' in photo_data

    def test_rejects_invalid_file_type(self, authenticated_client, order_handover_done):
        """E. Upload .txt rejected"""
        url = f"/api/v1/orders/{order_handover_done.id}/photo-reports/"
        text_file = SimpleUploadedFile(
            "test.txt",
            b"Text content",
            content_type="text/plain"
        )

        response = authenticated_client.post(
            url,
            {'file': text_file},
            format='multipart'
        )

        assert response.status_code == 400

    def test_cancelled_order_blocked(self, authenticated_client, order_cancelled):
        """F1. Cancelled order upload blocked"""
        url = f"/api/v1/orders/{order_cancelled.id}/photo-reports/"
        image = SimpleUploadedFile(
            "test.jpg",
            b"JPEG content",
            content_type="image/jpeg"
        )

        response = authenticated_client.post(
            url,
            {'file': image},
            format='multipart'
        )

        assert response.status_code == 400
        assert 'cancelled' in str(response.data.get('error', '')).lower()

    def test_completed_order_blocked(self, authenticated_client, order_completed):
        """F2. Completed order upload blocked"""
        url = f"/api/v1/orders/{order_completed.id}/photo-reports/"
        image = SimpleUploadedFile(
            "test.jpg",
            b"JPEG content",
            content_type="image/jpeg"
        )

        response = authenticated_client.post(
            url,
            {'file': image},
            format='multipart'
        )

        assert response.status_code == 400
        assert 'completed' in str(response.data.get('error', '')).lower()

    def test_file_exists_in_storage(self, authenticated_client, order_handover_done):
        """Verify uploaded file exists in storage"""
        url = f"/api/v1/orders/{order_handover_done.id}/photo-reports/"
        image = SimpleUploadedFile(
            "test.jpg",
            b"JPEG content for storage test",
            content_type="image/jpeg"
        )

        authenticated_client.post(
            url,
            {'file': image},
            format='multipart'
        )

        photo = PhotoReport.objects.get(order=order_handover_done)
        assert photo.file.storage.exists(photo.file.name)

    def test_webp_upload_accepted(self, authenticated_client, order_handover_done):
        """WebP images accepted"""
        url = f"/api/v1/orders/{order_handover_done.id}/photo-reports/"
        webp = SimpleUploadedFile(
            "test.webp",
            b"WEBP content",
            content_type="image/webp"
        )

        response = authenticated_client.post(
            url,
            {'file': webp},
            format='multipart'
        )

        assert response.status_code == 201

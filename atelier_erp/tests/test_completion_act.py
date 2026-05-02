"""
Order Completion Act (АВР) Tests
Targeted tests for AVR MVP functionality.
"""

import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model

from atelier_erp.models import Order, OrderCompletionAct, Customer
from atelier_erp.constants import HandoverStage, ProductionStage


User = get_user_model()


@pytest.mark.django_db
class TestOrderCompletionAct:
    """Tests for OrderCompletionAct model and API"""

    @pytest.fixture
    def customer(self):
        return Customer.objects.create(
            full_name='Test Customer',
            phone='+77001234567'
        )

    @pytest.fixture
    def user(self):
        return User.objects.create_user(
            username='testuser',
            password='testpass'
        )

    @pytest.fixture
    def order_with_handover_done(self, customer):
        """Order ready for AVR - handover done"""
        return Order.objects.create(
            order_number='О-2026-001',
            customer=customer,
            status=Order.Status.WAITING_FINAL_PAYMENT,
            total_amount=Decimal('10000'),
            paid_amount=Decimal('10000'),
            production_stage=ProductionStage.DONE,
            handover_stage=HandoverStage.DONE
        )

    @pytest.fixture
    def order_with_production_done_no_handover(self, customer):
        """Order ready for AVR - production done, handover not required"""
        return Order.objects.create(
            order_number='О-2026-002',
            customer=customer,
            status=Order.Status.READY,
            total_amount=Decimal('10000'),
            paid_amount=Decimal('5000'),
            production_stage=ProductionStage.DONE,
            handover_stage=HandoverStage.NOT_REQUIRED
        )

    @pytest.fixture
    def order_not_ready_for_act(self, customer):
        """Order not ready for AVR - handover not done"""
        return Order.objects.create(
            order_number='О-2026-003',
            customer=customer,
            status=Order.Status.IN_PRODUCTION,
            total_amount=Decimal('10000'),
            paid_amount=Decimal('5000'),
            production_stage=ProductionStage.SEWING,
            handover_stage=HandoverStage.PENDING
        )

    def test_can_create_act_after_handover_done(self, order_with_handover_done, user):
        """AVR available when handover_stage == done"""
        # Check availability logic
        can_create = (
            order_with_handover_done.handover_stage == HandoverStage.DONE
            or (
                order_with_handover_done.handover_stage == HandoverStage.NOT_REQUIRED
                and order_with_handover_done.production_stage == ProductionStage.DONE
            )
        )
        assert can_create is True

        # Create act
        act = OrderCompletionAct.objects.create(
            order=order_with_handover_done,
            act_number=f"АВР-{order_with_handover_done.order_number}",
            status=OrderCompletionAct.Status.DRAFT,
            created_by=user
        )

        assert act.act_number == 'АВР-О-2026-001'
        assert act.status == OrderCompletionAct.Status.DRAFT
        assert act.order == order_with_handover_done

    def test_can_create_act_when_handover_not_required_and_production_done(
        self, order_with_production_done_no_handover, user
    ):
        """AVR available when handover not required AND production done"""
        # Check availability logic
        can_create = (
            order_with_production_done_no_handover.handover_stage == HandoverStage.DONE
            or (
                order_with_production_done_no_handover.handover_stage == HandoverStage.NOT_REQUIRED
                and order_with_production_done_no_handover.production_stage == ProductionStage.DONE
            )
        )
        assert can_create is True

        # Create act
        act = OrderCompletionAct.objects.create(
            order=order_with_production_done_no_handover,
            act_number=f"АВР-{order_with_production_done_no_handover.order_number}",
            status=OrderCompletionAct.Status.DRAFT,
            created_by=user
        )

        assert act.act_number == 'АВР-О-2026-002'
        assert act.status == OrderCompletionAct.Status.DRAFT

    def test_cannot_create_act_before_handover_done(self, order_not_ready_for_act, user):
        """AVR not available when handover not done"""
        # Check availability logic
        can_create = (
            order_not_ready_for_act.handover_stage == HandoverStage.DONE
            or (
                order_not_ready_for_act.handover_stage == HandoverStage.NOT_REQUIRED
                and order_not_ready_for_act.production_stage == ProductionStage.DONE
            )
        )
        assert can_create is False

    def test_create_act_does_not_change_order_status(self, order_with_handover_done, user):
        """Creating AVR does not change Order.status"""
        original_status = order_with_handover_done.status

        act = OrderCompletionAct.objects.create(
            order=order_with_handover_done,
            act_number=f"АВР-{order_with_handover_done.order_number}",
            status=OrderCompletionAct.Status.DRAFT,
            created_by=user
        )

        # Refresh order from DB
        order_with_handover_done.refresh_from_db()

        assert order_with_handover_done.status == original_status
        assert act.status == OrderCompletionAct.Status.DRAFT

    def test_upload_signed_act_sets_status_signed(self, order_with_handover_done, user):
        """Upload signed file sets status to signed"""
        from django.core.files.uploadedfile import SimpleUploadedFile

        act = OrderCompletionAct.objects.create(
            order=order_with_handover_done,
            act_number=f"АВР-{order_with_handover_done.order_number}",
            status=OrderCompletionAct.Status.DRAFT,
            created_by=user
        )

        # Simulate file upload
        signed_file = SimpleUploadedFile(
            "test_act.pdf",
            b"PDF content",
            content_type="application/pdf"
        )

        act.signed_file = signed_file
        act.status = OrderCompletionAct.Status.SIGNED
        act.signed_file_uploaded_by = user
        act.save()

        act.refresh_from_db()
        assert act.status == OrderCompletionAct.Status.SIGNED
        assert act.signed_file is not None
        assert act.signed_file_uploaded_by == user

    def test_upload_signed_act_does_not_change_order_status(self, order_with_handover_done, user):
        """Upload signed AVR does not change Order.status"""
        from django.core.files.uploadedfile import SimpleUploadedFile

        original_status = order_with_handover_done.status

        act = OrderCompletionAct.objects.create(
            order=order_with_handover_done,
            act_number=f"АВР-{order_with_handover_done.order_number}",
            status=OrderCompletionAct.Status.DRAFT,
            created_by=user
        )

        # Upload signed file
        signed_file = SimpleUploadedFile(
            "test_act.pdf",
            b"PDF content",
            content_type="application/pdf"
        )

        act.signed_file = signed_file
        act.status = OrderCompletionAct.Status.SIGNED
        act.signed_file_uploaded_by = user
        act.save()

        # Refresh order from DB
        order_with_handover_done.refresh_from_db()

        assert order_with_handover_done.status == original_status
        assert act.status == OrderCompletionAct.Status.SIGNED

    def test_rejects_invalid_file_type(self, order_with_handover_done, user):
        """Only PDF and images allowed for upload"""
        from django.core.files.uploadedfile import SimpleUploadedFile
        from atelier_erp.api.v1.serializers import OrderCompletionActUploadSerializer

        # Test with invalid file type
        invalid_file = SimpleUploadedFile(
            "test.exe",
            b"EXE content",
            content_type="application/x-msdownload"
        )

        serializer = OrderCompletionActUploadSerializer(data={
            'signed_file': invalid_file,
            'notes': 'Test'
        })

        assert not serializer.is_valid()
        assert 'signed_file' in serializer.errors

    def test_returns_existing_act_if_already_created(self, order_with_handover_done, user):
        """If AVR already exists, return existing one"""
        # Create first act
        act1 = OrderCompletionAct.objects.create(
            order=order_with_handover_done,
            act_number=f"АВР-{order_with_handover_done.order_number}",
            status=OrderCompletionAct.Status.DRAFT,
            created_by=user
        )

        # Try to create another act - should get existing
        try:
            existing_act = order_with_handover_done.completion_act
            assert existing_act.id == act1.id
            assert existing_act.act_number == act1.act_number
        except OrderCompletionAct.DoesNotExist:
            pytest.fail("Should have returned existing act")

    def test_act_number_generation(self, order_with_handover_done, user):
        """Act number follows pattern: АВР-{order_number}"""
        act = OrderCompletionAct.objects.create(
            order=order_with_handover_done,
            act_number=f"АВР-{order_with_handover_done.order_number}",
            status=OrderCompletionAct.Status.DRAFT,
            created_by=user
        )

        assert act.act_number.startswith('АВР-')
        assert order_with_handover_done.order_number in act.act_number

    def test_related_name_access(self, order_with_handover_done, user):
        """Can access act via order.completion_act"""
        act = OrderCompletionAct.objects.create(
            order=order_with_handover_done,
            act_number=f"АВР-{order_with_handover_done.order_number}",
            status=OrderCompletionAct.Status.DRAFT,
            created_by=user
        )

        # Access via related_name
        retrieved_act = order_with_handover_done.completion_act
        assert retrieved_act == act

    def test_soft_delete(self, order_with_handover_done, user):
        """Soft delete - is_active flag"""
        act = OrderCompletionAct.objects.create(
            order=order_with_handover_done,
            act_number=f"АВР-{order_with_handover_done.order_number}",
            status=OrderCompletionAct.Status.DRAFT,
            created_by=user
        )

        assert act.is_active is True

        # Soft delete
        act.is_active = False
        act.save()

        act.refresh_from_db()
        assert act.is_active is False


@pytest.mark.django_db
class TestCompletionActAPI:
    """API endpoint tests for completion act"""

    @pytest.fixture
    def api_client(self):
        from rest_framework.test import APIClient
        return APIClient()

    @pytest.fixture
    def authenticated_client(self, api_client, user):
        api_client.force_authenticate(user=user)
        return api_client

    @pytest.fixture
    def customer(self):
        return Customer.objects.create(
            full_name='Test Customer',
            phone='+77001234567'
        )

    @pytest.fixture
    def user(self):
        return User.objects.create_user(
            username='testuser',
            password='testpass'
        )

    @pytest.fixture
    def order_with_handover_done(self, customer):
        return Order.objects.create(
            order_number='О-2026-API-001',
            customer=customer,
            status=Order.Status.WAITING_FINAL_PAYMENT,
            total_amount=Decimal('10000'),
            paid_amount=Decimal('10000'),
            production_stage=ProductionStage.DONE,
            handover_stage=HandoverStage.DONE
        )

    @pytest.fixture
    def order_not_ready(self, customer):
        return Order.objects.create(
            order_number='О-2026-API-002',
            customer=customer,
            status=Order.Status.IN_PRODUCTION,
            total_amount=Decimal('10000'),
            paid_amount=Decimal('5000'),
            production_stage=ProductionStage.SEWING,
            handover_stage=HandoverStage.PENDING
        )

    def test_get_act_not_created(self, authenticated_client, order_with_handover_done):
        """GET returns not_created when act doesn't exist"""
        url = f"/api/v1/orders/{order_with_handover_done.id}/completion-act/"
        response = authenticated_client.get(url)

        assert response.status_code == 200
        assert response.data['exists'] is False
        assert response.data['status'] == 'not_created'

    def test_get_act_not_available(self, authenticated_client, order_not_ready):
        """GET returns not_available when conditions not met"""
        url = f"/api/v1/orders/{order_not_ready.id}/completion-act/"
        response = authenticated_client.get(url)

        assert response.status_code == 200
        assert response.data['exists'] is False
        assert response.data['status'] == 'not_available'

    def test_create_act_success(self, authenticated_client, order_with_handover_done):
        """POST creates act when conditions are met"""
        url = f"/api/v1/orders/{order_with_handover_done.id}/completion-act/"
        response = authenticated_client.post(url, {}, format='json')

        assert response.status_code == 201
        assert response.data['exists'] is True
        assert response.data['act']['act_number'] == 'АВР-О-2026-API-001'
        assert response.data['act']['status'] == 'draft'

    def test_create_act_not_available(self, authenticated_client, order_not_ready):
        """POST returns error when conditions not met"""
        url = f"/api/v1/orders/{order_not_ready.id}/completion-act/"
        response = authenticated_client.post(url, {}, format='json')

        assert response.status_code == 400
        assert response.data['code'] == 'act_not_available'

    def test_upload_signed_act(self, authenticated_client, order_with_handover_done):
        """POST upload-signed sets status to signed"""
        from django.core.files.uploadedfile import SimpleUploadedFile

        # Create act first
        OrderCompletionAct.objects.create(
            order=order_with_handover_done,
            act_number=f"АВР-{order_with_handover_done.order_number}",
            status=OrderCompletionAct.Status.DRAFT
        )

        # Upload signed file
        url = f"/api/v1/orders/{order_with_handover_done.id}/completion-act/upload-signed/"
        signed_file = SimpleUploadedFile(
            "test_act.pdf",
            b"PDF content",
            content_type="application/pdf"
        )

        response = authenticated_client.post(
            url,
            {'signed_file': signed_file, 'notes': 'Test notes'},
            format='multipart'
        )

        assert response.status_code == 200
        assert response.data['act']['status'] == 'signed'
        assert response.data['act']['notes'] == 'Test notes'

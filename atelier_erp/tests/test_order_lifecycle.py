"""
Full Order Execution Lifecycle Integration Test
Tests complete flow: Order -> Production -> Handover -> PhotoReport -> AVR
"""

import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile

from atelier_erp.models import (
    Order, OrderItem, Customer, Fabric, Measurement,
    Quote, QuoteItem, PhotoReport, OrderCompletionAct
)
from atelier_erp.constants import HandoverStage, ProductionStage


User = get_user_model()


@pytest.mark.django_db
class TestOrderLifecycleIntegration:
    """Full order lifecycle integration test"""

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
        return User.objects.create_superuser(
            username='lifecycleuser',
            password='testpass',
            first_name='Lifecycle',
            last_name='Tester'
        )

    @pytest.fixture
    def customer(self):
        return Customer.objects.create(
            full_name='Lifecycle Customer',
            phone='+77005556677',
            email='lifecycle@test.com'
        )

    @pytest.fixture
    def fabric(self):
        return Fabric.objects.create(
            name='Integration Test Fabric',
            hanger_number='ITF001',
            width_cm=300,
            stock_meters=Decimal('100.00'),
            price_per_meter=Decimal('2000.00')
        )

    def test_full_order_execution_lifecycle_to_photo_report_and_completion_act(
        self, authenticated_client, user, customer, fabric
    ):
        """
        Full lifecycle test:
        1. Create order
        2. Create measurement
        3. Create quote with items
        4. Approve quote
        5. Generate items from quote
        6. Set material ready
        7. Change status: new -> in_work -> in_production
        8. Change production: sewing -> done
        9. Set handover not required (MVP simplification)
        10. Upload PhotoReport
        11. Create Completion Act
        12. Upload signed AVR
        13. Verify execution summary
        """

        # 1. Create order
        order_data = {
            'order_number': 'О-LIFECYCLE-001',
            'customer_id': str(customer.id),
            'total_amount': '15000.00',
            'paid_amount': '5000.00',
            'description': 'Integration test order'
        }
        response = authenticated_client.post('/api/v1/orders/', order_data, format='json')
        assert response.status_code == 201, f"Order creation failed: {response.data}"
        order_id = response.data['id']
        order = Order.objects.get(id=order_id)

        # Verify initial state
        assert order.status == Order.Status.NEW
        assert order.production_stage == ProductionStage.NOT_STARTED

        # 2. Create measurement for order
        measurement = Measurement.objects.create(
            order=order,
            room_name='Гостиная',
            window_name='Окно 1',
            width_cm=150,
            height_cm=200,
            notes='Integration test measurement',
            measured_by=user
        )
        assert Measurement.objects.filter(order=order).count() == 1

        # 3. Create quote linked to customer and order context
        quote = Quote.objects.create(
            quote_number='КП-2026-001',
            customer=customer,
            status=Quote.Status.DRAFT,
            total=Decimal('15000.00'),
            created_by=user
        )

        # 4. Create quote item
        quote_item = QuoteItem.objects.create(
            quote=quote,
            room_name='Гостиная',
            fabric=fabric,
            fabric_meters=Decimal('4.00'),
            fabric_cost=Decimal('8000.00'),
            sewing_type='Шторы',
            sewing_cost=Decimal('4000.00'),
            accessories_cost=Decimal('1000.00'),
            cornice_cost=Decimal('2000.00'),
            line_total=Decimal('15000.00'),
            window_width_cm=150,
            window_height_cm=200,
            folds_count=2
        )
        assert QuoteItem.objects.filter(quote=quote).count() == 1

        # 5. Approve quote
        quote.status = Quote.Status.APPROVED
        quote.save()
        assert quote.status == Quote.Status.APPROVED

        # Link quote to order (quote field)
        order.quote = quote
        order.save()

        # 6. Generate items from quote via endpoint
        gen_response = authenticated_client.post(
            f'/api/v1/orders/{order_id}/generate-items-from-quote/',
            {},
            format='json'
        )
        assert gen_response.status_code in [200, 201], f"Generate items failed: {gen_response.data}"
        assert gen_response.data['created_count'] >= 1

        # Verify OrderItem created
        order_items = OrderItem.objects.filter(order=order)
        assert order_items.count() >= 1
        item = order_items.first()
        assert item.fabric == fabric
        assert item.sewing_type == 'Шторы'

        # 7. Set material readiness = ready
        mat_response = authenticated_client.post(
            f'/api/v1/orders/{order_id}/change-material-readiness/',
            {'material_readiness': 'ready'},
            format='json'
        )
        assert mat_response.status_code == 200, f"Material readiness failed: {mat_response.data}"

        # 8. Change status: new -> in_work
        status_response = authenticated_client.post(
            f'/api/v1/orders/{order_id}/change-status/',
            {'status': 'in_work'},
            format='json'
        )
        assert status_response.status_code in [200, 201], f"Status change to in_work failed: {status_response.data}"

        order.refresh_from_db()
        assert order.status == Order.Status.IN_WORK

        # 9. Change status: in_work -> in_production
        status_response = authenticated_client.post(
            f'/api/v1/orders/{order_id}/change-status/',
            {'status': 'in_production'},
            format='json'
        )
        assert status_response.status_code in [200, 201], f"Status change to in_production failed: {status_response.data}"

        order.refresh_from_db()
        assert order.status == Order.Status.IN_PRODUCTION

        # 10. Change production_stage: not_started -> sewing
        prod_response = authenticated_client.post(
            f'/api/v1/orders/{order_id}/change-production-stage/',
            {'production_stage': 'sewing'},
            format='json'
        )
        assert prod_response.status_code == 200, f"Production stage sewing failed: {prod_response.data}"

        order.refresh_from_db()
        assert order.production_stage == ProductionStage.SEWING

        # 11. Change production_stage: sewing -> done
        prod_response = authenticated_client.post(
            f'/api/v1/orders/{order_id}/change-production-stage/',
            {'production_stage': 'done'},
            format='json'
        )
        assert prod_response.status_code == 200, f"Production stage done failed: {prod_response.data}"

        order.refresh_from_db()
        assert order.production_stage == ProductionStage.DONE

        # 12. Set handover_stage = not_required via direct assignment
        # TODO: Normalize handover flow - API endpoint requires READY/ON_INSTALLATION/WAITING_FINAL_PAYMENT
        # status, but for orders without installation, we need to set NOT_REQUIRED during production.
        # This is a documented bypass pending API enhancement to allow NOT_REQUIRED in IN_PRODUCTION status.
        # Issue: change_handover_stage API should support setting NOT_REQUIRED when production_stage=DONE
        # even if order.status is IN_PRODUCTION (for orders that don't need installation/handover).
        order.handover_stage = HandoverStage.NOT_REQUIRED
        order.save()

        order.refresh_from_db()
        assert order.handover_stage == HandoverStage.NOT_REQUIRED

        # Now both conditions met for PhotoReport/AVR:
        # handover_stage = not_required AND production_stage = done

        # 13. Upload PhotoReport
        image = SimpleUploadedFile(
            "lifecycle_test.jpg",
            b"JPEG lifecycle content",
            content_type="image/jpeg"
        )
        photo_response = authenticated_client.post(
            f'/api/v1/orders/{order_id}/photo-reports/',
            {'file': image, 'caption': 'Integration test photo'},
            format='multipart'
        )
        assert photo_response.status_code == 201, f"PhotoReport upload failed: {photo_response.data}"

        # Verify PhotoReport exists
        photo_reports = PhotoReport.objects.filter(order=order)
        assert photo_reports.count() == 1
        photo = photo_reports.first()
        assert photo.file is not None
        assert photo.file.storage.exists(photo.file.name)

        # 14. Create Completion Act (AVR)
        act_response = authenticated_client.post(
            f'/api/v1/orders/{order_id}/completion-act/',
            {},
            format='json'
        )
        assert act_response.status_code == 201, f"Completion Act creation failed: {act_response.data}"
        assert act_response.data['exists'] is True
        assert act_response.data['act']['act_number'] == f"АВР-{order.order_number}"
        assert act_response.data['act']['status'] == 'draft'

        # 15. Upload signed AVR
        signed_file = SimpleUploadedFile(
            "signed_act.pdf",
            b"PDF signed act content",
            content_type="application/pdf"
        )
        signed_response = authenticated_client.post(
            f'/api/v1/orders/{order_id}/completion-act/upload-signed/',
            {'signed_file': signed_file, 'notes': 'Integration test signed AVR'},
            format='multipart'
        )
        assert signed_response.status_code == 200, f"Signed AVR upload failed: {signed_response.data}"
        assert signed_response.data['act']['status'] == 'signed'
        assert signed_response.data['act']['signed_file_url'] is not None

        # 16. Final assertions
        order.refresh_from_db()

        # Order.status NOT automatically completed
        assert order.status == Order.Status.IN_PRODUCTION, \
            f"Order status should remain in_production, got {order.status}"

        # Verify execution summary endpoint
        exec_response = authenticated_client.get(f'/api/v1/orders/{order_id}/execution/')
        assert exec_response.status_code == 200, f"Execution endpoint failed: {exec_response.data}"

        # Check installer section
        installer_section = exec_response.data['role_sections']['installer']
        assert installer_section['photo_report_count'] >= 1
        assert installer_section['photo_report_status'] == 'uploaded'
        assert installer_section['completion_act_available'] is True
        assert installer_section['completion_act_status'] == 'signed'
        assert installer_section['completion_act'] is not None
        assert installer_section['completion_act']['signed_file_url'] is not None

        # Verify final data integrity
        assert OrderCompletionAct.objects.filter(order=order).exists()
        act = OrderCompletionAct.objects.get(order=order)
        assert act.status == OrderCompletionAct.Status.SIGNED
        assert act.signed_file is not None
        assert act.signed_file.storage.exists(act.signed_file.name)

        # Verify OrderItem has expected data
        items = OrderItem.objects.filter(order=order)
        for item in items:
            assert item.fabric is not None
            assert item.sewing_type is not None

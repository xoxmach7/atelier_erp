"""
Django Signals - ONLY for audit logging and cache invalidation.
NO business logic here - all business logic is in services.
"""

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.contrib.auth import get_user_model

from .models import (
    Order, Task, Customer, Fabric, Cornice, Quote,
    OrderStatusHistory, TaskHistory, ActivityLog
)

User = get_user_model()


@receiver(post_save, sender=Order)
def log_order_created_or_updated(sender, instance, created, **kwargs):
    """Log order creation and status changes to ActivityLog"""
    if created:
        ActivityLog.objects.create(
            entity_type=ActivityLog.EntityType.ORDER,
            entity_id=instance.id,
            entity_repr=f"{instance.order_number} - {instance.customer.full_name}",
            action=ActivityLog.Action.CREATED,
            new_values={
                'order_number': instance.order_number,
                'customer_id': str(instance.customer_id),
                'total_amount': str(instance.total_amount),
                'status': instance.status,
            },
            performed_by=instance.created_by,
            performed_by_name=instance.created_by.get_full_name() if instance.created_by else 'System',
        )


@receiver(post_save, sender=Task)
def log_task_created(sender, instance, created, **kwargs):
    """Log task creation"""
    if created:
        ActivityLog.objects.create(
            entity_type=ActivityLog.EntityType.TASK,
            entity_id=instance.id,
            entity_repr=f"{instance.task_number} - {instance.client_name}",
            action=ActivityLog.Action.CREATED,
            new_values={
                'task_number': instance.task_number,
                'client_name': instance.client_name,
                'status': instance.status,
            },
            performed_by=instance.created_by,
            performed_by_name=instance.created_by.get_full_name() if instance.created_by else 'System',
        )


@receiver(post_save, sender=Customer)
def log_customer_created(sender, instance, created, **kwargs):
    """Log customer creation"""
    if created:
        ActivityLog.objects.create(
            entity_type=ActivityLog.EntityType.CUSTOMER,
            entity_id=instance.id,
            entity_repr=f"{instance.full_name} ({instance.phone})",
            action=ActivityLog.Action.CREATED,
            new_values={
                'full_name': instance.full_name,
                'phone': instance.phone,
            },
        )

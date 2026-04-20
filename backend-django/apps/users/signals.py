from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from apps.users.models import User
from apps.users.tasks import send_welcome_email


@receiver(post_save, sender=User)
def user_created(sender, instance, created, **kwargs):
    """Handle user creation."""
    if created and not instance.email_verified:
        # Send welcome email asynchronously
        send_welcome_email.delay(str(instance.id))


@receiver(pre_save, sender=User)
def user_pre_save(sender, instance, **kwargs):
    """Handle before user save."""
    if instance.pk:
        old_user = User.objects.filter(pk=instance.pk).first()
        if old_user and old_user.email != instance.email:
            # Email changed - reset verification
            instance.email_verified = False

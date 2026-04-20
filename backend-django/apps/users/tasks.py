from celery import shared_task
from django.core.mail import send_mail

from apps.users.models import User


@shared_task(bind=True, max_retries=3)
def send_welcome_email(self, user_id: str):
    """Send welcome email to new user."""
    try:
        user = User.objects.get(id=user_id)
        send_mail(
            subject="Добро пожаловать в Brigada!",
            message=f"Здравствуйте, {user.first_name}!\n\n"
            f"Ваш аккаунт был успешно создан.",
            from_email="noreply@brigada.kz",
            recipient_list=[user.email],
            fail_silently=False,
        )
    except User.DoesNotExist:
        return
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


@shared_task
def cleanup_inactive_users():
    """Cleanup users that haven't logged in for a long time."""
    from datetime import timedelta

    from django.utils import timezone

    threshold = timezone.now() - timedelta(days=365)
    inactive_users = User.objects.filter(
        last_login__lt=threshold, is_active=True, is_staff=False
    )

    count = inactive_users.count()
    inactive_users.update(is_active=False)

    return f"Deactivated {count} inactive users"

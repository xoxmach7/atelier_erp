from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.urls import reverse


@shared_task(bind=True, max_retries=3)
def send_password_reset_email(self, email: str, uid: str, token: str):
    """Send password reset email to user."""
    try:
        # Build reset URL
        reset_url = f"{settings.FRONTEND_URL}/auth/reset-password?uid={uid}&token={token}"

        send_mail(
            subject="Сброс пароля",
            message=f"Для сброса пароля перейдите по ссылке:\n{reset_url}\n\n"
            f"Если вы не запрашивали сброс пароля, проигнорируйте это письмо.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)

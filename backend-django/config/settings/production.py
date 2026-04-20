from config.settings.base import *  # noqa: F401,F403

# =============================================================================
# Production Settings
# =============================================================================
DEBUG = False

# =============================================================================
# Security
# =============================================================================
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)  # noqa: F405
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

SESSION_COOKIE_SECURE = env.bool("SESSION_COOKIE_SECURE", default=True)  # noqa: F405
CSRF_COOKIE_SECURE = env.bool("CSRF_COOKIE_SECURE", default=True)  # noqa: F405
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_HTTPONLY = True

SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# =============================================================================
# Static Files (CDN / S3 in production)
# =============================================================================
AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default=None)  # noqa: F405
AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY", default=None)  # noqa: F405
AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME", default=None)  # noqa: F405
AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="eu-central-1")  # noqa: F405
AWS_S3_CUSTOM_DOMAIN = env("AWS_S3_CUSTOM_DOMAIN", default=None)  # noqa: F405

if AWS_STORAGE_BUCKET_NAME:
    INSTALLED_APPS += ["storages"]  # noqa: F405
    DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
    AWS_DEFAULT_ACL = "private"
    AWS_S3_OBJECT_PARAMETERS = {
        "CacheControl": "max-age=86400",
    }

# =============================================================================
# Email (SMTP in production)
# =============================================================================
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

# =============================================================================
# Logging (JSON format for production)
# =============================================================================
LOGGING["handlers"]["console"]["formatter"] = "json"  # noqa: F405

# =============================================================================
# Caching (Redis in production)
# =============================================================================
CACHES["default"]["OPTIONS"]["SERIALIZER"] = "django_redis.serializers.json.JSONSerializer"  # noqa: F405

# =============================================================================
# Celery (Production settings)
# =============================================================================
CELERY_TASK_ALWAYS_EAGER = False
CELERY_WORKER_PREFETCH_MULTIPLIER = 4
CELERY_WORKER_CONCURRENCY = 4

from config.settings.base import *  # noqa: F401,F403

# =============================================================================
# Development Settings
# =============================================================================
DEBUG = True

# Allow all hosts in development
ALLOWED_HOSTS = ["*"]

# =============================================================================
# Debug Toolbar (optional)
# =============================================================================
INSTALLED_APPS += ["django_extensions"]  # noqa: F405

# =============================================================================
# Email (Console backend for development)
# =============================================================================
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# =============================================================================
# Cache (Dummy cache for development)
# =============================================================================
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.dummy.DummyCache",
    }
}

# =============================================================================
# Logging (More verbose in development)
# =============================================================================
LOGGING["loggers"]["django.db.backends"]["level"] = "DEBUG"  # noqa: F405
LOGGING["loggers"]["django.db.backends"]["handlers"] = ["console"]  # noqa: F405

# =============================================================================
# REST Framework (Browsable API in development)
# =============================================================================
REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = [  # noqa: F405
    "rest_framework.renderers.JSONRenderer",
    "rest_framework.renderers.BrowsableAPIRenderer",
]

# =============================================================================
# JWT (Longer lifetime for development)
# =============================================================================
SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"] = timedelta(days=7)  # noqa: F405,F821

# =============================================================================
# CORS (Allow all in development)
# =============================================================================
CORS_ALLOW_ALL_ORIGINS = True

# =============================================================================
# Defender (Disable in development)
# =============================================================================
MIDDLEWARE = [m for m in MIDDLEWARE if "defender" not in m]  # noqa: F405

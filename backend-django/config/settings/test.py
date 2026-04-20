from config.settings.base import *  # noqa: F401,F403

# =============================================================================
# Test Settings
# =============================================================================
DEBUG = False

SECRET_KEY = "test-secret-key-not-for-production"

# =============================================================================
# Database (SQLite for fast tests)
# =============================================================================
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# =============================================================================
# Password Hashing (Faster for tests)
# =============================================================================
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# =============================================================================
# Email (Console backend)
# =============================================================================
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# =============================================================================
# Celery (Synchronous execution)
# =============================================================================
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# =============================================================================
# Cache (Dummy)
# =============================================================================
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.dummy.DummyCache",
    }
}

# =============================================================================
# Media Storage (In-memory)
# =============================================================================
DEFAULT_FILE_STORAGE = "django.core.files.storage.InMemoryStorageStorage"

# =============================================================================
# Defender (Disable)
# =============================================================================
MIDDLEWARE = [m for m in MIDDLEWARE if "defender" not in m]  # noqa: F405

# =============================================================================
# REST Framework (Disable throttling)
# =============================================================================
REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"] = []  # noqa: F405
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {}  # noqa: F405

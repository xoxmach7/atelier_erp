"""
Atelier ERP - Minimal Settings for First Deploy
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# DEBUG по умолчанию ВЫКЛЮЧЕН. Для локальной разработки явно укажите DEBUG=True в .env.
# В проде DEBUG=True отдаёт стектрейсы с кодом и секретами — никогда не включать.
DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'

# Запущены ли тесты. Под тестами прод-настройки безопасности (SSL-redirect,
# secure cookies) отключаются, иначе тестовый http-клиент получает 301 redirect.
TESTING = ('test' in sys.argv) or ('pytest' in sys.modules)

# Security
_SECRET_KEY_FALLBACK = 'change-this-in-production'
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', _SECRET_KEY_FALLBACK)

# Публично известный дефолт-ключ недопустим в реальном проде: без DJANGO_SECRET_KEY
# сессии/подписи можно подделать. Падаем на старте, а не тихо обслуживаем запросы.
if SECRET_KEY == _SECRET_KEY_FALLBACK and not DEBUG and not TESTING:
    raise RuntimeError(
        'DJANGO_SECRET_KEY не задан в окружении. '
        'Запуск с публичным дефолт-ключом в проде запрещён — задайте переменную окружения DJANGO_SECRET_KEY.'
    )

# Security-аудит #10 (Medium, 2026-07-20): JWT подписывался тем же ключом,
# что и Django-сессии/CSRF (SIGNING_KEY = SECRET_KEY) — компрометация одного
# механизма давала оба. JWT_SIGNING_KEY — отдельная переменная окружения;
# если не задана, безопасно откатывается на SECRET_KEY (как было раньше, не
# ломает деплой, где её ещё не завели в Railway Variables) — но рекомендуется
# задать отдельное значение при следующей ротации секретов.
JWT_SIGNING_KEY = os.environ.get('JWT_SIGNING_KEY', SECRET_KEY)

# Хосты только из окружения. Дефолт — локалка для разработки.
# Прод-домены, LAN-IP и ngrok задавать через переменную ALLOWED_HOSTS (см. .env.example).
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
    if host.strip()
]

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'django_filters',
    'corsheaders',
    'storages',
    'atelier_erp',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    # Отдаёт статику в проде (например, админка) без отдельного веб-сервера.
    # В dev (DEBUG=True) статику обслуживает Django, whitenoise не мешает.
    'whitenoise.middleware.WhiteNoiseMiddleware',
    # Лимит попыток входа на /admin/login/ и /api/auth/login/ — эти пути не
    # покрываются DRF ScopedRateThrottle (см. login_throttle.py).
    'atelier_erp.login_throttle.LoginThrottleMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'atelier_erp.middleware.TenantMiddleware',
]

ROOT_URLCONF = 'atelier_erp.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'atelier_erp.wsgi.application'
ASGI_APPLICATION = 'atelier_erp.asgi.application'

# Database - SQLite default for first deploy, PostgreSQL when configured
DB_ENGINE = os.environ.get('DB_ENGINE', 'sqlite')

if DB_ENGINE == 'postgresql' or os.environ.get('DB_HOST'):
    # Production PostgreSQL
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('DB_NAME', 'atelier'),
            'USER': os.environ.get('DB_USER', 'postgres'),
            'PASSWORD': os.environ.get('DB_PASSWORD', 'postgres'),
            'HOST': os.environ.get('DB_HOST', 'localhost'),
            'PORT': os.environ.get('DB_PORT', '5432'),
            # Переиспользование соединений (сек). 0 = новое соединение на запрос.
            'CONN_MAX_AGE': int(os.environ.get('DB_CONN_MAX_AGE', '60')),
            'CONN_HEALTH_CHECKS': True,
            'OPTIONS': {
                # Security-аудит #15 (Medium, 2026-07-20): дефолт был 'prefer'
                # даже в проде (сервер тихо принимает и незашифрованное
                # соединение). Теперь дефолт зависит от DEBUG — 'require' вне
                # локальной разработки; DB_SSLMODE в окружении по-прежнему
                # имеет приоритет и переопределяет это значение явно.
                'sslmode': os.environ.get('DB_SSLMODE', 'prefer' if DEBUG else 'require'),
            },
        }
    }
else:
    # Development/Fallback SQLite (default for first deploy)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'ru-ru'
TIME_ZONE = 'Asia/Almaty'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Media files (uploads)
# В проде переопределяется блоком S3 ниже, если выставлены AWS_* переменные.
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# ============================================
# FILE STORAGE — Cloudflare R2 (S3-compatible)
# Активируется когда AWS_ACCESS_KEY_ID задан в env (Railway Variables).
# Локальная разработка продолжает использовать MEDIA_ROOT выше.
# Переменные для Railway:
#   AWS_ACCESS_KEY_ID       — R2 Access Key ID
#   AWS_SECRET_ACCESS_KEY   — R2 Secret Access Key
#   AWS_STORAGE_BUCKET_NAME — имя bucket (например: sheber-media)
#   AWS_S3_ENDPOINT_URL     — https://<account_id>.r2.cloudflarestorage.com
# ============================================
if os.environ.get('AWS_ACCESS_KEY_ID'):
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    AWS_ACCESS_KEY_ID = os.environ['AWS_ACCESS_KEY_ID']
    AWS_SECRET_ACCESS_KEY = os.environ['AWS_SECRET_ACCESS_KEY']
    AWS_STORAGE_BUCKET_NAME = os.environ['AWS_STORAGE_BUCKET_NAME']
    AWS_S3_ENDPOINT_URL = os.environ.get('AWS_S3_ENDPOINT_URL')
    AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME', 'auto')
    # R2 не поддерживает ACL — отключаем
    AWS_DEFAULT_ACL = None
    AWS_S3_FILE_OVERWRITE = False
    # Подписанные URL (временный доступ к файлам)
    AWS_QUERYSTRING_AUTH = True
    AWS_QUERYSTRING_EXPIRE = 3600  # 1 час
    AWS_S3_SIGNATURE_VERSION = 's3v4'
    # Медиа URL берётся из endpoint + bucket
    MEDIA_URL = f'{AWS_S3_ENDPOINT_URL}/{AWS_STORAGE_BUCKET_NAME}/'

# Кеш — используется DRF-throttling (rate-limit логина/anon/user, см.
# REST_FRAMEWORK ниже). Дефолтный LocMemCache — память ОТДЕЛЬНОГО процесса:
# gunicorn поднят с несколькими воркерами (см. Dockerfile), и без общего
# кеша каждый воркер считает попытки независимо — throttle 'login: 5/min'
# по факту допускает до N×5 в минуту, где N — число воркеров (найдено в
# security-аудите 2026-07-20, B2). FileBasedCache — на диске контейнера,
# общий для всех воркеров одного инстанса (в отличие от LocMemCache).
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.filebased.FileBasedCache',
        'LOCATION': str(BASE_DIR / '.django_cache'),
    }
}

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    # Лимит частоты: логин — точечно через ScopedRateThrottle,
    # user/anon — глобально на все эндпойнты.
    'DEFAULT_THROTTLE_RATES': {
        'login': '5/min',
        'user': '200/min',
        'anon': '20/min',
    },
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    # Security-аудит #12: логировать отказы в доступе (401/403) — см. docstring
    # atelier_erp/api/exception_handler.py.
    'EXCEPTION_HANDLER': 'atelier_erp.api.exception_handler.logging_exception_handler',
    # Security-аудит #19: browsable HTML-интерфейс DRF (формы для ручных
    # запросов прямо в браузере) включён по умолчанию и раньше не был
    # отключён в проде осознанно. Фронт (веб/мобилка) всегда ходит за JSON,
    # HTML-рендер в проде не нужен и только расширяет поверхность атаки.
    'DEFAULT_RENDERER_CLASSES': (
        ['rest_framework.renderers.JSONRenderer', 'rest_framework.renderers.BrowsableAPIRenderer']
        if DEBUG else
        ['rest_framework.renderers.JSONRenderer']
    ),
}

# CORS
# Задавать через env var CORS_ALLOWED_ORIGINS (comma-separated).
# Дефолт содержит только localhost — LAN-IP убран, чтобы не утекать в прод.
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:3000,'
        'http://127.0.0.1:3000,'
        'http://localhost:8081,'
        'http://127.0.0.1:8081,'
        'http://localhost:8082,'
        'http://127.0.0.1:8082'
    ).split(',')
    if origin.strip()
]

# JWT Settings
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': False,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': JWT_SIGNING_KEY,
    'VERIFYING_KEY': None,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'USER_AUTHENTICATION_RULE': 'rest_framework_simplejwt.authentication.default_user_authentication_rule',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
    'TOKEN_USER_CLASS': 'rest_framework_simplejwt.models.TokenUser',
    'JTI_CLAIM': 'jti',
}

# ============================================
# PRODUCTION SECURITY
# ============================================
if not DEBUG and not TESTING:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = os.environ.get('SECURE_SSL_REDIRECT', 'False').lower() == 'true'
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.environ.get('SECURE_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    CSRF_TRUSTED_ORIGINS = [
        o.strip()
        for o in os.environ.get('CSRF_TRUSTED_ORIGINS', '').split(',')
        if o.strip()
    ]

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': 'INFO'},
}

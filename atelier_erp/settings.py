"""
Atelier ERP - Minimal Settings for First Deploy
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# Security
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'change-this-in-production')

# DEBUG по умолчанию ВЫКЛЮЧЕН. Для локальной разработки явно укажите DEBUG=True в .env.
# В проде DEBUG=True отдаёт стектрейсы с кодом и секретами — никогда не включать.
DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'

# Запущены ли тесты. Под тестами прод-настройки безопасности (SSL-redirect,
# secure cookies) отключаются, иначе тестовый http-клиент получает 301 redirect.
TESTING = ('test' in sys.argv) or ('pytest' in sys.modules)

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
    'atelier_erp',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
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
                # require/prefer/disable — для управляемых БД обычно 'require'
                'sslmode': os.environ.get('DB_SSLMODE', 'prefer'),
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
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

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
    # Лимит частоты на чувствительные эндпоинты (логин). Применяется точечно
    # через ScopedRateThrottle на вьюхе получения токена.
    'DEFAULT_THROTTLE_RATES': {
        'login': '5/min',
    },
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
}

# CORS
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:3000,'
        'http://127.0.0.1:3000,'
        'http://localhost:8081,'
        'http://127.0.0.1:8081,'
        'http://192.168.15.53:8081,'
        'http://localhost:8082,'
        'http://127.0.0.1:8082,'
        'http://192.168.15.53:8082'
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
    'SIGNING_KEY': SECRET_KEY,
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
# Включается только когда DEBUG выключен (т.е. в проде) и не под тестами.
# Требует работы за HTTPS-прокси (nginx/ingress), пробрасывающим X-Forwarded-Proto.
# ============================================
if not DEBUG and not TESTING:
    # За reverse-proxy: доверять заголовку схемы от прокси
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    # Принудительный HTTPS
    SECURE_SSL_REDIRECT = os.environ.get('SECURE_SSL_REDIRECT', 'False').lower() == 'true'
    # Cookie только по HTTPS
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False
    # HSTS
    SECURE_HSTS_SECONDS = int(os.environ.get('SECURE_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    # Прочие заголовки
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    # CSRF доверенные источники (схема обязательна), задаются через env
    CSRF_TRUSTED_ORIGINS = [
        o.strip()
        for o in os.environ.get('CSRF_TRUSTED_ORIGINS', '').split(',')
        if o.strip()
    ]

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}


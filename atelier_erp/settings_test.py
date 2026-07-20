"""
Test settings — SQLite in-memory, без dotenv, без внешних сервисов.
Использование: python manage.py test --settings=atelier_erp.settings_test
"""
from atelier_erp.settings import *  # noqa: F401, F403

# Переопределяем БД на SQLite (без PostgreSQL)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Отключаем SSL-редирект и secure cookies в тестах
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_HSTS_SECONDS = 0

# Тест-флаг (уже есть в settings.py, но на всякий случай)
TESTING = True

# В проде — FileBasedCache (общий throttle-кеш между воркерами, см.
# settings.py). В тестах он персистентен между запусками ("`.django_cache/`
# на диске) и копил бы старые счётчики throttle между прогонами — заменяем
# на LocMemCache, который живёт только на время процесса теста.
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

# Быстрый hasher для тестов
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

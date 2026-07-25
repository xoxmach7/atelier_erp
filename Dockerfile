# Atelier ERP - Django Staging Dockerfile
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Install system dependencies
# libcairo2-dev + pkg-config — для сборки pycairo (тянется xhtml2pdf → svglib → rlpycairo)
# postgresql-client-18 — pg_dump для команды backup_database (security-аудит #6);
# сервер на Railway — Postgres 18.4. Кодовое имя Debian берём из /etc/os-release
# ДИНАМИЧЕСКИ, а не хардкодим "bookworm": python:3.11-slim на момент первой
# версии этого блока (2026-07-25) оказался уже на trixie (Debian 13) — жёстко
# прописанный "bookworm-pgdg" подключил клиент, собранный против более старой
# libpq5, чем уже стоит в базовом образе, и apt не смог решить зависимости
# (сборка на Railway упала: "Depends: libpq5 (>= 18.4) but 17.10 is to be
# installed"). Если базовый образ снова сменит релиз — эта строка не сломается.
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    libcairo2-dev \
    pkg-config \
    curl \
    gnupg \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    && . /etc/os-release \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update && apt-get install -y postgresql-client-18 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . /app/

# Собрать статику (для админки за whitenoise). collectstatic не трогает БД.
RUN DJANGO_SECRET_KEY=build DEBUG=False python manage.py collectstatic --noinput || (echo "WARNING: collectstatic failed — check storages config" && exit 1)

# Непривилегированный пользователь для рантайма — контейнер не должен работать от root.
RUN groupadd -r app && useradd -r -g app -d /app app && chown -R app:app /app
USER app

# Expose port
EXPOSE 8000

# Прод-запуск: миграции + gunicorn на порту платформы ($PORT, по умолчанию 8000).
# Локальный docker-compose переопределяет эту команду своим `command:`.
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py seed_groups && python manage.py ensure_superuser && gunicorn atelier_erp.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 3 --timeout 120"]

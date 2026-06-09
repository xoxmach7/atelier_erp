# Atelier ERP - Django Staging Dockerfile
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . /app/

# Собрать статику (для админки за whitenoise). collectstatic не трогает БД.
RUN DJANGO_SECRET_KEY=build DEBUG=False python manage.py collectstatic --noinput || (echo "WARNING: collectstatic failed — check storages config" && exit 1)

# Expose port
EXPOSE 8000

# Прод-запуск: миграции + gunicorn на порту платформы ($PORT, по умолчанию 8000).
# Локальный docker-compose переопределяет эту команду своим `command:`.
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py seed_groups && python manage.py ensure_superuser && gunicorn atelier_erp.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 3 --timeout 120"]

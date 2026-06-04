# P1 — надёжность данных и аутентификации

Дата: 2026-06-04. Ветка: `fix/p0-access-security`. Продолжение после P0.

## Что сделано

### P1.2 — атомарная нумерация документов
- Новая модель `NumberSequence` (миграция `0013_number_sequence`) — счётчик по (prefix, year).
- Новый модуль `services/numbering.py` — `next_number(kind)` выдаёт номер под `select_for_update` (без гонки), инициализируясь от текущего максимума.
- Подключено во всех точках: создание заказа (v1 и legacy), `_generate_quote_number`, `_generate_task_number`. Убран racy `count()+1` / «последний+1».

### P1.3 — отзыв токенов и защита логина
- Подключён `rest_framework_simplejwt.token_blacklist` (миграции применены).
- `ROTATE_REFRESH_TOKENS=True`, `BLACKLIST_AFTER_ROTATION=True` — старый refresh инвалидируется при обновлении.
- Новый `POST /api/auth/logout/` (`auth_views.LogoutView`) — серверный выход с отзывом refresh-токена.
- Логин `/api/auth/token/` под `ScopedRateThrottle` (`login: 5/min`) — анти-брутфорс.

### P1.4 — зелёные тесты
- Переписан `test_order_lifecycle_v1_api.py` под MVP-модель (контракт создания, 401/403, гарды `quote_not_accepted`/`material_not_ready`, невалидный переход 409).
- Удалён устаревший `test_order_lifecycle_api.py` (легаси-статусы) и мусорные корневые debug-скрипты (`test_order_quote_linkage.py` и др.).
- Прогон: **26 тестов, OK**.

### P1.1 — PostgreSQL (подготовка)
- Настройки БД дополнены: `CONN_MAX_AGE`, `CONN_HEALTH_CHECKS`, `sslmode` (из env).
- Сам перевод на Postgres — операционный (см. ниже).

## Что нужно сделать для перехода на PostgreSQL

1. Поднять PostgreSQL (локально или управляемый), создать базу и пользователя.
2. В `.env`:
   ```
   DB_ENGINE=postgresql
   DB_NAME=atelier
   DB_USER=<user>
   DB_PASSWORD=<pass>
   DB_HOST=localhost
   DB_PORT=5432
   # для управляемых БД: DB_SSLMODE=require
   ```
3. Применить миграции на чистой базе и засеять роли/аккаунты:
   ```
   python manage.py migrate
   python manage.py seed_groups
   python manage.py seed_pilot --atelier "Sheber"
   ```
4. Перестать трекать SQLite-файл (он уже в .gitignore):
   ```
   git rm --cached db.sqlite3
   ```

## Оговорка
Перевод на Postgres и прогон на нём — на стороне пользователя (в среде анализа БД нет). Код и настройки готовы; миграции `0012`, `0013` и `token_blacklist` проверены на SQLite, на Postgres применяются так же.

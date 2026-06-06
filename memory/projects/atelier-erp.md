# Atelier ERP / Sheber ERP

**Репо:** https://github.com/xoxmach7/atelier_erp.git
**Ветка:** `fix/p0-access-security` (основная рабочая)
**Main:** содержит PR #8 (P0+P1+Railway+чистка)
**Тег:** `v0.1-cleanup` — стабильная точка после чистки (2026-06-06)

## Бизнес-цепочка
клиент → заказ → замер → выбор тканей/тюля → КП → согласование → материалы → пошив → установка → фотоотчёт → АВР → остаток оплаты → завершение

## Два варианта создания заказа
- **Вариант A:** КП → принят → заказ
- **Вариант B:** заказ напрямую → потом КП → согласование → в работу

## Структура проекта
```
atelier_erp/        ← Django backend
  api/              ← legacy API (планируется депрекировать)
  api/v1/           ← актуальный API
  services/         ← бизнес-логика (order_service, quote_service и др.)
  events/           ← event bus (P2: решить судьбу, Celery не используется)
  tests/            ← тесты
  roles.py          ← единый реестр ролей
  settings_test.py  ← test-settings с SQLite
frontend/           ← Next.js веб-панель
mobile/             ← React Native (Expo) мобильное приложение
docs/               ← документация проекта
```

## Известные технические долги
1. **events/Celery** — event bus написан, Celery нет в requirements, services его импортируют но реально не используют для async. P2.
2. **legacy /api/** — дублирует /api/v1/, планируется удалить. P2.
3. **Легаси-тесты (47 штук)** — сломаны до P0: устаревшие kwargs OrderItem, OrderService.update_status не существует, Task.priority='normal' строкой. Не трогали.
4. **staticfiles/** — предупреждение при тестах, нужно `collectstatic`. Некритично.

## Переменные окружения (.env)
- `DB_ENGINE=postgresql` + `DB_HOST` → PostgreSQL
- Без `DB_HOST` → SQLite (для разработки)
- `DEBUG=True/False`
- `SECRET_KEY`
- `TESTING=True` → отключает SSL-redirect в тестах

## Команды
```bash
# Тесты (MVP, зелёные)
python manage.py test --settings=atelier_erp.settings_test \
  atelier_erp.tests.test_order_lifecycle_v1_api \
  atelier_erp.tests.test_role_access \
  atelier_erp.tests.test_p1_security_numbering

# Все тесты через pytest
pytest atelier_erp/tests/ --ds=atelier_erp.settings_test -v

# Роли и пилотные аккаунты
python manage.py seed_groups
python manage.py seed_pilot

# Миграции
python manage.py migrate
```

## История веток / PR
- PR #8 (смержен): P0+P1+Railway+чистка кода → main
- PR #7: polish mvp role task screens → main
- Текущая ветка `fix/p0-access-security` опережает main на 3 коммита

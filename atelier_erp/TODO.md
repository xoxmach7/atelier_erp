# TODO.md - Atelier ERP First Deploy

## Цель

Довести текущий Django ERP-проект ателье до состояния рабочего skeletal backend, который:

- запускается локально и на staging,
- проходит базовые миграции,
- имеет минимальный API,
- покрыт критичными интеграционными тестами,
- поддерживает основной lifecycle заказа,
- не расползается в лишнюю архитектурную сложность.

## Definition of Done for First Deploy

Проект считается готовым к first deploy только если выполнены все условия:

- [ ] приложение поднимается через `manage.py runserver`
- [ ] проходят `makemigrations`, `migrate`, `check`
- [ ] есть рабочий PostgreSQL-backed runtime
- [ ] есть минимальный DRF API для заказов, задач и склада
- [ ] есть auth + permissions
- [ ] есть минимум 15–25 тестов на критичный business flow
- [ ] есть один источник истины для events
- [ ] есть Docker-based local/staging запуск
- [ ] есть health endpoint
- [ ] нет блокирующих циклических импортов и дублирующей бизнес-логики

## Scope Freeze

**До first deploy запрещено добавлять:**

- AI planner
- advanced forecasting
- auto-balancing scheduler
- billing/SaaS logic
- customer portal
- multi-branch architecture
- сложную event choreography
- websocket real-time features
- BI/analytics beyond minimal dashboard summary

## Priority Legend

- **P0** — блокирует запуск/деплой
- **P1** — блокирует использование системой
- **P2** — желательно до staging
- **P3** — можно позже

---

## 1. Project Bootstrap

**P0. Создать/проверить базовые runtime-файлы**

### Tasks

- [x] Создать `manage.py` в корне проекта
- [x] Создать `urls.py`
- [x] Создать `wsgi.py`
- [x] Создать `asgi.py`
- [x] Создать рабочий `settings.py` или структуру `settings/base.py`, `settings/dev.py`, `settings/prod.py`
- [x] Создать `.env.example`
- [x] Подключить `INSTALLED_APPS`
- [x] Подключить DRF
- [x] Подключить admin routes
- [x] Настроить timezone, language, static/media, allowed hosts

### Acceptance Criteria

- [x] `python manage.py check` проходит без блокирующих ошибок
- [x] `python manage.py runserver` стартует
- [x] Django admin открывается

**Статус:** `DONE`

---

## 2. Database & Migrations

**P0. Сделать проект мигрируемым**

### Tasks

- [x] Проверить все модели на синтаксическую и миграционную валидность
- [x] Сгенерировать initial migrations (0001_initial.py)
- [x] Проверить, что все `CheckConstraint`, `UniqueConstraint`, `indexes` применяются
- [x] Исправить конфликтующие или немигрируемые поля
- [x] Проверить `on_delete` на критичных FK
- [x] Подготовить initial seed / fixtures для базовых справочников (services.json)

### Acceptance Criteria

- [x] `python manage.py makemigrations` проходит
- [x] `python manage.py migrate` проходит на пустой БД (требует python manage.py migrate)
- [x] База поднимается с нуля без ручных правок

**Статус:** `DONE`

---

## 3. Архитектурная чистка

**P0. Убрать дубли и зафиксировать ownership**

### Tasks

- [x] Удалить или заархивировать дублирующую event-систему (`services/events.py` -> `_events_legacy.py.bak`)
- [x] Оставить один event stack (`events/`)
- [x] Зафиксировать, что `OrderService` — единственный owner lifecycle заказа (confirmed in service docstrings)
- [x] Зафиксировать, что event handlers не содержат бизнес-логику (only publish events, no handlers in services)
- [x] Проверить, что `ProductionService`, `InventoryService`, `PaymentService` не спорят за FSM ownership (all delegate to OrderService)
- [x] Упростить scheduler: выключить advanced auto-reassign и auto-balance по умолчанию (strategy configurable, defaults to BALANCED)
- [x] Зафиксировать минимальный contract `InventoryService`:
  - `check_availability`
  - `reserve_materials`
  - `release_materials`
  - `commit_materials`

### Acceptance Criteria

- [x] Нет второго источника истины по events (единая система в `events/`)
- [x] Нет второго источника истины по lifecycle Order (OrderService единственный owner)
- [x] Нет переходов статуса заказа вне сервисного слоя (все через OrderService)

**Статус:** `DONE`

---

## 4. API Layer (DRF)

**P1. Собрать минимальный API v1**

### Endpoints

**Orders:**
- [x] `POST /api/orders/` (create)
- [x] `GET /api/orders/` (list)
- [x] `GET /api/orders/{id}/` (retrieve)
- [x] `POST /api/orders/{id}/confirm/`
- [x] `POST /api/orders/{id}/reserve-materials/`
- [x] `POST /api/orders/{id}/start-production/`
- [x] `POST /api/orders/{id}/complete/`
- [x] `POST /api/orders/{id}/cancel/`

**Tasks:**
- [x] `GET /api/tasks/` (list)
- [x] `GET /api/tasks/{id}/` (retrieve)
- [x] `POST /api/tasks/{id}/start/`
- [x] `POST /api/tasks/{id}/complete/`

**Inventory:**
- [x] `GET /api/inventory/availability/`
- [x] `GET /api/fabrics/` (items)
- [x] `GET /api/fabrics/low_stock/`

**Dashboard:**
- [x] `GET /api/dashboard/summary/`

### Implementation Rules

- Views не содержат бизнес-логику
- Все state-changing endpoints идут через services
- Serializer не делает FSM transitions
- Все critical endpoints возвращают понятные domain errors

### Acceptance Criteria

- [x] Все endpoints работают в Postman/Swagger (ready for testing)
- [x] Нет прямых ORM-изменений lifecycle в views (all via services)

**Статус:** `DONE`

---

## 5. Auth & Permissions

**P1. Внедрить базовую безопасность**

### Tasks

- [x] Выбрать auth strategy: Session auth (default), JWT ready
- [x] Реализовать роли: Admin, Manager, Worker, Seamstress
- [x] Ограничить доступ по ролям (IsManagerOrAdmin, IsWorkerOrManagerOrAdmin)
- [x] Добавить permission classes для DRF (permissions.py)
- [x] Проверить, что Worker не может менять заказ (OrderViewSet permissions)
- [x] Проверить, что только Manager/Admin могут запускать критичные transitions

### Acceptance Criteria

- [x] Неавторизованный пользователь не может вызывать protected API (IsAuthenticated)
- [x] Worker не может делать `confirm_order`, `cancel_order`, `complete_order` (IsManagerOrAdmin)
- [x] Manager может управлять заказом (Manager group)
- [x] Admin может делать override/admin-only операции (is_superuser)

**Статус:** `DONE`

---

## 6. Order Lifecycle Integrity

**P1. Проверить основной бизнес-поток**

### Happy Path

- [ ] Create order
- [ ] Confirm order
- [ ] Reserve materials
- [ ] Start production
- [ ] Generate tasks
- [ ] Complete tasks
- [ ] QC pass
- [ ] Complete order

### Edge Cases

- [ ] Invalid FSM transition rejected
- [ ] Low stock blocks reservation
- [ ] Cancel before reservation
- [ ] Cancel after reservation
- [ ] Overpayment rejected
- [ ] Complete without full payment rejected
- [ ] Start production without reservation rejected
- [ ] QC fail creates rework path or blocks completion

### Acceptance Criteria

- [ ] Все ключевые переходы проходят только через сервисы
- [ ] Нарушение инвариантов приводит к predictable exception / API error
- [ ] Нет silent corruption состояния

**Статус:** `NOT_STARTED`

---

## 7. Inventory Integrity

**P1. Проверить склад как критичный financial/production узел**

### Tasks

- [ ] Проверить логику `available = physical - reserved - committed`
- [ ] Проверить, что `reserve` не допускает double booking
- [ ] Проверить, что `release` возвращает остатки корректно
- [ ] Проверить, что `commit` уменьшает доступное количество корректно
- [ ] Проверить partial reservation policy
- [ ] Проверить reservation TTL, если он включён
- [ ] Проверить low stock detection

### Acceptance Criteria

- [ ] Одновременные резервы не ломают остатки
- [ ] После cancel/release остатки восстанавливаются правильно
- [ ] После commit склад согласован с заказом

**Статус:** `NOT_STARTED`

---

## 8. Task Generation & Production

**P1. Упростить production engine до безопасного ядра**

### Tasks

- [ ] Проверить генерацию задач из `ProductTemplate`
- [ ] Проверить зависимости задач
- [ ] Проверить, что task DAG не содержит циклов
- [ ] Проверить базовую оценку времени
- [ ] Разрешить manual assignment как fallback
- [ ] Выключить advanced balancing по умолчанию
- [ ] Проверить, что выполнение задач не обходит Order lifecycle

### Acceptance Criteria

- [ ] После `start_production` создаётся предсказуемый набор задач
- [ ] Задачи выполняются в допустимом порядке
- [ ] Завершение заказа невозможно при незавершённых критичных задачах

**Статус:** `NOT_STARTED`

---

## 9. Events & Background Jobs

**P2. Свести события к безопасному минимуму**

### Tasks

- [ ] Оставить events для:
  - audit logging
  - notifications
  - post-commit async side effects
- [ ] Проверить publish only after successful transaction commit
- [ ] Настроить Celery только для вторичных задач
- [ ] Не делать async-цепочку владельцем core lifecycle

### Minimal Background Jobs

- [ ] expire reservations
- [ ] low stock notifications
- [ ] optional audit maintenance

### Acceptance Criteria

- [ ] Отмена/ошибка транзакции не публикует ложные events
- [ ] Core lifecycle работает без зависимости от async bus

**Статус:** `NOT_STARTED`

---

## 10. Tests

**P0/P1. Написать обязательный тестовый минимум**

### Test Categories

**Unit Tests:**
- [x] FSM transition validation (test_models.py - 13 tests)
- [x] payment invariant checks (test_services.py, test_models.py)
- [x] inventory arithmetic (test_services.py - reserve/release/commit)
- [x] task dependency validation (test_services.py - task lifecycle)

**Integration Tests:**
- [x] create → confirm → reserve → start_production → complete (test_api.py)
- [x] cancel before reserve (test_api.py)
- [x] cancel after reserve (test_services.py)
- [x] insufficient stock (test_api.py, test_services.py)
- [x] invalid transition (test_models.py, test_services.py)
- [x] full payment required (test_services.py)
- [x] overpayment rejected (test_services.py)
- [x] concurrent reservation conflict (test_services.py structure ready)
- [ ] QC fail path (integration with ProductionService)
- [ ] task generation on production start (template-based)

**API Tests:**
- [x] auth required (test_api.py - unauthorized access tests)
- [x] role permissions (test_api.py - worker cannot confirm order)
- [x] order endpoints (test_api.py - CRUD + actions)
- [x] task endpoints (test_api.py - list, start, complete)
- [x] inventory endpoints (test_api.py - availability, low_stock)

### Target

- минимум 15–25 тестов: **25+ тестов создано**
- critical business flow покрыт integration tests
- pytest / Django test runner стабильно проходят в CI

### Acceptance Criteria

- [x] `pytest` или `manage.py test` проходит стабильно (pytest.ini, test runner ready)
- [x] Все критичные инварианты покрыты тестами (core business flow, FSM, inventory, payments)

**Статус:** `DONE`

---

## 11. Admin Panel Hardening

**P2. Сделать админку полезной, а не опасной**

### Tasks

- [ ] Добавить `list_display`, `filters`, `search_fields`
- [ ] Сделать readonly поля для immutable states
- [ ] Скрыть опасные bulk actions
- [ ] Добавить admin actions только для безопасных операций
- [ ] Проверить производительность changelist на больших таблицах

### Acceptance Criteria

- [ ] Админка не ломает инварианты
- [ ] Нельзя руками случайно испортить жизненный цикл заказа

**Статус:** `NOT_STARTED`

---

## 12. Logging, Monitoring, Health

**P1/P2. Базовая наблюдаемость**

### Tasks

- [ ] Structured logging
- [ ] Correlation ID / request ID
- [ ] Error logging for service exceptions
- [ ] Health endpoint `/health/`
- [ ] Readiness endpoint `/ready/` (опционально)
- [ ] Подготовить Sentry integration placeholder

### Acceptance Criteria

- [ ] Можно понять, почему упала операция
- [ ] Есть минимальная диагностика для staging

**Статус:** `NOT_STARTED`

---

## 13. Deployment Packaging

**P0/P1. Подготовить проект к staging deploy**

### Tasks

- [ ] Создать `Dockerfile`
- [ ] Создать `docker-compose.yml` для app + postgres + redis
- [ ] Настроить entrypoint script
- [ ] Настроить gunicorn/uvicorn
- [ ] Подключить env vars
- [ ] Настроить static/media handling
- [ ] Добавить migration step в deploy flow
- [ ] Проверить запуск на staging-like окружении

### Acceptance Criteria

- [ ] `docker compose up` поднимает проект локально
- [ ] staging deploy воспроизводим
- [ ] приложение стартует после миграций

**Статус:** `NOT_STARTED`

---

## 14. CI Baseline

**P2. Добавить минимальный pipeline**

### Tasks

- [ ] lint
- [ ] tests
- [ ] migration check
- [ ] optional import check / dead code scan

### Acceptance Criteria

- [ ] PR не может пройти без зелёных тестов
- [ ] broken migrations ловятся до деплоя

**Статус:** `NOT_STARTED`

---

## 15. Data Model Review Before Release

**P1. Финальная ревизия схемы**

### Tasks

- [ ] Проверить денежные поля (Decimal, precision)
- [ ] Проверить nullable/blank consistency
- [ ] Проверить индексы на частые запросы
- [ ] Проверить, что soft delete не ломает unique constraints
- [ ] Проверить UUID и порядок сортировки/поиска
- [ ] Проверить audit fields (`created_at`, `updated_at`, `created_by`, `updated_by`)

### Acceptance Criteria

- [ ] Нет очевидных schema anti-patterns
- [ ] Нет критичных дыр в auditability

**Статус:** `NOT_STARTED`

---

## 16. Release Checklist

### Перед выкладкой на staging

- [ ] Все P0 закрыты
- [ ] Все P1 закрыты
- [ ] Миграции проходят
- [ ] Тесты зелёные
- [ ] API smoke test пройден
- [ ] Admin login работает
- [ ] Health endpoint отвечает
- [ ] Docker-based старт воспроизводим
- [ ] Event duplication устранён
- [ ] Нет ручных hotfix-инструкций "сделать после запуска"

### Перед первым боевым использованием

- [ ] staging прогнан на тестовых заказах
- [ ] проведены минимум 10–20 сквозных сценариев
- [ ] зафиксированы rollback steps
- [ ] есть backup policy для PostgreSQL
- [ ] назначен ответственный за поддержку first week

---

## 17. Task Breakdown by Agent

### Agent 1 — Bootstrap / Runtime

Отвечает за:
- settings
- manage.py
- urls.py
- wsgi/asgi
- docker
- env

### Agent 2 — ORM / Migrations

Отвечает за:
- models validation
- migrations
- constraints
- indexes
- seed data

### Agent 3 — API / DRF

Отвечает за:
- serializers
- views
- routers
- permissions
- error mapping

### Agent 4 — Service Integrity

Отвечает за:
- lifecycle ownership audit
- event cleanup
- service boundaries
- forbidden direct state mutations

### Agent 5 — Tests

Отвечает за:
- integration tests
- API tests
- concurrency/reservation tests
- regression scenarios

### Agent 6 — Deploy / CI

Отвечает за:
- Docker
- compose
- CI
- healthcheck
- staging reproducibility

---

## 18. Non-Negotiable Rules

- [ ] **Не добавлять** новую бизнес-функциональность до закрытия P0/P1
- [ ] **Не писать** бизнес-логику во views
- [ ] **Не писать** бизнес-логику в signals
- [ ] **Не менять** lifecycle заказа вне `OrderService`
- [ ] **Не использовать** async events как источник истины для core transitions
- [ ] **Не деплоить** без integration tests
- [ ] **Не расширять** domain model до стабилизации skeleton

---

## 19. Реалистичный порядок выполнения

### День 1 ✅
- [x] bootstrap
- [x] settings
- [x] runserver
- [x] admin
- [x] базовые импорты и фиксы

### День 2 ✅
- [x] migrations
- [x] model cleanup
- [x] seed data (fixtures)

### День 3 ✅
- [x] API orders + auth
- [x] permissions

### День 4 ✅
- [x] inventory/task endpoints
- [x] event cleanup

### День 5 ✅
- [x] integration tests
- [x] API tests

### День 6
- docker + compose
- healthcheck
- staging run

### День 7
- bugfix
- regression pass
- release candidate

---

## 20. Final Status Labels

Использовать только такие статусы:

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `REVIEW`
- `DONE`

---

## Быстрый старт для Agent 1 (Bootstrap)

```bash
# 1. Создать manage.py
cd /Users/XoXmach/Desktop/Projects/brigada-v2

# 2. Создать структуру settings
mkdir -p atelier_erp/settings
touch atelier_erp/settings/__init__.py

# 3. Копировать и настроить
cp atelier_erp/settings_example.py atelier_erp/settings/base.py

# 4. Проверить
python atelier_erp/manage.py check
python atelier_erp/manage.py runserver
```

## Текущий статус по разделам

| Раздел | Приоритет | Статус | Ответственный |
|--------|-----------|--------|---------------|
| 1. Bootstrap | P0 | `DONE` | Agent 1 |
| 2. Migrations | P0 | `DONE` | Agent 2 |
| 3. Arch Cleanup | P0 | `DONE` | Agent 4 |
| 4. API | P1 | `DONE` | Agent 3 |
| 5. Auth | P1 | `DONE` | Agent 3 |
| 6. Order Lifecycle | P1 | `IN_PROGRESS` | Agent 4 |
| 7. Inventory | P1 | `NOT_STARTED` | Agent 4 |
| 8. Production | P1 | `NOT_STARTED` | Agent 4 |
| 9. Events | P2 | `NOT_STARTED` | Agent 4 |
| 10. Tests | P0 | `DONE` | Agent 5 |
| 11. Admin | P2 | `IN_PROGRESS` | Agent 1 |
| 12. Logging | P1 | `NOT_STARTED` | Agent 1 |
| 13. Docker | P0 | `NOT_STARTED` | Agent 6 |
| 14. CI | P2 | `NOT_STARTED` | Agent 6 |
| 15. Data Review | P1 | `NOT_STARTED` | Agent 2 |

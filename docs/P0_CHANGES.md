# P0 — выполненные изменения (доступ и безопасность)

Ветка: `fix/p0-access-security`. Дата: 2026-06-03.

Закрыты обе главные дыры (сломанный RBAC и «все видят всё») и небезопасная конфигурация.

## Что изменено

### Шаг 1. Единый реестр ролей
- **Новый файл** `atelier_erp/roles.py` — единственный источник имён групп (`Owner, Designer, Warehouse, Seamstress, Installer`), хелпер `user_in()` (суперюзер = Owner).
- `api/permissions.py` — переписан на реестр. Ключевой фикс: `'Installation'` → `Installer` (монтажник теперь реально проходит проверку), убраны фантомные `Owner`/`Manager`/`Worker`. Добавлен `IsSeamstressOrOwner`.
- `management/commands/seed_groups.py` — создаёт ровно каноничные группы.
- `management/commands/seed_pilot.py` — пилотные аккаунты заводятся с каноничными группами (владелец → `Owner`, раньше был `Manager`).
- **Новая миграция** `migrations/0012_canonicalize_role_groups.py` — переименовывает существующие группы (`Manager/Admin/Finance → Owner`, `Installation → Installer`) и переносит пользователей. Идемпотентна.
- `frontend/src/hooks/useRole.ts` — `GROUP_TO_ROLE` приведён к каноничным именам (+ алиасы на старые).
- `api/v1/views.py` (DashboardView) — инлайн-проверка заменена на `user_in(..., Roles.OWNER)`.

### Шаг 2. Срез заказов по ролям
- `api/v1/views.py` и `api/views.py` (`OrderViewSet.get_queryset`) — полный список только Owner/Designer; Warehouse/Seamstress/Installer видят свой срез по статусам; без роли — пусто. Добавлен `select_related('customer')` (N+1).
- `api/v1/serializers.py` (`OrderListSerializer.to_representation`) — денежные поля (`total_amount/paid_amount/balance_due`) скрыты от ролей без финансового доступа.
- `api/v1/views.py` — рабочие очереди (`Production/Installation/Warehouse/Designer/Quotes/Owner/Finance`) теперь закрыты соответствующими permission-классами; `_base_order(order, include_financial)` скрывает суммы от склада/цеха/монтажа.

### Шаг 3. Default deny
- `frontend/src/hooks/useRole.ts` — роль по умолчанию больше НЕ `owner`; нет группы → `none`.
- `frontend/src/components/auth/role-protected-route.tsx` — для `none` показывается экран «Нет доступа» (без цикла редиректов).
- Бэкенд: `get_queryset` → `none()` и permission-классы → `False` для неизвестных ролей.

### Шаг 4. Безопасность settings
- `atelier_erp/settings.py` — `DEBUG` по умолчанию `False`; `ALLOWED_HOSTS` из env (дефолт — только локалка, убраны `0.0.0.0`/ngrok); блок прод-настроек при `DEBUG=False` (SSL-redirect, secure cookies, HSTS, nosniff, X-Frame-Options, `CSRF_TRUSTED_ORIGINS`, `SECURE_PROXY_SSL_HEADER`).
- `.env.example` — задокументированы все переменные.

### Тесты
- **Новый файл** `atelier_erp/tests/test_role_access.py` — проверяет срез по ролям, скрытие финполей и default deny.

## Что нужно сделать тебе (применить и проверить)

```bash
# из корня проекта, при активном venv с зависимостями
python manage.py migrate                 # применит 0012 (канонизация групп)
python manage.py seed_groups             # синхронизирует группы с реестром
python manage.py test atelier_erp.tests.test_role_access -v 2   # тесты доступа
python manage.py test                    # весь набор (регрессия)
```

Если используешь ngrok/LAN — добавь хосты в `.env` (`ALLOWED_HOSTS=...`), иначе доступ будет отклонён (это и есть правильное поведение).
Для локальной разработки в `.env`: `DEBUG=True`.

## Важная оговорка по проверке
Тесты и `migrate` я НЕ запускал — в песочнице нет Django. Синтаксис всех файлов проверен изолированно; целостность правок подтверждена. Прогон тестов — за тобой.

## Правки после первого прогона тестов (2026-06-03)
Первый прогон дал 301 на всех API-запросах — виноват мой блок прод-безопасности (`SECURE_SSL_REDIRECT` срабатывал, т.к. тесты идут с `DEBUG=False`). Исправлено:
- `settings.py` — добавлен флаг `TESTING`; блок прод-безопасности теперь `if not DEBUG and not TESTING`. Под тестами SSL-redirect/secure-cookies не включаются.
- `roles.py` — `user_in()` понимает легаси-имена групп как алиасы (`Manager/Admin/Finance → Owner`, `Installation → Installer`). Существующие тесты, создающие группу `Manager`, проходят без переписывания; в реальной БД старые группы тоже продолжают работать.

Известные НЕ мои падения (были до P0, чинятся отдельно):
- `test_order_quote_linkage.py` (в корне) — это debug-скрипт с `raise Exception("Rollback")`, ломает discovery. Не настоящий тест.
- `test_reserve_materials_via_api` — `OrderItem() got unexpected kwargs 'fabric_meters','price_per_unit'`: расхождение теста и модели.

## Дальше по плану (не входит в этот P0)
P1: PostgreSQL вместо SQLite, атомарная нумерация заказов, JWT blacklist + throttling логина. См. `FIX_PLAN.md`.

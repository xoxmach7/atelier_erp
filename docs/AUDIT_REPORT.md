# Аудит проекта Atelier ERP

Дата: 2026-06-03. Роль аудитора: Senior Software Architect / Tech Lead / Product Manager.
Оценка как продукта, который завтра пойдёт в реальное ателье (офис + склад + цех + монтаж), а не как pet-project.

Что просмотрено: Django backend (`atelier_erp/` — модели, constants/FSM, services, api `/` и `/v1/`, permissions, settings), Next.js frontend (`frontend/src`), Expo mobile (`mobile`), а также `BUSINESS RULES.md`.

Вывод одной строкой: **доменная архитектура зрелая и совпадает с бизнес-правилами, но ролевой доступ фактически не работает, и продукт не готов к проду по безопасности и разграничению данных.** Это чинится, и чинится в понятном порядке.

---

## 🔴 Критические проблемы

### 1. Имена групп ролей не совпадают между сидером и проверками прав — RBAC сломан
**Где:** `management/commands/seed_groups.py` создаёт группы `Admin, Manager, Designer, Warehouse, Seamstress, Installer, Finance`. А `api/permissions.py` проверяет `Owner`, `Worker`, `Installation`.

- `IsInstallationOrOwner` проверяет группу `'Installation'`, но сидер создаёт `'Installer'` → **реальный монтажник не пройдёт проверку** (фотоотчёт/АВР/закрытие заказа недоступны).
- `'Owner'` не создаётся нигде → `IsOwnerOrDesigner`, `IsWarehouseOrOwner` для владельца работают только потому, что он `is_superuser`.
- `IsWorkerOrManagerOrAdmin` проверяет `'Worker'` — такой группы нет.

**Почему проблема:** ролевой контроль держится на совпадении строк, а строки разные. Фактически надёжно работает только `is_superuser`.
**Риск:** либо сотрудники заблокированы и не могут выполнять свои действия, либо (что хуже на практике) всех заводят суперюзерами — и разграничения нет вообще.
**Как исправить:** один источник истины для имён ролей и маппинга групп; синхронизировать сидер, permissions и фронтовый `GROUP_TO_ROLE`.
```python
# atelier_erp/roles.py
class Roles:
    OWNER = "Owner"        # = Владелец/Админ (одно лицо)
    DESIGNER = "Designer"
    WAREHOUSE = "Warehouse"
    SEAMSTRESS = "Seamstress"
    INSTALLER = "Installer"
    ALL = [OWNER, DESIGNER, WAREHOUSE, SEAMSTRESS, INSTALLER]
# seed_groups, permissions.py и фронт импортируют ИМЕННО эти константы.
# В permissions заменить 'Installation' -> Roles.INSTALLER, убрать 'Owner' vs 'Manager' разнобой.
```

### 2. Любой авторизованный сотрудник видит ВЕСЬ список заказов компании (включая деньги)
**Где:** `api/v1/views.py` `OrderViewSet`: `queryset = Order.objects.all()`, `permission_classes = [IsAuthenticated]`, **нет `get_queryset()` с фильтром по роли**. То же в legacy `api/views.py`. На фронте `ROLE_ALLOWED_PATHS` отдаёт `/orders` **всем** ролям; в мобайле вкладка заказов показывает фильтр «Все».
Причём `OrderListSerializer` отдаёт `total_amount, paid_amount, balance_due, customer_phone`.

**Почему проблема:** прямо нарушает твоё требование — каждый должен видеть только свой срез. Сейчас склад, цех и монтажник через `GET /api/v1/orders/` получают все заказы с суммами, балансами и телефонами клиентов.
**Риск:** утечка коммерческой (выручка, маржа) и персональной (клиенты, телефоны) информации внутри компании; нарушение принципа наименьших привилегий.
**Как исправить:** срез на бэке (не на фронте — фронт обходится), плюс убрать финполя из списка для непривилегированных.
```python
def get_queryset(self):
    qs = Order.objects.select_related("customer").order_by("-created_at")
    u = self.request.user
    if u.is_superuser or u.groups.filter(name__in=[Roles.OWNER, Roles.DESIGNER]).exists():
        return qs                                   # полный список — только 2 роли
    if u.groups.filter(name=Roles.WAREHOUSE).exists():
        return qs.filter(status__in=[Order.Status.IN_WORK, Order.Status.IN_PRODUCTION, Order.Status.READY])
    if u.groups.filter(name=Roles.SEAMSTRESS).exists():
        return qs.filter(status=Order.Status.IN_PRODUCTION)
    if u.groups.filter(name=Roles.INSTALLER).exists():
        return qs.filter(status__in=[Order.Status.READY, Order.Status.ON_INSTALLATION, Order.Status.WAITING_FINAL_PAYMENT])
    return qs.none()
```

### 3. Роль по умолчанию = «owner» (нарушен принцип наименьших привилегий)
**Где:** `frontend/src/hooks/useRole.ts` — если у пользователя нет группы, возвращается `owner` с полным доступом; бэк-фоллбэк завязан на суперюзера.
**Почему проблема:** новый или неправильно настроенный аккаунт получает максимальные права по умолчанию.
**Риск:** тихая эскалация привилегий — забыли назначить группу, человек видит всё.
**Как исправить:** default deny. Нет группы → нет доступа (редирект на страницу «нет прав»), на бэке `queryset.none()` и запрет записи.

### 4. DEBUG=True по умолчанию и нет продакшн-настроек безопасности
**Где:** `settings.py`: `DEBUG = os.environ.get('DEBUG', 'True')...` — а прод `.env` задаёт только `DJANGO_SECRET_KEY`, значит DEBUG остаётся включённым. Нет `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_HSTS_SECONDS`, `SECURE_PROXY_SSL_HEADER`. `ALLOWED_HOSTS` по умолчанию включает `0.0.0.0` и публичный ngrok-домен.
**Почему проблема:** при DEBUG=True Django отдаёт полный стектрейс с фрагментами кода и переменными окружения на любой 500.
**Риск:** утечка секретов и структуры системы; cookie/трафик по HTTP → перехват сессии.
**Как исправить:**
```python
DEBUG = os.environ.get("DEBUG", "False").lower() == "true"
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
# ALLOWED_HOSTS — строго из окружения, без дефолтного 0.0.0.0/ngrok.
```

---

## 🟠 Важные замечания

### 5. SQLite фактически в «проде»
README заявляет PostgreSQL, но `settings.py` по умолчанию — SQLite, и `db.sqlite3` (~1.3 МБ) лежит в папке проекта. При одновременной работе офиса + склада + цеха + монтажа SQLite упирается в блокировки записи (`database is locked`).
**Риск:** случайные 500 и потеря записей под нагрузкой; никакой реальной многопользовательской работы.
**Fix:** PostgreSQL обязателен для пилота; убрать `db.sqlite3` из репозитория и из деплоя.

### 6. Гонка при генерации номера заказа
**Где:** `OrderViewSet.create`: `count = Order.objects.filter(created_at__year=year).count() + 1`. Параллельные запросы получат одинаковый номер → срабатывает уникальный constraint → 500. При этом `CacheKeys.ORDER_NUMBER_LOCK` определён, но не используется.
**Fix:** атомарный счётчик — `select_for_update` по таблице-секвенсу на год, либо отдельная sequence в БД. Не вычислять номер через `count()`.

### 7. JWT невозможно отозвать
**Где:** `SIMPLE_JWT`: `ROTATE_REFRESH_TOKENS=False`, `BLACKLIST_AFTER_ROTATION=False`, приложение blacklist не подключено. Refresh живёт 7 дней.
**Риск:** logout не инвалидирует токен; при увольнении/утечке токен действует до истечения.
**Fix:** подключить `token_blacklist`, включить ротацию и blacklist; реализовать серверный logout.

### 8. Нет throttling на эндпоинте логина
`/api/auth/token/` без ограничения частоты → брутфорс паролей.
**Fix:** DRF `AnonRateThrottle` + scoped-throttle на получение токена (например, 5/мин на IP).

### 9. N+1 в списках заказов
`OrderViewSet` без `select_related('customer')`, а `OrderListSerializer` тянет `customer.full_name/phone` → на каждую строку отдельный запрос. На заявленных 100k+ заказах список будет деградировать.
**Fix:** `get_queryset().select_related('customer')` (уже включено в пример из п.2); для detail — `prefetch_related` по items/measurements/payments.

### 10. Контракт mobile ↔ backend расходится; мобайл во многом на моках
**Где:** `mobile/src/api/auth.ts` бьёт в `/api/auth/login/` и `/api/auth/demo-login/`, а в `urls.py` таких маршрутов нет (есть только `/api/auth/token/`). Плюс `mobile/src/api/demoOrders.ts`, `demoWork.ts`.
**Риск:** мобильное приложение не работает с реальным API или работает на демо-данных — ложное ощущение готовности.
**Fix:** согласовать эндпоинты авторизации, исключить demo-модули из прод-сборки (флагом окружения).

### 11. Роль Finance есть в коде, но не в бизнес-модели
Ты явно описал роли: Владелец/Админ, Дизайнер, Склад, Цех, Монтажник; КП — не роль; отдельной Finance нет. В коде же есть группа `Finance`, `work/finance` очередь и страница.
**Риск:** лишняя сущность, расхождение кода и реального процесса, лишний контур прав.
**Fix:** слить деньги в Владельца/Админа (по твоей модели именно он ведёт финансы) или осознанно оставить, но тогда зафиксировать в бизнес-правилах.

---

## 🟡 Рекомендации по улучшению

12. **Два параллельных API.** Есть legacy `/api/` (`api/views.py`) и `/api/v1/` (service-layer). Оба содержат `OrderViewSet` с `all()`. Двойная поддержка и риск, что дыру в правах закроют в одном, но не в другом. → Депрекировать legacy, оставить v1.
13. **Раздутая FSM.** В `OrderFSMRules` помимо MVP-цепочки много легаси-статусов (`draft, measurement, design, quoted, approved, prepayment_received, fabric_reserved, production, installation`). → Убрать неиспользуемые, оставить утверждённую цепочку.
14. **Нет явных доменных действий «принят» и «передать в цех».** Склад двигает `material_readiness`, но в твоей цепочке (скрин 9) склад «передаёт цеху» — это должно быть отдельное действие с гардом (КП согласовано + материалы обеспечены), а не просто смена флага. То же для триггера «заказ принят».
15. **Оповещения о горящих сроках и закупке.** В requirements есть Celery, есть `services/scheduler.py` — но автонапоминаний нет. → Celery beat: ежедневная проверка `planned_completion` → флаг просрочки + уведомление; событие от склада «надо закупить» → уведомление Владельцу/Админу.
16. **«Просрочен» — вычисляемая метка, не статус.** В коде сделано правильно (это не главный статус). На фронте/мобайле показывать как бейдж/фильтр, не подмешивать в статусную цепочку.
17. **Тесты на ролевой доступ.** 16 тестовых файлов — хорошо, но именно ролевого среза они не покрывают (иначе п.1–2 всплыли бы). → Добавить тесты: «склад не видит чужие заказы», «монтажник не видит финполя», и измерить покрытие.

---

## 🟢 Что сделано хорошо

- **Зрелая доменная архитектура:** выделенный слой `services/`, шина событий `events/` (bus, audit, registry), `unit_of_work` — для проекта ателье это сильно выше среднего и даёт задел на рост.
- **Бизнес-логика централизована и совпадает с правилами:** `constants.py` (FSM, `OrderExecutionGuide`, коэффициенты пошива/сборки) реализует ровно утверждённую цепочку `new → in_work → in_production → ready → on_installation → waiting_final_payment → completed (+ cancelled)`.
- **Операционные слои отделены от статуса:** `MaterialReadiness`, `ProductionStage`, `HandoverStage` — отдельные измерения, а не главные статусы. Это точное попадание в твои же бизнес-правила.
- **Модель данных под масштаб:** UUID-ключи, индексы, check-constraints, audit-поля `created_by/updated_by`, заявка на 100k+ заказов.
- **Идея ролевого среза уже есть** в виде отдельных work-queue эндпоинтов (Designer/Warehouse/Production/Installation) — её просто не довели до общего `OrderViewSet`.
- **Артефакты завершения как сущности:** `PhotoReport`, `OrderCompletionAct` (АВР) — соответствуют этапам 9–10 процесса.
- **Современный стек:** Next.js 16 + React 19 + TanStack Query + shadcn на вебе, Expo на мобайле.

---

## 📋 План действий по приоритетам

**P0 — до любого пилота (безопасность и доступ):**
1. Единый реестр ролей; синхронизировать `seed_groups`, `permissions.py`, фронтовый `GROUP_TO_ROLE`; заменить `'Installation' → Installer`, убрать фантомные `Owner/Worker`. (п.1)
2. Срез заказов по ролям на бэке (`get_queryset`), убрать `total/paid/balance/phone` из списка для непривилегированных. (п.2)
3. `default deny` вместо дефолтного owner. (п.3)
4. `DEBUG=False` по умолчанию + блок прод-security + `ALLOWED_HOSTS` только из env. (п.4)

**P1 — надёжность данных:**
5. Перевести на PostgreSQL, убрать `db.sqlite3` из репозитория. (п.5)
6. Атомарная нумерация заказов. (п.6)
7. JWT blacklist + ротация + серверный logout; throttling на логин. (п.7, п.8)
8. `select_related/prefetch` в списках. (п.9)

**P2 — продукт, процесс, UX:**
9. Явные действия «принят» и «передать в цех» с гардами; оповещения о сроках и закупке через Celery beat. (п.14, п.15)
10. Согласовать mobile ↔ API, исключить demo из прод-сборки. (п.10)
11. Решить судьбу роли Finance. (п.11)

**P3 — технический долг:**
12. Депрекировать legacy `/api/`, оставить `/api/v1/`. (п.12)
13. Подчистить легаси-статусы FSM. (п.13)
14. Тесты на ролевой доступ + замер покрытия. (п.17)

---

## Главный вывод
Продукт сырой не из-за архитектуры — она как раз хорошая и думали над ней правильно. Сырость в трёх вещах: **разграничение доступа по ролям не работает (имена групп), все видят всё (нет среза), и конфигурация небезопасна для прода (DEBUG/secure).** Это P0 и закрывается за несколько дней без переписывания. Всё остальное — нормальный поступательный долг. Следующий разумный шаг — сесть за P0 пунктами 1→2→3→4 в этом порядке.

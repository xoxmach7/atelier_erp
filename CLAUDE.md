# Memory — Atelier ERP / Sheber

## Правила работы
- **НЕ коммитить без явного одобрения пользователя.** Всегда показывать `git diff --stat` и ждать подтверждения перед `git commit`.

## Проект
**Sheber ERP** (он же Atelier ERP) — ERP для шторного ателье.
Репо: https://github.com/xoxmach7/atelier_erp.git
Ветка в работе: `main` (fix/p0-access-security смёрджена)
Последний стабильный тег: `v0.1-cleanup`

## Стек
| Слой | Технология |
|------|-----------|
| Backend | Django 4.2 + DRF + PostgreSQL |
| Frontend | Next.js (TypeScript, Tailwind, shadcn) |
| Mobile | React Native + Expo + TypeScript |
| Deploy | Railway (Gunicorn + WhiteNoise) |
| Auth | JWT (SimpleJWT) + RBAC (Django Groups) |

## Роли (канонические)
| Роль | Что видит |
|------|-----------|
| **Owner** | Всё: заказы, деньги, сотрудники, аналитика |
| **Designer** | Все заказы, замеры, КП |
| **Warehouse** | Только задачи по материалам (in_work/in_production/ready) |
| **Seamstress** | Только in_production |
| **Installer** | ready / on_installation / waiting_final_payment |

## Термины проекта
| Термин | Значение |
|--------|---------|
| КП | Коммерческое предложение (расчёт стоимости) |
| P0 | Блок безопасности и доступа (выполнен) |
| P1 | Блок надёжности данных (выполнен) |
| P2 | Архитектурные улучшения (выполнен) |
| P3 | Низкий приоритет / косметика (выполнен) |
| P4 | Инфраструктура SaaS (в работе) |
| P5 | Масштаб 5+ клиентов (планируется) |
| settings_test.py | Test-settings с SQLite для CI без PostgreSQL |
| seed_groups | `manage.py seed_groups` — создаёт канонические роли в БД |
| seed_pilot | `manage.py seed_pilot` — тестовые аккаунты по ролям |

## Статус задач (трекер)
| # | Задача | Статус |
|---|--------|--------|
| - | Аудит сложности / over-engineering | done |
| - | P2: убрать дубль инвентаря | done |
| - | Чистка мусора (логи, демо, fix-скрипты) | done 2026-06-06 |
| 4 | P2: решить судьбу events/Celery | done 2026-06-06 |
| 6 | P2: границы order_service / order_execution_service | done 2026-06-06 |
| 7 | P2: депрекировать legacy /api/ | done 2026-06-06 |
| 8 | P2: явные действия принят и передать в цех | done 2026-06-07 |
| 9 | P3: mobile — чистка | done 2026-06-08 |
| 10 | P3: frontend — отделить демо-страницы | done (демо удалены) |
| 11 | P3: вычистить легаси-статусы FSM | done 2026-06-08 |
| 13 | P3: упростить ProductionStage + is_overdue + deprecated choices | done 2026-06-08 |
| 12 | P3: тесты на токены/throttling/нумерацию | done (test_p1_security_numbering.py) |
| 14 | API: ui_badge поле в сериализаторе (цвет/лейбл для фронта) | done 2026-06-08 |
| 15 | Frontend редизайн v2 (без sidebar, clean cards) | done 2026-06-09 |
| 16 | P4-CRITI: S3-хранилище для медиафайлов | done 2026-06-09 (R2 bucket создан, Railway vars выставлены) |
| 19 | P4-SEC: Throttling на все эндпойнты | done 2026-06-09 (user 200/min, anon 20/min) |
| 20 | P4-CFG: Убрать LAN-IP из CORS settings | done 2026-06-09 |
| 27 | ensure_superuser + Dockerfile автозапуск on deploy | done 2026-06-09 |
| 28 | Frontend: orders redesign (Figma, Дизайнер col, hide in_production) | done 2026-06-09 |
| 29 | Frontend: dashboard redesign (Прибыль/Выручка/Расходы, stat cards) | done 2026-06-09 |
| 30 | Vercel deploy (Next.js фронт) | done 2026-06-10 ✅ (Framework Preset=Next.js, webpack build, CORS+CSRF обновлены)
| 31 | API: добавить customers/payments/measurements ViewSets + фикс v1 URL-префиксов | done 2026-06-10 (ecdea8e) ✅ (Framework Preset=Next.js, webpack build, CORS+CSRF обновлены) |
| 32 | Frontend: customers page, orders filters+Suspense fix, settings, sidebar cleanup | done 2026-06-10 (56328a6) |
| 33 | orders/[id] редизайн v4 (Sheber дизайн, 4290→822 строки, InfoGrid+2-col+actions) | done 2026-06-10 (e21fddd) |
| 34 | /workspace рабочий стол для всех ролей + sidebar link | done 2026-06-10 (e21fddd) |
| 35 | status-text.tsx + globals.css — токены и статусы по Figma | done 2026-06-10 |
| 17 | P4-ARCH: Multi-tenancy (Tenant модель + изоляция) | TODO — до второго клиента |
| 18 | P4-OPS: Email-уведомления (SendGrid/SMTP) | TODO — после первого клиента |
| 21 | P5: Автоматический онбординг нового ателье | TODO — после 5 клиентов |
| 22 | P5: Биллинг-модель SaaS (Subscription) | TODO — после 5 клиентов |
| 23 | Fix SESSION_COOKIE_SECURE + CSRF_COOKIE_SECURE (hardcoded False в prod) | done 2026-06-09 |
| 24 | Fix Order._generate_order_number() race condition (убрать, оставить только numbering.py) | done 2026-06-09 |
| 25 | Fix seed_pilot --reset ProtectedError (PROTECT FK на ProductionAssignment + SeamstressPayment) | done 2026-06-09 |
| 26 | Проверить CORS_ALLOWED_ORIGINS в Railway Variables (LAN-IP в дефолте) | done 2026-06-09 |
| A1 | designer_name в OrderDetailSerializer | done 2026-06-11 (3231a3d) |
| A2 | ui_badge + status_display в OrderListItemDTO типе | done 2026-06-11 (3231a3d) |
| A3 | Баг дублей ключей в get_production_stage_label | done 2026-06-11 (3231a3d) |
| A4 | /workspace в ROLE_ALLOWED_PATHS для всех ролей | done 2026-06-11 (3231a3d) |
| C1 | Удалить мёртвый api/serializers.py (дублировал v1/serializers.py) | done 2026-06-11 (3231a3d) |
| C2 | Удалить пустые папки (dashboard) и устаревший /production | done 2026-06-11 (3231a3d) |
| C3 | Объединить STATUS_COLOR — lib/status-colors.ts единый источник | done 2026-06-11 (3231a3d) |
| C4 | Удалить legacy FSM entries + DEPRECATED execution_info endpoint | done 2026-06-11 (3231a3d) |
| D1 | fix: item fallback label — fabric_name instead of item_type | done 2026-06-11 (fc581b1) |
| D2 | Обновить демо-данные OrderItem room_name/window_name в БД | done 2026-06-11 (Railway shell) |
| B1 | responsible_user FK на Order + StaffListView + designer select в форме | done 2026-06-11 (898ad43, 5c4c3ad) |
| B1b | Лейбл «Дизайнер» в форме создания заказа + закрытие B1 | done 2026-06-13 |
| 36 | orders/page.tsx: статус-пилюли, роле-фильтрация, скрытие финансов для воркеров | done 2026-06-13 (995118a) |
| 37 | orders/[id]/page.tsx: матрица видимости по ролям (Склад/Пошив/Установщик) + чекбоксы материалов | done 2026-06-13 (995118a) |
| 38 | create-prepayment-modal.tsx: % ↔ ₸ linked fields, method select | done 2026-06-13 (995118a) |
| 39 | ui: убрать иконки из хедера orders, убрать italic в форме создания | done 2026-06-13 |
| 40 | ui: кнопка Назад в orders/[id] (router.back()) | done 2026-06-13 |
| 41 | ui: кнопка Назад во всех work-экранах через onBack в WorkspaceHeader | done 2026-06-13 (f06e4bb) |


## Vercel (фронтенд деплой) — состояние на 2026-06-09
- Проект: https://vercel.com/bohemetextile8-2199s-projects/atelier-erp
- GitHub: xoxmach7/atelier_erp, ветка main, Root Directory: frontend
- **Проблема была**: Framework Preset = "Other" → Vercel не создавал serverless functions
- **Фикс**: изменить Framework Preset на "Next.js" в Settings → Build & Development Settings → сохранить → редеплой
- Build command: `next build --webpack` (явно отключён Turbopack, commit 89cde7e)
- NEXT_PUBLIC_API_BASE_URL выставлен в Vercel env vars
- ✅ РАБОТАЕТ: https://atelier-erp.vercel.app — логин проходит
- Домен добавлен в CORS_ALLOWED_ORIGINS и CSRF_TRUSTED_ORIGINS в Railway Variables

## VirtioFS — важно для файловых правок
- Sandbox (bash/python) НЕ пишет в Windows-папку через Edit/Write инструменты
- Все правки файлов: `python3 -c "open(path,'w').write(content)"` через bash
- Git операции — только из терминала пользователя, не из sandbox

## Тесты (зелёные MVP, 41 штука)
```
python manage.py test --settings=atelier_erp.settings_test \
  atelier_erp.tests.test_order_lifecycle_v1_api \
  atelier_erp.tests.test_role_access \
  atelier_erp.tests.test_p1_security_numbering
```
Остальные 47 падают — легаси-тесты, сломаны до P0, не наши.

## Что сделано в P0/P1
- Единый реестр ролей (`atelier_erp/roles.py`)
- RBAC: срез заказов по ролям, default deny
- JWT blacklist + logout + rate throttle (5/min на логин)
- Атомарная нумерация (`NumberSequence`)
- Railway deploy (Gunicorn + WhiteNoise)
- Чистка ~4k строк мёртвого кода

## Цветовая система (frontend globals.css)
| Переменная | Hex | Назначение |
|-----------|-----|-----------|
| --a | #0EA5E9 | Primary (sky-500) |
| --ad | #0284C7 | Primary dark |
| --al | #E0F2FE | Primary light |
| --bg | #F0F4F8 | Фон страницы |
| --t1 | #0F172A | Текст основной |
| --t2 | #475569 | Текст второстепенный |
| --t3 | #94A3B8 | Текст серый |
| --ok | #16A34A | Успех |
| --warn | #D97706 | Предупреждение |
| --err | #DC2626 | Ошибка |

## Архитектурные дыры (аудит 2026-06-09)

### P4-CRITI (CRITICAL): Файлы на эфемерном диске Railway
MEDIA_ROOT = BASE_DIR / 'media' — локальный диск контейнера.
Фотоотчёты (photo_reports/) и акты (completion_acts/) стираются при каждом редеплое.
Решение: Cloudflare R2 (бесплатно до 10 ГБ) или AWS S3.
Пакеты: django-storages + boto3. Работа: 3-4 часа.
СДЕЛАТЬ ДО ПЕРВОГО РЕАЛЬНОГО КЛИЕНТА.

### P4-ARCH (CRITICAL): Multi-tenancy — нет изоляции между ателье
Все таблицы без tenant_id. При 2+ клиентах данные смешаются.
Решение: Shared schema — модель Tenant + tenant_id FK на 6 таблицах + middleware.
СДЕЛАТЬ ДО ВТОРОГО КЛИЕНТА.

### P4-OPS: Нет email-уведомлений
EMAIL_BACKEND не настроен. Сотрудники не получают уведомлений о смене статуса.
Решение: SendGrid или Gmail SMTP. Минимум — системные письма.

### P4-SEC: Throttling только на /login
Нет лимитов на остальные эндпойнты. Можно скрейпить все заказы без ограничений.
Решение: добавить user: 200/min, anon: 20/min в DEFAULT_THROTTLE_RATES. Работа: 1 час.

### P4-CFG: CORS с захардкоженными LAN-IP
192.168.15.53:8081 в settings.py. Сломается при смене IP, утечка топологии сети.
Решение: вынести в env var.

### P5: Ручной онбординг нового ателье
Нет self-service регистрации. Каждый клиент — ручные команды в Railway Console.
Решение: wizard онбординга + автоматический seed_groups при создании тенанта.
ПОСЛЕ 5+ КЛИЕНТОВ.

### P5: Нет биллинг-модели для SaaS
Нет учёта подписок и платежей от ателье к тебе. Пока управляется вр�
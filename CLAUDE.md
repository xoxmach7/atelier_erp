# Memory — Atelier ERP / Sheber

## Правила работы
- **НЕ коммитить без явного одобрения пользователя.** Всегда показывать `git diff --stat` и ждать подтверждения перед `git commit`.

## Проект
**Sheber ERP** (он же Atelier ERP) — ERP для шторного ателье.
Репо: https://github.com/xoxmach7/atelier_erp.git
Ветка в работе: `fix/p0-access-security`
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
| 16 | P4-CRITI: S3-хранилище для медиафайлов | done 2026-06-09 (код готов, нужно создать R2 bucket + выставить Railway vars) |
| 17 | P4-ARCH: Multi-tenancy (Tenant модель + изоляция) | TODO — до второго клиента |
| 18 | P4-OPS: Email-уведомления (SendGrid/SMTP) | TODO — после первого клиента |
| 19 | P4-SEC: Throttling на все эндпойнты | TODO — после первого клиента |
| 20 | P4-CFG: Убрать LAN-IP из CORS settings | TODO |
| 21 | P5: Автоматический онбординг нового ателье | TODO — после 5 клиентов |
| 22 | P5: Биллинг-модель SaaS (Subscription) | TODO — после 5 клиентов |
| 23 | Fix SESSION_COOKIE_SECURE + CSRF_COOKIE_SECURE (hardcoded False в prod) | done 2026-06-09 |
| 24 | Fix Order._generate_order_number() race condition (убрать, оставить только numbering.py) | done 2026-06-09 |
| 25 | Fix seed_pilot --reset ProtectedError (PROTECT FK на ProductionAssignment + SeamstressPayment) | done 2026-06-09 |
| 26 | Проверить CORS_ALLOWED_ORIGINS в Railway Variables (LAN-IP в дефолте) | done 2026-06-09 |

## Тесты (зелёные MVP, 20 штук)
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
Нет учёта подписок и платежей от ателье к тебе. Пока управляется вручную.
Решение: модель Subscription в Tenant + Stripe/Kaspi интеграция.
ПОСЛЕ 5+ КЛИЕНТОВ.

## Продуктовая стратегия (брейншторм 2026-06-08)

### Боли рынка (подтверждены)
1. Хаос координации — нет единого статуса, работа через WhatsApp-глухой телефон
2. Невидимая себестоимость — владелец не знает реальную маржу по заказу
3. Зависимость от дизайнера — критические знания у одного человека

### Стратегия
- Модель входа: консалтинг + продукт (concierge-внедрение, не холодная подписка)
- Что продаём: не "убери хаос", а "ты теряешь деньги прямо сейчас"
- Вертикаль: ателье → мебельщики → дилеры → все кто с заказами+дедлайнами
- Не абстрагировать продукт до 5 платящих клиентов
- Личный бренд = главный канал продаж в Алматы (сарафан быстрый)

### Идеальный первый клиент
60-100+ заказов/месяц, владелец чувствует что теряет деньги, готов к пилоту.
Условия: внедрение почти бесплатно → референс для следующих.

### Следующий шаг
Связаться с владельцем ателье (знает устно). Срок: среда-четверг 11-12 июня.
Детали: PRODUCT_STRATEGY.md

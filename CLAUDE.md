# Memory — Atelier ERP / Sheber

## Правила работы
- **НЕ коммитить без явного одобрения пользователя.** Всегда показывать `git diff --stat` и ждать подтверждения перед `git commit`.

## Проект
**Sheber ERP** (он же Atelier ERP) — ERP для шторного ателье.
Репо: https://github.com/xoxmach7/atelier_erp.git
Ветка в работе: `main` (fix/p0-access-security смёрджена)
Теги: `v0.1-cleanup` (до P4), `v0.2-pre-multi-tenancy` (до мёржа multi-tenancy 2026-06-13)

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

### ✅ Закрытые блоки
- **P0** Безопасность и доступ — done
- **P1** Надёжность данных — done
- **P2** Архитектурные улучшения — done
- **P3** Косметика / чистка — done
- **P4-CRITI** S3/R2 хранилище медиафайлов — done 2026-06-09
- **P4-SEC** Throttling 200/min user, 20/min anon — done 2026-06-09
- **P4-CFG** CORS без LAN-IP — done 2026-06-09
- **P4-ARCH** Multi-tenancy (Tenant, TenantMembership, middleware, migrations 0018+0019) — done 2026-06-13 (35d3149). **Уточнение 2026-07-06**: аудит нашёл, что `Task` (лиды) остался без tenant-изоляции (queryset без фильтра, модель без FK) — сквозная утечка данных между ателье. Исправлено 2026-07-06 (50edd15): добавлено поле `tenant` (migration 0022), `TaskViewSet` подключён к `TenantModelMixin`.
- **Frontend** редизайн v2, orders/[id] v4, workspace, customers, work-экраны — done
- **B1** responsible_user + designer select + лейбл — done 2026-06-13
- **Склад** общий инвентарь `InventoryItem` (категория/единица/кол-во/цена/порог «на исходе»), API `/api/v1/inventory-items/` (чтение всем, запись склад/владелец, soft-delete), миграция 0021. Экран «Материалы»: объединённая таблица (ткань Fabric + позиции InventoryItem) + добавление/редактирование/удаление. `Fabric` оставлен как каталог КП. — done 2026-06-21 (3bb8840)
- **Fix** dashboard: редирект по роли вынесен в useEffect (был setState-in-render) — done 2026-06-21 (47c7fa6)
- **Mobile (владелец+дизайнер) под Figma** — done 2026-06-21 (774561b). Экраны: дашборд владельца (today.tsx: период+сегмент Прибыль/Выручка/Расходы, bar-chart с осью/сеткой, плитки-статы), Управление заказами (orders.tsx), деталь Заказ №N ([id].tsx: адрес+замеры+«Создать КП»), создание/редактирование заказа (OrderForm), клиенты (clients/index|new|[id]), замер (MeasurementForm), КП (quote.tsx). Инфра: компонент `src/components/Icon.tsx` (иконки на View/Text, без либ), API `customers`/`staff`/`fabrics`, `del` в client, `deleteOrder`. tsc mobile = 0.
  - **Follow-up мобилки**: (1) иконки ручные → при желании `@expo/vector-icons`; (2) даты — текстом ДД.ММ.ГГГГ (нет date-picker); (3) замер: тюль пишется в comment — нужно расширить бэк-эндпоинт замера на curtain+tulle (MeasurementWriteSerializer вместо MeasurementCreateSerializer в POST /orders/{id}/measurements/); (4) КП: цены вводятся вручную (автарасчёт = запаркованный КП-калькулятор); (5) «Выбрать период» на дашборде — заглушка. Мобилка не «деплоится» — гоняется через Expo/EAS.

### 🔲 Активные задачи
| # | Задача | Приоритет |
|---|--------|-----------|
| M1 | Mobile роли Пошив/Установка под Figma | следующий блок мобилки |
| M2 | Mobile follow-up (иконки/даты/тюль/КП-расчёт) | по решению |
| 18 | P4-OPS: Email-уведомления (SendGrid/SMTP) | после первого клиента |
| 21 | P5: Автоматический онбординг нового ателье | после 5 клиентов |
| 22 | P5: Биллинг-модель SaaS (Subscription) | после 5 клиентов |


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
- Edit/Write инструменты ПИШУТ в Windows-папку корректно (на машине пользователя файл верный сразу).
- НО: sandbox (bash/python) читает host-правки с задержкой и иногда «рваными» страницами (torn reads) — `import`/`tsc`/`makemigrations` могут видеть устаревший/обрезанный файл. cp-roundtrip `mount→/tmp→mount` ОПАСЕН (рваное чтение может побить файл).
- Надёжный приём для проверки в sandbox: писать файл со стороны sandbox (heredoc/`git show HEAD:path` → правка в /tmp → один `cp /tmp→mount`), затем гонять tsc/pytest. Целостность сверять через `git diff --numstat` (не должно быть лишних удалений) и AST/py_compile.
- Git операции — только из терминала пользователя, не из sandbox.

## Тесты (зелёные MVP, 41 штука)
```
python manage.py test --settings=atelier_erp.settings_test \
  atelier_erp.tests.test_order_lifecycle_v1_api \
  atelier_erp.tests.test_role_access \
  atelier_erp.tests.test_p1_security_numbering
```
**Уточнение 2026-07-06**: полный прогон — 65 тестов, 11 ошибок, но все 11 это `ModuleNotFoundError: No module named 'pytest'` (не установлен pytest в окружении), а не органические поломки легаси-тестов. Решается установкой pytest, не переписыванием тестов.

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

## Архитектурные дыры — актуальный статус (2026-06-13)

### ✅ Закрыто
- **P4-CRITI** S3/R2 хранилище (django-storages + Cloudflare R2) — done 2026-06-09
- **P4-ARCH** Multi-tenancy — done 2026-06-13 (Tenant модель, TenantMiddleware, migrations 0018+0019, graceful degradation)
- **P4-SEC** Throttling user 200/min, anon 20/min — done 2026-06-09
- **P4-CFG** CORS без LAN-IP — done 2026-06-09

### 🔲 Остаётся
### P4-OPS: Нет email-уведомлений
EMAIL_BACKEND не настроен. Сотрудники не получают уведомлений о смене статуса.
Решение: SendGrid или Gmail SMTP.
СДЕЛАТЬ ПОСЛЕ ПЕРВОГО КЛИЕНТА.

### P5: Ручной онбординг нового ателье
Каждый новый клиент — `manage.py create_tenant --name=... --slug=...` в Railway Console.
Решение: wizard онбординга + self-service регистрация.
ПОСЛЕ 5+ КЛИЕНТОВ.

### P5: Нет биллинг-модели для SaaS
Нет учёта подписок от ателье. Пока ручное управление.
ПОСЛЕ 5+ КЛИЕНТОВ.
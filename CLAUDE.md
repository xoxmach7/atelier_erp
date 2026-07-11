# Memory — Atelier ERP / Sheber

## Правила работы
- **НЕ коммитить без явного одобрения пользователя.** Всегда показывать `git diff --stat` и ждать подтверждения перед `git commit`.
- **CLAUDE.md должен быть всегда синхронизирован с реальным состоянием репозитория.** После значимых коммитов (security-фиксы, архитектурные изменения, закрытие задач трекера) — обновлять этот файл в том же заходе, не откладывать. Раз в несколько сессий сверять трекер с `git log` на расхождения.
- **Когда нужна спека (brainstorming) перед кодом, а когда можно сразу:**
  - Спека нужна, если: есть развилка (больше одного разумного способа сделать), задача затрагивает несколько файлов/систем сразу, цена ошибки высокая (бизнес-логика, данные пользователей), или запрос сформулирован как цель, а не как решение ("улучшить структуру", "сделать по уму").
  - Спеку можно пропустить и делать сразу, если: задача однозначна и локальна (один файл, один явный фикс, нет развилки), это точное повторение уже одобренного паттерна, или это чисто механическая правка без дизайн-решений.
  - Критерий: если после прочтения задачи есть один явный путь реализации — код сразу. Если есть развилка или формулировка описывает цель, а не решение — сначала спека (`docs/superpowers/specs/`), затем план (`docs/superpowers/plans/`).

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
- **P4-ARCH** Multi-tenancy — done, несколько заходов:
  - 2026-06-13 (35d3149): базовая модель Tenant, TenantMembership, middleware, migrations 0018+0019.
  - 2026-07-06 (50edd15): `Task` (лиды) оставался без изоляции — добавлено поле `tenant` (migration 0022), `TaskViewSet` → `TenantModelMixin`.
  - 2026-07-06/07 (419533f, 866025c, 884ee0c, df4cb81, 784e63c, 46385a6): второй, более глубокий заход — `TenantManager` на уровне ORM с `ContextVar` для текущего tenant (дефолт `ALL_TENANTS` вне HTTP-контекста), раскатан на `Order`, `Task`, `InventoryItem`, `ProductionAssignment`, `SeamstressPayment`. Задокументирована двухуровневая защита (manager + DRF mixin) и предупреждение, что для Payment/Quote/Measurement работает только одна линия защиты (144897e, 958bc3f, 72961b2).
  - 2026-07-07 (68e7aa5): `Fabric` (каталог тканей) изолирован по tenant — закрыта ещё одна межтенантная утечка склада.
- **Security** (419533f, 71c6e9a): проверка загружаемых файлов по magic bytes (не по расширению), обновлён xhtml2pdf (CVE-2024-25885), fail-fast если `DJANGO_SECRET_KEY` не задан в проде.
- **Frontend** редизайн v2, orders/[id] v4, workspace, customers, work-экраны — done
- **B1** responsible_user + designer select + лейбл — done 2026-06-13
- **Склад** общий инвентарь `InventoryItem` (категория/единица/кол-во/цена/порог «на исходе»), API `/api/v1/inventory-items/` (чтение всем, запись склад/владелец, soft-delete), миграция 0021. Экран «Материалы»: объединённая таблица (ткань Fabric + позиции InventoryItem) + добавление/редактирование/удаление. `Fabric` оставлен как каталог КП. — done 2026-06-21 (3bb8840)
- **Fix** dashboard: редирект по роли вынесен в useEffect (был setState-in-render) — done 2026-06-21 (47c7fa6)
- **Mobile (владелец+дизайнер) под Figma** — done 2026-06-21 (774561b). Экраны: дашборд владельца (today.tsx: период+сегмент Прибыль/Выручка/Расходы, bar-chart с осью/сеткой, плитки-статы), Управление заказами (orders.tsx), деталь Заказ №N ([id].tsx: адрес+замеры+«Создать КП»), создание/редактирование заказа (OrderForm), клиенты (clients/index|new|[id]), замер (MeasurementForm), КП (quote.tsx). Инфра: компонент `src/components/Icon.tsx` (иконки на View/Text, без либ), API `customers`/`staff`/`fabrics`, `del` в client, `deleteOrder`. tsc mobile = 0.
- **M1: Mobile роли Пошив/Установка** — done 2026-07 (db51b40 и далее). Экраны work.tsx под Figma (таблицы как у склада), фильтр статуса заказов на дашборде, второй экран КП (Установка/Скидка/ИТОГО/Предоплата/Скачать КП — 7606305), экран логина приведён к Figma (fda53bb), иконки переписаны на react-native-svg (7d8486a), кнопка загрузки фото монтажника подключена (cc4d404). Плюс тестовая инфраструктура mobile: jest-expo + @testing-library/react-native, покрытие ApiClient (retry на 401, дедупликация refresh) и API-модулей orders/customers/fabrics/payments/staff/work.
  - **Важно**: в `mobile/app` также остался старый нередизайненный `work.tsx`-механизм ролевых очередей (warehouse/production/installation) ещё из допилотной эпохи (до 774561b). При доработке M2 проверять, не дублирует ли что-то из старого кода уже сделанный Figma-экран.
  - **Follow-up мобилки (M2)**: (1) иконки частично ещё ручные → при желании `@expo/vector-icons`; (2) даты — текстом ДД.ММ.ГГГГ (нет date-picker); (3) замер: тюль пишется в comment — нужно расширить бэк-эндпоинт замера на curtain+tulle (MeasurementWriteSerializer вместо MeasurementCreateSerializer в POST /orders/{id}/measurements/); (4) КП: цены вводятся вручную (автарасчёт = запаркованный КП-калькулятор); (5) «Выбрать период» на дашборде — заглушка. Мобилка не «деплоится» — гоняется через Expo/EAS.
- **Landing page** (landing.html, корень репо) — редизайн под ui-ux-pro-max design system (палитра B2B Service `#0369A1`/`#0F172A`, шрифт Plus Jakarta Sans, секция сравнения «без системы vs Sheber Atelier», a11y-доработки). Ребрендинг Sheber ERP → **Sheber Atelier** на лендинге. Задеплоено отдельным Vercel-проектом: https://sheber-atelier-landing.vercel.app (аккаунт bohemetextile8-2199, без git-интеграции — редеплой руками через `vercel --prod` из копии файлов). Логотип: `media/newlogo.webp` (добавлен в git через `git add -f`, т.к. `media/` в целом в `.gitignore`).
- **Security-аудит backend** (2026-07-11, 92c0292): найдена и закрыта межтенантная утечка платежей в `FinanceWorkQueueView` (запрашивал `Payment.objects` без tenant-фильтра — любой Owner/Manager видел последние 20 платежей всех ателье; добавлен `TenantViaOrderMixin` + `scope_to_tenant()`). Закрыта HTML-инъекция в KP PDF (`quote_service.generate_pdf` вставлял поля клиента/комнаты без экранирования — теперь `html.escape()`); `_link_callback` xhtml2pdf больше не резолвит произвольные URI (только локальные шрифты) — закрыт потенциальный SSRF. Backend suite 79/79 зелёные после фикса.
  - **Отклонено при верификации, не требует фикса**: Quote IDOR (копирование чужого КП через `generate_items_from_quote`, `views.py:~890`) — `Quote.id` UUID, неугадываем по конвенции проекта, но tenant-проверка там всё же отсутствует как defense-in-depth (не критично, можно доделать при следующем заходе на Quote-flow).

### 🔲 Активные задачи
| # | Задача | Приоритет |
|---|--------|-----------|
| M2 | Mobile follow-up (иконки/даты/тюль/КП-расчёт, см. выше) | по решению |
| 18 | P4-OPS: Email-уведомления (SendGrid/SMTP) | после первого клиента |
| 21 | P5: Автоматический онбординг нового ателье | после 5 клиентов |
| 22 | P5: Биллинг-модель SaaS (Subscription) | после 5 клиентов |

### ⚠️ Не запушено
На 2026-07-11 локальный `main` опережает `origin/main` на 3 коммита — не забыть `git push`, когда пользователь подтвердит.


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
pytest/pytest-django закреплены в requirements.txt — прогон подтверждён 2026-07-11 (41 тест, зелёные).

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

## Архитектурные дыры — актуальный статус (2026-07-11)

См. полную историю multi-tenancy и security-фиксов в разделе «Статус задач» выше.

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
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
  - **Follow-up мобилки (M2)**: (1) замер: тюль пишется в comment — нужно расширить бэк-эндпоинт замера на curtain+tulle (MeasurementWriteSerializer вместо MeasurementCreateSerializer в POST /orders/{id}/measurements/); (2) КП: цены вводятся вручную (автарасчёт = запаркованный КП-калькулятор); (3) «Выбрать период» на дашборде — заглушка. Мобилка не «деплоится» — гоняется через Expo/EAS.
- **Mobile design polish** (2026-07-11, 91932d9): `work.tsx` использовал локальный emoji/text `IconButton` (⌕/≡) вместо общего SVG icon-набора — заменён на `IconButton` из `Icon.tsx`, добавлена иконка `menu`. `OrderForm`: поля "Дата замера"/"Завершение" были текстовым вводом `__.__.____` без валидации — заменены на `@react-native-community/datetimepicker` (Android: системный modal, iOS: spinner в Modal с кнопкой «Готово»). tsc чистый, mobile suite 55/55. Не проверено визуально в симуляторе (в песочнице нет Android/iOS эмулятора) — рекомендовано пользователю прогнать через Expo Go перед мержем. Проверка показала, что старый нередизайненный `work.tsx` из допилотной эпохи (упомянутый ранее в этом файле) уже был удалён раньше — эта заметка была устаревшей.
- **Landing page** (landing.html, корень репо) — редизайн под ui-ux-pro-max design system (палитра B2B Service `#0369A1`/`#0F172A`, шрифт Plus Jakarta Sans, секция сравнения «без системы vs Sheber Atelier», a11y-доработки). Ребрендинг Sheber ERP → **Sheber Atelier** на лендинге. Задеплоено отдельным Vercel-проектом: https://sheber-atelier-landing.vercel.app (аккаунт bohemetextile8-2199, без git-интеграции — редеплой руками через `vercel --prod` из копии файлов). Логотип: `media/newlogo.webp` (добавлен в git через `git add -f`, т.к. `media/` в целом в `.gitignore`).
- **Security-аудит backend** (2026-07-11, 92c0292): найдена и закрыта межтенантная утечка платежей в `FinanceWorkQueueView` (запрашивал `Payment.objects` без tenant-фильтра — любой Owner/Manager видел последние 20 платежей всех ателье; добавлен `TenantViaOrderMixin` + `scope_to_tenant()`). Закрыта HTML-инъекция в KP PDF (`quote_service.generate_pdf` вставлял поля клиента/комнаты без экранирования — теперь `html.escape()`); `_link_callback` xhtml2pdf больше не резолвит произвольные URI (только локальные шрифты) — закрыт потенциальный SSRF. Backend suite 79/79 зелёные после фикса.
  - **Отклонено при верификации, не требует фикса**: Quote IDOR (копирование чужого КП через `generate_items_from_quote`, `views.py:~890`) — `Quote.id` UUID, неугадываем по конвенции проекта, но tenant-проверка там всё же отсутствует как defense-in-depth (не критично, можно доделать при следующем заходе на Quote-flow).
- **Dependency audit** (2026-07-11, 6c19688): backend `pip-audit` 8→0 уязвимостей (Pillow 11.3.0→12.3.0 — закрыт CVE-2026-42311 memory corruption через PSD, эксплуатируемо через загрузку фото замеров/установки, вызывающую `Image.open()`; pytest 8.4.2→9.1.1). Frontend `npm audit` 7→4 (vitest 2.1.9→4.1.10 — закрыт critical CVSS 9.8 произвольное чтение/исполнение файлов через vitest UI-сервер; остаток — postcss внутри next, ложный совет резолвера откатить next до 9.3.3, игнорируем). Mobile `npm audit` 17→14 (undici HIGH + tar + js-yaml закрыты non-breaking; остаток требует мажорного Expo 54→57, не делали). Тесты после апгрейда все зелёные (backend 119/79, frontend 23, mobile 55).
- **Client-side + инфра security review** (2026-07-11, c13d144): frontend/mobile чисты (нет XSS/`dangerouslySetInnerHTML`/`eval`/open-redirect/отключённого TLS). Django settings (DEBUG/ALLOWED_HOSTS/CORS/CSRF/SECRET_KEY) все корректны. Исправлено: Dockerfile запускал контейнер от root (нет `USER`) — добавлен непривилегированный пользователь `app`, `chown -R` на `/app`, `USER app` перед `CMD`; проверено live-сборкой (`whoami`/`id` внутри контейнера → `app` uid 999, статика читается/пишется).
- **Quote IDOR defense-in-depth + mobile SecureStore** (2026-07-11, d37db00): `_get_source_quote` (`order_item_generation_service.py`) теперь проверяет `quote.order.tenant_id == order.tenant_id` для явно переданного `quote_id` — закрывает теоретическую дыру, где чужой approved-КП можно скопировать в свой заказ, если UUID где-то засветился. Mobile: JWT-токены (access/refresh) перенесены из `AsyncStorage` (незашифровано) в `expo-secure-store` (Keychain/Keystore); `atelier_user` (не секрет) остался в AsyncStorage. Добавлен jest-мок `mobile/__mocks__/expo-secure-store.ts`. Тесты: backend 119/119, mobile 55/55, tsc чистый.

- **M2.2 + M2.1: Авторасчёт метража + тюль в свои поля** (2026-07-11): метраж ткани/тюля больше не вводится руками — вычисляется сервером из ширины окна и **настраиваемого на окно** коэффициента сборки (раздельные `curtain_gathering` 2.2 / `tulle_gathering` 2.0 на модели `Measurement`, migration 0024). Формула по модели «сборка»: `meters = ceil₀.₁(width_cm × gathering / 100)`, вынесена в `atelier_erp/services/measurement_calc.py` (единая точка изменения округления). Write-path — action `POST /orders/{id}/measurements/` + переработанный `MeasurementCreateSerializer` (обе ткани по имени + коэффициенты; метраж read-only, присланный клиентом игнорируется). Закрыт M2.1: тюль (ткань+коэффициент) уходит в свои поля, а не в `notes`. Мобилка: `MeasurementForm` — 2 выпадашки сборки + живая подсказка «≈ X.X м»; легаси-экран `orders/[id]/measurements.tsx` мигрирован синхронно (иначе молча ломался бы). Цена КП осталась ручной (по решению пользователя — тарифы `SewingRates`/`GatheringRatios` не задействованы). Web-путь `/api/v1/measurements/` не мигрирован (шлёт метраж вручную, вне скоупа). Тесты: backend 87 (+3 meterage endpoint/формула), mobile 58 (+3 previewMeters); tsc чистый. **Не проверено визуально в симуляторе** (нет эмулятора в песочнице) — прогнать через Expo Go перед мержем. Спека: `docs/superpowers/specs/2026-07-11-quote-meterage-autocalc-design.md`.

- **Пилотные баги с телефона** (2026-07-13): (Bug#4/#3) «Скачать КП»/сохранение КП падало `select_for_update cannot be used outside of a transaction` — `QuoteService.update_quote` обёрнут в `transaction.atomic()` (вызывается из ViewSet без внешнего UnitOfWork; sibling-мутаторы approve/send/reject/revise имели тот же латентный баг — обёрнуты в atomic превентивно в аудите 2026-07-15, хотя из API не вызываются). «Перекидывает на предоплату» после создания КП — это штатный 2-й экран КП, не баг. (Bug#1/#2) экран деталей заказа не показывал замеры/дату замера/адрес: `OrderExecutionService.get_order_execution_summary` не отдавал их на верхнем уровне (замеры жили только в `role_sections.designer`, а адрес мобилка кладёт в `order.installation_address_*`, тогда как экран читал `customer.address`). Добавлены top-level `measurement_date`/`installation_date`/`planned_completion`/`installation_address`/`measurements`; мобильный `[id].tsx` читает `installation_address`. (Bug#5) фильтр-пилюли на экране заказов рендерились обрезанными — горизонтальный `FlatList` с `flexDirection:'row'` в contentContainer заменён на горизонтальный `ScrollView`. Тесты: backend 89 (+2 регрессии), mobile 58, tsc чистый. Мобилка бьёт в Railway prod (`ateliererp-production`), backend-фиксы видны после redeploy.

### 🔲 Активные задачи
| # | Задача | Приоритет |
|---|--------|-----------|
| M2 | Mobile follow-up: авто-расчёт **цены** КП (запаркован, цена пока ручная); «Выбрать период» на дашборде — заглушка | по решению |
| 18 | P4-OPS: Email-уведомления (SendGrid/SMTP) | после первого клиента |
| 21 | P5: Автоматический онбординг нового ателье | после 5 клиентов |
| 22 | P5: Биллинг-модель SaaS (Subscription) | после 5 клиентов |

- **Статусы: группы в фильтре + смена статуса с телефона** (2026-07-18): (1) Фильтр-пилюли в мобилке показывали 7 технических статусов FSM — заменены на 4 пользовательские группы (Все / В работе / Просрочен / Завершён / Ожидание). Раскладка группа→статусы задана **на бэке** в новом `atelier_erp/api/v1/filters.py` (`ORDER_STATUS_GROUPS` + `OrderFilterSet.status_group`), чтобы веб и мобилка не разъехались; мобилка шлёт `?status_group=`, `OrderViewSet` перешёл с `filterset_fields` на `filterset_class`. `overdue` — производное состояние (дедлайн прошёл и заказ не в терминальном статусе), считается на сервере, поэтому больше не ломается пагинацией. (2) **Найдена регрессия: мобилка вообще не умела менять статус заказа** — компонент `mobile/src/components/orders/OrderRoleActions.tsx` остался в репо, но нигде не был отрендерен после редизайна `orders/[id].tsx` под Figma. Заказы, созданные с телефона, навсегда висели в `new`. Строка «Статус» в карточке заказа сделана кликабельной: открывает список разрешённых переходов из `data.actions` (правила перехода остаются на бэке, мобилка своей копии FSM не держит) + «Отменить заказ». Дашбордная плитка «Ожидают оплаты» переведена с `?status=waiting_final_payment` на группу `?status=waiting`. Тесты: backend 97 (+5 на группы), mobile 58, tsc чистый, iOS/Android бандлы 200. **Важно про Metro:** в SDK 54 бандл дёргается по `/.expo/.virtual-metro-entry.bundle?platform=...`, старый путь `/expo-router/entry.bundle` отдаёт 404.

- **Автопродвижение статусов** (2026-07-18): статусы двигались только руками, поэтому в системе всегда отставали от реальности. Новый `atelier_erp/services/status_automation.py` с единственной функцией `auto_advance(order, target, reason, changed_by)`. Три свойства: (1) своих правил перехода нет — всё идёт через `OrderService.transition_status_mvp`, те же инварианты, что у ручных кнопок; (2) никогда не роняет основную операцию (запрещённый переход = молчаливый no-op + `logger.info`) — иначе приём платежа падал бы из-за отсутствия АВР; (3) в `OrderStatusHistory.notes` пишется префикс `[авто]`. Триггеры: позиции сформированы из КП → `in_work` (в `OrderItemGenerationService`), КП одобрено при уже готовых позициях → `in_work` (в `QuoteService.approve_quote`), `material_readiness=ready` → `in_production`, `production_stage=done` → `ready`, установка завершена + оплачено → `completed` (раньше считался флаг `can_auto_complete`, но его никто не применял), финальный платёж закрыл остаток → `completed` (только из `waiting_final_payment`, чтобы 100% предоплата не закрывала несшитый заказ). Сознательно НЕ автоматизированы: `ready → on_installation` (назначение бригады — решение человека) и любые переходы в `cancelled`. Спека: `docs/superpowers/specs/2026-07-18-status-automation-design.md`. Тесты: `test_status_automation.py` (12).
- **Веб-фильтр статусов: баг «Просрочено»** (2026-07-18): `frontend/src/lib/list-status.ts` сравнивал `status === "overdue"`, но `overdue` не существует как значение `Order.status` — это производный флаг `is_overdue`. Пилюля «Просрочено» на вебе показывала 0 всегда, а просроченные заказы висели в «В работе». `getListStatus(status, isOverdue)` теперь принимает флаг вторым аргументом (просрочка перебивает стадию, но не у закрытых заказов). Выяснилось, что `is_overdue` вообще не сериализовался в v1 — добавлен в `OrderListSerializer` и `OrderDetailSerializer` + в DTO фронта. Группа `completed` на бэке дополнена `cancelled` (иначе отменённый заказ не попадал ни в одну пилюлю) — теперь совпадает с вебовским ключом `done`.
- **Найдено, не исправлено**: `_create_order_item_from_quote_item` (`order_item_generation_service.py`) жёстко ставит `item_type='fabric'` и `fabric=quote_item.fabric`. Позиция КП без ткани (например, чистая услуга установки) роняет генерацию позиций с `IntegrityError: orderitem_valid_reference`. На пилоте не всплыло, т.к. позиции КП всегда с тканью.

### ⚠️ Не запушено
На 2026-07-11 всё запушено: `origin/main` = `c9e39e2` (M2.2 авторасчёт метража + предыдущие 3 коммита).


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
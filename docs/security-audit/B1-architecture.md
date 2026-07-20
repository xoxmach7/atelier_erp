# B1 — Архитектура и trust boundaries

Дата: 2026-07-20. Источники: чтение `settings.py`, `Dockerfile`, `docker-compose.yml`, `middleware.py`, `urls.py`, `requirements.txt`, `frontend/src/services/http/client.ts`, `mobile/src/api/client.ts`, история фиксов в `CLAUDE.md`.

## 1. Компоненты системы

| Компонент | Технология | Хостинг | Роль |
|---|---|---|---|
| Backend API | Django 4.2 + DRF, Gunicorn | Railway (managed PaaS, контейнер по `Dockerfile`) | Единственный источник бизнес-логики и данных. Все три клиента (веб, мобилка, Django admin) ходят в него. |
| БД | PostgreSQL | Railway-managed add-on | Единственное хранилище состояния. Доступ — только из backend-контейнера через внутреннюю сеть Railway (`DB_HOST`/`DB_PORT` из env), плюс отдельный публичный коннекшн-стринг `DATABASE_PUBLIC_URL` для ручных операций (использовался для `seed_demo --reset` на проде, см. CLAUDE.md 2026-07-18). |
| Файловое хранилище | Cloudflare R2 (S3-совместимое, через `django-storages`/`boto3`) | Cloudflare, отдельно от Railway | Медиафайлы (фото замеров/установки, АВР, логотип лендинга). Активируется наличием `AWS_ACCESS_KEY_ID` в env; без него — локальный `MEDIA_ROOT` (только dev). Отдаёт подписанные URL (`AWS_QUERYSTRING_AUTH=True`, TTL 1 час). |
| Веб-фронтенд | Next.js (TypeScript, Tailwind) | Vercel (`atelier-erp.vercel.app`) | SPA/SSR-клиент для Owner/Designer. Обращается к backend по `NEXT_PUBLIC_API_BASE_URL`. |
| Мобильное приложение | React Native + Expo | Дистрибуция через Expo/EAS (не через сторы на момент аудита) | Клиент для всех 5 ролей, основной канал для Warehouse/Seamstress/Installer. Обращается к backend по `EXPO_PUBLIC_API_BASE_URL`. JWT хранится в `expo-secure-store` (Keychain/Keystore), не в `AsyncStorage`. |
| Django admin | Встроенная админка Django | Тот же контейнер Railway, путь `/admin/` | Ручные операции суперпользователя (сейчас — только `admin`), напрямую поверх моделей. Не имеет собственного RBAC — либо суперюзер, либо ничего. |
| Landing page | Статический HTML | Vercel, отдельный проект (`sheber-atelier-landing.vercel.app`) | Маркетинговая страница, не имеет доступа к данным ERP, деплоится вручную (`vercel --prod`, без git-интеграции). |

**Чего нет** (сознательно, важно для threat model в B2): очереди/брокера сообщений (Redis/Celery — YAGNI, см. CLAUDE.md), email/SMS-провайдера, платёжного шлюза с реальным API (Kaspi Pay — это просто enum-значение способа оплаты, не интеграция), системы мониторинга ошибок (Sentry и т.п.), CI-пайплайна.

## 2. Точки входа (entry points)

Единственный backend слушает всё это на одном Django `ROOT_URLCONF`:

| Путь | Кто дергает | Аутентификация |
|---|---|---|
| `/api/v1/*` (DRF router: orders, quotes, measurements, payments, customers, tasks, inventory-items, fabrics) | Веб, мобилка | JWT (`Authorization: Bearer`) или DRF SessionAuthentication |
| `/api/auth/token/`, `/api/auth/token/refresh/`, `/api/auth/token/verify/` | Веб, мобилка | Логин/пароль → JWT; throttle `login: 5/min` |
| `/api/auth/logout/` | Веб, мобилка | Blacklist текущего refresh-токена |
| `/api/me/` | Веб, мобилка | JWT — текущий пользователь + роль |
| `/api/auth/` (browsable API DRF) | Разработка/отладка | Сессионный логин DRF, доступен и в проде (не за флагом `DEBUG`) |
| `/admin/` | Только суперюзер вручную | Django-сессия, логин/пароль |
| `/health/` | Railway healthcheck | `AllowAny`, без данных |
| Media URLs (R2) | Веб, мобилка, третьи лица по прямой ссылке | Подписанный URL, TTL 1 час — не требует JWT, но недолговечен и непредсказуем (UUID пути) |

Отдельного backend-for-frontend или API-gateway нет — оба клиента бьют в один и тот же публичный `/api/v1/`.

## 3. Trust boundaries

```
[ Интернет ]
     │
     ├── Vercel (Next.js, atelier-erp.vercel.app) ──┐
     │        доверенный клиент, но выполняется      │
     │        в браузере пользователя (untrusted      │
     │        runtime — XSS-поверхность)              │
     │                                                 │
     ├── Мобильное приложение (Expo, вне контроля     │
     │   инфраструктуры — крутится на устройствах      │
     │   пользователей, JWT в Keychain/Keystore)       │
     │                                                 │
     └── Прямые вызовы к /api/v1/ (браузерная         │
         DevTools-консоль, curl, Postman — ничто       │
         не мешает обратиться к API в обход            │
         Vercel/Expo)                                  │
                                                         ▼
                                    ══════ ГРАНИЦА ══════
                                    (JWT-аутентификация +
                                     RBAC-группы + tenant
                                     ContextVar)
                                              │
                                              ▼
                          [ Railway: Django API контейнер ]
                          - выполняется от непривилегированного
                            пользователя `app` (не root)
                          - TenantMiddleware резолвит tenant
                            из JWT-пользователя ДО ORM-запросов
                                              │
                        ┌─────────────────────┼─────────────────────┐
                        ▼                     ▼                     ▼
              [ PostgreSQL, Railway ]   [ Cloudflare R2 ]   [ Django admin /admin/ ]
              внутренняя сеть Railway   подписанные URL      тот же процесс, но
              + публичный коннекшн      (TTL 1ч), отдельные   ГРАНИЦА ВНУТРИ ГРАНИЦЫ:
              для ручных операций        от Railway креды     только is_superuser,
              (DATABASE_PUBLIC_URL)                           не проходит через RBAC-
                                                               группы/tenant-скоуп
                                                               (superuser = ALL_TENANTS)
```

Ключевые границы:
1. **Интернет → Railway-приложение.** Единственный настоящий периметр. Защищён JWT + `ALLOWED_HOSTS` + `CORS_ALLOWED_ORIGINS`/`CSRF_TRUSTED_ORIGINS` (оба явно из env, без LAN-IP-дефолтов).
2. **Пользователь-в-роли → данные другого тенанта.** Не сетевая, а логическая граница: `TenantManager` (ORM-уровень, `ContextVar`) + `scope_to_tenant()`/`scope_orders_for_role()` (DRF-уровень, defense-in-depth). Подробно описано в `project_tenant_isolation` (memory) и в security-аудитах 2026-07-11/07-19 из `CLAUDE.md`.
3. **Роль → роль внутри одного тенанта.** RBAC через Django-группы (`roles.py`), единый источник — но применяется вручную в каждом ViewSet/permission, не декларативно на уровне модели (риск для B2 — забытая проверка в новом эндпоинте).
4. **Суперюзер → всё.** `is_superuser` обходит и RBAC (permissions читают его как «все роли сразу»), и tenant-скоуп (`ALL_TENANTS` в middleware). Единственный superuser сейчас — `admin`, пароль пересоздаётся при каждом деплое из `SUPERUSER_PASSWORD` (`ensure_superuser`, вызывается в `CMD` контейнера) — если кто-то поменяет пароль вручную через `/admin/`, следующий деплой молча откатит его к значению из env.
5. **Данные о продажах Sheber (планируемый Sales CRM, см. предыдущий спек) → тенантные данные ателье.** Пока не реализовано, но зафиксировано как архитектурное требование: должно остаться вне `TenantManager`, без RBAC-групп ателье, доступно только `is_superuser`.

## 4. Основные потоки данных

- **Аутентификация:** логин/пароль → `/api/auth/token/` → JWT access (60 мин) + refresh (7 дней, ротация с blacklist) → хранится в `localStorage`/памяти на вебе (не проверено в рамках B1, см. E1) и в `expo-secure-store` на мобилке.
- **Тенант резолвится на КАЖДЫЙ запрос** заново из `user.tenant_membership.tenant` в `TenantMiddleware` — нет сессионного кеша, значит смена membership применяется мгновенно (плюс для безопасности при отзыве доступа).
- **Чувствительные данные:** ФИО/телефон/адрес клиента (`Customer`), суммы и платежи (`Payment`, `Order.total_amount/paid_amount`), фото объектов (`PhotoReport`) и подписанные АВР (`OrderCompletionAct`) — все текстовые данные в PostgreSQL, файлы — в R2 за подписанными URL.
- **Исходящие вызовы backend:** только к Cloudflare R2 (загрузка/подпись URL медиафайлов). Никаких вызовов к внешним API по пользовательским данным (нет email/SMS/платёжного шлюза) — сильно сокращает поверхность SSRF/утечки третьим лицам по сравнению с типичным SaaS.
- **PDF генерация КП** (`quote_service.generate_pdf`, xhtml2pdf) — рендерит клиентские данные в PDF; `_link_callback` ограничен локальными шрифтами после фикса 2026-07-11 (закрыт SSRF), проверить в B2 повторно.

## 5. Что B1 не покрывает (передаётся в следующие этапы)

- Порядок правильности CORS/CSRF конкретных значений в проде — не проверялось, чьи это домены (задача D1/E1).
- Кто именно имеет доступ к Railway/Vercel/Cloudflare консолям (люди, не код) — не в кодовой базе, нужно спросить владельца (это скорее F1/C1).
- Содержимое `.env` в проде (реальные значения секретов) — намеренно не читалось в рамках этого аудита.

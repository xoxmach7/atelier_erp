# E1 — Data & Encryption Architecture

Дата: 2026-07-20. Источники: `settings.py` (DB/S3/JWT-конфиг), `frontend/src/services/http/client.ts`, мобильный `SecureStore`-фикс из `CLAUDE.md` (2026-07-11), модели `Customer`/`Payment`/`PhotoReport`/`OrderCompletionAct`.

## 1. Классификация данных

| Тип | Примеры полей | Где хранится |
|---|---|---|
| Учётные секреты | Пароль (хэш `auth.User`), JWT access/refresh | PostgreSQL (хэш через Django `PBKDF2`), клиенты (см. ниже) |
| ПДн клиентов ателье | `Customer.full_name/phone/address_*` | PostgreSQL, plaintext-поля (ожидаемо для CRM/ERP — приложению нужно с ними работать) |
| Финансовые данные | `Order.total_amount/paid_amount`, `Payment.amount` | PostgreSQL, plaintext |
| Медиа с юридической/приватной значимостью | Фото объектов (`PhotoReport`), подписанные АВР (`OrderCompletionAct`) | Cloudflare R2 |
| Служебные секреты инфраструктуры | `DJANGO_SECRET_KEY`, R2-ключи, `DATABASE_PUBLIC_URL`, `SUPERUSER_PASSWORD` | Railway/Vercel env vars (см. F1) |

## 2. Транспортное шифрование (TLS)

| Соединение | Статус |
|---|---|
| Клиент (браузер/мобилка) → Django backend | HTTPS через Railway edge, принудительно в проде: `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, HSTS на год с preload (`settings.py`) |
| Клиент → Next.js (Vercel) | HTTPS через Vercel edge |
| Backend → PostgreSQL | `sslmode` берётся из env, **дефолт в коде — `'prefer'`, не `'require'`** (`settings.py`: `'sslmode': os.environ.get('DB_SSLMODE', 'prefer')`). Соединение идёт по внутренней сети Railway (`postgres.railway.internal`, см. D1), поэтому риск перехвата ниже, чем для интернет-трафика, но `'prefer'` формально допускает молчаливый откат на plaintext, если TLS-согласование не удастся. Не проверено, выставлена ли переменная `DB_SSLMODE=require` в Railway Variables. | 
| Backend → Cloudflare R2 | HTTPS (стандарт для S3-совместимого API) |

## 3. Шифрование в состоянии покоя (at rest)

| Где | Что известно |
|---|---|
| PostgreSQL (Railway-managed) | **Не проверялось в рамках этого аудита** — гарантии шифрования диска зависят от Railway/их провайдера инфраструктуры (обычно AWS/GCP-подложка с encryption-at-rest по умолчанию), но это не подтверждено документацией/конфигурацией на нашей стороне. Нужно уточнить у Railway (SLA/security page), не предполагать. |
| Cloudflare R2 | Аналогично — encryption-at-rest обычно включён провайдером по умолчанию для object storage, не настраивается и не проверяется из кода. |
| Локальный `MEDIA_ROOT` (только dev, когда R2 не настроен) | Без шифрования — но это только для локальной разработки, не для прода (в проде `AWS_ACCESS_KEY_ID` всегда задан). |

## 4. Хранение токенов на клиентах — главная находка этого этапа

| Клиент | Где лежит JWT | Риск |
|---|---|---|
| Мобилка (Expo) | `expo-secure-store` (Keychain/iOS, Keystore/Android) | Закрыто 2026-07-11 — недоступно обычному JS-коду приложения, требует компрометации самого устройства/ОС |
| **Веб (Next.js)** | **`localStorage`** (`frontend/src/services/http/client.ts`: `STORAGE_KEYS.accessToken/refreshToken`, `localStorage.getItem/setItem`) | **Открытый вопрос, поднятый в B2/C1 — подтверждён.** `localStorage` читается любым JS, выполняющимся на странице. Аудит 2026-07-11 не нашёл активного XSS в текущем коде, но `localStorage` убирает второй рубеж защиты: если XSS появится позже (через скомпрометированную npm-зависимость Next.js-приложения — реальный, часто встречающийся вектор, не гипотетический), атакующий получает **и access, и refresh токен** — то есть возможность полного захвата сессии на весь срок жизни refresh-токена (7 дней), а не только на 60 минут. | **High** |

## 5. Риски (сводно для этого этапа)

| Риск | Приоритет |
|---|---|
| JWT (оба токена) в `localStorage` на вебе — при любом будущем XSS даёт длительный (7 дней) захват аккаунта, а не только 60-минутный | **High** |
| `DB_SSLMODE` по умолчанию `'prefer'`, не `'require'` — не проверено, что в Railway Variables выставлено жёстче | **Medium** |
| Encryption-at-rest для Postgres/R2 не подтверждён документацией провайдера (не значит, что его нет — значит, что не проверяли) | **Low-Medium**, информационный пробел, а не подтверждённая дыра |
| Предсказуемость путей файлов в R2 (перенесено из B2, не проверялось) | Low-Medium |

## 6. Рекомендации

1. **Перевести хранение JWT на вебе с `localStorage` на что-то, не читаемое произвольным JS** — самый весомый вариант: httpOnly-cookie для refresh-токена (access может оставаться в памяти/сторе React, это не критично при коротком TTL). Это требует изменений на backend (выдача/приём куки) и middleware CORS/CSRF — нетривиальная, но самая ценная правка из всего E1.
2. Явно выставить `DB_SSLMODE=require` в Railway Variables (или зафиксировать, что внутренняя сеть Railway это компенсирует, и решение осознанное — но сейчас это не задокументировано нигде).
3. Уточнить в документации/SLA Railway и Cloudflare R2 факт encryption-at-rest — не обязательно менять код, обязательно знать, на что полагаемся.

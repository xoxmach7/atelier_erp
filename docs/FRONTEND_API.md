# Atelier ERP — API для фронтенда

Шпаргалка для интеграции фронта/мобайла. Бэкенд: Django REST Framework, JWT.

## База

```
BASE_URL = https://<your-app>.up.railway.app    # прод (Railway)
BASE_URL = http://localhost:8000                 # локально
```

Все ответы — JSON. Авторизация — Bearer-токен в заголовке:
```
Authorization: Bearer <access_token>
```

---

## 1. Аутентификация

| Действие | Метод | URL | Тело | Ответ |
|---|---|---|---|---|
| Логин | POST | `/api/auth/token/` | `{ "username", "password" }` | `{ "access", "refresh" }` |
| Обновить access | POST | `/api/auth/token/refresh/` | `{ "refresh" }` | `{ "access" }` (+ новый refresh, ротация включена) |
| Проверить токен | POST | `/api/auth/token/verify/` | `{ "token" }` | 200 / 401 |
| Logout (отзыв) | POST | `/api/auth/logout/` | `{ "refresh" }` | 205 |
| Текущий пользователь | GET | `/api/me/` | — | см. ниже |

- `access` живёт 60 мин, `refresh` — 7 дней. На 401 от API — обновляй через refresh; если refresh умер — заново логин.
- Логин под лимитом **5 запросов/мин** на IP (anti-brute-force) → возможен `429 Too Many Requests`.
- Logout отзывает refresh-токен (blacklist); старый перестаёт работать.

### GET /api/me/
```json
{
  "id": 1,
  "username": "demo_owner",
  "email": "",
  "first_name": "",
  "last_name": "",
  "is_staff": true,
  "is_superuser": false,
  "groups": ["Owner"]
}
```
**Роль пользователя определяется по массиву `groups`.**

---

## 2. Роли

Пять каноничных групп (приходят в `groups` из `/api/me/`):

| Группа (backend) | Роль (UI) | Что видит/делает |
|---|---|---|
| `Owner` | владелец/админ | всё: все заказы, финансы, дашборд, управление |
| `Designer` | замерщик/дизайнер | все заказы, замеры, КП (видит суммы) |
| `Warehouse` | склад | только заказы в работе/производстве/готовые, материалы (без сумм) |
| `Seamstress` | швейный цех | только заказы в производстве (без сумм) |
| `Installer` | монтажник | только готовые/на установке/ожидают оплаты (без сумм) |

Маппинг группа → UI-роль (как на фронте):
```js
const GROUP_TO_ROLE = {
  Owner: "owner",
  Designer: "designer",
  Warehouse: "warehouse",
  Seamstress: "production",
  Installer: "installation",
};
// is_superuser === true → трактовать как "owner"
// нет совпадений → доступа нет (default deny), показать «Нет доступа»
```

Важно:
- **Список заказов `/api/v1/orders/` автоматически срезается по роли на бэкенде.** Owner/Designer видят все; склад/цех/монтаж — только свой срез. Фронту фильтровать не нужно — что отдал бэкенд, то и показывать.
- **Финансовые поля** (`total_amount`, `paid_amount`, `balance_due`) приходят в списке заказов только для Owner и Designer. У остальных их просто нет в ответе — не завязывайся на них для этих ролей.

---

## 3. Рабочие очереди (главные экраны по ролям)

Каждая роль обращается к своей очереди — это готовые наборы для её экрана:

| Роль | Эндпоинт | Содержит |
|---|---|---|
| Owner | `GET /api/v1/work/owner/` | счётчики + срезы по всем стадиям |
| Designer | `GET /api/v1/work/designer/` | нужен замер / нужен КП / в работе / просрочка |
| Designer/Owner | `GET /api/v1/work/quotes/` | КП: черновики, на согласовании, принятые |
| Warehouse | `GET /api/v1/work/warehouse/` | обеспеченность материалами, ткани |
| Seamstress | `GET /api/v1/work/production/` | к пошиву / в работе / готово |
| Installer | `GET /api/v1/work/installation/` | к установке / на установке / нужен фото+АВР |
| Owner | `GET /api/v1/work/finance/` | ожидают оплаты / закрыты |
| Owner | `GET /api/v1/dashboard/` | сводка: деньги, заказы, долги |

Доступ к чужой очереди → `403`. Дашборд/owner/finance — только владелец.

---

## 4. Заказы и сущности (v1)

| Действие | Метод | URL |
|---|---|---|
| Список заказов (срез по роли) | GET | `/api/v1/orders/` |
| Детали заказа | GET | `/api/v1/orders/{id}/` |
| Создать заказ | POST | `/api/v1/orders/` (Owner/Designer) |
| Сменить статус (MVP) | POST | `/api/v1/orders/{id}/change-status/` `{ "status": "in_work" }` |
| Обеспеченность материалами | POST | `/api/v1/orders/{id}/change-material-readiness/` |
| Стадия производства | POST | `/api/v1/orders/{id}/change-production-stage/` |
| Стадия установки | POST | `/api/v1/orders/{id}/change-handover-stage/` |
| Отменить | POST | `/api/v1/orders/{id}/cancel/` |
| Замеры заказа | GET/POST | `/api/v1/orders/{id}/measurements/` |
| КП заказа | GET | `/api/v1/orders/{id}/quotes/` |
| Сформировать позиции из КП | POST | `/api/v1/orders/{id}/generate-items-from-quote/` |
| Материалы заказа | GET | `/api/v1/orders/{id}/materials/` |
| Фотоотчёты | GET/POST | `/api/v1/orders/{id}/photo-reports/` |
| АВР (акт) | GET/POST | `/api/v1/orders/{id}/completion-act/` |
| Загрузить подписанный АВР | POST | `/api/v1/orders/{id}/completion-act/upload-signed/` |
| Чек-лист завершения | GET | `/api/v1/orders/{id}/completion-checklist/` |
| PDF по заказу | POST | `/api/v1/orders/{id}/generate-pdf/` |
| КП (список/CRUD) | — | `/api/v1/quotes/` |
| Задачи | — | `/api/v1/tasks/` |
| Инвентарь (ткани) | GET | `/api/v1/inventory/` |

Списки пагинированы (`PageNumberPagination`, 50 на страницу): ответ вида `{ count, next, previous, results: [...] }`.

---

## 5. Статусы заказа (главная цепочка)

```
new → in_work → in_production → ready → on_installation → waiting_final_payment → completed
```
плюс `cancelled` в любой момент.

| Значение | Подпись |
|---|---|
| `new` | Новый |
| `in_work` | В работе |
| `in_production` | В производстве |
| `ready` | Готов |
| `on_installation` | На установке / выдаче |
| `waiting_final_payment` | Ожидает финальной оплаты |
| `completed` | Завершён |
| `cancelled` | Отменён |

Переход через `change-status` валидируется на бэке: невалидный → `409 Conflict` (с `allowed_transitions`), не выполнены условия (нет принятого КП, нет материалов, нет фото/АВР/оплаты) → `400` с полем `code` (`quote_not_accepted`, `material_not_ready`, `production_not_done`, `payment_required` и т.п.).

Отдельные операционные слои (не главный статус, свои поля в деталях заказа):
- `material_readiness`: `not_ready` / `partially_ready` / `ready`
- `production_stage`: `not_started` / `cutting` / `sewing` / `quality_check` / `done`
- `handover_stage`: `not_required` / `pending` / `scheduled` / `in_progress` / `done`

---

## 6. Коды ответов, на которые закладываться

- `401` — нет/протух access → refresh или логин.
- `403` — роль не имеет доступа к ресурсу/очереди.
- `409` — недопустимый переход статуса (см. `allowed_transitions`).
- `400` — не выполнены бизнес-условия перехода (см. `code`).
- `429` — превышен лимит логина (5/мин).

## 7. CORS
Бэкенд разрешает origin фронта из переменной `CORS_ALLOWED_ORIGINS`. Если фронт крутится не на `http://localhost:3000` — попроси добавить его origin в эту переменную на бэкенде.

# Sheber ERP Demo Workflow

Этот сценарий создаёт безопасные демо-данные с префиксом `[DEMO]`, чтобы Sheber ERP можно было посмотреть как связанный продукт:

Клиент -> Заказ -> Замер -> КП -> Материалы -> Производство -> Установка / выдача -> Фотоотчёт -> АВР -> Оплата -> Завершение.

## 1. Как запустить demo seed

```bash
python manage.py seed_demo_workflow --reset-demo
```

Команда idempotent: повторный запуск обновляет демо-сценарий, а `--reset-demo` удаляет только записи с demo-маркерами.

## 2. Как запустить проект

Backend:

```bash
python manage.py runserver
```

Frontend:

```bash
cd frontend
npm run dev
```

## 3. Какие страницы открыть

- `/dashboard`
- `/orders`
- `/orders/[id]` для каждого demo order
- `/measurements`
- `/estimate?customer=...&order=...`
- `/quotes`
- `/quotes/[id]`
- `/production`
- `/installation`
- `/inventory`
- `/payments`

После запуска seed открой `/orders` и найди клиентов с префиксом `[DEMO]`.

## 4. Что должно быть видно

- `О-YYYY-901`: новый заказ без замера.
- `О-YYYY-902`: заказ с замерами, но без КП.
- `О-YYYY-903`: заказ с черновиком КП.
- `О-YYYY-904`: принятое КП и частичная готовность материалов.
- `О-YYYY-905`: заказ в производстве.
- `О-YYYY-906`: заказ готов к установке / выдаче.
- `О-YYYY-907`: заказ с фотоотчётом и АВР.
- `О-YYYY-908`: заказ ожидает финальную оплату.
- `О-YYYY-909`: завершённый заказ.

## 5. Что пока временно

- `/production` использует frontend-фильтрацию заказов, без отдельного backend queue endpoint.
- `/installation` использует frontend-фильтрацию заказов, без отдельного backend queue endpoint.
- `/dashboard` строит summary на frontend по списку заказов.
- Material requirements пока не имеют отдельного backend aggregation endpoint.
- Фотоотчёт и АВР в demo создаются техническими demo-файлами, чтобы блоки были видны в UI.

## 6. Что делать дальше

- Аккуратно разнести `/orders/[id]` на секции-компоненты.
- Добавить backend queues:
  - `/api/v1/production/queue/`
  - `/api/v1/installation/queue/`
  - `/api/v1/inventory/requirements/`
  - `/api/v1/dashboard/summary/`
- Добавить отдельный demo route map, если нужен быстрый просмотр каждого demo order одной ссылкой.

# Atelier ERP

ERP-система для ателье по пошиву штор.

Проект покрывает рабочий процесс исполнения заказа:
- расчёт проекта / смета
- замер
- материалы и склад
- пошив / производство
- карнизы
- установка
- оплаты
- контроль статусов

## Текущий статус

Backend baseline стабилизирован:
- Django backend работает
- PostgreSQL подключён
- миграции проходят
- Docker Compose baseline работает
- основные API endpoints и admin доступны

Дальше планируется frontend-панель для сотрудников.

---

## Структура проекта

```text
atelier_erp/
├── atelier_erp/          # Django backend
├── frontend/             # будущий Next.js frontend
├── manage.py
├── requirements.txt
├── docker-compose.yml
├── Dockerfile
├── .dockerignore
├── .env.example
└── README.md
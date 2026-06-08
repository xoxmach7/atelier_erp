# Memory — Atelier ERP / Sheber

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
| P2 | Архитектурные улучшения (в работе) |
| P3 | Низкий приоритет / косметика |
| settings_test.py | Test-settings с SQLite для CI без PostgreSQL |
| seed_groups | `manage.py seed_groups` — создаёт канонические роли в БД |
| seed_pilot | `manage.py seed_pilot` — тестовые аккаунты по ролям |

## Статус задач (трекер)
| # | Задача | Статус |
|---|--------|--------|
| - | Аудит сложности / over-engineering | ✅ |
| - | P2: убрать дубль инвентаря | ✅ |
| - | Чистка мусора (логи, демо, fix-скрипты) | ✅ сессия 2026-06-06 |
| 4 | P2: решить судьбу events/Celery | ✅ сессия 2026-06-06 |
| 6 | P2: границы order_service / order_execution_service | ✅ сессия 2026-06-06 |
| 7 | P2: депрекировать legacy /api/ | ✅ сессия 2026-06-06 |
| 8 | P2: явные действия «принят» и «передать в цех» | ✅ сессия 2026-06-07 |
| 9 | P3: mobile — чистка | ✅ сессия 2026-06-08 |
| 10 | P3: frontend — отделить демо-страницы | ✅ (демо удалены) |
| 11 | P3: вычистить легаси-статусы FSM | ✅ сессия 2026-06-08 |
| 13 | P3: упростить ProductionStage + is_overdue + deprecated choices | ✅ сессия 2026-06-08 |
| 12 | P3: тесты на токены/throttling/нумерацию | ✅ (test_p1_security_numbering.py) |
| 14 | API: ui_badge поле в сериализаторе (цвет/лейбл для фронта) | ✅ сессия 2026-06-08 |

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

## Цветовая ло�
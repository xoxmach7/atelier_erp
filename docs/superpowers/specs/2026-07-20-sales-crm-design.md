# Sales CRM — лиды ателье для продаж Sheber

Дата: 2026-07-20

## Проблема

Владелец Sheber ходит по ателье лично и предлагает продукт. Нужно фиксировать: кого прошёл, кто подписался, кто взял пробный период, кто отказался (но, возможно, ещё заинтересован), с историей касаний и напоминаниями, кого пора дёрнуть повторно.

Это данные о продажах **самого Sheber** (кто из ателье — потенциальный клиент SaaS), а не бизнес-данные какого-либо тенанта. В системе уже есть модель `Task` (лиды), но это лиды **внутри** ателье (клиенты конкретного ателье), per-tenant — переиспользовать её нельзя и не нужно: смешивать эти два понятия в одной таблице означало бы протечку мета-уровня (продажи Sheber) в тенантные данные.

## Архитектура

Новое отдельное Django-приложение `sales_crm`, вне `atelier_erp` core:
- **Не использует `TenantManagerMixin`** — это не тенантные данные, `tenant`-поля нет.
- Изолировано от ядра ERP: не завязано на `TenantManager`, не участвует в API v1, не появляется в мобилке/фронтенде.
- Доступ — только через Django admin, только суперюзеру.

Изоляция важна на будущее: когда появится автосбор лидов из мессенджеров для владельцев ателье (отдельная большая фича, вне этой спеки), она будет работать с тенантными данными ателье-клиентов — это другой контур, не путать с текущей задачей (лиды **для продажи** Sheber).

## Модель данных

```python
class Lead(AuditedModel):
    class Status(models.TextChoices):
        CONTACTED = 'contacted', 'Контакт'
        INTERESTED = 'interested', 'Показал интерес'
        TRIAL = 'trial', 'Пробный период'
        SUBSCRIBED = 'subscribed', 'Подписка'
        DECLINED_INTERESTED = 'declined_interested', 'Отказ, но интересно'
        DECLINED = 'declined', 'Отказ'

    class Source(models.TextChoices):
        PHONE = 'phone', 'Звонок'
        INSTAGRAM = 'instagram', 'Instagram'
        WHATSAPP = 'whatsapp', 'WhatsApp'
        REFERRAL = 'referral', 'Рекомендация'
        WEBSITE = 'website', 'Сайт'
        WALKIN = 'walkin', 'Личный визит'
        OTHER = 'other', 'Другое'

    atelier_name = models.CharField(max_length=255)
    address = models.CharField(max_length=255, blank=True)
    contact_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=50)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.OTHER)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.CONTACTED)
    first_contact_date = models.DateField()
    next_contact_date = models.DateField(null=True, blank=True)
    # created_at/updated_at из AuditedModel


class LeadContactLog(models.Model):
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='logs')
    date = models.DateTimeField(auto_now_add=True)
    note = models.TextField()
```

`Source` — тот же набор значений, что у `atelier_erp.models.Task.Source` (не общий код, просто согласованные строки), чтобы поле было готово принять источник вида "заявка пришла из WhatsApp", когда появится автосбор.

`declined_interested` — отдельное значение статуса, а не флаг поверх `declined`, чтобы в списке/фильтре admin было видно одной строкой без комбинирования полей.

## Admin UI

`LeadAdmin`:
- `list_display`: atelier_name, phone, status, next_contact_date, first_contact_date
- `list_filter`: status, source
- `search_fields`: atelier_name, phone
- `ordering`: next_contact_date (просроченные напоминания — сверху)
- `LeadContactLogInline` (TabularInline, readonly `date`, редактируемый `note`) — прямо на карточке лида, без перехода на отдельный экран

## Доступ

`LeadAdmin` переопределяет `has_module_permission`, `has_view_permission`, `has_add_permission`, `has_change_permission`, `has_delete_permission` — все возвращают `request.user.is_superuser`. Не полагаемся на дефолтную Django-permission-модель (Owner/другие роли ERP могут иметь `is_staff=True` для входа в admin по другим причинам) — раздел должен быть невидим и недоступен всем, кроме суперюзера, независимо от группы.

## Тестирование

Один тест: пользователь без `is_superuser` не видит `Lead` в списке моделей admin и получает 403/редирект при прямом переходе на URL admin-страницы лида.

Больше тестов не требуется — раздел admin-only, API/фронтенд/мобилка не затронуты.

## Вне скоупа

- Автосбор лидов из мессенджеров (WhatsApp/Instagram/Telegram) для владельцев ателье — отдельная большая фича, другой контур данных (тенантные лиды клиентов ателье, не лиды самого Sheber).
- Автоматический расчёт "пора дёрнуть" (уведомления/email) — сейчас это просто сортировка по `next_contact_date` в admin, вручную.
- API-эндпоинты — не нужны, доступ только через Django admin.

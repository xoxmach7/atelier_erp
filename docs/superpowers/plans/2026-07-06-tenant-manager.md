# Tenant-Safe Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Устранить структурный риск утечки данных между тенантами (как это уже произошло с моделью `Task`) за счёт переноса tenant-фильтрации с уровня DRF ViewSet на уровень менеджера модели — так, чтобы `Model.objects.all()` физически не мог вернуть чужие данные, независимо от того, вспомнил ли разработчик ViewSet вызвать `scope_to_tenant()`.

**Architecture:** Middleware кладёт текущий tenant в `contextvars.ContextVar` (а не только в `request.tenant`, который виден только внутри DRF-запроса). Новый `TenantManager` — менеджер модели, у которого `get_queryset()` фильтрует по этому contextvar. Модели с прямым FK `tenant` получают `objects = TenantManager()` вместо дефолтного `objects = models.Manager()`. Существующий `TenantModelMixin` в `tenant_utils.py` остаётся, но упрощается — фильтрация дублируется на двух уровнях временно (defense in depth), затем миксин используется только для `perform_create`. Superuser без tenant (Railway shell/админка) видит всё — сохраняем текущее поведение через `ContextVar` со значением-сентинелом.

**Tech Stack:** Django 4.2 ORM custom managers, `contextvars.ContextVar` (thread-safe и async-safe, в отличие от `threading.local`), существующий `TenantMiddleware` (`atelier_erp/middleware.py`).

---

## Контекст кодовой базы (прочитать перед началом)

- `atelier_erp/middleware.py` — `TenantMiddleware.__call__` кладёт `request.tenant` как `SimpleLazyObject`, резолвится через `user.tenant_membership.tenant`.
- `atelier_erp/tenant_utils.py` — `TenantModelMixin.scope_to_tenant(qs)` — текущий (хрупкий) механизм: работает только если ViewSet вызывает его явно.
- Модели с прямым FK `tenant`: `Customer` (models.py:80), `InventoryItem` (models.py:334), `Order` (models.py:442), `Task` (models.py:1089), `ProductionAssignment` (models.py:1427), `SeamstressPayment` (models.py:1518), `NumberSequence` (models.py:1656).
- Модели БЕЗ прямого FK, тенант через `order__tenant` (`TenantViaOrderMixin`): `Payment`, `Quote`, `Measurement` — их в этот план НЕ включаем (менеджер для них не годится, там нет прямого поля `tenant`).
- Тестовый прогон: `python manage.py test --settings=atelier_erp.settings_test atelier_erp.tests.test_order_lifecycle_v1_api atelier_erp.tests.test_role_access atelier_erp.tests.test_p1_security_numbering` — должен оставаться зелёным (41 тест) после каждого шага.
- Правило репо: **не коммитить без явного одобрения пользователя** — после каждого Task показывать `git diff --stat` и ждать подтверждения, только затем коммит (см. CLAUDE.md).

---

## Task 1: ContextVar для текущего tenant + обновление middleware

**Files:**
- Create: `atelier_erp/tenant_context.py`
- Modify: `atelier_erp/middleware.py`
- Test: `atelier_erp/tests/test_tenant_context.py`

- [ ] **Step 1: Написать падающий тест**

```python
# atelier_erp/tests/test_tenant_context.py
from django.test import TestCase
from atelier_erp.tenant_context import get_current_tenant_id, set_current_tenant_id, reset_current_tenant_id


class TenantContextTests(TestCase):
    def test_default_is_none(self):
        self.assertIsNone(get_current_tenant_id())

    def test_set_and_get(self):
        token = set_current_tenant_id(42)
        try:
            self.assertEqual(get_current_tenant_id(), 42)
        finally:
            reset_current_tenant_id(token)
        self.assertIsNone(get_current_tenant_id())

    def test_superuser_sentinel_bypasses_filter(self):
        token = set_current_tenant_id('__ALL__')
        try:
            self.assertEqual(get_current_tenant_id(), '__ALL__')
        finally:
            reset_current_tenant_id(token)
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `python manage.py test --settings=atelier_erp.settings_test atelier_erp.tests.test_tenant_context -v 2`
Expected: FAIL с `ModuleNotFoundError: No module named 'atelier_erp.tenant_context'`

- [ ] **Step 3: Реализовать `tenant_context.py`**

```python
"""
ContextVar для текущего tenant запроса.

В отличие от threading.local, contextvars.ContextVar корректно работает
и в sync, и в async Django-обработчиках, и не «утекает» между потоками
в пуле воркеров (Gunicorn sync workers создают новый контекст на запрос).

Значение:
  None       — тенант не определён (анонимный запрос, тенанты не настроены)
  '__ALL__'  — сентинел «показывать всё» (только для superuser без tenant,
               например Railway manage.py shell / админка)
  int        — id конкретного Tenant
"""
from __future__ import annotations

import contextvars
from typing import Optional, Union

TenantContextValue = Union[int, str, None]

ALL_TENANTS = '__ALL__'

_current_tenant_id: contextvars.ContextVar[TenantContextValue] = contextvars.ContextVar(
    'current_tenant_id', default=None
)


def get_current_tenant_id() -> TenantContextValue:
    return _current_tenant_id.get()


def set_current_tenant_id(value: TenantContextValue) -> contextvars.Token:
    return _current_tenant_id.set(value)


def reset_current_tenant_id(token: contextvars.Token) -> None:
    _current_tenant_id.reset(token)
```

- [ ] **Step 4: Запустить тест и убедиться, что он проходит**

Run: `python manage.py test --settings=atelier_erp.settings_test atelier_erp.tests.test_tenant_context -v 2`
Expected: PASS, 3 теста

- [ ] **Step 5: Обновить `TenantMiddleware`, чтобы он также выставлял ContextVar**

Прочитать текущий `atelier_erp/middleware.py` целиком перед правкой (36 строк, уже приведён выше в контексте).

```python
"""
TenantMiddleware — определяет тенант текущего запроса из JWT и
прикрепляет его к request.tenant, а также кладёт id тенанта в
ContextVar (atelier_erp.tenant_context), который читает TenantManager
на уровне ORM — это даёт защиту от утечки данных между тенантами
даже там, где ViewSet забыл вызвать scope_to_tenant().

Работает ПОСЛЕ AuthenticationMiddleware / JWT-аутентификации DRF,
поэтому использует lazy-резолв: tenant подгружается только при первом
обращении к request.tenant.
"""

from __future__ import annotations
from django.utils.functional import SimpleLazyObject

from atelier_erp.tenant_context import (
    ALL_TENANTS,
    set_current_tenant_id,
    reset_current_tenant_id,
)


def _get_tenant(request):
    """Вернуть Tenant для текущего запроса или None."""
    from atelier_erp.models import TenantMembership

    user = getattr(request, '_cached_user', None) or getattr(request, 'user', None)
    if user is None or not user.is_authenticated:
        return None

    try:
        return user.tenant_membership.tenant
    except TenantMembership.DoesNotExist:
        return None


class TenantMiddleware:
    """Добавляет request.tenant (Tenant | None) к каждому запросу
    и выставляет ContextVar для ORM-уровня фильтрации."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.tenant = SimpleLazyObject(lambda: _get_tenant(request))

        # ContextVar должен быть выставлен ДО того, как view начнёт делать
        # ORM-запросы. request.tenant — ленивый, поэтому резолвим его здесь
        # явно (после AuthenticationMiddleware user уже известен).
        tenant = _get_tenant(request)
        user = getattr(request, 'user', None)

        if tenant is not None:
            token = set_current_tenant_id(tenant.id)
        elif user is not None and getattr(user, 'is_authenticated', False) and getattr(user, 'is_superuser', False):
            # Суперюзер без tenant membership (Railway shell/админка) — видит всё.
            token = set_current_tenant_id(ALL_TENANTS)
        else:
            # Тенант не определён — single-tenant режим, данные с tenant=None.
            token = set_current_tenant_id(None)

        try:
            response = self.get_response(request)
        finally:
            reset_current_tenant_id(token)

        return response
```

**Важное замечание про порядок:** `_get_tenant(request)` дергается дважды (один раз для `request.tenant` lazy-обёртки, один раз явно) — это то же поведение, что было раньше (ленивая обёртка всё равно вызовет `_get_tenant` при первом обращении, а вызов здесь — не ленивый, чтобы successfully проставить contextvar до входа во view). Небольшой двойной запрос к БД (`user.tenant_membership`) допустим — Django кеширует related-объект на `user`, повторный доступ через `tenant_membership` не бьёт в БД второй раз в рамках одного request/user instance. Если профайлинг покажет накладные расходы — можно передать уже посчитанный `tenant` в лямбду `SimpleLazyObject(lambda: tenant)`.

- [ ] **Step 6: Прогнать полный тестовый набор**

Run: `python manage.py test --settings=atelier_erp.settings_test atelier_erp.tests.test_order_lifecycle_v1_api atelier_erp.tests.test_role_access atelier_erp.tests.test_p1_security_numbering atelier_erp.tests.test_tenant_context -v 2`
Expected: OK, 44 теста (41 существующих + 3 новых)

- [ ] **Step 7: Показать diff и закоммитить (после одобрения пользователя)**

```bash
git diff --stat
# показать пользователю, дождаться подтверждения
git add atelier_erp/tenant_context.py atelier_erp/middleware.py atelier_erp/tests/test_tenant_context.py
git commit -m "feat(tenant): добавить ContextVar для текущего tenant на уровне ORM

Middleware теперь выставляет id тенанта в contextvars.ContextVar в
дополнение к request.tenant — это подготовка для TenantManager,
который будет фильтровать queryset на уровне модели, а не только
там, где ViewSet явно вызывает scope_to_tenant()."
```

---

## Task 2: `TenantManager` — менеджер модели с автоматической фильтрацией

**Files:**
- Modify: `atelier_erp/tenant_utils.py`
- Test: `atelier_erp/tests/test_tenant_manager.py`

- [ ] **Step 1: Написать падающий тест**

Тест создаёт два `Tenant`, по клиенту `Customer` в каждом, и проверяет, что `Customer.objects.all()` возвращает только клиента текущего tenant (через contextvar), а без tenant в контексте — только записи с `tenant=None`.

```python
# atelier_erp/tests/test_tenant_manager.py
from django.test import TestCase

from atelier_erp.models import Customer, Tenant
from atelier_erp.tenant_context import ALL_TENANTS, set_current_tenant_id, reset_current_tenant_id


class TenantManagerTests(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(name='Ателье А', slug='atelier-a')
        self.tenant_b = Tenant.objects.create(name='Ателье Б', slug='atelier-b')

        self.customer_a = Customer.objects.create(
            name='Клиент А', phone='+79990000001', tenant=self.tenant_a
        )
        self.customer_b = Customer.objects.create(
            name='Клиент Б', phone='+79990000002', tenant=self.tenant_b
        )
        self.customer_none = Customer.objects.create(
            name='Клиент без тенанта', phone='+79990000003', tenant=None
        )

    def test_filters_by_current_tenant(self):
        token = set_current_tenant_id(self.tenant_a.id)
        try:
            names = set(Customer.objects.values_list('name', flat=True))
        finally:
            reset_current_tenant_id(token)
        self.assertEqual(names, {'Клиент А'})

    def test_other_tenant_isolated(self):
        token = set_current_tenant_id(self.tenant_b.id)
        try:
            names = set(Customer.objects.values_list('name', flat=True))
        finally:
            reset_current_tenant_id(token)
        self.assertEqual(names, {'Клиент Б'})

    def test_no_tenant_context_shows_null_tenant_rows(self):
        token = set_current_tenant_id(None)
        try:
            names = set(Customer.objects.values_list('name', flat=True))
        finally:
            reset_current_tenant_id(token)
        self.assertEqual(names, {'Клиент без тенанта'})

    def test_all_tenants_sentinel_shows_everything(self):
        token = set_current_tenant_id(ALL_TENANTS)
        try:
            names = set(Customer.objects.values_list('name', flat=True))
        finally:
            reset_current_tenant_id(token)
        self.assertEqual(names, {'Клиент А', 'Клиент Б', 'Клиент без тенанта'})

    def test_unfiltered_manager_still_available_for_admin(self):
        # Явный «сырой» доступ без tenant-фильтра — нужен для админки/миграций данных.
        token = set_current_tenant_id(self.tenant_a.id)
        try:
            count = Customer.all_tenants.count()
        finally:
            reset_current_tenant_id(token)
        self.assertEqual(count, 3)
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `python manage.py test --settings=atelier_erp.settings_test atelier_erp.tests.test_tenant_manager -v 2`
Expected: FAIL — `Customer.objects.all()` возвращает все 3 записи независимо от contextvar (менеджера ещё нет), и `Customer.all_tenants` не существует (AttributeError).

- [ ] **Step 3: Добавить `TenantManager` в `atelier_erp/tenant_utils.py`**

Дописать в конец файла (после существующих `TenantModelMixin`/`TenantViaOrderMixin`, ничего не удалять):

```python
from django.db import models

from atelier_erp.tenant_context import ALL_TENANTS, get_current_tenant_id


class TenantManager(models.Manager):
    """
    Менеджер модели, фильтрующий по текущему tenant (из ContextVar).

    Используется как ОСНОВНОЙ менеджер (`objects`) на моделях с прямым
    полем `tenant`. Это защита на уровне ORM: `Model.objects.all()`
    физически не может вернуть чужие данные, в отличие от DRF-миксина
    TenantModelMixin, который защищает только ViewSet'ы, явно его
    вызывающие (см. инцидент с TaskViewSet, где фильтрация была пропущена).

    Правила:
      - contextvar == '__ALL__' (суперюзер без tenant, Railway shell) → без фильтра.
      - contextvar == None (тенанты не настроены / анонимный контекст,
        например management-команда, запущенная не через HTTP) →
        показываем строки с tenant=None (совместимость с single-tenant
        данными, как и раньше в TenantModelMixin.scope_to_tenant).
      - contextvar == <id> → filter(tenant_id=<id>).

    Для «сырого» доступа без фильтра (админка, скрипты миграции данных)
    использовать `Model.all_tenants` — см. TenantManagerMixin ниже.
    """

    def get_queryset(self):
        qs = super().get_queryset()
        tenant_id = get_current_tenant_id()

        if tenant_id == ALL_TENANTS:
            return qs
        if tenant_id is None:
            return qs.filter(tenant__isnull=True)
        return qs.filter(tenant_id=tenant_id)


class TenantManagerMixin(models.Model):
    """
    Miксин для моделей с полем tenant: добавляет `objects` (отфильтрованный
    TenantManager) и `all_tenants` (обычный Manager без фильтра — для
    админки, дата-миграций, superuser-скриптов).

    Использование:
        class Customer(TenantManagerMixin, UUIDModel, TimestampedModel):
            tenant = models.ForeignKey(...)
            ...

    ВАЖНО: порядок менеджеров имеет значение в Django — первый объявленный
    менеджер класса становится default manager. Объявляем `objects` первым.
    """

    objects = TenantManager()
    all_tenants = models.Manager()

    class Meta:
        abstract = True
```

- [ ] **Step 4: Подключить миксин к модели `Customer` (пилотная модель для первой итерации)**

Modify: `atelier_erp/models.py` — найти `class Customer(UUIDModel, TimestampedModel):` (строка 66) и изменить на:

```python
class Customer(TenantManagerMixin, UUIDModel, TimestampedModel):
```

Добавить импорт в начало `models.py` (рядом с другими импортами `atelier_erp`):

```python
from atelier_erp.tenant_utils import TenantManagerMixin
```

**Проверить порядок MRO**: `TenantManagerMixin` объявляет `objects`/`all_tenants`, `UUIDModel`/`TimestampedModel` — обычные abstract-миксины без своих менеджеров, конфликта не будет. Убедиться при чтении `models.py:22-65`, что `UUIDModel`/`TimestampedModel` не объявляют `objects` сами (просмотреть эти строки перед правкой).

- [ ] **Step 5: Сгенерировать и применить миграцию (если Django считает это изменением)**

Run: `python manage.py makemigrations atelier_erp --settings=atelier_erp.settings_test --check --dry-run`

Изменение менеджера обычно НЕ требует миграции (это не изменение поля), но нужно проверить — если Django предложит миграцию (например, из-за `Meta.abstract` перестановки), внимательно прочитать её перед принятием, что не переставляет она проверку `AddField`/`RemoveField` по ошибке.

Expected: "No changes detected" (наиболее вероятный исход) — иначе применить `makemigrations` и внимательно вычитать сгенерированный файл перед `migrate`.

- [ ] **Step 6: Запустить тест и убедиться, что он проходит**

Run: `python manage.py test --settings=atelier_erp.settings_test atelier_erp.tests.test_tenant_manager -v 2`
Expected: PASS, 5 тестов

- [ ] **Step 7: Прогнать полный тестовый набор + системную проверку**

Run:
```bash
python manage.py check --settings=atelier_erp.settings_test
python manage.py test --settings=atelier_erp.settings_test atelier_erp.tests.test_order_lifecycle_v1_api atelier_erp.tests.test_role_access atelier_erp.tests.test_p1_security_numbering atelier_erp.tests.test_tenant_context atelier_erp.tests.test_tenant_manager -v 2
```
Expected: `check` — 0 issues; тесты — OK, 49 тестов

- [ ] **Step 8: Показать diff и закоммитить (после одобрения пользователя)**

```bash
git diff --stat
# показать пользователю, дождаться подтверждения
git add atelier_erp/tenant_utils.py atelier_erp/models.py atelier_erp/tests/test_tenant_manager.py
git commit -m "feat(tenant): TenantManager — фильтрация по tenant на уровне ORM

Customer.objects теперь фильтруется по текущему tenant автоматически,
на уровне менеджера модели, а не только там, где DRF ViewSet явно
вызывает scope_to_tenant(). Customer.all_tenants — сырой доступ без
фильтра для админки/скриптов. Пилотная модель — остальные с прямым
tenant FK (InventoryItem, Order, Task, ProductionAssignment,
SeamstressPayment) переводятся в отдельных задачах."
```

---

## Task 3: Раскатать `TenantManagerMixin` на остальные модели с прямым FK `tenant`

**Files:**
- Modify: `atelier_erp/models.py` (5 моделей)
- Test: `atelier_erp/tests/test_tenant_manager.py` (дополнить)

Модели: `InventoryItem` (models.py:334), `Order` (models.py:442), `Task` (models.py:1089), `ProductionAssignment` (models.py:1427), `SeamstressPayment` (models.py:1518). `NumberSequence` (models.py:1656) — намеренно НЕ включаем в этот шаг: у него своя логика атомарной нумерации (P1), риск регрессии выше пользы, обсудить отдельно.

- [ ] **Step 1: Дописать тесты по образцу Task 2 для `Order` (самая используемая модель) в `test_tenant_manager.py`**

```python
class OrderTenantManagerTests(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(name='Ателье А2', slug='atelier-a2')
        self.tenant_b = Tenant.objects.create(name='Ателье Б2', slug='atelier-b2')
        # Order требует customer — создаём минимально валидные записи по
        # образцу существующих фикстур в atelier_erp/tests/test_order_lifecycle_v1_api.py
        # (прочитать этот файл перед написанием фикстуры, чтобы не дублировать
        # обязательные поля вручную — использовать тот же helper/factory, если он там есть).
        ...

    def test_order_isolated_by_tenant(self):
        ...
```

**Примечание для исполняющего эту задачу**: перед написанием фикстур `Order` прочитать `atelier_erp/tests/test_order_lifecycle_v1_api.py` целиком — там наверняка уже есть helper для создания валидного заказа (обязательные поля, `NumberSequence` и т.п.), его и переиспользовать, а не изобретать заново.

- [ ] **Step 2: Запустить новые тесты, убедиться, что падают** (менеджер ещё не подключён к `Order`)

- [ ] **Step 3: Подключить `TenantManagerMixin` к каждой из 5 моделей**

Для каждой модели — заменить объявление класса, добавить миксин первым в списке родителей (порядок важен для MRO менеджеров), например:

```python
class InventoryItem(TenantManagerMixin, UUIDModel, AuditedModel):
class Order(TenantManagerMixin, UUIDModel, AuditedModel):
class Task(TenantManagerMixin, UUIDModel, AuditedModel):
class ProductionAssignment(TenantManagerMixin, UUIDModel, AuditedModel):
class SeamstressPayment(TenantManagerMixin, UUIDModel, AuditedModel):
```

Перед каждой правкой прочитать точное текущее объявление класса (Read models.py в районе указанной строки), чтобы не потерять существующие родительские классы.

- [ ] **Step 4: Проверить, не используется ли где-то в кодовой базе кастомный `Meta.ordering`/`Manager` на этих моделях, который может конфликтовать**

Run: `grep -n "class Meta" atelier_erp/models.py` — свериться, что `Meta` внутри каждой из 5 моделей не объявляет ничего, что ломается от смены базового набора родителей (в частности `abstract`, `ordering` не зависят от менеджера — конфликтов не ожидается, но проверить визуально).

- [ ] **Step 5: `makemigrations --check --dry-run`, ожидаем "No changes detected"**

- [ ] **Step 6: Прогнать все тесты, включая уже существующие 49 + новые**

Run: `python manage.py test --settings=atelier_erp.settings_test atelier_erp.tests -v 2`

**Важно**: если полный прогон `atelier_erp.tests` шире, чем 4 модуля из CLAUDE.md (там упоминается расхождение — часть тестов падает из-за отсутствующего `pytest` в окружении, не из-за наших изменений) — сузить до модулей, которые реально проходят на этой машине:

```bash
python manage.py test --settings=atelier_erp.settings_test \
  atelier_erp.tests.test_order_lifecycle_v1_api \
  atelier_erp.tests.test_role_access \
  atelier_erp.tests.test_p1_security_numbering \
  atelier_erp.tests.test_tenant_context \
  atelier_erp.tests.test_tenant_manager
```
Expected: OK, все тесты зелёные, включая тесты по `Order`.

- [ ] **Step 7: Ручная smoke-проверка через `manage.py shell`, что старое поведение (single-tenant, tenant=None) не сломалось**

```bash
python manage.py shell --settings=atelier_erp.settings_test -c "
from atelier_erp.tenant_context import set_current_tenant_id
from atelier_erp.models import Order
set_current_tenant_id(None)
print('orders with tenant=None visible via objects:', Order.objects.count())
print('all orders via all_tenants:', Order.all_tenants.count())
"
```
Expected: оба числа совпадают, если в БД пока нет multi-tenant данных (ожидаемо на dev/test окружении).

- [ ] **Step 8: Показать diff и закоммитить (после одобрения пользователя)**

```bash
git diff --stat
# показать пользователю, дождаться подтверждения
git add atelier_erp/models.py atelier_erp/tests/test_tenant_manager.py
git commit -m "feat(tenant): раскатать TenantManager на Order/Task/InventoryItem/ProductionAssignment/SeamstressPayment

Теперь Model.objects.all() для всех моделей с прямым tenant FK
физически не может вернуть данные другого тенанта — фильтрация на
уровне ORM-менеджера, а не только в DRF ViewSet. NumberSequence
намеренно не тронут (отдельная задача из-за завязки на P1
атомарную нумерацию)."
```

---

## Task 4: Упростить `TenantModelMixin` — убрать дублирующую ручную фильтрацию там, где менеджер уже защищает

**Files:**
- Modify: `atelier_erp/tenant_utils.py`
- Modify: `atelier_erp/api/v1/views.py` (ViewSet'ы для 5 моделей из Task 3)
- Test: существующие `test_role_access.py`, `test_order_lifecycle_v1_api.py` должны остаться зелёными без изменений (регрессионная защита)

Контекст: после Task 3 `scope_to_tenant()`, вызываемый вручную в `get_queryset()` каждого ViewSet, стал избыточным для чтения (менеджер уже фильтрует), но **не избыточным для `perform_create`** (там нужно проставить `tenant` при сохранении — это не задача менеджера).

- [ ] **Step 1: Прочитать все текущие вызовы `scope_to_tenant` в `views.py`**

Run: `grep -n "scope_to_tenant\|TenantModelMixin\|TenantViaOrderMixin" atelier_erp/api/v1/views.py`

Ожидаемо найти: `OrderViewSet`, `CustomerViewSet`, `TaskViewSet`, `InventoryItemViewSet`, и, возможно, другие. Выписать точный список строк перед правкой — не менять вслепую.

- [ ] **Step 2: Для каждого ViewSet, чья модель теперь под `TenantManagerMixin` (Customer, Order, Task, InventoryItem, ProductionAssignment, SeamstressPayment) — упростить `get_queryset()`**

Пример для `TaskViewSet` (текущий код после исправления в предыдущей сессии):

```python
def get_queryset(self):
    return self.scope_to_tenant(Task.objects.all().order_by('-created_at'))
```

Меняем на (менеджер уже фильтрует `Task.objects`, `scope_to_tenant` теперь defense-in-depth — оставляем ЕГО НЕ убираем полностью, а документируем, что это двойная защита, а не дублирование по ошибке):

```python
def get_queryset(self):
    # Task.objects уже отфильтрован TenantManager на уровне ORM (см.
    # tenant_utils.TenantManagerMixin). scope_to_tenant() здесь — вторая
    # линия защиты (defense in depth): если контекстvar по какой-то причине
    # не был выставлен (например, вызов вне HTTP-запроса), он всё равно
    # применит фильтр через request.tenant.
    return self.scope_to_tenant(Task.objects.all().order_by('-created_at'))
```

**Не удалять `scope_to_tenant()` вызовы** — оставить как есть, только уточнить комментарии. Цель этой задачи — не "упростить" за счёт удаления защиты, а зафиксировать документацией, что теперь есть два независимых уровня, и явно унести это понимание в код, чтобы будущий разработчик не удалил один из уровней, думая, что он "дублирующий мусор".

- [ ] **Step 3: Обновить docstring `TenantModelMixin` в `tenant_utils.py`, отразив новую роль (perform_create + defense-in-depth для чтения)**

```python
class TenantModelMixin:
    """Mixin для DRF ViewSet — изолирует данные по тенанту.

    С введением TenantManager (см. TenantManagerMixin выше) фильтрация
    чтения для моделей с прямым tenant FK теперь происходит УЖЕ на уровне
    ORM-менеджера — Model.objects.all() сам по себе безопасен. Вызов
    scope_to_tenant() в get_queryset() ViewSet'а остаётся как вторая линия
    защиты (defense in depth) и остаётся ОБЯЗАТЕЛЬНЫМ для моделей без
    прямого tenant FK (Payment, Quote, Measurement — см.
    TenantViaOrderMixin), для которых менеджер не применяется.

    perform_create() остаётся единственным местом, которое проставляет
    tenant при создании — это менеджер сделать не может.
    """
    ...
```

- [ ] **Step 4: Прогнать все тесты**

Run: `python manage.py test --settings=atelier_erp.settings_test atelier_erp.tests.test_order_lifecycle_v1_api atelier_erp.tests.test_role_access atelier_erp.tests.test_p1_security_numbering atelier_erp.tests.test_tenant_context atelier_erp.tests.test_tenant_manager -v 2`
Expected: OK, все тесты по-прежнему зелёные (изменения — только комментарии, поведение не меняется)

- [ ] **Step 5: Показать diff и закоммитить (после одобрения пользователя)**

```bash
git diff --stat
git add atelier_erp/tenant_utils.py atelier_erp/api/v1/views.py
git commit -m "docs(tenant): задокументировать двухуровневую tenant-защиту (manager + mixin)

Уточнить, что TenantManager (ORM-уровень) и TenantModelMixin.scope_to_tenant
(DRF-уровень) теперь работают как defense-in-depth, а не дублирование по
недосмотру — чтобы будущие правки не удалили один из уровней по ошибке."
```

---

## Self-Review

**Spec coverage:**
- ContextVar вместо threading.local — Task 1. ✅
- TenantManager на уровне модели — Task 2. ✅
- Раскатка на все модели с прямым tenant FK — Task 3. ✅
- Superuser-сентинел `__ALL__` — Task 1 (middleware) + Task 2 (тест `test_all_tenants_sentinel_shows_everything`). ✅
- Сохранение текущего поведения `TenantModelMixin.perform_create` — Task 4 (явно не трогаем). ✅
- `NumberSequence` — намеренно исключён из Task 3 с обоснованием (завязка на P1 атомарную нумерацию, отдельное обсуждение). ✅
- Модели через `order__tenant` (Payment/Quote/Measurement) — намеренно исключены, `TenantManager` для них неприменим (нет прямого FK) — задокументировано в Task 4 Step 3.

**Placeholder scan:** пройден — везде даны конкретные тестовые фикстуры или явное указание "прочитать существующий helper в файле X перед написанием" вместо абстрактного "написать тесты".

**Type consistency:** `get_current_tenant_id`/`set_current_tenant_id`/`reset_current_tenant_id` используются одинаково во всех задачах; `TenantManagerMixin`/`TenantManager` — имена согласованы между Task 2, 3, 4.

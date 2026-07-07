# Mobile: подключить роли Швея/Монтажник к реальному API — дизайн

> Статус проекта на момент написания: 1 пилотный клиент, backend полностью поддерживает роли Production/Installer (work queues, `/execution/`, `change-production-stage`, `change-handover-stage`, upload фото/АВР). Веб-фронтенд эти данные уже потребляет корректно. Мобилка — нет.

## Проблема

CLAUDE.md утверждает, что "Mobile роли Пошив/Установка под Figma" — ещё не сделанный, следующий блок (M1). Аудит кода показал обратное: экраны `act.tsx` (АВР), `photos.tsx` (фотоотчёт), `materials.tsx` (склад) и API-функции (`changeProductionStage`, `changeHandoverStage`, `uploadPhotoReport`, `uploadSignedAct`) уже реализованы и корректно проверяют роль пользователя (`canEdit`/`canUpload` по `primaryRole`).

Реальная причина, по которой швея и монтажник не могут пользоваться мобилкой (со слов владельца):
1. **Нет точки входа.** Общий экран деталей заказа (`mobile/app/orders/[id].tsx`) — дизайнерский/владельческий вид (замеры, КП, редактирование). Он читает `primaryRole` из контекста, но нигде не использует его для ветвления UI. Нет ссылок на `/act`, `/photos`, нет кнопки смены этапа пошива. Тапнув на задачу в `work.tsx`, швея/монтажник попадают в тот же неподходящий для них экран.
2. **Расхождение API-контракта.** TypeScript-тип `OrderExecution` в `mobile/src/api/orders.ts` описывает **плоскую** структуру ответа (`items_to_sew` и `actions.can_start_sewing` на верхнем уровне). Реальный ответ `GET /api/v1/orders/{id}/execution/` (см. `OrderExecutionService.get_order_execution_summary`) — **вложенный**: данные для швеи лежат в `role_sections.production.items_to_sew`, для монтажника — в `role_sections.installer.order_items` (не `items_to_install`, как ожидает мобильный тип), список доступных действий — в `available_actions` (массив объектов `{action, label, target_status, disabled_reason}`), а не в `actions.can_*` булевых флагах.
   - Веб-фронтенд (`frontend/src/types/index.ts`, `OrderExecutionDTO`/`RoleSectionsDTO`) уже описывает контракт правильно и потребляет его без проблем — это эталон для копирования в мобилку.
3. **Мобилка не тестировалась на реальном устройстве** — только Expo Go/симулятор, что могло скрыть проблемы с layout/сетью, которые не всплывают в собранном коде.

## Что НЕ нужно строить с нуля

- Backend: `ProductionWorkQueueView`, `InstallationWorkQueueView`, `/execution/`, `change-production-stage`, `change-handover-stage`, upload фото/АВР — всё уже работает, изменений не требует.
- `mobile/app/orders/[id]/act.tsx`, `photos.tsx` — уже реализованы, проверяют роль, вызывают правильные API-функции. Не трогаем.
- `mobile/src/api/orders.ts` — сами функции (`changeProductionStage`, `changeHandoverStage`, `fetchCompletionAct`, `uploadSignedAct`, `uploadPhotoReport`) уже существуют и корректны. Меняется только **тип** `OrderExecution`.

## Дизайн

### 1. Исправить тип `OrderExecution` в мобилке

В `mobile/src/api/orders.ts` заменить текущее определение `OrderExecution` на структуру, зеркальную `frontend/src/types/index.ts` (`OrderExecutionDTO` + `RoleSectionsDTO` + `ProductionItemDTO` + `ProductionAssignmentDTO` + `AvailableActionDTO` + `WarningDTO` + `NextStepDTO` + `PhotoReportSummaryDTO`). Ключевое отличие от старого мобильного типа:
- `items_to_sew`/`order_items` переезжают внутрь `role_sections.production`/`role_sections.installer` соответственно.
- `actions.can_*` заменяются на `available_actions: AvailableActionDTO[]` — массив, а не набор булевых флагов.
- Поле у монтажника называется `order_items`, не `items_to_install` (несмотря на то, что старый мобильный тип и текущий backend-комментарий в `views.py` используют разную терминологию — код сервиса, который реально отдаёт JSON, авторитетен).

Никакой логики не меняется — только форма данных, которую ожидает TypeScript. Это устраняет расхождение №2.

### 2. Ветвление экрана деталей заказа по роли

В `mobile/app/orders/[id].tsx`:
- Оставить текущий рендер (замеры/КП/редактирование) как есть — он выполняется только при `primaryRole === 'owner' || primaryRole === 'designer'` (или как дефолт/fallback, если роль не входит в специальный список — не блокировать доступ явно неизвестным ролям).
- Добавить два новых early-return блока рендера **до** существующего JSX:
  - `primaryRole === 'production'`: рендерит компактный список `data.role_sections.production.items_to_sew` (комната, ткань, тюль, размеры — по аналогии с `WorkTaskRow`/существующими карточками в проекте, не изобретать новый визуальный язык) + одна кнопка действия. Кнопка ищет в `data.available_actions` элемент с `action` вроде `start_sewing`/`mark_production_done` (**точные значения `action` подтвердить чтением `OrderExecutionService.get_available_actions` перед реализацией, не гадать**) и вызывает `changeProductionStage(orderId, targetStage)`, где `targetStage` берётся из `target_status` найденного action.
  - `primaryRole === 'installer'`: рендерит список `data.role_sections.installer.order_items` (комната, окно, ткань, размеры) + две кнопки-ссылки: `router.push('/orders/${id}/photos')` и `router.push('/orders/${id}/act')`. Никакой upload-логики здесь — только навигация.
- Оба новых блока используют уже загруженный `fetchOrderExecution` результат (`data` в текущем коде) — **не делать отдельный вызов work-queue API**, `/execution/` уже возвращает всё нужное через `role_sections`.
- Если соответствующий список пуст — показать существующий компонент `EmptyState` с уместным текстом ("Нет изделий в этом заказе" и т.п.), не падать и не показывать пустой экран без объяснения.

### 3. Обработка ошибок

Экран уже имеет общий `error`/retry-паттерн (строки 76-83 текущего файла) — новые ролевые блоки переиспользуют его, отдельной обработки ошибок не требуется.

### 4. Тестирование

- Юнит-уровень: TypeScript должен компилироваться без `any`/`as` хаков после смены типа (`tsc` в мобилке должен остаться на 0 ошибок, как отмечено в CLAUDE.md).
- **Обязательный ручной прогон на реальном Android/iOS устройстве** (не Expo Go в симуляторе, а собранная сборка или Expo Go на физическом телефоне) под учётками `seamstress`/`installer` из `seed_pilot`, на реальном пилотном заказе в статусе `in_production`/`ready`. Это правило, а не опция — исходная проблема была обнаружена именно из-за отсутствия такого прогона.

## Риски / открытые вопросы для реализации

- Точные строковые значения `action` в `available_actions` для "начать пошив"/"пошив готов"/"передать на установку" нужно прочитать из `OrderExecutionService.get_available_actions` (не открывал в рамках этого дизайна) — план реализации должен явно включать шаг чтения этого метода перед написанием кнопки.
- `ProductionStage`/`HandoverStage` enum-значения (`not_started`, `cutting`, `sewing`, `quality_check`, `done` и т.д., судя по `ChangeProductionStageRequest` в веб-типах) — нужно свериться, что кнопка предлагает переход только на следующий валидный этап, а не произвольный.

## Явно вне рамок этой задачи

- Разбивка/устранение расхождений между `order_execution_service.py` docstring-комментарием ("items to sew" vs фактическое поле `items_to_sew`, но у монтажника `order_items` вместо ожидаемого по аналогии `items_to_install`) — переименовывать поля бэкенда не нужно, раз веб уже работает с текущими именами.
- Редизайн визуального стиля карточек — переиспользуем существующие компоненты (`WorkTaskRow`, `EmptyState`, стили `theme/`), не создаём новую дизайн-систему.
- Обновление CLAUDE.md статуса M1 — сделать отдельным шагом после того, как это реально заработает и будет протестировано на устройстве.

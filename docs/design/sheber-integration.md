# Sheber ERP — Как добавить в проект

## Структура файлов в прототипе

Прототип `sheber-erp.jsx` — это один файл со всеми экранами.
В реальном проекте он разбивается на компоненты.

---

## 1. Где что лежит в прототипе

| Функция | В прототипе | В твоём проекте |
|---------|------------|-----------------|
| Стили (CSS переменные) | `const G = () => <style>` | `globals.css` или `tailwind.config.ts` |
| Общие компоненты | `Btn`, `Badge`, `Card`, `Modal` | `components/ui/` |
| Экраны | `S01_Login`, `S02_Dashboard` и т.д. | `app/` или `pages/` |
| Данные (mock) | в начале файла | API / `api/` |
| Навигация | `App()` + `screen` state | Next.js router |

---

## 2. Цвета → tailwind.config.ts

```ts
// tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#0EA5E9',
          dark:    '#0284C7',
          light:   '#E0F2FE',
          mid:     '#BAE6FD',
        },
        ok:   { DEFAULT: '#16A34A', bg: '#DCFCE7' },
        warn: { DEFAULT: '#D97706', bg: '#FEF3C7' },
        err:  { DEFAULT: '#DC2626', bg: '#FEE2E2' },
      },
      borderRadius: {
        DEFAULT: '10px',
        lg: '14px',
      },
      fontFamily: {
        sans: ['TT Norms Pro', 'DM Sans', '-apple-system', 'sans-serif'],
      },
    },
  },
}
```

---

## 3. CSS переменные → globals.css

```css
/* globals.css */
:root {
  --a: #0EA5E9;
  --ad: #0284C7;
  --al: #E0F2FE;
  --am: #BAE6FD;
  --bg: #F0F4F8;
  --card: #fff;
  --border: #E2E8F0;
  --borderl: #F1F5F9;
  --t1: #0F172A;
  --t2: #475569;
  --t3: #94A3B8;
  --ok: #16A34A;
  --ok-bg: #DCFCE7;
  --warn: #D97706;
  --warn-bg: #FEF3C7;
  --err: #DC2626;
  --err-bg: #FEE2E2;
  --pur: #7C3AED;
  --pur-bg: #EDE9FE;
  --r: 10px;
  --rl: 14px;
  --sh: 0 1px 3px rgba(15,23,42,.07), 0 1px 2px rgba(15,23,42,.04);
}
```

---

## 4. Компоненты UI → components/ui/

### Button.tsx
```tsx
// Взять из прототипа: const Btn = (...)
// Переименовать в Button, добавить типы

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warn'
  size?: 'sm' | 'lg'
  full?: boolean
  icon?: React.ReactNode
  children?: React.ReactNode
  onClick?: () => void
}

export function Button({ variant = 'primary', size, full, icon, children, onClick }: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}${size ? ` btn-${size}` : ''}${full ? ' btn-full' : ''}`}
      onClick={onClick}
    >
      {icon && <span className="flex">{icon}</span>}
      {children}
    </button>
  )
}
```

### Badge.tsx
```tsx
// Взять из прототипа: const Badge = (...)
type BadgeProps = {
  type: 'b-new' | 'b-inwork' | 'b-prod' | 'b-ready' | 'b-install' |
        'b-payment' | 'b-done' | 'b-cancel' | 'b-mat-no' | 'b-mat-part' |
        'b-mat-yes' | 'b-overdue' | 'b-draft'
  label: string
}
```

### StatusBadge маппинг
```ts
// lib/status.ts
export const ORDER_STATUS_LABELS: Record<string, { badge: string; label: string }> = {
  new:                   { badge: 'b-new',     label: 'Новый' },
  in_work:               { badge: 'b-inwork',  label: 'В работе' },
  in_production:         { badge: 'b-prod',    label: 'В производстве' },
  ready:                 { badge: 'b-ready',   label: 'Готов' },
  on_installation:       { badge: 'b-install', label: 'Установка/выдача' },
  waiting_final_payment: { badge: 'b-payment', label: 'Ожидает оплату' },
  completed:             { badge: 'b-done',    label: 'Завершён' },
  cancelled:             { badge: 'b-cancel',  label: 'Отменён' },
}

export const MATERIAL_STATUS_LABELS = {
  not_ready:       { badge: 'b-mat-no',   label: 'Не готовы' },
  partially_ready: { badge: 'b-mat-part', label: 'Частично готовы' },
  ready:           { badge: 'b-mat-yes',  label: 'Готовы' },
}
```

---

## 5. Маршруты → app/ (Next.js App Router)

```
app/
  login/
    page.tsx              ← S01_Login
  dashboard/
    page.tsx              ← S02_Dashboard
  orders/
    page.tsx              ← OrdersList (role-aware)
    new/
      page.tsx            ← S15_CreateOrder
    [id]/
      page.tsx            ← Order Detail (role-aware)
      edit/
        page.tsx          ← S16_EditOrder
      measurements/
        new/
          page.tsx        ← S17_CreateMeasurement
        [measId]/
          edit/
            page.tsx      ← S18_EditMeasurement
```

---

## 6. Role-based rendering в Order Detail

```tsx
// app/orders/[id]/page.tsx
import { useRole } from '@/hooks/useRole'

export default function OrderDetailPage() {
  const role = useRole()

  if (role === 'admin')     return <AdminOrderDetail />
  if (role === 'designer')  return <DesignerMeasurements />
  if (role === 'sewing')    return <SewingProductionItems />
  if (role === 'warehouse') return <WarehouseMaterialsView />
  if (role === 'installer') return <InstallerItemsView />

  return null
}
```

---

## 7. API endpoints → компоненты

| Экран | API endpoint | Метод |
|-------|-------------|-------|
| Список заказов | `/api/orders/` | GET |
| Создать заказ | `/api/orders/` | POST |
| Детали заказа | `/api/orders/:id/` | GET |
| Редактировать заказ | `/api/orders/:id/` | PATCH |
| Замеры | `/api/measurements/` | GET/POST |
| КП | `/api/quotes/:orderId/` | GET |
| Статус материалов | `/api/orders/:id/` → `material_readiness` | PATCH |
| Производство | `/api/orders/:id/` → `production_stage` | PATCH |
| Фотоотчёт | `/api/photo-reports/` | POST |
| АВР | `/api/completion-acts/` | POST |
| Оплата | `/api/payments/` | POST |

---

## 8. Порядок переноса (рекомендуется)

```
Шаг 1 — globals.css: добавить CSS-переменные
Шаг 2 — components/ui/: Button, Badge, Card, Modal, Input, EmptyState
Шаг 3 — lib/status.ts: маппинг статусов и ролей
Шаг 4 — /orders page: список заказов + фильтры
Шаг 5 — /orders/[id] page: Order Detail (начни с Admin)
Шаг 6 — /orders/[id] по ролям: Designer, Sewing, Warehouse, Installer
Шаг 7 — /orders/new: форма создания заказа
Шаг 8 — measurements: форма замера
Шаг 9 — dashboard: метрики + график
Шаг 10 — finance overlay, photo, docs
```

---

## 9. Зависимости для установки

```bash
# Уже должны быть в проекте:
npm install recharts
npm install lucide-react

# Опционально:
npm install @tanstack/react-query   # для API запросов
npm install zod                      # для валидации форм
npm install react-hook-form          # для форм замеров
```

---

## 10. Быстрый старт — скопировать стили

Минимально что нужно скопировать из прототипа в `globals.css`:

1. Все CSS-переменные из `:root { ... }`
2. Классы `.btn`, `.btn-primary`, `.btn-secondary` и т.д.
3. Классы `.badge`, `.b-new`, `.b-prod` и т.д.
4. Классы `.card`, `.input`, `.select`

После этого все компоненты из прототипа будут работать в твоём проекте без изменений.

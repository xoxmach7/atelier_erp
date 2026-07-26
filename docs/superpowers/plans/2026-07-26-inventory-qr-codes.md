# QR-коды для материалов склада — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Печать QR-этикеток для позиций склада (`InventoryItem`) на вебе и сканирование этих QR в мобильном приложении тремя ролями (Owner/Designer/Warehouse) для просмотра остатка/категории/цены.

**Architecture:** Чистый frontend/mobile — бэкенд не меняется (нужный `GET /api/v1/inventory-items/{id}/` уже открыт всем ролям). QR кодирует строку `SHEBER-INV:{id}`. Веб генерирует QR-картинку и печатает через `window.print()` с CSS-трюком «печатать только один div». Мобилка сканирует камерой (`expo-camera`), парсит строку, запрашивает актуальные данные и показывает read-only карточку.

**Tech Stack:** Next.js/TypeScript (веб), Expo/React Native/TypeScript (мобилка), `qrcode` (генерация QR на вебе), `expo-camera` (сканирование на мобилке).

---

## Task 1: Веб — функция формирования содержимого QR

**Files:**
- Create: `frontend/src/lib/inventory-qr.ts`
- Test: `frontend/src/lib/inventory-qr.test.ts`

- [ ] **Step 1: Написать падающий тест**

Создать `frontend/src/lib/inventory-qr.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildInventoryQrValue } from "./inventory-qr";

describe("buildInventoryQrValue", () => {
  it("формирует строку с префиксом SHEBER-INV:", () => {
    expect(buildInventoryQrValue("11111111-2222-3333-4444-555555555555")).toBe(
      "SHEBER-INV:11111111-2222-3333-4444-555555555555"
    );
  });
});
```

- [ ] **Step 2: Прогнать тест — убедиться, что падает**

Run: `cd frontend && npx vitest run src/lib/inventory-qr.test.ts`
Expected: FAIL — `Cannot find module './inventory-qr'` (файл ещё не создан).

- [ ] **Step 3: Написать минимальную реализацию**

Создать `frontend/src/lib/inventory-qr.ts`:

```ts
/**
 * Содержимое QR-этикетки материала склада — стабильный указатель на id
 * позиции, не сами данные (остаток/цена постоянно меняются, печатная
 * этикетка — нет). При сканировании приложение всегда идёт за актуальными
 * данными в API.
 */
const INVENTORY_QR_PREFIX = "SHEBER-INV:";

export function buildInventoryQrValue(id: string): string {
  return `${INVENTORY_QR_PREFIX}${id}`;
}
```

- [ ] **Step 4: Прогнать тест — убедиться, что проходит**

Run: `cd frontend && npx vitest run src/lib/inventory-qr.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/inventory-qr.ts frontend/src/lib/inventory-qr.test.ts
git commit -m "feat(web): функция формирования содержимого QR материала склада"
```

---

## Task 2: Веб — зависимость `qrcode` и модалка печати этикетки

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/components/inventory/print-qr-modal.tsx`
- Modify: `frontend/src/app/globals.css`

- [ ] **Step 1: Установить зависимости**

Run:
```bash
cd frontend && npm install qrcode@^1.5.4 && npm install -D @types/qrcode@^1.5.6
```
Expected: `package.json` получает `"qrcode": "^1.5.4"` в `dependencies` и `"@types/qrcode": "^1.5.6"` в `devDependencies`.

- [ ] **Step 2: Добавить CSS-трюк «печатать только один блок»**

В конец `frontend/src/app/globals.css` (после существующего блока `@layer base { ... }`) добавить:

```css

/*
 * Печать QR-этикетки материала: печатаем ТОЛЬКО #qr-print-area, а не всю
 * страницу за модалкой. Без этого трюка браузер печатает фон страницы за
 * оверлеем модалки (print CSS не учитывает визуальный z-index/stacking).
 */
@media print {
  body.printing-qr-label * {
    visibility: hidden;
  }
  body.printing-qr-label #qr-print-area,
  body.printing-qr-label #qr-print-area * {
    visibility: visible;
  }
  body.printing-qr-label #qr-print-area {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
  }
}
```

- [ ] **Step 3: Создать модалку печати**

Создать `frontend/src/components/inventory/print-qr-modal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ModalCloseX } from "@/components/shared/modal-close";
import { buildInventoryQrValue } from "@/lib/inventory-qr";
import type { InventoryItemDTO } from "@/types";

export function PrintQrModal({
  item,
  onClose,
}: {
  item: InventoryItemDTO;
  onClose: () => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    QRCode.toDataURL(buildInventoryQrValue(item.id), { width: 240, margin: 1 }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  const handlePrint = () => {
    document.body.classList.add("printing-qr-label");
    const cleanup = () => {
      document.body.classList.remove("printing-qr-label");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(15,23,42,.35)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-[380px] rounded-[14px] bg-white p-6 shadow-2xl">
        <ModalCloseX onClose={onClose} />
        <div className="pt-10 text-center">
          <h2 className="mb-4 text-[18px] font-semibold text-[#0F172A]">Печать QR-этикетки</h2>

          <div
            id="qr-print-area"
            className="mx-auto flex flex-col items-center gap-2 rounded-[10px] border border-[#E2E8F0] p-4"
          >
            {dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dataUrl} alt="QR-код материала" width={160} height={160} />
            ) : (
              <div className="flex h-[160px] w-[160px] items-center justify-center text-[13px] text-[#94A3B8]">
                Генерация...
              </div>
            )}
            <p className="text-[14px] font-medium text-[#0F172A]">{item.name}</p>
            <p className="text-[12px] text-[#94A3B8]">
              {item.category_display}
              {item.sku ? ` · ${item.sku}` : ""}
            </p>
          </div>

          <button
            onClick={handlePrint}
            disabled={!dataUrl}
            className="mt-6 w-full rounded-[10px] bg-[#60CCED] py-[12px] text-[15px] font-semibold text-white transition-colors hover:bg-[#4DBCE0] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Печать
          </button>
        </div>
      </div>
    </div>
  );
}
```

Компонент презентационный, без бизнес-логики, требующей юнит-теста — в проекте нет прецедента рендер-тестов для похожих модалок (`CreateKPModal`, модалка «Сотрудник создан» и т.п. тоже без тестов), тестируется вручную через браузер на шаге проверки (Task 3, Step 4).

- [ ] **Step 4: Прогнать typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок (0 errors).

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/app/globals.css frontend/src/components/inventory/print-qr-modal.tsx
git commit -m "feat(web): модалка генерации и печати QR-этикетки материала"
```

---

## Task 3: Веб — пункт «Печать QR» в меню материала

**Files:**
- Modify: `frontend/src/app/work/warehouse/materials/page.tsx`

- [ ] **Step 1: Добавить импорт и состояние**

В `frontend/src/app/work/warehouse/materials/page.tsx` найти существующий импорт:

```tsx
import { ModalCloseX } from "@/components/shared/modal-close";
```

Добавить сразу под ним:

```tsx
import { PrintQrModal } from "@/components/inventory/print-qr-modal";
```

Найти существующее состояние меню:

```tsx
  const [menu, setMenu] = useState<{ id: string; top: number; right: number } | null>(null);
```

Добавить сразу под ним:

```tsx
  const [qrItem, setQrItem] = useState<InventoryItemDTO | null>(null);
```

- [ ] **Step 2: Добавить пункт меню «Печать QR»**

Найти в блоке `createPortal` существующие кнопки меню (внутри `<div className="fixed z-[101] w-52 ...">`):

```tsx
                <button
                  onClick={() => { setMenu(null); openEdit(it); }}
                  className="w-full px-4 py-2.5 text-left text-[14px] text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                >
                  Редактировать
                </button>
```

Добавить сразу под ней (перед кнопкой «Удалить»):

```tsx
                <button
                  onClick={() => { setMenu(null); setQrItem(it); }}
                  className="w-full px-4 py-2.5 text-left text-[14px] text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                >
                  Печать QR
                </button>
```

- [ ] **Step 3: Отрендерить модалку**

Найти конец блока `createPortal` (закрывающая строка `document.body\n      )}`), сразу под ним, перед комментарием `{/* Добавить количество (приход) */}`, добавить:

```tsx
      {qrItem && <PrintQrModal item={qrItem} onClose={() => setQrItem(null)} />}
```

- [ ] **Step 4: Проверить вручную в браузере**

Run: `cd frontend && npm run dev`

Зайти под Owner или Warehouse на `/work/warehouse/materials`, открыть «⋮» у любой позиции склада (не Fabric-строки без InventoryItem), нажать «Печать QR» — модалка должна показать QR-код и название/категорию/артикул, кнопка «Печать» открывает системный диалог печати браузера. Под Designer — пункт «Печать QR» не должен быть виден вообще (весь блок «⋮» скрыт, т.к. `editable = canEdit && ...`).

- [ ] **Step 5: Прогнать полный набор проверок**

Run:
```bash
cd frontend && npx tsc --noEmit && npx vitest run
```
Expected: tsc — 0 ошибок; vitest — все тесты зелёные (существующие 51 + новый из Task 1).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/work/warehouse/materials/page.tsx
git commit -m "feat(web): пункт «Печать QR» в меню материала (Owner/Warehouse)"
```

---

## Task 4: Мобилка — функции формирования и разбора содержимого QR

**Files:**
- Create: `mobile/src/lib/inventoryQr.ts`
- Test: `mobile/src/lib/__tests__/inventoryQr.test.ts`

- [ ] **Step 1: Написать падающий тест**

Создать `mobile/src/lib/__tests__/inventoryQr.test.ts`:

```ts
import { buildInventoryQrValue, parseInventoryQrValue } from '../inventoryQr';

describe('buildInventoryQrValue', () => {
  it('формирует строку с префиксом', () => {
    expect(buildInventoryQrValue('abc-123')).toBe('SHEBER-INV:abc-123');
  });
});

describe('parseInventoryQrValue', () => {
  it('извлекает id из валидной строки', () => {
    expect(parseInventoryQrValue('SHEBER-INV:abc-123')).toBe('abc-123');
  });

  it('возвращает null для чужого QR (нет префикса)', () => {
    expect(parseInventoryQrValue('https://example.com')).toBeNull();
  });

  it('возвращает null, если после префикса пусто', () => {
    expect(parseInventoryQrValue('SHEBER-INV:')).toBeNull();
  });

  it('обрезает пробелы вокруг id', () => {
    expect(parseInventoryQrValue('SHEBER-INV: abc-123 ')).toBe('abc-123');
  });
});
```

- [ ] **Step 2: Прогнать тест — убедиться, что падает**

Run: `cd mobile && npx jest src/lib/__tests__/inventoryQr.test.ts`
Expected: FAIL — `Cannot find module '../inventoryQr'`.

- [ ] **Step 3: Написать минимальную реализацию**

Создать `mobile/src/lib/inventoryQr.ts`:

```ts
/**
 * Содержимое QR-этикетки материала склада — та же схема, что и на вебе
 * (frontend/src/lib/inventory-qr.ts): стабильный указатель на id позиции,
 * не сами данные (остаток/цена постоянно меняются, печатная этикетка — нет).
 */
const INVENTORY_QR_PREFIX = 'SHEBER-INV:';

export function buildInventoryQrValue(id: string): string {
  return `${INVENTORY_QR_PREFIX}${id}`;
}

export function parseInventoryQrValue(raw: string): string | null {
  if (!raw.startsWith(INVENTORY_QR_PREFIX)) return null;
  const id = raw.slice(INVENTORY_QR_PREFIX.length).trim();
  return id.length > 0 ? id : null;
}
```

- [ ] **Step 4: Прогнать тест — убедиться, что проходит**

Run: `cd mobile && npx jest src/lib/__tests__/inventoryQr.test.ts`
Expected: PASS (4 теста)

- [ ] **Step 5: Commit**

```bash
git add mobile/src/lib/inventoryQr.ts mobile/src/lib/__tests__/inventoryQr.test.ts
git commit -m "feat(mobile): формирование и разбор содержимого QR материала склада"
```

---

## Task 5: Мобилка — запрос одной позиции склада по id

**Files:**
- Modify: `mobile/src/api/inventory.ts`
- Create: `mobile/src/api/__tests__/inventory.test.ts`

- [ ] **Step 1: Написать падающий тест**

Создать `mobile/src/api/__tests__/inventory.test.ts`:

```ts
jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

import { apiClient } from '../client';
import { fetchInventoryItemById } from '../inventory';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchInventoryItemById', () => {
  it('запрашивает конкретную позицию по id', async () => {
    const item = { id: 'abc-123', name: 'Лён', sku: 'LEN-1' };
    mockedApiClient.get.mockResolvedValueOnce(item);

    const result = await fetchInventoryItemById('abc-123');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/inventory-items/abc-123/');
    expect(result).toEqual(item);
  });
});
```

- [ ] **Step 2: Прогнать тест — убедиться, что падает**

Run: `cd mobile && npx jest src/api/__tests__/inventory.test.ts`
Expected: FAIL — `fetchInventoryItemById is not a function` (или `undefined`).

- [ ] **Step 3: Добавить функцию в API-модуль**

В `mobile/src/api/inventory.ts` найти существующую функцию:

```ts
export async function fetchInventoryItems(): Promise<InventoryItem[]> {
  const res = await apiClient.get<InventoryPage | InventoryItem[]>('/api/v1/inventory-items/');
  if (Array.isArray(res)) return res;
  return res.results ?? [];
}
```

Добавить сразу под ней:

```ts
/** Одна позиция по id — для экрана скана QR (не тянуть весь список ради одной). */
export async function fetchInventoryItemById(id: string): Promise<InventoryItem> {
  return apiClient.get<InventoryItem>(`/api/v1/inventory-items/${id}/`);
}
```

- [ ] **Step 4: Прогнать тест — убедиться, что проходит**

Run: `cd mobile && npx jest src/api/__tests__/inventory.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add mobile/src/api/inventory.ts mobile/src/api/__tests__/inventory.test.ts
git commit -m "feat(mobile): запрос одной позиции склада по id (для скана QR)"
```

---

## Task 6: Мобилка — зависимость `expo-camera` и иконка «скан»

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/src/components/Icon.tsx`

- [ ] **Step 1: Установить `expo-camera`**

Run: `cd mobile && npx expo install expo-camera`
Expected: `mobile/package.json` получает `"expo-camera": "~<версия для SDK 54>"` — версию резолвит сам `expo install` под установленный Expo SDK, руками не проставлять. Пакет входит в состав Expo Go — пересборка приложения не нужна (как `expo-document-picker`/`expo-image-picker` ранее в проекте).

- [ ] **Step 2: Добавить иконку `scan` в реестр иконок**

В `mobile/src/components/Icon.tsx` найти:

```tsx
export type IconName =
  | 'plus' | 'search' | 'user' | 'filter' | 'tenge' | 'edit' | 'trash'
  | 'dots' | 'calendar' | 'userAdd' | 'doc' | 'chevron' | 'minus' | 'menu'
  | 'eye' | 'eyeOff' | 'check';
```

Заменить на:

```tsx
export type IconName =
  | 'plus' | 'search' | 'user' | 'filter' | 'tenge' | 'edit' | 'trash'
  | 'dots' | 'calendar' | 'userAdd' | 'doc' | 'chevron' | 'minus' | 'menu'
  | 'eye' | 'eyeOff' | 'check' | 'scan';
```

Найти конец кейса `'check'` (перед `case 'eye':`):

```tsx
    case 'check':
      return (
        <Svg {...common} strokeWidth={3}>
          <Polyline points="4 12.5 9.5 18 20 6.5" />
        </Svg>
      );

    case 'eye':
```

Вставить новый кейс между ними:

```tsx
    case 'check':
      return (
        <Svg {...common} strokeWidth={3}>
          <Polyline points="4 12.5 9.5 18 20 6.5" />
        </Svg>
      );

    case 'scan':
      // Уголки видоискателя — стандартная пиктограмма сканера QR/штрихкода.
      return (
        <Svg {...common}>
          <Path d="M3 7V5a2 2 0 0 1 2-2h2" />
          <Path d="M17 3h2a2 2 0 0 1 2 2v2" />
          <Path d="M21 17v2a2 2 0 0 1-2 2h-2" />
          <Path d="M7 21H5a2 2 0 0 1-2-2v-2" />
          <Line x1="3" y1="12" x2="21" y2="12" />
        </Svg>
      );

    case 'eye':
```

- [ ] **Step 3: Прогнать typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: без ошибок (0 errors).

- [ ] **Step 4: Commit**

```bash
git add mobile/package.json mobile/package-lock.json mobile/src/components/Icon.tsx
git commit -m "feat(mobile): зависимость expo-camera и иконка scan"
```

---

## Task 7: Мобилка — read-only карточка материала

**Files:**
- Create: `mobile/src/components/inventory/InventoryQrCard.tsx`

- [ ] **Step 1: Создать компонент**

Создать `mobile/src/components/inventory/InventoryQrCard.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { UNIT_LABELS, type InventoryItem } from '../../api/inventory';

function money(v: string): string {
  const n = parseFloat(v);
  if (!n || isNaN(n)) return '0';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
}

function qty(v: string): string {
  const n = parseFloat(v) || 0;
  return Number.isInteger(n) ? String(n) : String(n);
}

/** Карточка результата скана QR — только просмотр, без права правки (сканирование
 * во всех трёх ролях, включая Склад, это просмотр, а не изменение остатка). */
export function InventoryQrCard({ item }: { item: InventoryItem }) {
  const unit = UNIT_LABELS[item.unit] ?? item.unit_display ?? '';
  return (
    <View style={s.card}>
      {Boolean(item.sku) && <Text style={s.sku}>{item.sku}</Text>}
      <Text style={s.name}>{item.name}</Text>
      {Boolean(item.category_display) && <Text style={s.category}>{item.category_display}</Text>}

      <View style={s.row}>
        <Text style={s.label}>Остаток</Text>
        <Text style={[s.value, item.is_low_stock && s.low]}>
          {qty(item.quantity)} {unit}
        </Text>
      </View>

      <View style={s.row}>
        <Text style={s.label}>Цена</Text>
        <Text style={s.value}>{money(item.price_per_unit)} ₸/{unit}</Text>
      </View>

      {item.is_low_stock && <Text style={s.lowLabel}>На исходе</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#FAFBFC', borderRadius: 16, padding: 20, margin: 20 },
  sku: { fontSize: 14, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular' },
  name: { fontSize: 22, color: '#0F172A', fontFamily: 'TTNormsPro-Bold', marginTop: 4 },
  category: { fontSize: 15, color: '#475569', fontFamily: 'TTNormsPro-Regular', marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  label: { fontSize: 15, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular' },
  value: { fontSize: 16, color: '#0F172A', fontFamily: 'TTNormsPro-Bold' },
  low: { color: '#F59E0B' },
  lowLabel: { fontSize: 13, color: '#F59E0B', fontFamily: 'TTNormsPro-Medium', marginTop: 8, textAlign: 'right' },
});
```

Презентационный компонент без бизнес-логики — в проекте нет прецедента рендер-тестов для похожих карточек (`InventoryItemForm` и другие тоже без них), проверяется вручную на Task 9, Step 3.

- [ ] **Step 2: Прогнать typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: без ошибок (0 errors).

- [ ] **Step 3: Commit**

```bash
git add mobile/src/components/inventory/InventoryQrCard.tsx
git commit -m "feat(mobile): read-only карточка материала для результата скана"
```

---

## Task 8: Мобилка — экран сканирования

**Files:**
- Create: `mobile/app/inventory/scan.tsx`

- [ ] **Step 1: Создать экран**

Создать `mobile/app/inventory/scan.tsx`:

```tsx
import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { fetchInventoryItemById, type InventoryItem } from '../../src/api/inventory';
import { parseInventoryQrValue } from '../../src/lib/inventoryQr';
import { InventoryQrCard } from '../../src/components/inventory/InventoryQrCard';

type State =
  | { kind: 'scanning' }
  | { kind: 'loading' }
  | { kind: 'result'; item: InventoryItem }
  | { kind: 'error'; message: string };

export default function ScanInventoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<State>({ kind: 'scanning' });

  useFocusEffect(
    useCallback(() => {
      setState({ kind: 'scanning' });
    }, [])
  );

  const handleScanned = useCallback(
    async ({ data }: { data: string }) => {
      setState((current) => {
        if (current.kind !== 'scanning') return current;
        return { kind: 'loading' };
      });

      const id = parseInventoryQrValue(data);
      if (!id) {
        setState({ kind: 'error', message: 'Это не QR материала.' });
        return;
      }

      try {
        const item = await fetchInventoryItemById(id);
        setState({ kind: 'result', item });
      } catch (e: any) {
        setState({
          kind: 'error',
          message:
            e?.status === 404
              ? 'Позиция не найдена — возможно, удалена.'
              : e?.message ?? 'Не удалось загрузить материал',
        });
      }
    },
    []
  );

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.6}>
          <Text style={s.back}>Назад</Text>
        </TouchableOpacity>
        <Text style={s.title}>Скан материала</Text>
        <View style={{ width: 60 }} />
      </View>

      {state.kind === 'scanning' &&
        (!permission ? (
          <View style={s.centered}>
            <ActivityIndicator color="#60CCED" size="large" />
          </View>
        ) : !permission.granted ? (
          <View style={s.centered}>
            <Text style={s.permissionText}>Нужен доступ к камере, чтобы сканировать QR.</Text>
            <TouchableOpacity style={s.retryBtn} onPress={requestPermission}>
              <Text style={s.retryText}>Разрешить</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <CameraView
            style={s.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleScanned}
          />
        ))}

      {state.kind === 'loading' && (
        <View style={s.centered}>
          <ActivityIndicator color="#60CCED" size="large" />
        </View>
      )}

      {state.kind === 'result' && (
        <View>
          <InventoryQrCard item={state.item} />
          <TouchableOpacity style={s.retryBtn} onPress={() => setState({ kind: 'scanning' })}>
            <Text style={s.retryText}>Сканировать ещё раз</Text>
          </TouchableOpacity>
        </View>
      )}

      {state.kind === 'error' && (
        <View style={s.centered}>
          <Text style={s.errorText}>{state.message}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => setState({ kind: 'scanning' })}>
            <Text style={s.retryText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    paddingHorizontal: 20, paddingBottom: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  back: { fontSize: 16, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular' },
  title: { fontSize: 20, fontFamily: 'TTNormsPro-Regular', color: '#0F172A' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  camera: { flex: 1 },
  permissionText: {
    fontSize: 15, color: '#475569', textAlign: 'center', marginBottom: 16,
    fontFamily: 'TTNormsPro-Regular',
  },
  errorText: {
    fontSize: 15, color: '#EF4444', textAlign: 'center', marginBottom: 16,
    fontFamily: 'TTNormsPro-Regular',
  },
  retryBtn: {
    alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: '#60CCED', borderRadius: 10, marginTop: 12,
  },
  retryText: { fontSize: 15, color: '#FFFFFF', fontFamily: 'TTNormsPro-Medium' },
});
```

- [ ] **Step 2: Прогнать typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: без ошибок (0 errors).

- [ ] **Step 3: Commit**

```bash
git add mobile/app/inventory/scan.tsx
git commit -m "feat(mobile): экран сканирования QR материала"
```

---

## Task 9: Мобилка — кнопка «Скан» на экране «Материалы»

**Files:**
- Modify: `mobile/app/inventory/index.tsx`

- [ ] **Step 1: Добавить кнопку в шапку экрана**

В `mobile/app/inventory/index.tsx` найти:

```tsx
        <View style={s.iconRow}>
          <IconButton name="plus" size={38} onPress={() => router.push('/inventory/new')} />
          <IconButton name="search" size={38} onPress={() => setShowSearch(v => !v)} />
        </View>
```

Заменить на:

```tsx
        <View style={s.iconRow}>
          <IconButton name="scan" size={38} onPress={() => router.push('/inventory/scan')} />
          <IconButton name="plus" size={38} onPress={() => router.push('/inventory/new')} />
          <IconButton name="search" size={38} onPress={() => setShowSearch(v => !v)} />
        </View>
```

- [ ] **Step 2: Прогнать typecheck и jest**

Run:
```bash
cd mobile && npx tsc --noEmit && npx jest
```
Expected: tsc — 0 ошибок; jest — все тесты зелёные (существующие 55 + 5 новых из Task 4/5).

- [ ] **Step 3: Проверить вручную в Expo Go**

Запустить `npx expo start`, зайти под Owner/Designer/Warehouse на экран «Материалы» → «Скан» → навести камеру на распечатанный (или показанный на другом экране) QR из Task 3 → должна открыться карточка с остатком/категорией/ценой. Навести на случайный чужой QR (не `SHEBER-INV:...`) → сообщение «Это не QR материала».

Это единственная часть фичи, которую нельзя проверить автоматическими тестами (аппаратная камера) — отметить в отчёте по плану как «не проверено визуально в симуляторе», если ручная проверка на реальном устройстве недоступна в момент реализации.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/inventory/index.tsx
git commit -m "feat(mobile): кнопка «Скан» на экране «Материалы»"
```

---

## Task 10: Финальная проверка всего набора

**Files:** нет новых — только прогон существующих проверок по всем трём стекам.

- [ ] **Step 1: Backend — подтвердить, что ничего не сломано**

Run: `python manage.py test --settings=atelier_erp.settings_test`
Expected: PASS, 308/308 (бэкенд не менялся в этом плане, тесты должны остаться как были).

- [ ] **Step 2: Frontend — полный прогон**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: tsc — 0 ошибок; vitest — 52/52 (51 существующих + 1 новый из Task 1).

- [ ] **Step 3: Mobile — полный прогон**

Run: `cd mobile && npx tsc --noEmit && npx jest`
Expected: tsc — 0 ошибок; jest — 60/60 (55 существующих + 4 из Task 4 + 1 из Task 5).

- [ ] **Step 4: Итоговый отчёт**

Свести результат: что реализовано (печать QR на вебе для Owner/Warehouse, скан на мобилке для всех трёх ролей), что проверено автоматически, что требует ручной проверки на реальном устройстве (сканирование камерой), какие зависимости добавлены (`qrcode`+`@types/qrcode` на вебе, `expo-camera` на мобилке — версию резолвил `expo install`).

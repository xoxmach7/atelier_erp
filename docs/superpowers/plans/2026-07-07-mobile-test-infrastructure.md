# Mobile Test Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Установить Jest-инфраструктуру в `mobile/` (Expo SDK 54) и написать тесты на весь `mobile/src/api/*.ts` (7 файлов, ~40 экспортируемых функций), не меняя существующее поведение кода.

**Architecture:** `jest-expo` пресет + `@testing-library/react-native` (устанавливается для будущего переиспользования, не используется в этом плане) + официальный мок `@react-native-async-storage/async-storage`. `client.ts` тестируется через мокнутый `global.fetch` (это единственный файл, который реально обращается к сети). Остальные 6 модулей (`orders.ts`, `customers.ts`, `fabrics.ts`, `payments.ts`, `staff.ts`, `work.ts`) тестируются через мокнутый `apiClient` — не дублируем проверку HTTP-механики там, где её уже покрыл `client.test.ts`.

**Tech Stack:** jest-expo, @testing-library/react-native, TypeScript (existing strict mode), npm.

---

## Контекст кодовой базы (прочитать перед началом)

- `mobile/package.json` — сейчас НЕТ `jest`/`@testing-library/react-native` ни в deps, ни в devDeps, ни скрипта `test`. Пакетный менеджер — npm (`package-lock.json` присутствует).
- `mobile/babel.config.js` — уже настроен с `babel-preset-expo`, трогать не нужно.
- `mobile/tsconfig.json` — `strict: true`, `baseUrl: "."`, path alias `@/*` → `src/*`. Новые тестовые файлы должны проходить strict-проверку без `any`.
- `mobile/src/api/client.ts` (152 строки) — `ApiClient` класс, экспортирует singleton `apiClient` и функцию `setUnauthorizedCallback`. Использует `AsyncStorage` (`@react-native-async-storage/async-storage`) для токенов, `global.fetch` для запросов. Полный текст уже приведён в каждом шаге ниже, где он нужен — не обязательно открывать файл заново.
- `mobile/src/api/orders.ts` (359 строк, 21 экспортируемая функция) — самый большой модуль, все функции — тонкие обёртки над `apiClient.get/post/patch/del/postMultipart`.
- `mobile/src/api/customers.ts`, `fabrics.ts`, `payments.ts`, `staff.ts`, `work.ts` — маленькие модули (5, 1, 2, 1, 7 функций соответственно), тот же паттерн тонких обёрток.
- Спека: `docs/superpowers/specs/2026-07-07-mobile-test-infrastructure-design.md` — 10 обязательных сценариев для `client.ts`, перечислены в Task 2 этого плана дословно.
- Правило репо (CLAUDE.md): **не коммитить без явного одобрения пользователя** — после каждой задачи показать `git diff --stat`, дождаться подтверждения, затем коммит. В рамках subagent-driven-development эту паузу можно снять только если пользователь явно разрешил автономное выполнение плана — уточнить у пользователя перед стартом, если не оговорено.
- Ветка: `feature/mobile-test-infrastructure` (уже создана и активна на момент написания плана).

---

## Task 1: Установить и сконфигурировать Jest

**Files:**
- Modify: `mobile/package.json`
- Create: `mobile/jest.config.js`
- Create: `mobile/src/api/__tests__/setup.smoke.test.ts` (временный smoke-тест, удаляется в конце задачи)

- [ ] **Step 1: Установить зависимости**

Run:
```bash
cd mobile
npm install --save-dev jest-expo @testing-library/react-native @types/jest
```

Expected: `package.json` обновлён, `node_modules/jest-expo`, `node_modules/@testing-library/react-native` существуют.

- [ ] **Step 2: Добавить конфиг Jest**

Create `mobile/jest.config.js`:

```js
module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
```

- [ ] **Step 3: Добавить скрипт `test` в `package.json`**

Modify `mobile/package.json` — в секции `"scripts"` (текущее содержимое смотри в контексте выше) добавить после `"typecheck": "tsc --noEmit",`:

```json
    "test": "jest",
```

Итоговая секция `scripts` должна выглядеть так:

```json
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "lint": "eslint . --ext .ts,.tsx",
    "build-preview": "eas build --platform android --profile preview"
  },
```

- [ ] **Step 4: Написать временный smoke-тест, чтобы проверить, что Jest вообще запускается**

Create `mobile/src/api/__tests__/setup.smoke.test.ts`:

```typescript
describe('jest setup smoke test', () => {
  it('runs a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Запустить и убедиться, что тест проходит**

Run: `cd mobile && npm test`
Expected: `PASS src/api/__tests__/setup.smoke.test.ts`, 1 passed.

Если Jest падает с ошибкой трансформации/конфигурации — остановиться и разобраться до перехода дальше (не переходить к Task 2 с неработающей инфраструктурой).

- [ ] **Step 6: Удалить временный smoke-тест**

```bash
rm mobile/src/api/__tests__/setup.smoke.test.ts
```

- [ ] **Step 7: Убедиться, что typecheck по-прежнему проходит**

Run: `cd mobile && npm run typecheck`
Expected: 0 ошибок (как и до этой задачи).

- [ ] **Step 8: Показать diff и закоммитить (после одобрения пользователя)**

```bash
git diff --stat
# показать пользователю, дождаться подтверждения
git add mobile/package.json mobile/package-lock.json mobile/jest.config.js
git commit -m "chore(mobile): установить jest-expo и @testing-library/react-native

Тестовой инфраструктуры в mobile/ не было вообще. Добавлен jest-expo
(официальный пресет для Expo-проектов) + @testing-library/react-native
(понадобится для будущих тестов компонентов/экранов, не используется
в этом коммите). Скрипт npm test запускает Jest."
```

---

## Task 2: Тесты `mobile/src/api/client.ts` — HTTP-механика и retry-логика

**Files:**
- Create: `mobile/src/api/__tests__/client.test.ts`

Это самая важная задача плана — `client.ts` содержит retry-на-401, дедупликацию refresh-запросов, различие JSON/FormData тела. Полный текст `client.ts` (для справки, не копировать в тест — импортировать):

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_API_BASE_URL = 'http://10.0.2.2:8000';

function getBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl) return envUrl;
  return DEFAULT_API_BASE_URL;
}

export interface ApiError {
  status: number;
  message: string;
  detail?: string;
}

const STORAGE = {
  access: 'atelier_access_token',
  refresh: 'atelier_refresh_token',
} as const;

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedCallback(cb: () => void) {
  onUnauthorized = cb;
}

export class ApiClient {
  private baseUrl: string;
  private refreshPromise: Promise<string | null> | null = null;

  constructor() {
    this.baseUrl = getBaseUrl();
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const refreshToken = await AsyncStorage.getItem(STORAGE.refresh);
        if (!refreshToken) return null;

        const res = await fetch(`${this.baseUrl}/api/auth/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: refreshToken }),
        });

        if (!res.ok) return null;

        const { access } = await res.json() as { access: string };
        await AsyncStorage.setItem(STORAGE.access, access);
        return access;
      } catch {
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retry = true,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = await AsyncStorage.getItem(STORAGE.access);

    const isFormData = options.body instanceof FormData;
    const headers: Record<string, string> = {
      'ngrok-skip-browser-warning': 'true',
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };

    let response: Response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch (networkErr) {
      throw {
        status: 0,
        message: `Не удалось подключиться к серверу (${this.baseUrl}).`,
        detail: networkErr instanceof Error ? networkErr.message : String(networkErr),
      } as ApiError;
    }

    if (response.status === 401 && retry) {
      const newToken = await this.refreshAccessToken();
      if (newToken) {
        return this.request<T>(endpoint, options, false);
      }
      await Promise.all([AsyncStorage.removeItem(STORAGE.access), AsyncStorage.removeItem(STORAGE.refresh), AsyncStorage.removeItem('atelier_user')]);
      onUnauthorized?.();
      throw {
        status: 401,
        message: 'Сессия истекла. Войдите снова.',
      } as ApiError;
    }

    if (response.status === 401) {
      throw { status: 401, message: 'Требуется авторизация.' } as ApiError;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        message: errorData.detail || errorData.error || `Ошибка сервера: HTTP ${response.status}`,
        detail: JSON.stringify(errorData),
      } as ApiError;
    }

    if (response.status === 204) return {} as T;
    return response.json() as Promise<T>;
  }

  public async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  public async post<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) });
  }

  public async postMultipart<T>(endpoint: string, formData: FormData): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body: formData });
  }

  public async patch<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) });
  }

  public async del<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }
}

export const apiClient = new ApiClient();
```

**Важно про `apiClient` singleton:** модуль экспортирует уже созданный экземпляр `ApiClient`. `baseUrl` фиксируется в конструкторе через `getBaseUrl()`, который читает `process.env.EXPO_PUBLIC_API_BASE_URL`. Тесты должны импортировать `ApiClient` (класс, не singleton) напрямую и создавать свежий инстанс в каждом тесте — это даёт предсказуемый `baseUrl` (`http://10.0.2.2:8000`, дефолт, если переменная окружения не установлена в тестовом процессе) и изолирует `refreshPromise`-состояние между тестами.

- [ ] **Step 1: Написать тест на успешный GET с токеном**

Create `mobile/src/api/__tests__/client.test.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiClient, setUnauthorizedCallback } from '../client';

function mockFetchOnce(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: response.json ?? (async () => ({})),
  } as Response);
}

describe('ApiClient', () => {
  let client: ApiClient;

  beforeEach(async () => {
    await AsyncStorage.clear();
    global.fetch = jest.fn();
    client = new ApiClient();
  });

  it('sends GET with Authorization header when token exists', async () => {
    await AsyncStorage.setItem('atelier_access_token', 'token-123');
    mockFetchOnce({ ok: true, status: 200, json: async () => ({ hello: 'world' }) });

    const result = await client.get('/api/v1/orders/');

    expect(result).toEqual({ hello: 'world' });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://10.0.2.2:8000/api/v1/orders/',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Запустить и убедиться, что тест проходит**

Run: `cd mobile && npm test -- client.test.ts`
Expected: PASS, 1 passed. (Тест новый, код `client.ts` не менялся — тест описывает уже существующее поведение, поэтому должен пройти сразу; если падает — расследовать несоответствие спеке до продолжения, не подгонять тест под неверное поведение молча.)

- [ ] **Step 3: Добавить тест на запрос без токена**

Append to `mobile/src/api/__tests__/client.test.ts` (внутри `describe('ApiClient', ...)`, после первого теста):

```typescript
  it('sends GET without Authorization header when no token stored', async () => {
    mockFetchOnce({ ok: true, status: 200, json: async () => ({}) });

    await client.get('/api/v1/orders/');

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });
```

- [ ] **Step 4: Запустить, убедиться что проходит**

Run: `cd mobile && npm test -- client.test.ts`
Expected: PASS, 2 passed.

- [ ] **Step 5: Добавить тесты на Content-Type для JSON vs FormData**

Append:

```typescript
  it('sets Content-Type: application/json for POST with plain body', async () => {
    mockFetchOnce({ ok: true, status: 200, json: async () => ({}) });

    await client.post('/api/v1/orders/', { foo: 'bar' });

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.body).toBe(JSON.stringify({ foo: 'bar' }));
  });

  it('does not set Content-Type for postMultipart with FormData body', async () => {
    mockFetchOnce({ ok: true, status: 200, json: async () => ({}) });
    const formData = new FormData();
    formData.append('file', 'fake-file-content');

    await client.postMultipart('/api/v1/orders/1/photo-reports/', formData);

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers['Content-Type']).toBeUndefined();
    expect(options.body).toBe(formData);
  });
```

- [ ] **Step 6: Запустить, убедиться что проходят**

Run: `cd mobile && npm test -- client.test.ts`
Expected: PASS, 4 passed.

- [ ] **Step 7: Добавить тест на успешный refresh после 401 и повторный запрос**

Append:

```typescript
  it('refreshes token on 401 and retries the request once with new token', async () => {
    await AsyncStorage.setItem('atelier_access_token', 'expired-token');
    await AsyncStorage.setItem('atelier_refresh_token', 'refresh-token-abc');

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) } as Response) // original request
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access: 'new-token' }) } as Response) // refresh call
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: 'success' }) } as Response); // retried request

    const result = await client.get('/api/v1/orders/');

    expect(result).toEqual({ data: 'success' });
    expect(global.fetch).toHaveBeenCalledTimes(3);

    const refreshCall = (global.fetch as jest.Mock).mock.calls[1];
    expect(refreshCall[0]).toBe('http://10.0.2.2:8000/api/auth/token/refresh/');
    expect(JSON.parse(refreshCall[1].body)).toEqual({ refresh: 'refresh-token-abc' });

    const retriedCall = (global.fetch as jest.Mock).mock.calls[2];
    expect(retriedCall[1].headers.Authorization).toBe('Bearer new-token');

    expect(await AsyncStorage.getItem('atelier_access_token')).toBe('new-token');
  });
```

- [ ] **Step 8: Запустить, убедиться что проходит**

Run: `cd mobile && npm test -- client.test.ts`
Expected: PASS, 5 passed.

- [ ] **Step 9: Добавить тест на дедупликацию параллельных refresh-запросов**

Append:

```typescript
  it('deduplicates concurrent refresh calls when two requests get 401 at the same time', async () => {
    await AsyncStorage.setItem('atelier_access_token', 'expired-token');
    await AsyncStorage.setItem('atelier_refresh_token', 'refresh-token-abc');

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) } as Response) // request A original
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) } as Response) // request B original
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access: 'new-token' }) } as Response) // single refresh call
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: 'A' }) } as Response) // request A retried
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: 'B' }) } as Response); // request B retried

    const [resultA, resultB] = await Promise.all([
      client.get('/api/v1/orders/'),
      client.get('/api/v1/customers/'),
    ]);

    expect(resultA).toEqual({ data: 'A' });
    expect(resultB).toEqual({ data: 'B' });

    const refreshCalls = (global.fetch as jest.Mock).mock.calls.filter(
      ([url]) => url === 'http://10.0.2.2:8000/api/auth/token/refresh/'
    );
    expect(refreshCalls).toHaveLength(1);
  });
```

- [ ] **Step 10: Запустить, убедиться что проходит**

Run: `cd mobile && npm test -- client.test.ts`
Expected: PASS, 6 passed.

- [ ] **Step 11: Добавить тест на провал refresh — logout**

Append:

```typescript
  it('clears storage and calls onUnauthorized when refresh fails', async () => {
    await AsyncStorage.setItem('atelier_access_token', 'expired-token');
    await AsyncStorage.setItem('atelier_refresh_token', 'refresh-token-abc');
    await AsyncStorage.setItem('atelier_user', JSON.stringify({ id: 1 }));

    const onUnauthorized = jest.fn();
    setUnauthorizedCallback(onUnauthorized);

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) } as Response) // original request
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) } as Response); // refresh call fails

    await expect(client.get('/api/v1/orders/')).rejects.toEqual({
      status: 401,
      message: 'Сессия истекла. Войдите снова.',
    });

    expect(await AsyncStorage.getItem('atelier_access_token')).toBeNull();
    expect(await AsyncStorage.getItem('atelier_refresh_token')).toBeNull();
    expect(await AsyncStorage.getItem('atelier_user')).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 12: Запустить, убедиться что проходит**

Run: `cd mobile && npm test -- client.test.ts`
Expected: PASS, 7 passed.

- [ ] **Step 13: Добавить тест на сетевую ошибку**

Append:

```typescript
  it('wraps network errors (fetch throws) into ApiError with status 0', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network request failed'));

    await expect(client.get('/api/v1/orders/')).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining('http://10.0.2.2:8000'),
    });
  });
```

- [ ] **Step 14: Запустить, убедиться что проходит**

Run: `cd mobile && npm test -- client.test.ts`
Expected: PASS, 8 passed.

- [ ] **Step 15: Добавить тесты на не-401 ошибки сервера**

Append:

```typescript
  it('parses error detail from JSON body for non-401 error responses', async () => {
    mockFetchOnce({ ok: false, status: 400, json: async () => ({ detail: 'Некорректные данные' }) });

    await expect(client.get('/api/v1/orders/')).rejects.toMatchObject({
      status: 400,
      message: 'Некорректные данные',
    });
  });

  it('falls back to generic message when error body is not parseable JSON', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => { throw new Error('not json'); },
    } as unknown as Response);

    await expect(client.get('/api/v1/orders/')).rejects.toMatchObject({
      status: 500,
      message: 'Ошибка сервера: HTTP 500',
    });
  });
```

- [ ] **Step 16: Запустить, убедиться что проходят**

Run: `cd mobile && npm test -- client.test.ts`
Expected: PASS, 10 passed.

- [ ] **Step 17: Добавить тест на 204 No Content**

Append:

```typescript
  it('returns empty object for 204 No Content without calling json()', async () => {
    const jsonSpy = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: jsonSpy,
    } as unknown as Response);

    const result = await client.del('/api/v1/orders/1/');

    expect(result).toEqual({});
    expect(jsonSpy).not.toHaveBeenCalled();
  });
```

- [ ] **Step 18: Запустить весь файл, убедиться что все 11 тестов проходят**

Run: `cd mobile && npm test -- client.test.ts`
Expected: PASS, 11 passed, 0 failed.

- [ ] **Step 19: Прогнать typecheck**

Run: `cd mobile && npm run typecheck`
Expected: 0 ошибок.

- [ ] **Step 20: Показать diff и закоммитить (после одобрения пользователя)**

```bash
git diff --stat
# показать пользователю, дождаться подтверждения
git add mobile/src/api/__tests__/client.test.ts
git commit -m "test(mobile): покрыть ApiClient — retry на 401, дедупликация refresh, network errors

11 тестов на самую критичную для бизнеса часть мобилки: обновление
токена при истечении сессии, дедупликация параллельных refresh-запросов
(баг здесь = разлогин сотрудника посреди работы), различие JSON/FormData
тела, обработка сетевых обрывов и 204 No Content."
```

---

## Task 3: Тесты `mobile/src/api/orders.ts`

**Files:**
- Create: `mobile/src/api/__tests__/orders.test.ts`

Полный список экспортируемых функций `orders.ts` (21 штука) с их реальными сигнатурами — см. контекст плана выше (файл прочитан полностью при написании плана). Тесты мокают `apiClient` целиком (не `fetch`) — HTTP-механика уже покрыта в Task 2.

- [ ] **Step 1: Написать тест-файл с моком `apiClient` и первыми функциями (create/update/delete/fetch orders)**

Create `mobile/src/api/__tests__/orders.test.ts`:

```typescript
jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
    postMultipart: jest.fn(),
  },
}));

import { apiClient } from '../client';
import {
  createOrder, updateOrder, deleteOrder, fetchOrders, fetchOrderExecution,
  changeOrderStatus, changeMaterialReadiness, changeProductionStage, changeHandoverStage,
  cancelOrder, fetchMeasurements, createMeasurement, fetchQuotes, createQuote,
  generateQuotePdf, fetchMaterials, updateMaterial, fetchPhotoReports, uploadPhotoReport,
  fetchCompletionAct, createCompletionAct, uploadSignedAct, fetchCompletionChecklist,
} from '../orders';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createOrder', () => {
  it('posts payload to /api/v1/orders/', async () => {
    mockedApiClient.post.mockResolvedValueOnce({ id: '1' });

    const result = await createOrder({ client_name: 'Иван', client_phone: '+77001234567' });

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/v1/orders/', { client_name: 'Иван', client_phone: '+77001234567' });
    expect(result).toEqual({ id: '1' });
  });
});

describe('updateOrder', () => {
  it('patches payload to /api/v1/orders/{id}/', async () => {
    mockedApiClient.patch.mockResolvedValueOnce({ id: '1', client_name: 'Пётр' });

    const result = await updateOrder('1', { client_name: 'Пётр' });

    expect(mockedApiClient.patch).toHaveBeenCalledWith('/api/v1/orders/1/', { client_name: 'Пётр' });
    expect(result).toEqual({ id: '1', client_name: 'Пётр' });
  });
});

describe('deleteOrder', () => {
  it('calls del on /api/v1/orders/{id}/', async () => {
    mockedApiClient.del.mockResolvedValueOnce({});

    await deleteOrder('1');

    expect(mockedApiClient.del).toHaveBeenCalledWith('/api/v1/orders/1/');
  });
});

describe('fetchOrders', () => {
  it('builds endpoint with page and page_size, no status filter', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ count: 0, results: [] });

    await fetchOrders();

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/orders/?page=1&page_size=50');
  });

  it('includes status filter and custom page when provided', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ count: 0, results: [] });

    await fetchOrders('in_work', 2);

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/orders/?page=2&page_size=50&status=in_work');
  });
});

describe('fetchOrderExecution', () => {
  it('gets /api/v1/orders/{id}/execution/', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ order_id: '1' });

    await fetchOrderExecution('1');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/orders/1/execution/');
  });
});
```

- [ ] **Step 2: Запустить, убедиться что проходят**

Run: `cd mobile && npm test -- orders.test.ts`
Expected: PASS, 6 passed.

- [ ] **Step 3: Добавить тесты на статусные экшены заказа**

Append:

```typescript
describe('order status/stage actions', () => {
  it('changeOrderStatus posts {status} to change-status endpoint', async () => {
    mockedApiClient.post.mockResolvedValueOnce({});

    await changeOrderStatus('1', 'in_work');

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/v1/orders/1/change-status/', { status: 'in_work' });
  });

  it('changeMaterialReadiness posts {material_readiness}', async () => {
    mockedApiClient.post.mockResolvedValueOnce({});

    await changeMaterialReadiness('1', 'ready');

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/v1/orders/1/change-material-readiness/', { material_readiness: 'ready' });
  });

  it('changeProductionStage posts {production_stage}', async () => {
    mockedApiClient.post.mockResolvedValueOnce({});

    await changeProductionStage('1', 'sewing');

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/v1/orders/1/change-production-stage/', { production_stage: 'sewing' });
  });

  it('changeHandoverStage posts {handover_stage}', async () => {
    mockedApiClient.post.mockResolvedValueOnce({});

    await changeHandoverStage('1', 'done');

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/v1/orders/1/change-handover-stage/', { handover_stage: 'done' });
  });

  it('cancelOrder posts {reason}', async () => {
    mockedApiClient.post.mockResolvedValueOnce({});

    await cancelOrder('1', 'Клиент отказался');

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/v1/orders/1/cancel/', { reason: 'Клиент отказался' });
  });
});
```

- [ ] **Step 4: Запустить, убедиться что проходят**

Run: `cd mobile && npm test -- orders.test.ts`
Expected: PASS, 11 passed.

- [ ] **Step 5: Добавить тесты на замеры и КП**

Append:

```typescript
describe('measurements', () => {
  it('fetchMeasurements gets /api/v1/orders/{orderId}/measurements/', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ count: 0, results: [] });

    await fetchMeasurements('1');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/orders/1/measurements/');
  });

  it('createMeasurement posts payload to measurements endpoint', async () => {
    mockedApiClient.post.mockResolvedValueOnce({});
    const payload = { room_name: 'Спальня', width: 150, height: 200 };

    await createMeasurement('1', payload);

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/v1/orders/1/measurements/', payload);
  });
});

describe('quotes', () => {
  it('fetchQuotes gets /api/v1/quotes/ filtered by order', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ count: 0, results: [] });

    await fetchQuotes('1');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/quotes/?order=1');
  });

  it('createQuote posts payload to /api/v1/quotes/', async () => {
    mockedApiClient.post.mockResolvedValueOnce({ id: 'q1' });
    const payload = { order_id: '1', items: [] };

    const result = await createQuote(payload);

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/v1/quotes/', payload);
    expect(result).toEqual({ id: 'q1' });
  });

  it('generateQuotePdf posts to generate-pdf endpoint', async () => {
    mockedApiClient.post.mockResolvedValueOnce({ pdf_url: 'http://x/y.pdf', pdf_generated: true, path: '/y.pdf' });

    const result = await generateQuotePdf('q1');

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/v1/quotes/q1/generate-pdf/', {});
    expect(result.pdf_generated).toBe(true);
  });
});
```

- [ ] **Step 6: Запустить, убедиться что проходят**

Run: `cd mobile && npm test -- orders.test.ts`
Expected: PASS, 16 passed.

- [ ] **Step 7: Добавить тесты на материалы, фотоотчёты, АВР, чеклист**

Append:

```typescript
describe('materials', () => {
  it('fetchMaterials gets /api/v1/orders/{orderId}/materials/', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ count: 0, results: [] });

    await fetchMaterials('1');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/orders/1/materials/');
  });

  it('updateMaterial patches /api/v1/orders/{orderId}/materials/{materialId}/', async () => {
    mockedApiClient.patch.mockResolvedValueOnce({
      material: { id: 'm1' },
      order_material_readiness: 'ready',
      order_material_readiness_label: 'Обеспечен',
    });

    await updateMaterial('1', 'm1', { status: 'ready' });

    expect(mockedApiClient.patch).toHaveBeenCalledWith('/api/v1/orders/1/materials/m1/', { status: 'ready' });
  });
});

describe('photo reports', () => {
  it('fetchPhotoReports gets /api/v1/orders/{orderId}/photo-reports/', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ count: 0, photo_reports: [] });

    await fetchPhotoReports('1');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/orders/1/photo-reports/');
  });

  it('uploadPhotoReport posts FormData via postMultipart', async () => {
    mockedApiClient.postMultipart.mockResolvedValueOnce({ id: 'p1' });
    const formData = new FormData();

    await uploadPhotoReport('1', formData);

    expect(mockedApiClient.postMultipart).toHaveBeenCalledWith('/api/v1/orders/1/photo-reports/', formData);
  });
});

describe('completion act', () => {
  it('fetchCompletionAct gets /api/v1/orders/{orderId}/completion-act/', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ exists: false, status: 'not_created' });

    await fetchCompletionAct('1');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/orders/1/completion-act/');
  });

  it('createCompletionAct posts empty body to completion-act endpoint', async () => {
    mockedApiClient.post.mockResolvedValueOnce({ exists: true, status: 'draft' });

    await createCompletionAct('1');

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/v1/orders/1/completion-act/', {});
  });

  it('uploadSignedAct posts FormData via postMultipart', async () => {
    mockedApiClient.postMultipart.mockResolvedValueOnce({ act: undefined, created: true, message: 'ok' });
    const formData = new FormData();

    await uploadSignedAct('1', formData);

    expect(mockedApiClient.postMultipart).toHaveBeenCalledWith('/api/v1/orders/1/completion-act/upload-signed/', formData);
  });

  it('fetchCompletionChecklist gets /api/v1/orders/{orderId}/completion-checklist/', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ checklist: [], can_complete: false });

    await fetchCompletionChecklist('1');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/orders/1/completion-checklist/');
  });
});
```

- [ ] **Step 8: Запустить весь файл, убедиться что все тесты проходят**

Run: `cd mobile && npm test -- orders.test.ts`
Expected: PASS, 23 passed, 0 failed.

- [ ] **Step 9: Прогнать typecheck**

Run: `cd mobile && npm run typecheck`
Expected: 0 ошибок.

- [ ] **Step 10: Показать diff и закоммитить (после одобрения пользователя)**

```bash
git diff --stat
# показать пользователю, дождаться подтверждения
git add mobile/src/api/__tests__/orders.test.ts
git commit -m "test(mobile): покрыть все 21 функцию orders.ts

Каждая функция проверена на правильный endpoint (включая интерполяцию id),
правильный HTTP-метод через apiClient, и правильное тело запроса.
apiClient мокается целиком — HTTP-механика уже покрыта в client.test.ts."
```

---

## Task 4: Тесты остальных модулей (`customers.ts`, `fabrics.ts`, `payments.ts`, `staff.ts`, `work.ts`)

**Files:**
- Create: `mobile/src/api/__tests__/customers.test.ts`
- Create: `mobile/src/api/__tests__/fabrics.test.ts`
- Create: `mobile/src/api/__tests__/payments.test.ts`
- Create: `mobile/src/api/__tests__/staff.test.ts`
- Create: `mobile/src/api/__tests__/work.test.ts`

Эти 5 модулей маленькие (1-7 функций каждый), объединены в одну задачу — паттерн идентичен Task 3 (мокаем `apiClient`), но каждый файл отдельный, чтобы соответствовать структуре из спеки (Section 3: "один файл на каждый существующий модуль").

- [ ] **Step 1: Написать `customers.test.ts` (5 функций — полный текст модуля см. в контексте плана)**

Create `mobile/src/api/__tests__/customers.test.ts`:

```typescript
jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
  },
}));

import { apiClient } from '../client';
import { fetchCustomers, fetchCustomer, createCustomer, updateCustomer, deleteCustomer } from '../customers';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchCustomers', () => {
  it('builds endpoint with page_size, no search', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ count: 0, results: [] });

    await fetchCustomers();

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/customers/?page_size=200');
  });

  it('appends encoded search query when provided', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ count: 0, results: [] });

    await fetchCustomers('Иван Петров');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/customers/?page_size=200&search=%D0%98%D0%B2%D0%B0%D0%BD%20%D0%9F%D0%B5%D1%82%D1%80%D0%BE%D0%B2');
  });
});

describe('fetchCustomer', () => {
  it('gets /api/v1/customers/{id}/', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ id: '1' });

    await fetchCustomer('1');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/customers/1/');
  });
});

describe('createCustomer', () => {
  it('posts input to /api/v1/customers/', async () => {
    mockedApiClient.post.mockResolvedValueOnce({ id: '1' });
    const input = { full_name: 'Иван', phone: '+77001234567' };

    await createCustomer(input);

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/v1/customers/', input);
  });
});

describe('updateCustomer', () => {
  it('patches input to /api/v1/customers/{id}/', async () => {
    mockedApiClient.patch.mockResolvedValueOnce({ id: '1' });

    await updateCustomer('1', { full_name: 'Пётр' });

    expect(mockedApiClient.patch).toHaveBeenCalledWith('/api/v1/customers/1/', { full_name: 'Пётр' });
  });
});

describe('deleteCustomer', () => {
  it('calls del on /api/v1/customers/{id}/', async () => {
    mockedApiClient.del.mockResolvedValueOnce({});

    await deleteCustomer('1');

    expect(mockedApiClient.del).toHaveBeenCalledWith('/api/v1/customers/1/');
  });
});
```

**Реальная форма `CustomerInput`** (`mobile/src/types/customer.ts`): `{ full_name: string; phone: string; email?: string }` — payload в тестах выше уже ей соответствует, каст не нужен.

- [ ] **Step 2: Запустить, убедиться что проходят**

Run: `cd mobile && npm test -- customers.test.ts`
Expected: PASS, 6 passed.

- [ ] **Step 3: Написать `fabrics.test.ts` (1 функция)**

Create `mobile/src/api/__tests__/fabrics.test.ts`:

```typescript
jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

import { apiClient } from '../client';
import { fetchFabricsList } from '../fabrics';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchFabricsList', () => {
  it('gets /api/v1/inventory/ with page_size, no search', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ count: 0, results: [] });

    const result = await fetchFabricsList();

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/inventory/?page_size=200');
    expect(result).toEqual([]);
  });

  it('appends encoded search query when provided', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ count: 1, results: [{ id: 'f1', name: 'Лён' }] });

    const result = await fetchFabricsList('лён');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/inventory/?page_size=200&search=%D0%BB%D1%91%D0%BD');
    expect(result).toEqual([{ id: 'f1', name: 'Лён' }]);
  });

  it('returns empty array when results is missing from response', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ count: 0 } as never);

    const result = await fetchFabricsList();

    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 4: Запустить, убедиться что проходят**

Run: `cd mobile && npm test -- fabrics.test.ts`
Expected: PASS, 3 passed.

- [ ] **Step 5: Написать `payments.test.ts` (2 функции)**

Create `mobile/src/api/__tests__/payments.test.ts`:

```typescript
jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import { apiClient } from '../client';
import { fetchPayments, recordPayment } from '../payments';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchPayments', () => {
  it('gets /api/payments/', async () => {
    mockedApiClient.get.mockResolvedValueOnce([]);

    await fetchPayments();

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/payments/');
  });
});

describe('recordPayment', () => {
  it('posts payment data to /api/payments/', async () => {
    mockedApiClient.post.mockResolvedValueOnce({
      id: '1', orderId: '1', orderNumber: 'О-2026-001', customerName: 'Иван', amount: 1000,
      type: 'prepayment', method: 'cash', status: 'received',
    });
    const data = { orderId: '1', amount: 1000, type: 'prepayment' as const, method: 'cash' as const };

    await recordPayment(data);

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/payments/', data);
  });
});
```

**Реальная форма `PaymentFormData`** (`mobile/src/types/payment.ts`): `{ orderId: string; amount: number; type: 'prepayment'|'final'|'additional'; method: 'cash'|'card'|'transfer'; notes?: string }` — payload в тесте уже ей соответствует, каст не нужен.

- [ ] **Step 6: Запустить, убедиться что проходят**

Run: `cd mobile && npm test -- payments.test.ts`
Expected: PASS, 2 passed.

- [ ] **Step 7: Написать `staff.test.ts` (1 функция)**

Create `mobile/src/api/__tests__/staff.test.ts`:

```typescript
jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

import { apiClient } from '../client';
import { fetchStaff } from '../staff';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchStaff', () => {
  it('gets /api/v1/staff/ without role filter', async () => {
    mockedApiClient.get.mockResolvedValueOnce([]);

    await fetchStaff();

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/staff/');
  });

  it('appends encoded role query when provided', async () => {
    mockedApiClient.get.mockResolvedValueOnce([]);

    await fetchStaff('Seamstress');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/staff/?role=Seamstress');
  });
});
```

- [ ] **Step 8: Запустить, убедиться что проходят**

Run: `cd mobile && npm test -- staff.test.ts`
Expected: PASS, 2 passed.

- [ ] **Step 9: Написать `work.test.ts` (7 функций)**

Create `mobile/src/api/__tests__/work.test.ts`:

```typescript
jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

import { apiClient } from '../client';
import {
  fetchOwnerQueue, fetchDesignerQueue, fetchQuotesQueue,
  fetchWarehouseQueue, fetchProductionQueue, fetchInstallationQueue, fetchFinanceQueue,
} from '../work';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

beforeEach(() => {
  jest.clearAllMocks();
});

const emptyQueueResponse = { role: 'owner' as const, count: 0, items: [] };

describe('work queue fetchers', () => {
  it('fetchOwnerQueue gets /api/v1/work/owner/', async () => {
    mockedApiClient.get.mockResolvedValueOnce(emptyQueueResponse);
    await fetchOwnerQueue();
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/work/owner/');
  });

  it('fetchDesignerQueue gets /api/v1/work/designer/', async () => {
    mockedApiClient.get.mockResolvedValueOnce(emptyQueueResponse);
    await fetchDesignerQueue();
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/work/designer/');
  });

  it('fetchQuotesQueue gets /api/v1/work/quotes/', async () => {
    mockedApiClient.get.mockResolvedValueOnce(emptyQueueResponse);
    await fetchQuotesQueue();
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/work/quotes/');
  });

  it('fetchWarehouseQueue gets /api/v1/work/warehouse/', async () => {
    mockedApiClient.get.mockResolvedValueOnce(emptyQueueResponse);
    await fetchWarehouseQueue();
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/work/warehouse/');
  });

  it('fetchProductionQueue gets /api/v1/work/production/', async () => {
    mockedApiClient.get.mockResolvedValueOnce(emptyQueueResponse);
    await fetchProductionQueue();
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/work/production/');
  });

  it('fetchInstallationQueue gets /api/v1/work/installation/', async () => {
    mockedApiClient.get.mockResolvedValueOnce(emptyQueueResponse);
    await fetchInstallationQueue();
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/work/installation/');
  });

  it('fetchFinanceQueue gets /api/v1/work/finance/', async () => {
    mockedApiClient.get.mockResolvedValueOnce(emptyQueueResponse);
    await fetchFinanceQueue();
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/work/finance/');
  });
});
```

- [ ] **Step 10: Запустить, убедиться что проходят**

Run: `cd mobile && npm test -- work.test.ts`
Expected: PASS, 7 passed.

- [ ] **Step 11: Запустить весь тестовый набор целиком**

Run: `cd mobile && npm test`
Expected: все файлы PASS. Итого: `client.test.ts` (11) + `orders.test.ts` (23) + `customers.test.ts` (6) + `fabrics.test.ts` (3) + `payments.test.ts` (2) + `staff.test.ts` (2) + `work.test.ts` (7) = 54 теста, 0 failed.

- [ ] **Step 12: Прогнать typecheck**

Run: `cd mobile && npm run typecheck`
Expected: 0 ошибок.

- [ ] **Step 13: Показать diff и закоммитить (после одобрения пользователя)**

```bash
git diff --stat
# показать пользователю, дождаться подтверждения
git add mobile/src/api/__tests__/customers.test.ts mobile/src/api/__tests__/fabrics.test.ts mobile/src/api/__tests__/payments.test.ts mobile/src/api/__tests__/staff.test.ts mobile/src/api/__tests__/work.test.ts
git commit -m "test(mobile): покрыть customers/fabrics/payments/staff/work API-модули

Завершает покрытие всего mobile/src/api/ (7 файлов, ~54 теста).
Каждая экспортируемая функция проверена на правильный endpoint,
метод и тело запроса через мокнутый apiClient."
```

---

## Self-Review

**Spec coverage:**
- Стек `jest-expo` + `@testing-library/react-native` + async-storage mock — Task 1. ✅
- Конфигурация `jest.config.js`, скрипт `npm test` — Task 1. ✅
- Структура `mobile/src/api/__tests__/*.test.ts`, один файл на модуль — Task 2-4 (7 файлов). ✅
- Все 10 сценариев `client.ts` из спеки — Task 2, Steps 1-17 покрывают каждый пункт 1:1 (проверено построчно против списка в спеке). ✅
- Каждая экспортируемая функция всех 7 модулей имеет тест — Task 2 (5 методов ApiClient + setUnauthorizedCallback косвенно через тест логаута), Task 3 (21/21 функция orders.ts), Task 4 (5+1+2+1+7 = 16/16 функций остальных модулей). ✅
- `npm test` зелёный, `npm run typecheck` 0 ошибок — проверяется в конце каждой задачи. ✅
- Не менять поведение существующего кода — ни один шаг плана не редактирует `client.ts`/`orders.ts`/etc., только создаёт тестовые файлы и правит `package.json`/добавляет `jest.config.js`. ✅

**Placeholder scan:** пройден — везде даны реальные ассерты с реальными URL/телами запросов, скопированными из прочитанного кода, а не абстрактные "добавить тест на X".

**Type consistency:** имена функций/сигнатур в тестах (`createOrder`, `changeProductionStage`, `fetchFabricsList` и т.д.) взяты дословно из реального кода модулей, прочитанного при написании плана — не изобретены.

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

  afterEach(() => {
    // client.ts stores the unauthorized callback in a module-level `let`, which Jest
    // does not reset between it() blocks in the same file. Reset it here so a mock
    // registered by one test can't leak into (or be silently invoked by) a later one.
    setUnauthorizedCallback(() => {});
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

  it('sends GET without Authorization header when no token stored', async () => {
    mockFetchOnce({ ok: true, status: 200, json: async () => ({}) });

    await client.get('/api/v1/orders/');

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

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

  it('wraps network errors (fetch throws) into ApiError with status 0', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network request failed'));

    await expect(client.get('/api/v1/orders/')).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining('http://10.0.2.2:8000'),
    });
  });

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
});

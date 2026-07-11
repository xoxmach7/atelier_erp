import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const DEFAULT_API_BASE_URL = 'http://10.0.2.2:8000';

export function getBaseUrl(): string {
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

// AuthContext registers this callback so client can trigger logout on 401
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedCallback(cb: () => void) {
  onUnauthorized = cb;
}

export class ApiClient {
  private baseUrl: string;
  // Prevent multiple simultaneous refresh requests
  private refreshPromise: Promise<string | null> | null = null;

  constructor() {
    this.baseUrl = getBaseUrl();
  }

  private async refreshAccessToken(): Promise<string | null> {
    // If already refreshing, wait for that promise
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const refreshToken = await SecureStore.getItemAsync(STORAGE.refresh);
        if (!refreshToken) return null;

        const res = await fetch(`${this.baseUrl}/api/auth/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: refreshToken }),
        });

        if (!res.ok) return null;

        const { access } = await res.json() as { access: string };
        await SecureStore.setItemAsync(STORAGE.access, access);
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
    const token = await SecureStore.getItemAsync(STORAGE.access);

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

    // 401 → try to refresh token once, then retry request
    if (response.status === 401 && retry) {
      const newToken = await this.refreshAccessToken();
      if (newToken) {
        // Retry with new token
        return this.request<T>(endpoint, options, false);
      }
      // Refresh failed — force logout
      await Promise.all([SecureStore.deleteItemAsync(STORAGE.access), SecureStore.deleteItemAsync(STORAGE.refresh), AsyncStorage.removeItem('atelier_user')]);
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

const DEFAULT_API_BASE_URL = 'http://10.0.2.2:8000';

function getBaseUrl(): string {
  // Expo public env var
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl) {
    return envUrl;
  }
  return DEFAULT_API_BASE_URL;
}

export interface ApiError {
  status: number;
  message: string;
  detail?: string;
}

export class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getBaseUrl();
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = await this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (networkErr) {
      const base = this.baseUrl;
      throw {
        status: 0,
        message: `Не удалось подключиться к серверу (${base}). Убедитесь, что backend запущен и baseURL указан верно.`,
        detail: networkErr instanceof Error ? networkErr.message : String(networkErr),
      } as ApiError;
    }

    if (response.status === 401) {
      throw {
        status: 401,
        message: 'Требуется авторизация. Войдите в систему.',
      } as ApiError;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        message: errorData.detail || errorData.error || `Ошибка сервера: HTTP ${response.status}`,
        detail: JSON.stringify(errorData),
      } as ApiError;
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  private async getToken(): Promise<string | null> {
    // Placeholder — заменить на AsyncStorage или SecureStore
    return null;
  }

  public async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  public async post<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  public async patch<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }
}

export const apiClient = new ApiClient();

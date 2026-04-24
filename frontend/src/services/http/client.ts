/**
 * Base HTTP Client for Atelier ERP API
 * Handles request/response logic, error handling, and automatic token refresh
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

const STORAGE_KEYS = {
  accessToken: "atelier_access_token",
  refreshToken: "atelier_refresh_token",
  user: "atelier_user",
} as const;

/**
 * Token refresh state management
 * Prevents multiple simultaneous refresh requests
 */
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

/**
 * Callback to notify AuthContext of token update
 * Set by AuthProvider on initialization
 */
let onTokenRefreshed: ((token: string) => void) | null = null;

export function setTokenRefreshCallback(callback: (token: string) => void): void {
  onTokenRefreshed = callback;
}

/**
 * Get the stored access token from localStorage
 * Note: This runs on client-side only
 */
function getAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(STORAGE_KEYS.accessToken);
}

/**
 * Get the stored refresh token from localStorage
 */
function getRefreshToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(STORAGE_KEYS.refreshToken);
}

/**
 * Update access token in localStorage and notify AuthContext
 */
function setAccessToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(STORAGE_KEYS.accessToken, token);
  onTokenRefreshed?.(token);
}

/**
 * Clear all auth storage and redirect to login
 */
function clearAuthStorage(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.refreshToken);
  localStorage.removeItem(STORAGE_KEYS.user);
}

/**
 * Perform token refresh request
 * Returns new access token or throws error
 */
async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new ApiClientError("No refresh token available", 401);
  }

  const response = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh: refreshToken }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiClientError(
      errorData.detail || "Token refresh failed",
      response.status,
      errorData
    );
  }

  const data = await response.json();
  const newAccessToken = data.access;

  if (!newAccessToken) {
    throw new ApiClientError("Invalid token response", 500);
  }

  setAccessToken(newAccessToken);
  return newAccessToken;
}

/**
 * Execute token refresh with lock to prevent concurrent requests
 */
async function executeTokenRefresh(): Promise<string> {
  // If already refreshing, wait for that promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = refreshAccessToken();

  try {
    const token = await refreshPromise;
    return token;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
}

/**
 * Build headers with optional auth token
 */
function buildHeaders(customHeaders?: HeadersInit, accessToken?: string | null): HeadersInit {
  const token = accessToken ?? getAccessToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...customHeaders,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

interface ApiError {
  message: string;
  status: number;
  data?: unknown;
}

class ApiClientError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.data = data;
  }
}

interface RequestConfig extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(`${API_BASE_URL}${endpoint}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // Clone response to read body without consuming the original
    const clonedResponse = response.clone();
    let errorData: unknown;
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;

    try {
      // Try to parse as JSON first
      errorData = await clonedResponse.json();
      // Extract meaningful message from backend DRF error format
      if (typeof errorData === "object" && errorData !== null) {
        if ("detail" in errorData && typeof errorData.detail === "string") {
          errorMessage = errorData.detail;
        } else if ("message" in errorData && typeof errorData.message === "string") {
          errorMessage = errorData.message;
        } else {
          // Try to extract first error message from field errors
          const firstError = Object.values(errorData).flat()[0];
          if (typeof firstError === "string") {
            errorMessage = firstError;
          }
        }
      }
    } catch {
      // If JSON parsing fails, read as text from original response
      try {
        errorData = await response.text();
        if (typeof errorData === "string" && errorData.trim()) {
          errorMessage = errorData.trim();
        }
      } catch {
        errorData = null;
      }
    }

    // Provide specific messages for auth errors
    if (response.status === 401) {
      errorMessage = errorMessage || "Authentication required. Please log in to access this resource.";
    } else if (response.status === 403) {
      errorMessage = errorMessage || "Access denied. You don't have permission to access this resource.";
    }

    throw new ApiClientError(errorMessage, response.status, errorData);
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/**
 * Check if response is 401 Unauthorized due to expired token
 * (not due to missing token or invalid credentials)
 */
function isTokenExpiredResponse(response: Response): boolean {
  return response.status === 401 && getAccessToken() !== null;
}

/**
 * Handle token refresh failure by clearing auth and redirecting
 */
function handleRefreshFailure(): void {
  clearAuthStorage();
  // Trigger auth context logout via redirect
  // AuthContext will detect missing tokens on next state check
  window.location.href = "/login";
}

/**
 * Execute HTTP request with automatic token refresh on 401
 * Retries the request once after successful refresh
 */
async function executeRequestWithRefresh<T>(
  requestFn: (accessToken?: string | null) => Promise<Response>
): Promise<T> {
  const accessToken = getAccessToken();
  let response = await requestFn(accessToken);

  // If 401 and we had a token, try to refresh
  if (isTokenExpiredResponse(response)) {
    try {
      const newToken = await executeTokenRefresh();
      // Retry the original request with new token
      response = await requestFn(newToken);
    } catch (refreshError) {
      // Refresh failed - clear auth and redirect
      handleRefreshFailure();
      throw refreshError;
    }
  }

  return handleResponse<T>(response);
}

export async function get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
  const url = buildUrl(endpoint, config?.params);

  return executeRequestWithRefresh<T>((accessToken) =>
    fetch(url, {
      method: "GET",
      headers: buildHeaders(config?.headers, accessToken),
      ...config,
    })
  );
}

export async function post<T>(endpoint: string, data: unknown, config?: RequestConfig): Promise<T> {
  const url = buildUrl(endpoint);

  return executeRequestWithRefresh<T>((accessToken) =>
    fetch(url, {
      method: "POST",
      headers: buildHeaders(config?.headers, accessToken),
      body: JSON.stringify(data),
      ...config,
    })
  );
}

export async function put<T>(endpoint: string, data: unknown, config?: RequestConfig): Promise<T> {
  const url = buildUrl(endpoint);

  return executeRequestWithRefresh<T>((accessToken) =>
    fetch(url, {
      method: "PUT",
      headers: buildHeaders(config?.headers, accessToken),
      body: JSON.stringify(data),
      ...config,
    })
  );
}

export async function patch<T>(endpoint: string, data: unknown, config?: RequestConfig): Promise<T> {
  const url = buildUrl(endpoint);

  return executeRequestWithRefresh<T>((accessToken) =>
    fetch(url, {
      method: "PATCH",
      headers: buildHeaders(config?.headers, accessToken),
      body: JSON.stringify(data),
      ...config,
    })
  );
}

export async function del<T>(endpoint: string, config?: RequestConfig): Promise<T> {
  const url = buildUrl(endpoint);

  return executeRequestWithRefresh<T>((accessToken) =>
    fetch(url, {
      method: "DELETE",
      headers: buildHeaders(config?.headers, accessToken),
      ...config,
    })
  );
}

export { ApiClientError, API_BASE_URL };
export type { ApiError, RequestConfig };

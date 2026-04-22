/**
 * Base HTTP Client for Atelier ERP API
 * Handles request/response logic and error handling
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

const STORAGE_KEYS = {
  accessToken: "atelier_access_token",
} as const;

/**
 * Get the stored access token from localStorage
 * Note: This runs on client-side only
 */
function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(STORAGE_KEYS.accessToken);
}

/**
 * Build headers with optional auth token
 */
function buildHeaders(customHeaders?: HeadersInit): HeadersInit {
  const token = getAuthToken();
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

export async function get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
  const url = buildUrl(endpoint, config?.params);

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(config?.headers),
    ...config,
  });

  return handleResponse<T>(response);
}

export async function post<T>(endpoint: string, data: unknown, config?: RequestConfig): Promise<T> {
  const url = buildUrl(endpoint);

  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(config?.headers),
    body: JSON.stringify(data),
    ...config,
  });

  return handleResponse<T>(response);
}

export async function put<T>(endpoint: string, data: unknown, config?: RequestConfig): Promise<T> {
  const url = buildUrl(endpoint);

  const response = await fetch(url, {
    method: "PUT",
    headers: buildHeaders(config?.headers),
    body: JSON.stringify(data),
    ...config,
  });

  return handleResponse<T>(response);
}

export async function patch<T>(endpoint: string, data: unknown, config?: RequestConfig): Promise<T> {
  const url = buildUrl(endpoint);

  const response = await fetch(url, {
    method: "PATCH",
    headers: buildHeaders(config?.headers),
    body: JSON.stringify(data),
    ...config,
  });

  return handleResponse<T>(response);
}

export async function del<T>(endpoint: string, config?: RequestConfig): Promise<T> {
  const url = buildUrl(endpoint);

  const response = await fetch(url, {
    method: "DELETE",
    headers: buildHeaders(config?.headers),
    ...config,
  });

  return handleResponse<T>(response);
}

export { ApiClientError, API_BASE_URL };
export type { ApiError, RequestConfig };

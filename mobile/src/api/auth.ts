import { apiClient } from './client';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    role: string;
  };
}

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/api/auth/login/', credentials);
}

export async function demoLogin(): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/api/auth/demo-login/', {});
}

export async function logout(): Promise<void> {
  return apiClient.post<void>('/api/auth/logout/', {});
}

import { useState, useCallback } from 'react';
import type { AuthResponse } from '../api/auth';

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthResponse['user'] | null;
  token: string | null;
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
  });

  const login = useCallback((response: AuthResponse) => {
    setAuth({
      isAuthenticated: true,
      user: response.user,
      token: response.token,
    });
  }, []);

  const logout = useCallback(() => {
    setAuth({
      isAuthenticated: false,
      user: null,
      token: null,
    });
  }, []);

  return { ...auth, login, logout };
}

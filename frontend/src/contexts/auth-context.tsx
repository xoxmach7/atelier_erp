"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { setTokenRefreshCallback } from "@/services/http/client";
import type { User, TokenPair, LoginCredentials, AuthState } from "@/types/auth";

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: (redirect?: boolean) => void;
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  accessToken: "atelier_access_token",
  refreshToken: "atelier_refresh_token",
  user: "atelier_user",
} as const;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Register token refresh callback with HTTP client
  // This updates state when HTTP client refreshes the token
  useEffect(() => {
    setTokenRefreshCallback((newAccessToken: string) => {
      setState((prev) => ({
        ...prev,
        accessToken: newAccessToken,
      }));
    });
  }, []);

  // Load auth state from localStorage on mount
  useEffect(() => {
    const loadAuthState = () => {
      try {
        const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken);
        const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
        const userJson = localStorage.getItem(STORAGE_KEYS.user);

        if (accessToken && refreshToken && userJson) {
          const user = JSON.parse(userJson) as User;
          setState({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    loadAuthState();
  }, []);

  const fetchCurrentUser = useCallback(async (token: string): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/me/`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch user");
    }

    return response.json();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    // Get tokens
    const tokenResponse = await fetch(`${API_BASE_URL}/auth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      throw new Error(error.detail || "Invalid credentials");
    }

    const tokens: TokenPair = await tokenResponse.json();

    // Fetch current user
    const user = await fetchCurrentUser(tokens.access);

    // Store in localStorage
    localStorage.setItem(STORAGE_KEYS.accessToken, tokens.access);
    localStorage.setItem(STORAGE_KEYS.refreshToken, tokens.refresh);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));

    // Update state
    setState({
      user,
      accessToken: tokens.access,
      refreshToken: tokens.refresh,
      isAuthenticated: true,
      isLoading: false,
    });
  }, [fetchCurrentUser]);

  const logout = useCallback((redirect: boolean = true) => {
    localStorage.removeItem(STORAGE_KEYS.accessToken);
    localStorage.removeItem(STORAGE_KEYS.refreshToken);
    localStorage.removeItem(STORAGE_KEYS.user);

    setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });

    if (redirect) {
      window.location.href = "/login";
    }
  }, []);

  const getAccessToken = useCallback(() => {
    return state.accessToken;
  }, [state.accessToken]);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    getAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

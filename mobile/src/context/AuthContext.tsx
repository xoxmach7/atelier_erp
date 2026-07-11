import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { setUnauthorizedCallback } from '../api/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_superuser: boolean;
  groups: string[]; // e.g. ['Designer', 'Manager']
}

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Determine the primary role key for work queues */
  primaryRole: RoleKey;
}

export type RoleKey =
  | 'owner'
  | 'designer'
  | 'quotes'
  | 'warehouse'
  | 'production'
  | 'installation'
  | 'finance';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  accessToken: 'atelier_access_token',
  refreshToken: 'atelier_refresh_token',
  user: 'atelier_user',
} as const;

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:8000';

// ─── Role mapping (backend group name → RoleKey) ─────────────────────────────

function groupsToRole(groups: string[], isSuperuser: boolean): RoleKey {
  // 'Owner' — каноничное имя группы (см. бэкенд atelier_erp/roles.py).
  // 'Manager'/'Admin' оставлены как легаси-алиасы на случай нераскатанной канонизации.
  if (isSuperuser || groups.includes('Owner') || groups.includes('Manager') || groups.includes('Admin')) {
    return 'owner';
  }
  if (groups.includes('Designer')) return 'designer';
  if (groups.includes('Warehouse')) return 'warehouse';
  if (groups.includes('Seamstress')) return 'production';
  if (groups.includes('Installer')) return 'installation';
  if (groups.includes('Finance')) return 'finance';
  // fallback — show owner view (all orders)
  return 'owner';
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Load persisted auth on mount
  useEffect(() => {
    const restore = async () => {
      try {
        const [access, refresh, userJson] = await Promise.all([
          SecureStore.getItemAsync(STORAGE_KEYS.accessToken),
          SecureStore.getItemAsync(STORAGE_KEYS.refreshToken),
          AsyncStorage.getItem(STORAGE_KEYS.user),
        ]);

        if (access && refresh && userJson) {
          const user: AuthUser = JSON.parse(userJson);
          setState({
            user,
            accessToken: access,
            refreshToken: refresh,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    restore();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    // 1. Get JWT tokens
    const tokenRes = await fetch(`${API_BASE_URL}/api/auth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({}));
      throw new Error(err.detail ?? 'Неверный логин или пароль');
    }

    const { access, refresh } = await tokenRes.json() as { access: string; refresh: string };

    // 2. Fetch current user (with groups)
    const meRes = await fetch(`${API_BASE_URL}/api/me/`, {
      headers: { Authorization: `Bearer ${access}` },
    });

    if (!meRes.ok) {
      throw new Error('Не удалось получить данные пользователя');
    }

    const user: AuthUser = await meRes.json();

    // 3. Persist — токены в SecureStore (зашифровано), профиль пользователя
    // (не секрет) в AsyncStorage.
    await Promise.all([
      SecureStore.setItemAsync(STORAGE_KEYS.accessToken, access),
      SecureStore.setItemAsync(STORAGE_KEYS.refreshToken, refresh),
      AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user)),
    ]);

    setState({
      user,
      accessToken: access,
      refreshToken: refresh,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const logout = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.accessToken),
      SecureStore.deleteItemAsync(STORAGE_KEYS.refreshToken),
      AsyncStorage.removeItem(STORAGE_KEYS.user),
    ]);

    setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  // Register logout callback so ApiClient can force logout on failed refresh
  React.useEffect(() => {
    setUnauthorizedCallback(() => {
      setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    });
  }, []);

  const primaryRole: RoleKey = state.user
    ? groupsToRole(state.user.groups, state.user.is_superuser)
    : 'owner';

  return (
    <AuthContext.Provider value={{ ...state, login, logout, primaryRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider');
  return ctx;
}

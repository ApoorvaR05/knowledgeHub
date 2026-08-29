import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '../types';
import { authApi } from '../api/client';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, role?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('token'),
    loading: true,
  });

  // On mount — verify stored token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setState(s => ({ ...s, loading: false }));
      return;
    }
    authApi
      .me()
      .then(res => {
        setState({ user: res.data, token, loading: false });
      })
      .catch(() => {
        localStorage.removeItem('token');
        setState({ user: null, token: null, loading: false });
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    const { token } = res.data;
    localStorage.setItem('token', token);
    const me = await authApi.me();
    setState({ user: me.data, token, loading: false });
  }, []);

  const register = useCallback(async (email: string, password: string, role?: string) => {
    const res = await authApi.register(email, password, role);
    const { token } = res.data;
    localStorage.setItem('token', token);
    const me = await authApi.me();
    setState({ user: me.data, token, loading: false });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setState({ user: null, token: null, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

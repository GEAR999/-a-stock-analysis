'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { api } from '@/lib/api-client';

interface User {
  id: string;
  email: string;
  username: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (email: string, username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  skipLocalMode: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 直接调用 /api/auth/me，middleware 会自动检查 cookie
        // 如果 cookie 无效/过期，API 返回 401
        const res = await api.auth.me();
        if (res.ok && res.data) {
          setUser(res.data as User);
        }
      } catch {
        // 未登录
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();

    // 监听未授权事件
    const handleUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    if (res.ok && res.data) {
      setUser((res.data as { user: User }).user);
      return { ok: true };
    }
    return { ok: false, error: res.error || '登录失败' };
  }, []);

  const register = useCallback(async (email: string, username: string, password: string) => {
    const res = await api.auth.register(email, username, password);
    if (res.ok && res.data) {
      setUser((res.data as { user: User }).user);
      return { ok: true };
    }
    return { ok: false, error: res.error || '注册失败' };
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setUser(null);
  }, []);

  // 跳过登录，使用本地模式
  const skipLocalMode = useCallback(() => {
    setUser({ id: 'local', email: 'local', username: '本地用户' });
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      skipLocalMode,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

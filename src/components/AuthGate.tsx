'use client';

import { useAuth } from '@/hooks/useAuth';
import LoginPage from '@/app/login/page';
import type { ReactNode } from 'react';

/**
 * 认证门控组件
 * - 当 DATABASE_URL 未配置时，跳过认证（本地模式）
 * - 当 DATABASE_URL 已配置时，要求登录
 * - 提供"跳过登录，使用本地数据"选项
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  // 检查是否处于本地模式（用户选择了跳过登录）
  const isLocalMode = typeof window !== 'undefined' && localStorage.getItem('auth_local_mode') === 'true';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-[var(--text-secondary)] text-sm">加载中...</div>
      </div>
    );
  }

  // 已登录 或 本地模式 → 显示主界面
  if (isAuthenticated || isLocalMode) {
    return <>{children}</>;
  }

  // 未登录 → 显示登录页面（带"跳过"选项）
  return <LoginPage />;
}

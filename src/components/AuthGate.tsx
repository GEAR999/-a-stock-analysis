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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e17]">
        <div className="text-[#94a3b8] text-sm">加载中...</div>
      </div>
    );
  }

  // 已登录或未配置数据库 → 显示主界面
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // 未登录 → 显示登录页面（带"跳过"选项）
  return <LoginPage />;
}

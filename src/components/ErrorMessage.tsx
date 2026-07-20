'use client';

import React from 'react';
import type { ApiErrorType } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/api-client';

interface ErrorMessageProps {
  /** 错误类型 */
  type: ApiErrorType | 'empty';
  /** 自定义消息（覆盖默认） */
  message?: string;
  /** 是否可重试 */
  retryable?: boolean;
  /** 重试回调 */
  onRetry?: () => void;
  /** 额外类名 */
  className?: string;
}

const errorIcons: Record<string, React.ReactNode> = {
  network: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636a9 9 0 11-12.728 0M12 2v6m0 8v6m-6.364-6.364l4.243-4.243m4.242 0l4.243 4.243" />
    </svg>
  ),
  timeout: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  not_found: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  server: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
    </svg>
  ),
  empty: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  ),
  unknown: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  ),
};

const errorColors: Record<string, string> = {
  network: 'text-amber-400',
  timeout: 'text-amber-400',
  not_found: 'text-gray-400',
  server: 'text-red-400',
  empty: 'text-gray-500',
  unknown: 'text-gray-400',
};

export default function ErrorMessage({
  type,
  message,
  retryable,
  onRetry,
  className = '',
}: ErrorMessageProps) {
  const defaultMessage = type === 'empty' ? '暂无数据' : getErrorMessage(type);
  const displayMessage = message || defaultMessage;
  const isRetryable = retryable ?? (type !== 'not_found' && type !== 'empty');
  const icon = errorIcons[type] || errorIcons.unknown;
  const color = errorColors[type] || errorColors.unknown;

  return (
    <div className={`flex flex-col items-center justify-center py-8 px-4 ${className}`}>
      <div className={`${color} mb-3`}>{icon}</div>
      <p className="text-sm text-gray-400 text-center mb-3">{displayMessage}</p>
      {isRetryable && onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-1.5 text-xs rounded border border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-gray-600 transition-colors"
        >
          重试
        </button>
      )}
    </div>
  );
}

// ============================================================
// 离线缓存提示条
// ============================================================

interface OfflineBannerProps {
  /** 缓存更新时间戳 */
  cachedAt: number;
  /** 是否在线 */
  isOnline: boolean;
  className?: string;
}

export function OfflineBanner({ cachedAt, isOnline, className = '' }: OfflineBannerProps) {
  const timeStr = new Date(cachedAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 bg-amber-900/30 border border-amber-700/50 rounded text-xs ${className}`}>
      <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      <span className="text-amber-300">
        当前显示离线缓存数据（更新于 {timeStr}）
        {isOnline ? '，网络恢复后自动刷新' : '，请检查网络连接'}
      </span>
    </div>
  );
}

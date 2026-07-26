'use client';

import { useState } from 'react';

interface UserFriendlyErrorProps {
  type: 'network' | 'data' | 'auth' | 'system' | 'unknown';
  title?: string;
  message: string;
  retry?: () => void;
  showDetails?: boolean;
}

const ERROR_CONFIG: Record<string, { icon: string; color: string; bgColor: string; borderColor: string }> = {
  network: {
    icon: '',
    color: 'text-[#ef4444]',
    bgColor: 'bg-[#ef4444]/5',
    borderColor: 'border-[#ef4444]/20',
  },
  data: {
    icon: '',
    color: 'text-[#f59e0b]',
    bgColor: 'bg-[#f59e0b]/5',
    borderColor: 'border-[#f59e0b]/20',
  },
  auth: {
    icon: '',
    color: 'text-[#3b82f6]',
    bgColor: 'bg-[#3b82f6]/5',
    borderColor: 'border-[#3b82f6]/20',
  },
  system: {
    icon: '',
    color: 'text-[#ef4444]',
    bgColor: 'bg-[#ef4444]/5',
    borderColor: 'border-[#ef4444]/20',
  },
  unknown: {
    icon: '',
    color: 'text-[var(--text-secondary)]',
    bgColor: 'bg-[var(--surface-input)]',
    borderColor: 'border-[var(--border-default)]',
  },
};

export function UserFriendlyError({
  type,
  title,
  message,
  retry,
  showDetails = false,
}: UserFriendlyErrorProps) {
  const [showTechnical, setShowTechnical] = useState(false);
  const config = ERROR_CONFIG[type] || ERROR_CONFIG.unknown;

  const friendlyTitles: Record<string, string> = {
    network: '网络连接问题',
    data: '数据加载失败',
    auth: '需要登录',
    system: '系统繁忙',
    unknown: '出现了一些问题',
  };

  const displayTitle = title || friendlyTitles[type] || '出现了一些问题';

  return (
    <div className={`p-4 rounded border ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-start gap-3">
        <span className={`text-xl ${config.color} flex-shrink-0`}>{config.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-semibold ${config.color} mb-1`}>{displayTitle}</h3>
          <p className="text-xs text-[var(--text-secondary)] mb-3">{message}</p>

          <div className="flex items-center gap-2 flex-wrap">
            {retry && (
              <button
                onClick={retry}
                className="px-3 py-1 text-xs rounded bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
              >
                
              </button>
            )}
            {showDetails && (
              <button
                onClick={() => setShowTechnical(!showTechnical)}
                className="px-3 py-1 text-xs rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
              >
                {showTechnical ? '隐藏详情' : '查看详情'}
              </button>
            )}
          </div>

          {showTechnical && showDetails && (
            <div className="mt-3 p-2 bg-[var(--surface-input)] rounded text-xs font-mono text-[var(--text-secondary)] overflow-auto max-h-32">
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 全屏错误页面
interface FullScreenErrorProps {
  type: 'network' | 'system' | 'auth';
  title?: string;
  message: string;
  retry?: () => void;
}

export function FullScreenError({ type, title, message, retry }: FullScreenErrorProps) {
  const config = ERROR_CONFIG[type];

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)]">
      <div className="text-center max-w-md px-6">
        <div className={`text-6xl mb-4 ${config.color}`}>{config.icon}</div>
        <h1 className={`text-xl font-semibold ${config.color} mb-2`}>
          {title || ERROR_CONFIG[type] ? '系统繁忙' : '出现了一些问题'}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">{message}</p>
        {retry && (
          <button
            onClick={retry}
            className="px-6 py-2 rounded bg-[var(--accent)] text-white text-sm hover:opacity-90 transition-opacity"
          >
            
          </button>
        )}
      </div>
    </div>
  );
}

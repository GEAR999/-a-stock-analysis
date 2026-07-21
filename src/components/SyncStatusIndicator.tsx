'use client';

import { useEffect, useState } from 'react';
import { getSyncStatus, getLastSyncTime, getSyncError, onSyncStatusChange, type SyncStatus } from '@/lib/api-client-db';

const STATUS_CONFIG: Record<SyncStatus, { label: string; color: string; icon: string }> = {
  idle: { label: '未连接', color: 'text-[var(--text-secondary)]', icon: '○' },
  syncing: { label: '同步中...', color: 'text-[#3b82f6]', icon: '↻' },
  synced: { label: '已同步', color: 'text-[#22c55e]', icon: '✓' },
  error: { label: '同步失败', color: 'text-[#ef4444]', icon: '✕' },
  offline: { label: '离线模式', color: 'text-[#f59e0b]', icon: '◌' },
};

export function SyncStatusIndicator({ className = '' }: { className?: string }) {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSync, setLastSync] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    setStatus(getSyncStatus());
    setLastSync(getLastSyncTime());
    setError(getSyncError());

    const unsubscribe = onSyncStatusChange((newStatus, newError) => {
      setStatus(newStatus);
      setLastSync(getLastSyncTime());
      setError(newError || null);
    });
    return unsubscribe;
  }, []);

  const config = STATUS_CONFIG[status];

  const formatTime = (ts: number): string => {
    if (!ts) return '从未';
    const diff = Date.now() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setShowDetail(true)}
      onMouseLeave={() => setShowDetail(false)}
    >
      <span className={`text-xs ${config.color} flex items-center gap-1 cursor-default`}>
        <span className={status === 'syncing' ? 'animate-spin' : ''}>{config.icon}</span>
        <span className="hidden sm:inline">{config.label}</span>
      </span>

      {showDetail && (
        <div className="absolute bottom-full left-0 mb-2 z-50 px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded text-xs whitespace-nowrap shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className={config.color}>{config.icon}</span>
            <span className="text-[var(--text-primary)]">{config.label}</span>
          </div>
          <div className="text-[var(--text-secondary)]">
            上次同步: {formatTime(lastSync)}
          </div>
          {error && (
            <div className="text-[#ef4444] mt-1">
              错误: {error}
            </div>
          )}
          {status === 'error' && (
            <div className="text-[var(--text-secondary)] mt-1">
              数据已保存在本地，恢复连接后将自动同步
            </div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

/**
 * 数据源状态卡片
 */

import React from 'react';
import type { SourceCardProps } from '@/lib/monitor/types';

const statusConfig = {
  ok: { color: '#10b981', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/30', label: '正常', icon: '✓' },
  degraded: { color: '#f59e0b', bg: 'bg-amber-500/10', ring: 'ring-amber-500/30', label: '降级', icon: '⚠' },
  down: { color: '#ef4444', bg: 'bg-red-500/10', ring: 'ring-red-500/30', label: '不可用', icon: '✗' },
};

export default function SourceCard({ name, displayName, status, latency, lastCheck, lastError }: SourceCardProps) {
  const cfg = statusConfig[status];
  const checkTime = lastCheck ? new Date(lastCheck).toLocaleTimeString('zh-CN') : '--';

  return (
    <div className={`rounded-xl border p-4 ${cfg.bg} ring-1 ${cfg.ring} transition-all duration-300`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full animate-pulse"
            style={{ backgroundColor: cfg.color }}
          />
          <span className="font-semibold text-sm">{displayName}</span>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: cfg.color + '20', color: cfg.color }}
        >
          {cfg.icon} {cfg.label}
        </span>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="opacity-60">响应时间</span>
          <span className="font-mono">{latency > 0 ? `${latency}ms` : '--'}</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-60">最后检查</span>
          <span className="font-mono">{checkTime}</span>
        </div>
        {lastError && (
          <div className="flex justify-between">
            <span className="opacity-60">错误</span>
            <span className="text-red-400 truncate max-w-[140px]" title={lastError}>
              {lastError}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

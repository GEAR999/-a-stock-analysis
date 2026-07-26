'use client';

import { useEffect, useState } from 'react';

type SystemStatus = 'healthy' | 'warning' | 'error' | 'unknown';

interface DataSourceStatus {
  status: 'ok' | 'degraded' | 'down';
  latency: number;
  lastCheck: string;
  lastError: string | null;
}

interface HealthSummary {
  mootdx: DataSourceStatus;
  tushare: DataSourceStatus;
  eastmoney: DataSourceStatus;
  overall: 'ok' | 'degraded' | 'down';
  timestamp: string;
  stats?: {
    total: number;
    success: number;
    failed: number;
    fallback: number;
  };
}

const OVERALL_STATUS_MAP: Record<string, SystemStatus> = {
  ok: 'healthy',
  degraded: 'warning',
  down: 'error',
};

const STATUS_CONFIG: Record<SystemStatus, { label: string; color: string; icon: string; bgColor: string }> = {
  healthy: { label: '系统正常', color: 'text-[#22c55e]', icon: '●', bgColor: 'bg-[#22c55e]/10' },
  warning: { label: '部分功能受限', color: 'text-[#f59e0b]', icon: '●', bgColor: 'bg-[#f59e0b]/10' },
  error: { label: '系统异常', color: 'text-[#ef4444]', icon: '●', bgColor: 'bg-[#ef4444]/10' },
  unknown: { label: '状态未知', color: 'text-[var(--text-secondary)]', icon: '○', bgColor: 'bg-[var(--text-secondary)]/10' },
};

const SOURCE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ok: { label: '正常', color: 'text-[#22c55e]' },
  degraded: { label: '降级', color: 'text-[#f59e0b]' },
  down: { label: '不可用', color: 'text-[#ef4444]' },
};

const SOURCE_LABELS: Record<string, string> = {
  mootdx: 'Mootdx',
  tushare: 'Tushare',
  eastmoney: '东方财富',
};

export default function SystemStatusIndicator() {
  const [health, setHealth] = useState<HealthSummary | null>(null);
  const [status, setStatus] = useState<SystemStatus>('unknown');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/health/summary', { cache: 'no-store' });
        if (!res.ok) throw new Error('health check failed');
        const data: HealthSummary = await res.json();
        if (cancelled) return;
        setHealth(data);
        setStatus(OVERALL_STATUS_MAP[data.overall] || 'unknown');
      } catch {
        if (cancelled) return;
        setStatus('error');
        setHealth(null);
      }
    };

    fetchHealth();
    const timer = setInterval(fetchHealth, 30000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const config = STATUS_CONFIG[status];

  return (
    <div className="relative">
      {/* 状态指示器按钮 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${config.bgColor} ${config.color} hover:opacity-80`}
        title={config.label}
      >
        <span className={config.color}>{config.icon}</span>
        <span className="hidden sm:inline">{config.label}</span>
      </button>

      {/* 展开详情面板 */}
      {expanded && health && (
        <>
          {/* 背景遮罩 */}
          <div className="fixed inset-0 z-40" onClick={() => setExpanded(false)} />

          {/* 详情面板 */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--surface-raised)] border border-[var(--border-strong)] rounded shadow-lg z-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">系统状态</h3>
              <button onClick={() => setExpanded(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                
              </button>
            </div>

            {/* 整体状态 */}
            <div className={`p-3 rounded mb-3 ${config.bgColor}`}>
              <div className="flex items-center gap-2">
                <span className={`text-lg ${config.color}`}>{config.icon}</span>
                <div>
                  <div className={`text-sm font-medium ${config.color}`}>{config.label}</div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    更新于 {new Date(health.timestamp).toLocaleTimeString('zh-CN')}
                  </div>
                </div>
              </div>
            </div>

            {/* 数据源状态 */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">数据源状态</div>
              {(['mootdx', 'tushare', 'eastmoney'] as const).map((source) => {
                const sourceHealth = health[source];
                const sourceConfig = SOURCE_STATUS_CONFIG[sourceHealth.status];
                return (
                  <div key={source} className="flex items-center justify-between p-2 bg-[var(--surface-input)] rounded">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${sourceConfig.color}`}>●</span>
                      <span className="text-xs text-[var(--text-primary)]">{SOURCE_LABELS[source]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${sourceConfig.color}`}>{sourceConfig.label}</span>
                      <span className="text-xs text-[var(--text-secondary)]">{sourceHealth.latency}ms</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 统计信息 */}
            {health.stats && (
              <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">请求统计</div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{health.stats.total}</div>
                    <div className="text-xs text-[var(--text-secondary)]">总计</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#22c55e]">{health.stats.success}</div>
                    <div className="text-xs text-[var(--text-secondary)]">成功</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#ef4444]">{health.stats.failed}</div>
                    <div className="text-xs text-[var(--text-secondary)]">失败</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#f59e0b]">{health.stats.fallback}</div>
                    <div className="text-xs text-[var(--text-secondary)]">降级</div>
                  </div>
                </div>
              </div>
            )}

            {/* 链接到完整监控页面 */}
            <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
              <a
                href="/monitor"
                className="block text-center text-xs text-[var(--accent)] hover:underline"
                onClick={() => setExpanded(false)}
              >
                查看完整监控面板 →
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

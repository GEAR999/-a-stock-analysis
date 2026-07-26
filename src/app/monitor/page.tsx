'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DataSourceStatus {
  status: 'ok' | 'degraded' | 'down';
  latency: number;
  lastCheck: string;
  lastError: string | null;
}

interface Alert {
  id: string;
  timestamp: number;
  type: 'error' | 'warning' | 'info';
  source: string;
  message: string;
  resolved: boolean;
  resolvedAt?: number;
}

interface MonitorData {
  overall: 'ok' | 'degraded' | 'down';
  healthScore: number;
  timestamp: string;
  mootdx: DataSourceStatus;
  tushare: DataSourceStatus;
  eastmoney: DataSourceStatus;
  stats: {
    total: number;
    success: number;
    failed: number;
    fallback: number;
  };
  alerts: {
    total: number;
    unresolved: number;
    recent: Alert[];
  };
  performance: {
    avgLatency: number;
    maxLatency: number;
    uptime: string;
  };
}

const STATUS_CONFIG = {
  ok: { label: '正常', color: 'text-[#22c55e]', bgColor: 'bg-[#22c55e]/10', borderColor: 'border-[#22c55e]/20' },
  degraded: { label: '降级', color: 'text-[#f59e0b]', bgColor: 'bg-[#f59e0b]/10', borderColor: 'border-[#f59e0b]/20' },
  down: { label: '不可用', color: 'text-[#ef4444]', bgColor: 'bg-[#ef4444]/10', borderColor: 'border-[#ef4444]/20' },
};

const ALERT_TYPE_CONFIG = {
  error: { icon: '', color: 'text-[#ef4444]', bgColor: 'bg-[#ef4444]/5' },
  warning: { icon: '', color: 'text-[#f59e0b]', bgColor: 'bg-[#f59e0b]/5' },
  info: { icon: '', color: 'text-[#3b82f6]', bgColor: 'bg-[#3b82f6]/5' },
};

export default function MonitorPage() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [alertHistory, setAlertHistory] = useState<Alert[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const [monitorRes, alertsRes] = await Promise.all([
          fetch('/api/monitor', { cache: 'no-store' }),
          fetch('/api/monitor/alerts', { cache: 'no-store' }),
        ]);

        if (!monitorRes.ok || !alertsRes.ok) throw new Error('Failed to fetch');

        const monitorData: MonitorData = await monitorRes.json();
        const alertsData = await alertsRes.json();

        if (cancelled) return;

        setData(monitorData);
        setAlertHistory(alertsData.data || []);
      } catch (error) {
        console.error('Failed to fetch monitor data:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    const timer = setInterval(fetchData, 15000); // 15秒刷新

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">加载中...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-[#ef4444]">加载失败，请刷新页面</div>
      </div>
    );
  }

  const overallConfig = STATUS_CONFIG[data.overall];
  const healthScoreColor = data.healthScore >= 80 ? '#22c55e' : data.healthScore >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-6">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm">
            ← 返回主页
          </Link>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">系统监控</h1>
        </div>
        <div className="text-xs text-[var(--text-secondary)]">
          更新于 {new Date(data.timestamp).toLocaleTimeString('zh-CN')}
        </div>
      </div>

      {/* 健康分数卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className={`p-6 rounded border ${overallConfig.bgColor} ${overallConfig.borderColor}`}>
          <div className="text-xs text-[var(--text-secondary)] mb-2">系统健康</div>
          <div className="flex items-end gap-2">
            <span className={`text-4xl font-bold ${overallConfig.color}`}>{data.healthScore}</span>
            <span className={`text-sm ${overallConfig.color} mb-1`}>/100</span>
          </div>
          <div className={`text-sm ${overallConfig.color} mt-2`}>{overallConfig.label}</div>
        </div>

        <div className="p-6 rounded border border-[var(--border-default)] bg-[var(--bg-panel)]">
          <div className="text-xs text-[var(--text-secondary)] mb-2">平均延迟</div>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold text-[var(--text-primary)]">{data.performance.avgLatency}</span>
            <span className="text-sm text-[var(--text-secondary)] mb-1">ms</span>
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-2">
            最大 {data.performance.maxLatency}ms
          </div>
        </div>

        <div className="p-6 rounded border border-[var(--border-default)] bg-[var(--bg-panel)]">
          <div className="text-xs text-[var(--text-secondary)] mb-2">可用性</div>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold text-[#22c55e]">{data.performance.uptime}</span>
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-2">
            成功 {data.stats.success} / 总计 {data.stats.total}
          </div>
        </div>

        <div className="p-6 rounded border border-[var(--border-default)] bg-[var(--bg-panel)]">
          <div className="text-xs text-[var(--text-secondary)] mb-2">未解决告警</div>
          <div className="flex items-end gap-2">
            <span className={`text-4xl font-bold ${data.alerts.unresolved > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
              {data.alerts.unresolved}
            </span>
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-2">
            总计 {data.alerts.total} 条告警
          </div>
        </div>
      </div>

      {/* 数据源状态 */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">数据源状态</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['mootdx', 'tushare', 'eastmoney'] as const).map((source) => {
            const sourceData = data[source];
            const config = STATUS_CONFIG[sourceData.status];
            return (
              <div key={source} className={`p-4 rounded border ${config.bgColor} ${config.borderColor}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {source === 'mootdx' ? 'Mootdx' : source === 'tushare' ? 'Tushare' : '东方财富'}
                  </span>
                  <span className={`text-xs ${config.color}`}>{config.label}</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">延迟</span>
                    <span className="text-[var(--text-primary)]">{sourceData.latency}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">最后检查</span>
                    <span className="text-[var(--text-primary)]">
                      {new Date(sourceData.lastCheck).toLocaleTimeString('zh-CN')}
                    </span>
                  </div>
                  {sourceData.lastError && (
                    <div className="pt-2 border-t border-[var(--border-subtle)]">
                      <span className="text-[var(--text-secondary)]">错误: </span>
                      <span className="text-[#ef4444]">{sourceData.lastError}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 请求统计 */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">请求统计</h2>
        <div className="p-4 rounded border border-[var(--border-default)] bg-[var(--bg-panel)]">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--text-primary)]">{data.stats.total}</div>
              <div className="text-xs text-[var(--text-secondary)]">总请求</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#22c55e]">{data.stats.success}</div>
              <div className="text-xs text-[var(--text-secondary)]">成功</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#ef4444]">{data.stats.failed}</div>
              <div className="text-xs text-[var(--text-secondary)]">失败</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#f59e0b]">{data.stats.fallback}</div>
              <div className="text-xs text-[var(--text-secondary)]">降级</div>
            </div>
          </div>
          {data.stats.total > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[var(--text-secondary)]">成功率:</span>
                <span className="text-[var(--text-primary)]">
                  {((data.stats.success / data.stats.total) * 100).toFixed(1)}%
                </span>
                <div className="flex-1 h-2 bg-[var(--surface-input)] rounded overflow-hidden ml-2">
                  <div
                    className="h-full bg-[#22c55e]"
                    style={{ width: `${(data.stats.success / data.stats.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 告警历史 */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">告警历史</h2>
        <div className="rounded border border-[var(--border-default)] bg-[var(--bg-panel)] overflow-hidden">
          {alertHistory.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-secondary)] text-sm">暂无告警记录</div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)] max-h-96 overflow-auto">
              {alertHistory.map((alert) => {
                const typeConfig = ALERT_TYPE_CONFIG[alert.type];
                return (
                  <div key={alert.id} className={`p-4 ${typeConfig.bgColor}`}>
                    <div className="flex items-start gap-3">
                      <span className={`text-lg ${typeConfig.color} flex-shrink-0`}>{typeConfig.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-[var(--text-primary)]">{alert.source}</span>
                          <span className={`text-xs ${alert.resolved ? 'text-[#22c55e]' : typeConfig.color}`}>
                            {alert.resolved ? '已解决' : '未解决'}
                          </span>
                        </div>
                        <div className="text-sm text-[var(--text-primary)] mb-1">{alert.message}</div>
                        <div className="text-xs text-[var(--text-secondary)]">
                          {new Date(alert.timestamp).toLocaleString('zh-CN')}
                          {alert.resolvedAt && (
                            <span className="ml-2">
                              · 解决于 {new Date(alert.resolvedAt).toLocaleString('zh-CN')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

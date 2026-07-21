'use client';

/**
 * 系统监控面板
 * 路由：/monitor
 * 第31轮第4批需求
 * 
 * 功能：
 * - 数据源状态卡片（绿/黄/红灯）
 * - 请求统计（成功率、响应时间、切换次数）
 * - 异常事件时间线
 * - 健康趋势图
 * - 手动操作按钮
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { HealthSummary, HealthEvent, HealthSnapshot } from '@/lib/monitor/types';
import SourceCard from './SourceCard';
import EventTimeline from './EventTimeline';
import HealthTrendChart from './HealthTrendChart';

const SOURCE_DISPLAY: Record<string, string> = {
  mootdx: 'mootdx (通达信)',
  tushare: 'Tushare (官方API)',
  eastmoney: '东方财富 (备用)',
};

export default function SystemHealthPanel() {
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [snapshots, setSnapshots] = useState<HealthSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, historyRes] = await Promise.all([
        fetch('/api/health/summary'),
        fetch('/api/health/history?hours=24'),
      ]);

      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data);
      }

      if (historyRes.ok) {
        const data = await historyRes.json();
        setEvents(data.events || []);
        setSnapshots(data.snapshots || []);
      }

      setLastRefresh(new Date().toLocaleTimeString('zh-CN'));
    } catch (err) {
      console.error('[Monitor] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleProbe = async () => {
    setProbing(true);
    try {
      const res = await fetch('/api/health/probe', { method: 'POST' });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('[Monitor] probe error:', err);
    } finally {
      setProbing(false);
    }
  };

  // 初始加载 + 30秒自动刷新
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm opacity-60">加载监控数据...</p>
        </div>
      </div>
    );
  }

  const overallColor = summary?.overall === 'ok'
    ? 'text-emerald-400'
    : summary?.overall === 'degraded'
    ? 'text-amber-400'
    : 'text-red-400';

  const overallLabel = summary?.overall === 'ok' ? '运行正常' : summary?.overall === 'degraded' ? '部分降级' : '服务中断';

  return (
    <div className="p-4 space-y-6 max-w-5xl mx-auto">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="px-2.5 py-1.5 text-xs rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-all flex items-center gap-1.5"
          >
            ← 返回
          </a>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span className="text-2xl">📊</span>
              系统监控
            </h1>
            <p className="text-xs opacity-50 mt-1">
              数据源健康状态 · 自动刷新 · 上次更新: {lastRefresh || '--'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${overallColor}`}>
            {overallLabel}
          </span>
          <button
            onClick={handleProbe}
            disabled={probing}
            className="px-3 py-1.5 text-xs rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-all disabled:opacity-50"
          >
            {probing ? '检测中...' : '立即检查'}
          </button>
        </div>
      </div>

      {/* 数据源状态卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {summary && (['mootdx', 'tushare', 'eastmoney'] as const).map(src => (
          <SourceCard
            key={src}
            name={src}
            displayName={SOURCE_DISPLAY[src]}
            status={summary[src].status}
            latency={summary[src].latency}
            lastCheck={summary[src].lastCheck}
            lastError={summary[src].lastError}
          />
        ))}
      </div>

      {/* 请求统计 */}
      {summary && (
        <div className="rounded-xl border border-white/5 p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <span>📈</span> 请求统计（最近1小时）
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="总请求数"
              value={summary.stats.last1h_requests.toLocaleString()}
              icon="📊"
            />
            <StatCard
              label="成功率"
              value={`${(summary.stats.last1h_success_rate * 100).toFixed(1)}%`}
              icon="✅"
              bar={summary.stats.last1h_success_rate}
            />
            <StatCard
              label="平均响应"
              value={`${summary.stats.last1h_avg_latency}ms`}
              icon="⚡"
            />
            <StatCard
              label="自动切换"
              value={`${summary.stats.last1h_fallback_count}次`}
              icon="🔄"
            />
          </div>
        </div>
      )}

      {/* 健康趋势图 + 事件时间线 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 趋势图 */}
        <div className="rounded-xl border border-white/5 p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <span>📉</span> 24小时可用率
          </h2>
          <HealthTrendChart snapshots={snapshots} />
        </div>

        {/* 事件时间线 */}
        <div className="rounded-xl border border-white/5 p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <span>🔔</span> 异常事件
          </h2>
          <EventTimeline events={events} />
        </div>
      </div>
    </div>
  );
}

// ============ 统计卡片子组件 ============

function StatCard({ label, value, icon, bar }: {
  label: string;
  value: string;
  icon: string;
  bar?: number;
}) {
  return (
    <div className="text-center">
      <div className="text-lg mb-0.5">{icon}</div>
      <div className="text-lg font-bold font-mono">{value}</div>
      <div className="text-[10px] opacity-50 mt-0.5">{label}</div>
      {bar !== undefined && (
        <div className="w-full h-1 bg-white/5 rounded-full mt-1.5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${bar * 100}%`,
              backgroundColor: bar >= 0.95 ? '#10b981' : bar >= 0.8 ? '#f59e0b' : '#ef4444',
            }}
          />
        </div>
      )}
    </div>
  );
}

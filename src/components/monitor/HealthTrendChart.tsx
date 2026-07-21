'use client';

/**
 * 健康趋势图（纯SVG实现，无外部依赖）
 * 显示最近24小时数据源可用率
 */

import React, { useMemo } from 'react';
import type { HealthTrendChartProps } from '@/lib/monitor/types';

const SOURCE_COLORS: Record<string, string> = {
  mootdx: '#3b82f6',
  tushare: '#10b981',
  eastmoney: '#f59e0b',
};

const SOURCE_LABELS: Record<string, string> = {
  mootdx: 'mootdx',
  tushare: 'Tushare',
  eastmoney: '东财',
};

export default function HealthTrendChart({ snapshots }: HealthTrendChartProps) {
  // 按数据源分组，计算每个时间点的可用率
  const chartData = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return null;

    const sources = ['mootdx', 'tushare', 'eastmoney'];
    const now = Date.now();
    const hoursAgo = 24;
    const bucketSize = 3600000; // 1小时一个桶

    const data: Record<string, number[]> = {};
    const labels: string[] = [];

    for (let i = hoursAgo - 1; i >= 0; i--) {
      const bucketStart = now - (i + 1) * bucketSize;
      const bucketEnd = now - i * bucketSize;
      const hour = new Date(bucketEnd).getHours();
      labels.push(`${hour}:00`);

      for (const src of sources) {
        if (!data[src]) data[src] = [];
        const bucketSnapshots = snapshots.filter(s => {
          if (!s.checked_at) return false;
          const t = new Date(s.checked_at).getTime();
          return t >= bucketStart && t < bucketEnd && s.source_name === src;
        });
        if (bucketSnapshots.length === 0) {
          data[src].push(100); // 没有数据视为正常
        } else {
          const okCount = bucketSnapshots.filter(s => s.status === 'ok').length;
          data[src].push(Math.round((okCount / bucketSnapshots.length) * 100));
        }
      }
    }

    return { data, labels, sources };
  }, [snapshots]);

  if (!chartData) {
    return (
      <div className="text-center py-8 opacity-50">
        <p className="text-sm">暂无历史数据</p>
        <p className="text-xs mt-1 opacity-60">系统运行一段时间后自动展示</p>
      </div>
    );
  }

  const { data, labels, sources } = chartData;
  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const xStep = chartW / Math.max(labels.length - 1, 1);

  const buildPath = (values: number[]) => {
    return values
      .map((v, i) => {
        const x = padding.left + i * xStep;
        const y = padding.top + chartH - (v / 100) * chartH;
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
      })
      .join(' ');
  };

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* 网格线 */}
        {[0, 25, 50, 75, 100].map(v => {
          const y = padding.top + chartH - (v / 100) * chartH;
          return (
            <g key={v}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.1}
                strokeDasharray="4,4"
              />
              <text
                x={padding.left - 5}
                y={y + 3}
                textAnchor="end"
                fill="currentColor"
                fillOpacity={0.4}
                fontSize={9}
              >
                {v}%
              </text>
            </g>
          );
        })}

        {/* X轴标签（每6小时显示一个） */}
        {labels.map((label, i) => {
          if (i % 6 !== 0 && i !== labels.length - 1) return null;
          const x = padding.left + i * xStep;
          return (
            <text
              key={i}
              x={x}
              y={height - 5}
              textAnchor="middle"
              fill="currentColor"
              fillOpacity={0.4}
              fontSize={9}
            >
              {label}
            </text>
          );
        })}

        {/* 数据线 */}
        {sources.map(src => (
          <g key={src}>
            <path
              d={buildPath(data[src])}
              fill="none"
              stroke={SOURCE_COLORS[src]}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* 数据点 */}
            {data[src].map((v, i) => {
              if (v < 100) { // 只在异常点画点
                const x = padding.left + i * xStep;
                const y = padding.top + chartH - (v / 100) * chartH;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={3}
                    fill={SOURCE_COLORS[src]}
                    stroke="white"
                    strokeWidth={1}
                  />
                );
              }
              return null;
            })}
          </g>
        ))}
      </svg>

      {/* 图例 */}
      <div className="flex justify-center gap-4 mt-2">
        {sources.map(src => (
          <div key={src} className="flex items-center gap-1.5">
            <div
              className="w-3 h-0.5 rounded"
              style={{ backgroundColor: SOURCE_COLORS[src] }}
            />
            <span className="text-[10px] opacity-60">{SOURCE_LABELS[src]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

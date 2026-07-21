'use client';

/**
 * 异常事件时间线
 */

import React from 'react';
import type { EventTimelineProps } from '@/lib/monitor/types';

const levelColors = {
  info: { dot: '#3b82f6', bg: 'bg-blue-500/5', text: 'text-blue-400', label: 'INFO' },
  warn: { dot: '#f59e0b', bg: 'bg-amber-500/5', text: 'text-amber-400', label: 'WARN' },
  error: { dot: '#ef4444', bg: 'bg-red-500/5', text: 'text-red-400', label: 'ERROR' },
};

export default function EventTimeline({ events }: EventTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8 opacity-50">
        <p className="text-sm">暂无异常事件</p>
        <p className="text-xs mt-1 opacity-60">系统运行正常</p>
      </div>
    );
  }

  return (
    <div className="space-y-0 max-h-[400px] overflow-y-auto pr-2">
      {events.slice(0, 50).map((event, idx) => {
        const cfg = levelColors[event.level] || levelColors.info;
        const time = event.created_at
          ? new Date(event.created_at).toLocaleString('zh-CN', { hour12: false })
          : '--';
        const sourceLabel = event.source_name
          ? `[${event.source_name}]`
          : '';

        return (
          <div
            key={event.id || idx}
            className={`relative pl-6 py-2 border-l-2 ${cfg.bg} transition-all hover:pl-7`}
            style={{ borderColor: cfg.dot + '40' }}
          >
            {/* 时间点 */}
            <div
              className="absolute left-0 top-3 w-2.5 h-2.5 rounded-full -translate-x-1/2"
              style={{ backgroundColor: cfg.dot }}
            />

            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.text}`}
                    style={{ backgroundColor: cfg.dot + '15' }}
                  >
                    {cfg.label}
                  </span>
                  {sourceLabel && (
                    <span className="text-[10px] opacity-50 font-mono">{sourceLabel}</span>
                  )}
                </div>
                <p className="text-xs leading-relaxed opacity-80 truncate">
                  {event.description}
                </p>
              </div>
              <span className="text-[10px] opacity-40 font-mono whitespace-nowrap mt-0.5">
                {time}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

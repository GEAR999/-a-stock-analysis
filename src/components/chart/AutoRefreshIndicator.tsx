'use client';

import { useAutoRefresh } from '@/hooks/useAutoRefresh';

interface AutoRefreshIndicatorProps {
  onRefresh: () => void;
}

export function AutoRefreshIndicator({ onRefresh }: AutoRefreshIndicatorProps) {
  const { state, toggle, refresh } = useAutoRefresh(onRefresh);

  return (
    <div className="fixed bottom-24 right-6 z-50">
      <div className="flex items-center gap-2 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded px-3 py-1.5 shadow-lg">
        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full ${
          state.isActive && state.isTradingHours
            ? 'bg-green-400 animate-pulse'
            : 'bg-[var(--text-secondary)]'
        }`} />

        {/* Label */}
        <span className="text-xs text-[var(--text-secondary)]">
          自动刷新：
          <span className={state.isActive && state.isTradingHours ? 'text-[var(--accent-green)]' : 'text-[var(--text-secondary)]'}>
            {state.isTradingHours ? (state.isActive ? 'ON' : 'OFF') : '非交易时段'}
          </span>
        </span>

        {/* Countdown */}
        {state.isActive && state.isTradingHours && (
          <span className="text-xs text-[var(--text-secondary)] font-mono">{state.countdown}s</span>
        )}

        {/* Toggle button */}
        <button
          onClick={toggle}
          className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-card)] hover:bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          title={state.isActive ? '关闭自动刷新' : '开启自动刷新'}
        >
          {state.isActive ? '⏸' : '▶'}
        </button>

        {/* Manual refresh */}
        <button
          onClick={refresh}
          className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-card)] hover:bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          title="立即刷新"
        >
          ↻
        </button>
      </div>
    </div>
  );
}

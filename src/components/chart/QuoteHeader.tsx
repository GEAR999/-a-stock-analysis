'use client';

import { useAppState } from '@/hooks/useAppState';
import { Switch } from '@/components/ui/switch';

export function QuoteHeader() {
  const { currentQuote, selectedStock, isMonitoring, setIsMonitoring } = useAppState();

  if (!selectedStock) {
    return (
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-default)] bg-[var(--bg-primary)]">
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-secondary)]">未选择股票</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">实时监控</span>
          <Switch checked={isMonitoring} onCheckedChange={setIsMonitoring} />
        </div>
      </div>
    );
  }

  // Stock selected but quote not yet loaded
  if (!currentQuote) {
    return (
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-default)] bg-[var(--bg-primary)]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[var(--text-primary)]">{selectedStock.name}</span>
          <span className="text-xs text-[var(--text-secondary)]">{selectedStock.code}</span>
          <span className="text-xs text-[var(--text-secondary)] animate-pulse">行情加载中...</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">实时监控</span>
          <Switch checked={isMonitoring} onCheckedChange={setIsMonitoring} />
        </div>
      </div>
    );
  }

  const isUp = currentQuote.changePercent > 0;
  const isDown = currentQuote.changePercent < 0;
  const colorClass = isUp ? 'text-[var(--accent-red)]' : isDown ? 'text-[var(--accent-green)]' : 'text-[var(--text-secondary)]';

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-default)] bg-[var(--bg-primary)]">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">{currentQuote.name}</span>
          <span className="text-xs text-[var(--text-secondary)] font-mono-num">{currentQuote.code}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-lg font-bold font-mono-num ${colorClass}`}>
            {currentQuote.price.toFixed(2)}
          </span>
          <span className={`text-sm font-mono-num ${colorClass}`}>
            {isUp ? '+' : ''}{currentQuote.change.toFixed(2)}
          </span>
          <span className={`text-sm font-mono-num ${colorClass}`}>
            {isUp ? '+' : ''}{currentQuote.changePercent.toFixed(2)}%
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-[var(--text-secondary)]">开 <span className="text-[var(--text-primary)] font-mono-num">{currentQuote.open.toFixed(2)}</span></span>
          <span className="text-[var(--text-secondary)]">高 <span className="text-[var(--accent-red)] font-mono-num">{currentQuote.high.toFixed(2)}</span></span>
          <span className="text-[var(--text-secondary)]">低 <span className="text-[var(--accent-green)] font-mono-num">{currentQuote.low.toFixed(2)}</span></span>
          <span className="text-[var(--text-secondary)]">量 <span className="text-[var(--text-primary)] font-mono-num">{(currentQuote.volume / 10000).toFixed(0)}万</span></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">实时监控</span>
          <Switch checked={isMonitoring} onCheckedChange={setIsMonitoring} />
        </div>
      </div>
    </div>
  );
}

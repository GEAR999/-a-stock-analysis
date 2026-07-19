'use client';

import { useAppState } from '@/hooks/useAppState';
import { Switch } from '@/components/ui/switch';

export function QuoteHeader() {
  const { currentQuote, selectedStock, isMonitoring, setIsMonitoring } = useAppState();

  if (!selectedStock || !currentQuote) {
    return (
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e293b] bg-[#0d1117]">
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#94a3b8]">未选择股票</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#94a3b8]">实时监控</span>
          <Switch checked={isMonitoring} onCheckedChange={setIsMonitoring} />
        </div>
      </div>
    );
  }

  const isUp = currentQuote.changePercent > 0;
  const isDown = currentQuote.changePercent < 0;
  const colorClass = isUp ? 'text-[#ef4444]' : isDown ? 'text-[#22c55e]' : 'text-[#94a3b8]';

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e293b] bg-[#0d1117]">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#e2e8f0]">{currentQuote.name}</span>
          <span className="text-xs text-[#94a3b8] font-mono-num">{currentQuote.code}</span>
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
          <span className="text-[#94a3b8]">开 <span className="text-[#e2e8f0] font-mono-num">{currentQuote.open.toFixed(2)}</span></span>
          <span className="text-[#94a3b8]">高 <span className="text-[#ef4444] font-mono-num">{currentQuote.high.toFixed(2)}</span></span>
          <span className="text-[#94a3b8]">低 <span className="text-[#22c55e] font-mono-num">{currentQuote.low.toFixed(2)}</span></span>
          <span className="text-[#94a3b8]">量 <span className="text-[#e2e8f0] font-mono-num">{(currentQuote.volume / 10000).toFixed(0)}万</span></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#94a3b8]">实时监控</span>
          <Switch checked={isMonitoring} onCheckedChange={setIsMonitoring} />
        </div>
      </div>
    </div>
  );
}

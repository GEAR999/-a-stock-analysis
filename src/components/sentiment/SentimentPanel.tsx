'use client';

import { useState, useEffect } from 'react';
import type { MarketSentiment } from '@/lib/types';

export function SentimentPanel() {
  const [sentiment, setSentiment] = useState<MarketSentiment | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSentiment = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/stock?action=sentiment');
        const json = await res.json();
        if (json.success) setSentiment(json.data);
      } catch {
        // ignore
      }
      setLoading(false);
    };
    fetchSentiment();
  }, []);

  if (loading) {
    return <div className="px-3 py-4 text-xs text-[#94a3b8] text-center">加载中...</div>;
  }

  if (!sentiment) {
    return <div className="px-3 py-4 text-xs text-[#94a3b8] text-center">暂无数据</div>;
  }

  const total = sentiment.upCount + sentiment.downCount + sentiment.flatCount;
  const upPercent = total > 0 ? (sentiment.upCount / total) * 100 : 0;
  const downPercent = total > 0 ? (sentiment.downCount / total) * 100 : 0;

  return (
    <div className="border-b border-[#1e293b]">
      <div className="px-3 py-2 text-xs font-medium text-[#94a3b8] uppercase tracking-wider">
        市场情绪
      </div>
      <div className="px-3 pb-3 space-y-3">
        {/* Heat Score */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#94a3b8]">市场热度</span>
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${sentiment.heatScore}%`,
                  backgroundColor: sentiment.heatScore >= 60 ? '#ef4444' : sentiment.heatScore >= 40 ? '#f59e0b' : '#22c55e',
                }}
              />
            </div>
            <span className="text-xs font-mono-num text-[#e2e8f0]">{sentiment.heatScore}</span>
          </div>
        </div>

        {/* Up/Down */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-1.5 rounded bg-[#0a0e17]">
            <div className="text-xs font-mono-num text-[#ef4444] font-bold">{sentiment.upCount}</div>
            <div className="text-[10px] text-[#94a3b8]">上涨</div>
          </div>
          <div className="text-center p-1.5 rounded bg-[#0a0e17]">
            <div className="text-xs font-mono-num text-[#94a3b8] font-bold">{sentiment.flatCount}</div>
            <div className="text-[10px] text-[#94a3b8]">平盘</div>
          </div>
          <div className="text-center p-1.5 rounded bg-[#0a0e17]">
            <div className="text-xs font-mono-num text-[#22c55e] font-bold">{sentiment.downCount}</div>
            <div className="text-[10px] text-[#94a3b8]">下跌</div>
          </div>
        </div>

        {/* Up/Down bar */}
        <div className="h-1.5 rounded-full overflow-hidden flex">
          <div className="bg-[#ef4444] transition-all" style={{ width: `${upPercent}%` }} />
          <div className="bg-[#94a3b8] transition-all" style={{ width: `${100 - upPercent - downPercent}%` }} />
          <div className="bg-[#22c55e] transition-all" style={{ width: `${downPercent}%` }} />
        </div>

        {/* Limit Up/Down */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#94a3b8]">涨停/跌停</span>
          <span>
            <span className="text-[#ef4444] font-mono-num">{sentiment.limitUpCount}</span>
            <span className="text-[#94a3b8] mx-1">/</span>
            <span className="text-[#22c55e] font-mono-num">{sentiment.limitDownCount}</span>
          </span>
        </div>

        {/* Sector flows */}
        {sentiment.sectorFlows.length > 0 && (
          <div>
            <div className="text-[10px] text-[#94a3b8] mb-1">板块资金流向(亿)</div>
            <div className="space-y-0.5">
              {sentiment.sectorFlows.map((sector, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-[#e2e8f0]">{sector.name}</span>
                  <span className={`font-mono-num ${sector.flow >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                    {sector.flow >= 0 ? '+' : ''}{sector.flow.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

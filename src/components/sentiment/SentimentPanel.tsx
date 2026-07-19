'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppState } from '@/hooks/useAppState';
import type { MarketSentiment, SentimentScope } from '@/lib/types';

interface StockSentimentData {
  code: string;
  name: string;
  price: number;
  changePercent: number;
  technicalScore: number;
  volumeRatio: number;
  volumeTrend: string;
  momentumScore: number;
  supportLevel: number;
  resistanceLevel: number;
  heatScore: number;
  timestamp: number;
}

const scopeLabels: Record<SentimentScope, string> = {
  stock: '个股',
  sector: '板块',
  market: '大盘',
};

export function SentimentPanel() {
  const { selectedStock, currentQuote } = useAppState();
  const [scope, setScope] = useState<SentimentScope>('stock');
  const [marketSentiment, setMarketSentiment] = useState<MarketSentiment | null>(null);
  const [stockSentiment, setStockSentiment] = useState<StockSentimentData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchMarketSentiment = useCallback(async () => {
    try {
      const res = await fetch('/api/stock?action=sentiment');
      const json = await res.json();
      if (json.success) setMarketSentiment(json.data);
    } catch {
      // ignore
    }
  }, []);

  const fetchStockSentiment = useCallback(async () => {
    if (!selectedStock) return;
    try {
      const res = await fetch(`/api/stock?action=stock_sentiment&code=${selectedStock.code}`);
      const json = await res.json();
      if (json.success) setStockSentiment(json.data);
    } catch {
      // ignore
    }
  }, [selectedStock]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMarketSentiment(), fetchStockSentiment()]).finally(() => setLoading(false));
  }, [fetchMarketSentiment, fetchStockSentiment]);

  // Re-fetch stock sentiment when stock changes
  useEffect(() => {
    if (scope === 'stock' && selectedStock) {
      fetchStockSentiment();
    }
  }, [selectedStock, scope, fetchStockSentiment]);

  if (loading) {
    return <div className="px-3 py-4 text-xs text-[#94a3b8] text-center">加载中...</div>;
  }

  return (
    <div className="border-b border-[#1e293b]">
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider">
          市场情绪
        </span>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as SentimentScope)}
          className="text-[10px] bg-[#0a0e17] text-[#e2e8f0] border border-[#1e293b] rounded px-1.5 py-0.5 outline-none focus:border-[#3b82f6]"
        >
          <option value="stock">个股</option>
          <option value="sector">板块</option>
          <option value="market">大盘</option>
        </select>
      </div>

      <div className="px-3 pb-3 space-y-3">
        {scope === 'stock' && <StockSentimentView data={stockSentiment} quote={currentQuote} />}
        {scope === 'sector' && <SectorSentimentView data={marketSentiment} />}
        {scope === 'market' && <MarketSentimentView data={marketSentiment} />}
      </div>
    </div>
  );
}

function StockSentimentView({ data, quote }: { data: StockSentimentData | null; quote: { price: number; changePercent: number } | null }) {
  if (!data) {
    return <div className="text-xs text-[#94a3b8] text-center py-2">请先选择股票</div>;
  }

  const priceColor = (quote?.changePercent ?? data.changePercent) >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]';

  return (
    <>
      {/* Stock header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs text-[#e2e8f0] font-medium">{data.name}</span>
          <span className="text-[10px] text-[#94a3b8] ml-1">{data.code}</span>
        </div>
        <div className="text-right">
          <span className={`text-sm font-mono-num font-bold ${priceColor}`}>{data.price.toFixed(2)}</span>
          <span className={`text-[10px] font-mono-num ml-1 ${priceColor}`}>
            {(quote?.changePercent ?? data.changePercent) >= 0 ? '+' : ''}{(quote?.changePercent ?? data.changePercent).toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Technical Score */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#94a3b8]">技术强度</span>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${data.technicalScore}%`,
                backgroundColor: data.technicalScore >= 60 ? '#ef4444' : data.technicalScore >= 40 ? '#f59e0b' : '#22c55e',
              }}
            />
          </div>
          <span className="text-xs font-mono-num text-[#e2e8f0]">{data.technicalScore}</span>
        </div>
      </div>

      {/* Heat Score */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#94a3b8]">个股热度</span>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${data.heatScore}%`,
                backgroundColor: data.heatScore >= 70 ? '#ef4444' : data.heatScore >= 40 ? '#f59e0b' : '#3b82f6',
              }}
            />
          </div>
          <span className="text-xs font-mono-num text-[#e2e8f0]">{data.heatScore}</span>
        </div>
      </div>

      {/* Volume Analysis */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-1.5 rounded bg-[#0a0e17]">
          <div className="text-[10px] text-[#94a3b8]">量能状态</div>
          <div className={`text-xs font-medium ${
            data.volumeTrend === '放量' ? 'text-[#ef4444]' : data.volumeTrend === '缩量' ? 'text-[#22c55e]' : 'text-[#f59e0b]'
          }`}>{data.volumeTrend}</div>
        </div>
        <div className="p-1.5 rounded bg-[#0a0e17]">
          <div className="text-[10px] text-[#94a3b8]">量比</div>
          <div className="text-xs font-mono-num text-[#e2e8f0]">{data.volumeRatio}</div>
        </div>
      </div>

      {/* Momentum */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#94a3b8]">动量指标</span>
        <span className={`text-xs font-mono-num ${data.momentumScore > 0 ? 'text-[#ef4444]' : data.momentumScore < 0 ? 'text-[#22c55e]' : 'text-[#94a3b8]'}`}>
          {data.momentumScore > 0 ? '+' : ''}{data.momentumScore}
        </span>
      </div>

      {/* Support / Resistance */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-1.5 rounded bg-[#0a0e17]">
          <div className="text-[10px] text-[#94a3b8]">支撑位</div>
          <div className="text-xs font-mono-num text-[#22c55e]">{data.supportLevel.toFixed(2)}</div>
        </div>
        <div className="p-1.5 rounded bg-[#0a0e17]">
          <div className="text-[10px] text-[#94a3b8]">压力位</div>
          <div className="text-xs font-mono-num text-[#ef4444]">{data.resistanceLevel.toFixed(2)}</div>
        </div>
      </div>
    </>
  );
}

function SectorSentimentView({ data }: { data: MarketSentiment | null }) {
  if (!data || data.sectorFlows.length === 0) {
    return <div className="text-xs text-[#94a3b8] text-center py-2">暂无板块数据</div>;
  }

  const sorted = [...data.sectorFlows].sort((a, b) => b.flow - a.flow);

  return (
    <>
      <div className="text-[10px] text-[#94a3b8] mb-1">板块资金流向(亿)</div>
      <div className="space-y-1">
        {sorted.map((sector, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-[#e2e8f0]">{sector.name}</span>
            <div className="flex items-center gap-1.5">
              <div className="w-12 h-1 bg-[#1e293b] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, Math.abs(sector.flow) * 20)}%`,
                    backgroundColor: sector.flow >= 0 ? '#ef4444' : '#22c55e',
                  }}
                />
              </div>
              <span className={`font-mono-num w-12 text-right ${sector.flow >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                {sector.flow >= 0 ? '+' : ''}{sector.flow.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Market overview summary */}
      <div className="mt-2 pt-2 border-t border-[#1e293b]">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#94a3b8]">大盘热度</span>
          <span className="font-mono-num text-[#e2e8f0]">{data.heatScore}</span>
        </div>
        <div className="flex items-center justify-between text-xs mt-1">
          <span className="text-[#94a3b8]">量比</span>
          <span className="font-mono-num text-[#e2e8f0]">{data.volumeRatio.toFixed(2)}</span>
        </div>
      </div>
    </>
  );
}

function MarketSentimentView({ data }: { data: MarketSentiment | null }) {
  if (!data) {
    return <div className="text-xs text-[#94a3b8] text-center py-2">暂无数据</div>;
  }

  const total = data.upCount + data.downCount + data.flatCount;
  const upPercent = total > 0 ? (data.upCount / total) * 100 : 0;
  const downPercent = total > 0 ? (data.downCount / total) * 100 : 0;

  return (
    <>
      {/* Heat Score */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#94a3b8]">大盘热度</span>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${data.heatScore}%`,
                backgroundColor: data.heatScore >= 60 ? '#ef4444' : data.heatScore >= 40 ? '#f59e0b' : '#22c55e',
              }}
            />
          </div>
          <span className="text-xs font-mono-num text-[#e2e8f0]">{data.heatScore}</span>
        </div>
      </div>

      {/* Up/Down */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-1.5 rounded bg-[#0a0e17]">
          <div className="text-xs font-mono-num text-[#ef4444] font-bold">{data.upCount}</div>
          <div className="text-[10px] text-[#94a3b8]">上涨</div>
        </div>
        <div className="text-center p-1.5 rounded bg-[#0a0e17]">
          <div className="text-xs font-mono-num text-[#94a3b8] font-bold">{data.flatCount}</div>
          <div className="text-[10px] text-[#94a3b8]">平盘</div>
        </div>
        <div className="text-center p-1.5 rounded bg-[#0a0e17]">
          <div className="text-xs font-mono-num text-[#22c55e] font-bold">{data.downCount}</div>
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
          <span className="text-[#ef4444] font-mono-num">{data.limitUpCount}</span>
          <span className="text-[#94a3b8] mx-1">/</span>
          <span className="text-[#22c55e] font-mono-num">{data.limitDownCount}</span>
        </span>
      </div>

      {/* Volume */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#94a3b8]">量比</span>
        <span className="font-mono-num text-[#e2e8f0]">{data.volumeRatio.toFixed(2)}</span>
      </div>

      {/* Sector flows */}
      {data.sectorFlows.length > 0 && (
        <div>
          <div className="text-[10px] text-[#94a3b8] mb-1">板块资金流向(亿)</div>
          <div className="space-y-0.5">
            {data.sectorFlows.map((sector, i) => (
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
    </>
  );
}

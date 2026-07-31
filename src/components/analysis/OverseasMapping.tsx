'use client';

import { useState, useEffect, useCallback } from 'react';
import { Info, Loader2, RefreshCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface OverseasMappingProps {
  stockCode: string;
  stockName: string;
}

// 产业链映射关系
const INDUSTRY_MAPPINGS: Record<string, {
  overseas: string[];
  sector: string;
  correlation: '强联动' | '中等联动' | '弱联动';
  description: string;
}> = {
  '300308': {
    overseas: ['NVDA (英伟达)', 'AMD'],
    sector: 'AI算力',
    correlation: '强联动',
    description: '光模块龙头，直接受益于AI算力需求增长，与英伟达GPU出货量高度相关',
  },
  '688256': {
    overseas: ['NVDA (英伟达)', 'AMD', 'AVGO (博通)'],
    sector: 'AI芯片',
    correlation: '强联动',
    description: '国产AI芯片龙头，与海外AI芯片巨头形成竞争与替代关系',
  },
  '300750': {
    overseas: ['TSLA (特斯拉)', 'LGES (LG新能源)', 'PANW (松下)'],
    sector: '动力电池',
    correlation: '中等联动',
    description: '全球动力电池龙头，与特斯拉、LG新能源形成三足鼎立格局',
  },
  '688981': {
    overseas: ['TSM (台积电)', 'AVGO (博通)', 'QCOM (高通)'],
    sector: '半导体制造',
    correlation: '中等联动',
    description: '国产芯片制造龙头，与台积电形成竞争，受全球半导体周期影响',
  },
  '002475': {
    overseas: ['AAPL (苹果)', 'GOOGL (谷歌)'],
    sector: '消费电子',
    correlation: '中等联动',
    description: '苹果核心供应商，与苹果产品周期高度相关',
  },
  '002230': {
    overseas: ['NVDA (英伟达)', 'MSFT (微软)', 'GOOGL (谷歌)'],
    sector: 'AI应用',
    correlation: '中等联动',
    description: 'AI语音龙头，受益于全球AI应用落地浪潮',
  },
  '601127': {
    overseas: ['TSLA (特斯拉)', 'GM (通用)', 'F (福特)'],
    sector: '新能源汽车',
    correlation: '中等联动',
    description: '智能驾驶龙头，与特斯拉在自动驾驶领域形成竞争',
  },
  '688041': {
    overseas: ['NVDA (英伟达)', 'AMD', 'INTC (英特尔)'],
    sector: 'AI芯片',
    correlation: '强联动',
    description: '国产GPU龙头，与英伟达、AMD形成竞争关系',
  },
};

// 海外价格数据行
interface OverseasPriceRow {
  trade_date: string;
  sp500: number | null;
  nasdaq: number | null;
  nvda: number | null;
  aapl: number | null;
  tsla: number | null;
  amd: number | null;
  avgo: number | null;
  tsm: number | null;
  qcom: number | null;
  googl: number | null;
  msft: number | null;
  intc: number | null;
  nikkei: number | null;
  tel: number | null;
  samsung: number | null;
}

// 从个股名称提取 ticker（如 "NVDA (英伟达)" -> "nvda"）
function extractTicker(name: string): string {
  const match = name.match(/^(\w+)/);
  return match ? match[1].toLowerCase() : '';
}

function fmtPrice(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(v)) return '--';
  return v.toFixed(2);
}

function fmtChangePct(cur: number | null, prev: number | null): string {
  if (cur === null || prev === null || prev === 0) return '--';
  const pct = ((cur - prev) / prev) * 100;
  return (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
}

function changeColor(cur: number | null, prev: number | null): string {
  if (cur === null || prev === null) return 'text-gray-500';
  if (cur > prev) return 'text-red-400';
  if (cur < prev) return 'text-green-400';
  return 'text-gray-400';
}

export default function OverseasMapping({ stockCode, stockName }: OverseasMappingProps) {
  const mapping = INDUSTRY_MAPPINGS[stockCode];
  const [priceData, setPriceData] = useState<OverseasPriceRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/overseas?limit=5');
      const data = await res.json();
      if (data.success) setPriceData(data.data || []);
    } catch {
      // 静默失败
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  const latest = priceData[0];
  const prev = priceData[1];

  const correlationColor = {
    '强联动': 'text-[var(--accent-red)] bg-red-500/10 border-red-500/30',
    '中等联动': 'text-[var(--accent-yellow)] bg-yellow-500/10 border-yellow-500/30',
    '弱联动': 'text-[var(--text-secondary)] bg-[var(--text-secondary)]/10 border-[var(--text-secondary)]/30',
  };

  // 构建指数概览数据
  const indexItems = [
    { label: 'S&P 500', key: 'sp500' as const },
    { label: '纳斯达克', key: 'nasdaq' as const },
    { label: '日经225', key: 'nikkei' as const },
  ];

  // 构建个股价格数据
  const stockItems = [
    { label: 'NVDA 英伟达', key: 'nvda' as const },
    { label: 'AAPL 苹果', key: 'aapl' as const },
    { label: 'TSLA 特斯拉', key: 'tsla' as const },
    { label: 'AMD', key: 'amd' as const },
    { label: 'AVGO 博通', key: 'avgo' as const },
    { label: 'TSM 台积电', key: 'tsm' as const },
    { label: 'QCOM 高通', key: 'qcom' as const },
    { label: 'GOOGL 谷歌', key: 'googl' as const },
    { label: 'MSFT 微软', key: 'msft' as const },
    { label: 'INTC 英特尔', key: 'intc' as const },
    { label: 'TEL 东京电子', key: 'tel' as const },
    { label: 'Samsung 三星', key: 'samsung' as const },
  ];

  return (
    <div className="rounded border border-orange-500/30 bg-[var(--bg-primary)] overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 bg-orange-500/10 border-b border-orange-500/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span className="text-sm font-medium text-orange-300">海外市场行情</span>
        </div>
        <div className="flex items-center gap-2">
          {latest && (
            <span className="text-[9px] text-gray-500">{latest.trade_date}</span>
          )}
          <button onClick={fetchPrices} className="text-gray-500 hover:text-gray-300" disabled={loading}>
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* 加载状态 */}
        {loading && (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
            <span className="text-[10px] text-gray-400 ml-2">加载中...</span>
          </div>
        )}

        {/* 指数概览 */}
        {!loading && latest && (
          <div className="grid grid-cols-3 gap-2">
            {indexItems.map(item => (
              <div key={item.key} className="p-2 rounded bg-[var(--bg-panel)] text-center">
                <div className="text-[9px] text-gray-500 mb-1">{item.label}</div>
                <div className="text-xs font-mono font-bold text-gray-200">
                  {fmtPrice(latest[item.key])}
                </div>
                <div className={`text-[9px] font-mono ${changeColor(latest[item.key], prev?.[item.key] ?? null)}`}>
                  {fmtChangePct(latest[item.key], prev?.[item.key] ?? null)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 美股个股价格表 */}
        {!loading && latest && (
          <div>
            <div className="text-[10px] text-gray-500 mb-1">美股个股</div>
            <div className="grid grid-cols-2 gap-1.5">
              {stockItems.map(item => {
                const cur = latest[item.key];
                const prevVal = prev?.[item.key] ?? null;
                return (
                  <div key={item.key} className="flex items-center justify-between px-2 py-1 rounded bg-[var(--bg-panel)]">
                    <span className="text-[10px] text-gray-400">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-gray-200">{fmtPrice(cur)}</span>
                      <span className={`text-[9px] font-mono w-14 text-right ${changeColor(cur, prevVal)}`}>
                        {fmtChangePct(cur, prevVal)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 无数据提示 */}
        {!loading && !latest && (
          <div className="text-[10px] text-gray-500 py-4 text-center">
            暂无海外行情数据，等待李富贵推送
          </div>
        )}

        {/* 产业链映射（如果有） */}
        {mapping && (
          <>
            <div className="border-t border-[var(--border-default)] pt-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-orange-300 font-medium">产业链映射</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded border ${correlationColor[mapping.correlation]}`}>
                  {mapping.correlation}
                </span>
              </div>

              {/* 产业链说明 */}
              <div className="p-2 rounded bg-[var(--bg-panel)] mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-gray-500">所属产业链</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 text-gray-500 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[250px] bg-[var(--bg-primary)] border-orange-500/30">
                        <p className="text-xs text-[var(--text-primary)]">{mapping.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span className="text-xs text-orange-300 font-medium">{mapping.sector}</span>
              </div>

              {/* 关联海外龙头实时价格 */}
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500">关联海外龙头</span>
                {mapping.overseas.map((name, i) => {
                  const ticker = extractTicker(name);
                  const cur = latest ? (latest as any)[ticker] : null;
                  const prevVal = prev ? (prev as any)[ticker] : null;
                  return (
                    <div key={i} className="p-1.5 rounded bg-[var(--bg-panel)]">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-300">{name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-gray-200">{fmtPrice(cur)}</span>
                          <span className={`text-[9px] font-mono w-14 text-right ${changeColor(cur, prevVal)}`}>
                            {fmtChangePct(cur, prevVal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

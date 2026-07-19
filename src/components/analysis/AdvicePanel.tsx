'use client';

import { useMemo } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { getAllIndicators, analyzeChanlun, analyzeWaves, generateAdvice } from '@/lib/analysis';

export function AdvicePanel() {
  const { klineData, analysisSettings, selectedStock } = useAppState();

  const advice = useMemo(() => {
    if (klineData.length < 20) return null;
    const indicators = getAllIndicators(klineData);
    const chanlun = analysisSettings.chanlun ? analyzeChanlun(klineData) : { strokes: [], segments: [], centers: [], buySignals: [], sellSignals: [] };
    const wave = analysisSettings.wave ? analyzeWaves(klineData) : { waves: [] };
    return generateAdvice(klineData, indicators, chanlun, wave);
  }, [klineData, analysisSettings]);

  if (!selectedStock) {
    return (
      <div className="px-3 py-4 text-xs text-[#94a3b8] text-center">
        选择股票后显示综合分析
      </div>
    );
  }

  if (!advice) {
    return (
      <div className="px-3 py-4 text-xs text-[#94a3b8] text-center">
        数据加载中...
      </div>
    );
  }

  const scoreColor = advice.score >= 65 ? '#ef4444' : advice.score <= 35 ? '#22c55e' : '#f59e0b';
  const overallColor = advice.overall === '看多' ? '#ef4444' : advice.overall === '看空' ? '#22c55e' : '#f59e0b';

  return (
    <div className="flex flex-col gap-3 px-3 py-2">
      {/* Score */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#94a3b8]">综合评分</span>
        <span className="text-lg font-bold font-mono-num" style={{ color: scoreColor }}>{advice.score}</span>
      </div>

      {/* Overall */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#94a3b8]">综合建议</span>
        <span className="text-sm font-bold px-2 py-0.5 rounded" style={{ color: overallColor, backgroundColor: `${overallColor}15` }}>
          {advice.overall}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-1">
        <div className="text-xs text-[#94a3b8] mb-1">分析详情</div>
        {advice.details.map((detail, i) => (
          <div key={i} className="text-xs text-[#e2e8f0] py-0.5 border-l-2 border-[#1e293b] pl-2">
            {detail}
          </div>
        ))}
      </div>

      {/* Risk */}
      <div className="mt-2 p-2 rounded bg-[#f59e0b10] border border-[#f59e0b30]">
        <div className="text-xs text-[#f59e0b] mb-1 font-medium">风险提示</div>
        {advice.risk.map((r, i) => (
          <div key={i} className="text-[10px] text-[#94a3b8] leading-relaxed">{r}</div>
        ))}
      </div>
    </div>
  );
}

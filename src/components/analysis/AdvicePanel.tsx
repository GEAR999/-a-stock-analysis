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
    const wave = analysisSettings.wave ? analyzeWaves(klineData, analysisSettings.waveSensitivity) : { waves: [] };
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
  const overallColor = advice.overall.includes('多') ? '#ef4444' : advice.overall.includes('空') ? '#22c55e' : '#f59e0b';

  // 置信度颜色
  const confColor = advice.confidence === '高' ? '#22c55e' : advice.confidence === '中' ? '#f59e0b' : '#ef4444';
  const confBars = advice.confidence === '高' ? 5 : advice.confidence === '中' ? 3 : 1;

  return (
    <div className="flex flex-col gap-3 px-3 py-2">
      {/* Score + Confidence */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#94a3b8]">综合评分</span>
          <span className="text-lg font-bold font-mono-num" style={{ color: scoreColor }}>{advice.score}</span>
        </div>
        {/* 信号强度条 */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-end gap-0.5 h-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className="w-1 rounded-sm"
                style={{
                  height: `${40 + i * 12}%`,
                  backgroundColor: i <= confBars ? confColor : '#1e293b',
                }}
              />
            ))}
          </div>
          <span className="text-[10px] font-medium" style={{ color: confColor }}>
            {advice.confidence === '高' ? '强信号' : advice.confidence === '中' ? '一般' : '分歧'}
          </span>
        </div>
      </div>

      {/* Overall */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#94a3b8]">综合建议</span>
        <span className="text-sm font-bold px-2 py-0.5 rounded" style={{ color: overallColor, backgroundColor: `${overallColor}15` }}>
          {advice.overall}
        </span>
      </div>

      {/* Percentile */}
      {advice.percentile !== null && (
        <div className="flex items-center justify-between text-[10px] text-[#94a3b8]">
          <span>百分位排名</span>
          <span>高于近60天中 <span className="text-[#e2e8f0] font-mono-num">{advice.percentile}%</span> 的交易日</span>
        </div>
      )}

      {/* Volume summary */}
      {advice.volumeAnalysis && (
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-[#94a3b8]">量价关系</span>
          <span className={
            advice.volumeAnalysis.priceVolumeRelation === '量价齐升' ? 'text-[#ef4444]' :
            advice.volumeAnalysis.priceVolumeRelation === '量价齐跌' ? 'text-[#22c55e]' :
            'text-[#f59e0b]'
          }>
            {advice.volumeAnalysis.priceVolumeRelation}
            <span className="text-[#94a3b8] ml-1">(量比{advice.volumeAnalysis.volumeRatio.toFixed(1)})</span>
          </span>
        </div>
      )}

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

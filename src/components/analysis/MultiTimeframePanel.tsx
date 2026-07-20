'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { fetchWithRetry } from '@/lib/api-client';
import { analyzeChanlun, analyzeWaves, getAllIndicators, generateAdvice, type MultiTimeframeResult, type TimeframeSignal } from '@/lib/analysis';
import type { KLineData } from '@/lib/types';

interface MultiTimeframePanelProps {
  stockCode: string;
  stockName?: string;
}

const PERIOD_MAP: Record<string, string> = {
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'monthly',
};

const PERIOD_LABELS: Record<string, string> = {
  daily: '日线',
  weekly: '周线',
  monthly: '月线',
};

export default function MultiTimeframePanel({ stockCode }: MultiTimeframePanelProps) {
  const [timeframeResults, setTimeframeResults] = useState<Record<string, MultiTimeframeResult>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>(['daily', 'weekly', 'monthly']);

  useEffect(() => {
    if (!stockCode) return;
    let cancelled = false;

    const fetchAllPeriods = async () => {
      setLoading(true);
      setError(null);
      const results: Record<string, MultiTimeframeResult> = {};

      try {
        for (const period of ['daily', 'weekly', 'monthly']) {
          const res = await fetchWithRetry(`/api/stock?action=kline&code=${stockCode}&period=${period}&limit=120`, { timeout: 10000 });
          const json = await res.json();

          if (json.success && json.data && json.data.length > 10) {
            const klineData: KLineData[] = json.data;
            const indicators = getAllIndicators(klineData);
            const chanlun = analyzeChanlun(klineData);
            const wave = analyzeWaves(klineData, 'medium');
            const advice = generateAdvice(klineData, indicators, chanlun, wave);

            results[period] = {
              period,
              indicators,
              chanlun,
              wave,
              advice,
            };
          }
        }

        if (!cancelled) {
          setTimeframeResults(results);
          if (Object.keys(results).length === 0) {
            setError('暂无数据');
          }
        }
      } catch (err) {
        if (!cancelled) setError('数据获取失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAllPeriods();
    return () => { cancelled = true; };
  }, [stockCode]);

  // 计算共振
  const resonance = useMemo(() => {
    const activeResults = selectedPeriods
      .filter(p => timeframeResults[p])
      .map(p => timeframeResults[p]);

    if (activeResults.length < 2) return null;

    // 统计各维度方向
    const dimensions = ['macd', 'kdj', 'rsi', 'boll', 'chanlun', 'wave'] as const;
    let bullishCount = 0;
    let bearishCount = 0;
    let totalDimensions = 0;

    for (const dim of dimensions) {
      let dimBullish = 0;
      let dimBearish = 0;

      for (const result of activeResults) {
        const score = result.advice.dimensions[dim]?.score || 0;
        const maxScore = result.advice.dimensions[dim]?.maxScore || 20;
        const ratio = score / maxScore;

        if (ratio > 0.6) dimBullish++;
        else if (ratio < 0.4) dimBearish++;
      }

      totalDimensions++;
      if (dimBullish > dimBearish && dimBullish >= activeResults.length / 2) bullishCount++;
      else if (dimBearish > dimBullish && dimBearish >= activeResults.length / 2) bearishCount++;
    }

    const strength = bullishCount + bearishCount >= totalDimensions - 1
      ? (bullishCount === totalDimensions || bearishCount === totalDimensions ? '强' : '中')
      : '弱';

    let direction: '多头共振' | '空头共振' | '分歧';
    if (bullishCount > bearishCount && bullishCount >= 2) direction = '多头共振';
    else if (bearishCount > bullishCount && bearishCount >= 2) direction = '空头共振';
    else direction = '分歧';

    return { direction, strength, bullishCount, bearishCount, totalDimensions };
  }, [timeframeResults, selectedPeriods]);

  if (loading) {
    return (
      <div className="bg-[#111827] border border-[#1e293b] rounded p-3">
        <div className="text-xs text-gray-500">多周期分析加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#111827] border border-[#1e293b] rounded p-3">
        <div className="text-xs text-gray-500">暂无多周期数据</div>
      </div>
    );
  }

  const getSignalIcon = (signal: TimeframeSignal) => {
    switch (signal) {
      case 'bullish': return <span className="text-red-400">↑</span>;
      case 'bearish': return <span className="text-green-400">↓</span>;
      default: return <span className="text-gray-500">→</span>;
    }
  };

  const getSignalText = (signal: TimeframeSignal) => {
    switch (signal) {
      case 'bullish': return '看多';
      case 'bearish': return '看空';
      default: return '中性';
    }
  };

  const resonanceColors = {
    '多头共振': 'text-red-400 border-red-400/30 bg-red-400/5',
    '空头共振': 'text-green-400 border-green-400/30 bg-green-400/5',
    '分歧': 'text-gray-400 border-gray-400/30 bg-gray-400/5',
  };

  return (
    <div className="bg-[#111827] border border-[#1e293b] rounded p-3">
      {/* 标题 + 共振状态 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-300">多周期共振</span>
        {resonance && (
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs ${resonanceColors[resonance.direction]}`}>
            <span className="font-bold">{resonance.direction}</span>
            <span className="text-[10px]">({resonance.strength})</span>
          </div>
        )}
      </div>

      {/* 周期选择 */}
      <div className="flex gap-1 mb-3">
        {Object.keys(PERIOD_LABELS).map(period => (
          <button
            key={period}
            onClick={() => setSelectedPeriods(prev =>
              prev.includes(period)
                ? prev.filter(p => p !== period)
                : [...prev, period]
            )}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              selectedPeriods.includes(period)
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-[#0a0e17] text-gray-500 border border-[#1e293b]'
            }`}
          >
            {PERIOD_LABELS[period]}
          </button>
        ))}
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-gray-500 border-b border-[#1e293b]">
              <th className="text-left py-1 pr-2">周期</th>
              <th className="text-center py-1 px-1">MACD</th>
              <th className="text-center py-1 px-1">KDJ</th>
              <th className="text-center py-1 px-1">RSI</th>
              <th className="text-center py-1 px-1">BOLL</th>
              <th className="text-center py-1 px-1">缠论</th>
              <th className="text-center py-1 px-1">波浪</th>
              <th className="text-center py-1 pl-2">评分</th>
            </tr>
          </thead>
          <tbody>
            {selectedPeriods.map(period => {
              const result = timeframeResults[period];
              if (!result) return null;

              const dims = result.advice.dimensions;
              return (
                <tr key={period} className="border-b border-[#1e293b]/50">
                  <td className="py-1.5 pr-2 text-gray-400">{PERIOD_LABELS[period]}</td>
                  <td className="text-center py-1.5 px-1">{getSignalIcon(dims.macd?.signal || 'neutral')}</td>
                  <td className="text-center py-1.5 px-1">{getSignalIcon(dims.kdj?.signal || 'neutral')}</td>
                  <td className="text-center py-1.5 px-1">{getSignalIcon(dims.rsi?.signal || 'neutral')}</td>
                  <td className="text-center py-1.5 px-1">{getSignalIcon(dims.boll?.signal || 'neutral')}</td>
                  <td className="text-center py-1.5 px-1">{getSignalIcon(dims.chanlun?.signal || 'neutral')}</td>
                  <td className="text-center py-1.5 px-1">{getSignalIcon(dims.wave?.signal || 'neutral')}</td>
                  <td className="text-center py-1.5 pl-2">
                    <span className={`font-mono ${result.advice.score >= 60 ? 'text-red-400' : result.advice.score <= 40 ? 'text-green-400' : 'text-gray-400'}`}>
                      {result.advice.score}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 共振详情 */}
      {resonance && (
        <div className="mt-2 text-[10px] text-gray-500">
          {resonance.direction === '分歧'
            ? `各周期信号分歧，${resonance.bullishCount}个看多/${resonance.bearishCount}个看空`
            : `${resonance.direction}，${resonance.bullishCount}个看多/${resonance.bearishCount}个看空，${resonance.strength}共振`
          }
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { analyzeChanlun, analyzeWaves, calculateMACD, calculateRSI, calculateKDJ } from '@/lib/analysis';
import type { KLineData } from '@/lib/types';

type Signal = 'bullish' | 'neutral' | 'bearish';

interface SignalSummary {
  chanlun: { signal: Signal; text: string };
  wave: { signal: Signal; text: string };
  technical: { signal: Signal; text: string };
  overall: Signal;
  consistency: 'resonance' | 'divergence' | 'conflict';
}

function getSignalColor(signal: Signal): string {
  switch (signal) {
    case 'bullish': return '#ef4444';
    case 'bearish': return '#22c55e';
    case 'neutral': return '#f59e0b';
  }
}

function getSignalIcon(signal: Signal): string {
  switch (signal) {
    case 'bullish': return '🟢';
    case 'bearish': return '🔴';
    case 'neutral': return '🟡';
  }
}

function getSignalText(signal: Signal): string {
  switch (signal) {
    case 'bullish': return '看多';
    case 'bearish': return '看空';
    case 'neutral': return '中性';
  }
}

export function SignalSummaryBar() {
  const { klineData, analysisSettings, selectedStock } = useAppState();
  const [expanded, setExpanded] = useState(false);

  if (!selectedStock || klineData.length === 0) return null;

  // 计算各理论信号
  const summary = calculateSignalSummary(klineData, analysisSettings);

  const consistencyConfig = {
    resonance: { icon: '✅', color: '#22c55e', text: '共振' },
    divergence: { icon: '⚠️', color: '#f59e0b', text: '分歧' },
    conflict: { icon: '❌', color: '#ef4444', text: '矛盾' },
  };

  const consistency = consistencyConfig[summary.consistency];

  return (
    <div className="bg-[#111827] border-b border-[#1e293b]">
      {/* 摘要行 */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[#1a2332] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#e2e8f0]">信号总览</span>
          <span className="text-xs" style={{ color: consistency.color }}>
            {consistency.icon} {consistency.text}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {analysisSettings.chanlun && (
            <div className="flex items-center gap-1">
              <span className="text-xs">{getSignalIcon(summary.chanlun.signal)}</span>
              <span className="text-[10px] text-[#94a3b8]">缠论</span>
            </div>
          )}
          {analysisSettings.wave && (
            <div className="flex items-center gap-1">
              <span className="text-xs">{getSignalIcon(summary.wave.signal)}</span>
              <span className="text-[10px] text-[#94a3b8]">波浪</span>
            </div>
          )}
          {analysisSettings.technical && (
            <div className="flex items-center gap-1">
              <span className="text-xs">{getSignalIcon(summary.technical.signal)}</span>
              <span className="text-[10px] text-[#94a3b8]">技术</span>
            </div>
          )}
          <svg
            className={`w-3 h-3 text-[#94a3b8] transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* 展开详情 */}
      {expanded && (
        <div className="px-3 pb-2 space-y-1 border-t border-[#1e293b] pt-2">
          {analysisSettings.chanlun && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-xs text-[#e2e8f0]">缠论</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${getSignalColor(summary.chanlun.signal)}20`, color: getSignalColor(summary.chanlun.signal) }}
                >
                  {getSignalText(summary.chanlun.signal)}
                </span>
                <span className="text-[10px] text-[#94a3b8] max-w-[180px] truncate">{summary.chanlun.text}</span>
              </div>
            </div>
          )}
          {analysisSettings.wave && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-xs text-[#e2e8f0]">波浪</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${getSignalColor(summary.wave.signal)}20`, color: getSignalColor(summary.wave.signal) }}
                >
                  {getSignalText(summary.wave.signal)}
                </span>
                <span className="text-[10px] text-[#94a3b8] max-w-[180px] truncate">{summary.wave.text}</span>
              </div>
            </div>
          )}
          {analysisSettings.technical && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-[#e2e8f0]">技术</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${getSignalColor(summary.technical.signal)}20`, color: getSignalColor(summary.technical.signal) }}
                >
                  {getSignalText(summary.technical.signal)}
                </span>
                <span className="text-[10px] text-[#94a3b8] max-w-[180px] truncate">{summary.technical.text}</span>
              </div>
            </div>
          )}
          {/* 一致性说明 */}
          <div className="pt-1 border-t border-[#1e293b]">
            <div className="flex items-center gap-2">
              <span style={{ color: consistency.color }}>{consistency.icon}</span>
              <span className="text-[10px]" style={{ color: consistency.color }}>
                {summary.consistency === 'resonance' && '多理论方向一致，信号可靠性高'}
                {summary.consistency === 'divergence' && '部分理论方向不一致，建议观望或轻仓'}
                {summary.consistency === 'conflict' && '理论方向完全相反，建议暂停操作'}
              </span>
            </div>
          </div>
          {/* 时间戳 */}
          <div className="text-[9px] text-[#64748b]">
            基于 {klineData[klineData.length - 1]?.date || ''} 数据
          </div>
        </div>
      )}
    </div>
  );
}

function calculateSignalSummary(
  klineData: KLineData[],
  settings: { chanlun: boolean; wave: boolean; technical: boolean }
): SignalSummary {
  let chanlunSignal: Signal = 'neutral';
  let chanlunText = '未开启';
  let waveSignal: Signal = 'neutral';
  let waveText = '未开启';
  let technicalSignal: Signal = 'neutral';
  let technicalText = '未开启';

  // 缠论信号
  if (settings.chanlun && klineData.length > 10) {
    const chanlunData = analyzeChanlun(klineData);
    const lastBuy = chanlunData.buySignals[chanlunData.buySignals.length - 1];
    const lastSell = chanlunData.sellSignals[chanlunData.sellSignals.length - 1];
    const lastDataIndex = klineData.length - 1;

    if (lastBuy && (!lastSell || lastBuy.index > lastSell.index)) {
      chanlunSignal = 'bullish';
      chanlunText = `近期出现${lastBuy.type === 1 ? '一' : lastBuy.type === 2 ? '二' : '三'}买信号`;
    } else if (lastSell && (!lastBuy || lastSell.index > lastBuy.index)) {
      chanlunSignal = 'bearish';
      chanlunText = `近期出现${lastSell.type === 1 ? '一' : lastSell.type === 2 ? '二' : '三'}卖信号`;
    } else {
      chanlunSignal = 'neutral';
      chanlunText = '当前处于中枢震荡';
    }
  }

  // 波浪信号
  if (settings.wave && klineData.length > 10) {
    const waveData = analyzeWaves(klineData);
    const lastWave = waveData.waves[waveData.waves.length - 1];
    if (lastWave) {
      if (lastWave.label === '3' || lastWave.label === '5') {
        waveSignal = 'bullish';
        waveText = `当前处于第${lastWave.label}浪上升`;
      } else if (lastWave.label === 'A' || lastWave.label === 'C') {
        waveSignal = 'bearish';
        waveText = `当前处于第${lastWave.label}浪下跌`;
      } else if (lastWave.label === '2' || lastWave.label === '4') {
        waveSignal = 'neutral';
        waveText = `当前处于第${lastWave.label}浪调整`;
      } else {
        waveSignal = 'neutral';
        waveText = `当前浪型: ${lastWave.label}`;
      }
    }
  }

  // 技术指标信号
  if (settings.technical && klineData.length > 30) {
    const macdData = calculateMACD(klineData);
    const rsiData = calculateRSI(klineData);
    const kdjData = calculateKDJ(klineData);
    const lastMacd = macdData[macdData.length - 1];
    const prevMacd = macdData[macdData.length - 2];
    const lastRsi = rsiData[rsiData.length - 1];
    const lastKdj = kdjData[kdjData.length - 1];

    let bullCount = 0;
    let bearCount = 0;

    // MACD金叉/死叉
    if (lastMacd && prevMacd) {
      if (lastMacd.dif > lastMacd.dea && prevMacd.dif <= prevMacd.dea) bullCount++;
      if (lastMacd.dif < lastMacd.dea && prevMacd.dif >= prevMacd.dea) bearCount++;
      if (lastMacd.histogram > 0) bullCount++;
      else bearCount++;
    }

    // RSI
    if (lastRsi) {
      if (lastRsi.rsi > 50 && lastRsi.rsi < 70) bullCount++;
      if (lastRsi.rsi > 80) bearCount++;
      if (lastRsi.rsi < 30) bullCount++;
      if (lastRsi.rsi < 50 && lastRsi.rsi > 30) bearCount++;
    }

    // KDJ
    if (lastKdj) {
      if (lastKdj.k > lastKdj.d && lastKdj.j > lastKdj.k) bullCount++;
      if (lastKdj.k < lastKdj.d && lastKdj.j < lastKdj.k) bearCount++;
    }

    if (bullCount > bearCount + 1) {
      technicalSignal = 'bullish';
      technicalText = 'MACD/RSI/KDJ多指标看多';
    } else if (bearCount > bullCount + 1) {
      technicalSignal = 'bearish';
      technicalText = 'MACD/RSI/KDJ多指标看空';
    } else {
      technicalSignal = 'neutral';
      technicalText = '技术指标信号分歧';
    }
  }

  // 计算一致性
  const signals = [
    settings.chanlun ? chanlunSignal : null,
    settings.wave ? waveSignal : null,
    settings.technical ? technicalSignal : null,
  ].filter(Boolean) as Signal[];

  let consistency: 'resonance' | 'divergence' | 'conflict' = 'resonance';
  if (signals.length >= 2) {
    const bullCount = signals.filter(s => s === 'bullish').length;
    const bearCount = signals.filter(s => s === 'bearish').length;
    if (bullCount === signals.length || bearCount === signals.length) {
      consistency = 'resonance';
    } else if (Math.abs(bullCount - bearCount) <= 1) {
      consistency = 'conflict';
    } else {
      consistency = 'divergence';
    }
  }

  // 综合信号
  const overallSignal: Signal = consistency === 'resonance'
    ? (signals[0] || 'neutral')
    : 'neutral';

  return {
    chanlun: { signal: chanlunSignal, text: chanlunText },
    wave: { signal: waveSignal, text: waveText },
    technical: { signal: technicalSignal, text: technicalText },
    overall: overallSignal,
    consistency,
  };
}

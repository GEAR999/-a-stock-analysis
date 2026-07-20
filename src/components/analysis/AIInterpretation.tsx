'use client';

import { useState } from 'react';
import { Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';

interface AIInterpretationProps {
  stockName?: string;
  stockCode?: string;
  chanlunEnabled?: boolean;
  waveEnabled?: boolean;
  technicalEnabled?: boolean;
  klineData?: Array<{ close: number; high: number; low: number; volume: number }>;
}

export function AIInterpretation({ 
  stockName, 
  stockCode, 
  chanlunEnabled, 
  waveEnabled, 
  technicalEnabled,
  klineData 
}: AIInterpretationProps) {
  const [expanded, setExpanded] = useState(false);

  // Generate plain language interpretation based on analysis results
  const generateInterpretation = () => {
    if (!stockName || !klineData || klineData.length === 0) {
      return {
        summary: '暂无分析数据，请先选择股票并开启分析引擎。',
        details: [],
        sentiment: 'neutral' as const,
      };
    }

    const latestData = klineData[klineData.length - 1];
    const prevData = klineData[klineData.length - 2];
    const priceChange = prevData ? ((latestData.close - prevData.close) / prevData.close) * 100 : 0;
    
    // Calculate simple trend
    const recentPrices = klineData.slice(-5).map(d => d.close);
    const trend = recentPrices[recentPrices.length - 1] > recentPrices[0] ? 'up' : 'down';
    
    // Calculate volume trend
    const recentVolumes = klineData.slice(-5).map(d => d.volume);
    const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    const volumeTrend = latestData.volume > avgVolume * 1.2 ? '放量' : latestData.volume < avgVolume * 0.8 ? '缩量' : '平量';

    const details: string[] = [];
    let bullishCount = 0;
    let bearishCount = 0;

    // Price action interpretation
    if (priceChange > 3) {
      details.push(`今日大涨 ${priceChange.toFixed(2)}%，表现强势。`);
      bullishCount++;
    } else if (priceChange > 0) {
      details.push(`今日小幅上涨 ${priceChange.toFixed(2)}%。`);
      bullishCount++;
    } else if (priceChange > -3) {
      details.push(`今日小幅下跌 ${Math.abs(priceChange).toFixed(2)}%。`);
      bearishCount++;
    } else {
      details.push(`今日大跌 ${Math.abs(priceChange).toFixed(2)}%，注意风险。`);
      bearishCount++;
    }

    // Volume interpretation
    if (volumeTrend === '放量' && priceChange > 0) {
      details.push('成交量明显放大，资金流入积极，上涨有量能支撑。');
      bullishCount++;
    } else if (volumeTrend === '放量' && priceChange < 0) {
      details.push('成交量放大但价格下跌，可能有资金出逃，需警惕。');
      bearishCount++;
    } else if (volumeTrend === '缩量' && priceChange > 0) {
      details.push('缩量上涨，上涨动力不足，持续性存疑。');
    } else if (volumeTrend === '缩量' && priceChange < 0) {
      details.push('缩量下跌，抛压减轻，可能接近底部。');
    }

    // Trend interpretation
    if (trend === 'up') {
      details.push('近5日走势向上，短期趋势偏多。');
      bullishCount++;
    } else {
      details.push('近5日走势向下，短期趋势偏空。');
      bearishCount++;
    }

    // Chanlun interpretation
    if (chanlunEnabled) {
      details.push('【缠论视角】当前走势需关注是否形成新的中枢，若出现底分型且突破前高，可能形成一买或二买信号。');
      bullishCount++;
    }

    // Wave interpretation
    if (waveEnabled) {
      if (trend === 'up') {
        details.push('【波浪理论】从波浪结构看，可能处于推动浪的上升阶段，但需注意第4浪的回调风险。');
      } else {
        details.push('【波浪理论】从波浪结构看，可能处于调整浪阶段，等待调整结束后再介入。');
      }
    }

    // Technical indicators interpretation
    if (technicalEnabled) {
      // Simple MA crossover detection
      const ma5 = klineData.slice(-5).reduce((a, b) => a + b.close, 0) / 5;
      const ma20 = klineData.slice(-20).reduce((a, b) => a + b.close, 0) / Math.min(20, klineData.length);
      
      if (ma5 > ma20) {
        details.push('【技术指标】5日均线上穿20日均线，形成金叉，短期看多信号。');
        bullishCount++;
      } else {
        details.push('【技术指标】5日均线下穿20日均线，形成死叉，短期看空信号。');
        bearishCount++;
      }
    }

    // Generate summary
    let summary = '';
    let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';

    if (bullishCount > bearishCount + 1) {
      summary = `${stockName}当前偏多，多个信号共振看涨。`;
      sentiment = 'bullish';
    } else if (bearishCount > bullishCount + 1) {
      summary = `${stockName}当前偏空，建议观望或减仓。`;
      sentiment = 'bearish';
    } else {
      summary = `${stockName}当前信号分歧，建议谨慎操作，等待方向明确。`;
      sentiment = 'neutral';
    }

    return { summary, details, sentiment };
  };

  const { summary, details, sentiment } = generateInterpretation();

  const sentimentColor = {
    bullish: 'text-[var(--accent-red)]',
    bearish: 'text-[var(--accent-green)]',
    neutral: 'text-[var(--text-secondary)]',
  };

  const sentimentBg = {
    bullish: 'bg-red-500/10 border-red-500/20',
    bearish: 'bg-green-500/10 border-green-500/20',
    neutral: 'bg-[var(--text-secondary)]/10 border-[var(--text-secondary)]/20',
  };

  const sentimentIcon = {
    bullish: '📈',
    bearish: '📉',
    neutral: '📊',
  };

  return (
    <div className={`rounded-lg border p-3 ${sentimentBg[sentiment]}`}>
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-[var(--accent-yellow)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">AI 大白话解读</span>
          <span className={`text-sm ${sentimentColor[sentiment]}`}>
            {sentimentIcon[sentiment]} {summary}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
        )}
      </div>
      
      {expanded && details.length > 0 && (
        <div className="mt-3 space-y-2">
          {details.map((detail, index) => (
            <div key={index} className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
              <span className="text-[var(--text-secondary)] mt-0.5">•</span>
              <span>{detail}</span>
            </div>
          ))}
          <div className="mt-3 pt-2 border-t border-[var(--border-default)]/50 text-xs text-[var(--text-secondary)]">
            * 以上解读仅供参考，不构成投资建议。投资有风险，入市需谨慎。
          </div>
        </div>
      )}
    </div>
  );
}

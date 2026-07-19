'use client';

import { useMemo, useState } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { getAllIndicators, analyzeChanlun, analyzeWaves } from '@/lib/analysis';
import { AnalysisTooltip, AnalysisTooltipData } from './AnalysisTooltip';

interface TrendPath {
  name: string;
  type: 'optimistic' | 'neutral' | 'pessimistic';
  probability: number;
  trigger: string;
  target: string;
  timeWindow: string;
  strategy: string;
}

interface TrendOutlookData {
  currentPhase: string;
  phaseBasis: string;
  confidence: 'high' | 'medium' | 'low';
  paths: TrendPath[];
  optimalStrategy: string;
  keyObservations: string[];
  risks: {
    main: string;
    stopLoss: string;
    blackSwan?: string;
  };
}

// Probability ring component
function ProbabilityRing({ probability, color }: { probability: number; color: string }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (probability / 100) * circumference;

  return (
    <div className="relative w-16 h-16">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth="4"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold font-mono-num" style={{ color }}>{probability}%</span>
      </div>
    </div>
  );
}

function generateTrendOutlook(klineData: ReturnType<typeof useAppState>['klineData'], analysisSettings: ReturnType<typeof useAppState>['analysisSettings']): TrendOutlookData | null {
  if (klineData.length < 20) return null;

  const indicators = getAllIndicators(klineData);
  const chanlun = analysisSettings.chanlun ? analyzeChanlun(klineData) : null;
  const wave = analysisSettings.wave ? analyzeWaves(klineData) : null;

  const lastPrice = klineData[klineData.length - 1].close;
  const lastIdx = klineData.length - 1;
  const ma20 = indicators.ma[20]?.[lastIdx];
  const ma60 = indicators.ma[60]?.[lastIdx];
  const macdHist = indicators.macd[lastIdx]?.histogram ?? 0;
  const rsi = indicators.rsi[lastIdx]?.rsi ?? 50;
  const kdjK = indicators.kdj[lastIdx]?.k ?? 50;

  // Determine current phase
  let currentPhase = '震荡整理';
  let phaseBasis = '价格在均线附近波动，方向不明';
  let confidence: 'high' | 'medium' | 'low' = 'medium';

  if (ma20 && ma60) {
    if (lastPrice > ma20 && ma20 > ma60 && macdHist > 0) {
      currentPhase = '上升趋势中段';
      phaseBasis = '价格站上MA20和MA60，均线多头排列，MACD红柱';
      confidence = 'high';
    } else if (lastPrice > ma20 && lastPrice > ma60) {
      currentPhase = '上升趋势初期';
      phaseBasis = '价格突破MA20和MA60，但均线尚未完全多头排列';
      confidence = 'medium';
    } else if (lastPrice < ma20 && ma20 < ma60 && macdHist < 0) {
      currentPhase = '下跌趋势中段';
      phaseBasis = '价格跌破MA20和MA60，均线空头排列，MACD绿柱';
      confidence = 'high';
    } else if (lastPrice < ma20 && lastPrice < ma60) {
      currentPhase = '下跌趋势初期';
      phaseBasis = '价格跌破MA20和MA60，但尚未形成明显空头排列';
      confidence = 'medium';
    } else if (Math.abs(lastPrice - ma20) / ma20 < 0.02) {
      currentPhase = '震荡整理';
      phaseBasis = '价格在MA20附近反复震荡，等待方向选择';
      confidence = 'low';
    }
  }

  // Add chanlun/wave info to basis
  if (chanlun && chanlun.centers.length > 0) {
    const lastCenter = chanlun.centers[chanlun.centers.length - 1];
    if (lastPrice > lastCenter.high) {
      phaseBasis += '；缠论：已突破最近中枢上沿';
    } else if (lastPrice < lastCenter.low) {
      phaseBasis += '；缠论：已跌破最近中枢下沿';
    } else {
      phaseBasis += `；缠论：在中枢[${lastCenter.low.toFixed(2)}-${lastCenter.high.toFixed(2)}]内震荡`;
    }
  }

  // Generate paths based on current state
  const isUptrend = currentPhase.includes('上升');
  const isDowntrend = currentPhase.includes('下跌');

  const paths: TrendPath[] = isUptrend ? [
    {
      name: '乐观路径',
      type: 'optimistic',
      probability: 45,
      trigger: '成交量持续放大，突破前高且MACD金叉',
      target: `${(lastPrice * 1.1).toFixed(2)} - ${(lastPrice * 1.15).toFixed(2)}`,
      timeWindow: '1-2周',
      strategy: '持仓为主，回调至MA10附近可加仓',
    },
    {
      name: '中性路径',
      type: 'neutral',
      probability: 35,
      trigger: '量能维持当前水平，价格在MA20上方震荡',
      target: `${(lastPrice * 0.97).toFixed(2)} - ${(lastPrice * 1.05).toFixed(2)}`,
      timeWindow: '2-4周',
      strategy: '持仓观望，高抛低吸',
    },
    {
      name: '悲观路径',
      type: 'pessimistic',
      probability: 20,
      trigger: '放量跌破MA20，MACD死叉',
      target: `${(lastPrice * 0.9).toFixed(2)} - ${(lastPrice * 0.95).toFixed(2)}`,
      timeWindow: '1-3周',
      strategy: '减仓至半仓，跌破MA60清仓',
    },
  ] : isDowntrend ? [
    {
      name: '乐观路径',
      type: 'optimistic',
      probability: 25,
      trigger: '缩量企稳，MACD底背驰，放量站上MA20',
      target: `${(lastPrice * 1.08).toFixed(2)} - ${(lastPrice * 1.12).toFixed(2)}`,
      timeWindow: '2-3周',
      strategy: '轻仓试探，确认反转后加仓',
    },
    {
      name: '中性路径',
      type: 'neutral',
      probability: 40,
      trigger: '下跌动能减弱，在支撑位附近震荡',
      target: `${(lastPrice * 0.95).toFixed(2)} - ${(lastPrice * 1.03).toFixed(2)}`,
      timeWindow: '2-4周',
      strategy: '空仓观望，等待企稳信号',
    },
    {
      name: '悲观路径',
      type: 'pessimistic',
      probability: 35,
      trigger: '放量跌破前低，无明显止跌信号',
      target: `${(lastPrice * 0.85).toFixed(2)} - ${(lastPrice * 0.9).toFixed(2)}`,
      timeWindow: '1-2周',
      strategy: '严格空仓，不要抄底',
    },
  ] : [
    {
      name: '乐观路径',
      type: 'optimistic',
      probability: 35,
      trigger: '放量突破震荡区间上沿，均线转为多头排列',
      target: `${(lastPrice * 1.08).toFixed(2)} - ${(lastPrice * 1.12).toFixed(2)}`,
      timeWindow: '1-2周',
      strategy: '突破后跟进，回调不破突破位可加仓',
    },
    {
      name: '中性路径',
      type: 'neutral',
      probability: 40,
      trigger: '继续在当前区间震荡，量能无明显变化',
      target: `${(lastPrice * 0.95).toFixed(2)} - ${(lastPrice * 1.05).toFixed(2)}`,
      timeWindow: '2-4周',
      strategy: '区间高抛低吸，控制仓位',
    },
    {
      name: '悲观路径',
      type: 'pessimistic',
      probability: 25,
      trigger: '放量跌破震荡区间下沿',
      target: `${(lastPrice * 0.88).toFixed(2)} - ${(lastPrice * 0.93).toFixed(2)}`,
      timeWindow: '1-2周',
      strategy: '跌破即离场，不要抱有幻想',
    },
  ];

  const optimalStrategy = isUptrend
    ? '当前处于上升趋势，以持仓为主，回调是加仓机会，但注意设置止盈位'
    : isDowntrend
    ? '当前处于下跌趋势，以空仓或轻仓为主，不要急于抄底，等待明确反转信号'
    : '当前处于震荡整理，控制仓位，等待方向明确后再加仓';

  return {
    currentPhase,
    phaseBasis,
    confidence,
    paths,
    optimalStrategy,
    keyObservations: [
      '关注成交量变化：放量突破有效，缩量突破需警惕',
      `关键支撑位：MA20 = ${ma20?.toFixed(2) || '-'}`,
      `关键压力位：前高 = ${Math.max(...klineData.slice(-20).map(d => d.high)).toFixed(2)}`,
      'MACD是否出现金叉/死叉信号',
      'RSI是否进入超买(>70)或超卖(<30)区域',
    ],
    risks: {
      main: isUptrend
        ? '上涨动能减弱，成交量萎缩可能导致回调'
        : isDowntrend
        ? '下跌趋势未改，任何反弹都可能是诱多'
        : '方向未明，假突破风险较大',
      stopLoss: isUptrend
        ? `跌破MA20(${ma20?.toFixed(2) || '-'})考虑减仓，跌破MA60(${ma60?.toFixed(2) || '-'})清仓`
        : '当前不建议入场，如已持仓建议止损',
      blackSwan: rsi > 80 || kdjK > 90
        ? '技术指标严重超买，短期回调风险较大'
        : rsi < 20 || kdjK < 10
        ? '技术指标严重超卖，可能存在反弹机会但需确认'
        : undefined,
    },
  };
}

const pathColors = {
  optimistic: '#4ade80',
  neutral: '#fbbf24',
  pessimistic: '#f87171',
};

export function TrendOutlook() {
  const { klineData, analysisSettings, selectedStock } = useAppState();
  const [expandedPath, setExpandedPath] = useState<number | null>(null);

  const outlook = useMemo(
    () => generateTrendOutlook(klineData, analysisSettings),
    [klineData, analysisSettings]
  );

  if (!selectedStock) {
    return (
      <div className="px-3 py-4 text-xs text-[#94a3b8] text-center">
        选择股票后显示走势研判
      </div>
    );
  }

  if (!outlook) {
    return (
      <div className="px-3 py-4 text-xs text-[#94a3b8] text-center">
        数据加载中...
      </div>
    );
  }

  const confidenceColors = {
    high: '#4ade80',
    medium: '#fbbf24',
    low: '#f87171',
  };

  const phaseTooltip: AnalysisTooltipData = {
    name: '当前走势定性',
    conclusion: outlook.currentPhase,
    basis: outlook.phaseBasis,
    confidence: outlook.confidence,
    explanation: '基于均线系统、MACD、缠论中枢等多维度分析综合判断当前所处的趋势阶段。',
  };

  return (
    <div className="border-b border-[#1e293b]">
      <div className="px-3 py-2 text-xs font-medium text-[#d4a853] uppercase tracking-wider flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#d4a853]" />
        走势研判与操作展望
      </div>

      <div className="px-3 pb-3 space-y-3">
        {/* Current Phase */}
        <div className="p-2.5 rounded bg-[#0a1628] border border-[#d4a853]/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-[#94a3b8]">当前走势定性</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{
                color: confidenceColors[outlook.confidence],
                backgroundColor: `${confidenceColors[outlook.confidence]}20`,
              }}
            >
              置信度: {outlook.confidence === 'high' ? '高' : outlook.confidence === 'medium' ? '中' : '低'}
            </span>
          </div>
          <AnalysisTooltip data={phaseTooltip}>
            <div className="text-sm font-medium text-[#e2e8f0] mb-1">
              {outlook.currentPhase}
            </div>
          </AnalysisTooltip>
          <div className="text-[10px] text-[#94a3b8] leading-relaxed">
            {outlook.phaseBasis}
          </div>
        </div>

        {/* Multi-path Projection */}
        <div>
          <div className="text-[10px] text-[#94a3b8] mb-2">多路径推演</div>
          <div className="grid grid-cols-3 gap-1.5">
            {outlook.paths.map((path, i) => (
              <div
                key={i}
                className="p-2 rounded bg-[#0f0f1a] border border-[#1e293b] hover:border-[#2e394b] transition-colors cursor-pointer"
                onClick={() => setExpandedPath(expandedPath === i ? null : i)}
              >
                <div className="flex flex-col items-center mb-1.5">
                  <ProbabilityRing probability={path.probability} color={pathColors[path.type]} />
                  <div className="text-[10px] font-medium mt-1" style={{ color: pathColors[path.type] }}>
                    {path.name}
                  </div>
                </div>
                <div className="text-[9px] text-[#94a3b8] space-y-0.5">
                  <div>目标: <span className="text-[#e2e8f0] font-mono-num">{path.target}</span></div>
                  <div>窗口: {path.timeWindow}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Expanded Path Detail */}
          {expandedPath !== null && (
            <div className="mt-2 p-2 rounded bg-[#0a1628] border border-[#1e293b] text-[10px] space-y-1.5">
              <div className="font-medium text-[#e2e8f0]">{outlook.paths[expandedPath].name}详情</div>
              <div>
                <span className="text-[#94a3b8]">触发条件: </span>
                <span className="text-[#e2e8f0]">{outlook.paths[expandedPath].trigger}</span>
              </div>
              <div>
                <span className="text-[#94a3b8]">预期目标: </span>
                <span className="text-[#4ade80] font-mono-num">{outlook.paths[expandedPath].target}</span>
              </div>
              <div>
                <span className="text-[#94a3b8]">时间窗口: </span>
                <span className="text-[#e2e8f0]">{outlook.paths[expandedPath].timeWindow}</span>
              </div>
              <div>
                <span className="text-[#94a3b8]">应对策略: </span>
                <span className="text-[#fbbf24]">{outlook.paths[expandedPath].strategy}</span>
              </div>
            </div>
          )}
        </div>

        {/* Optimal Strategy */}
        <div className="p-2 rounded bg-[#0a1628] border border-[#3b82f6]/30">
          <div className="text-[10px] text-[#3b82f6] mb-1 font-medium">当前最优策略</div>
          <div className="text-[11px] text-[#e2e8f0] leading-relaxed">{outlook.optimalStrategy}</div>
        </div>

        {/* Key Observations */}
        <div>
          <div className="text-[10px] text-[#94a3b8] mb-1">关键观察点</div>
          <div className="space-y-0.5">
            {outlook.keyObservations.map((obs, i) => (
              <div key={i} className="text-[10px] text-[#94a3b8] flex items-start gap-1">
                <span className="text-[#3b82f6] mt-0.5">&#x2022;</span>
                <span>{obs}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Warning */}
        <div className="p-2 rounded bg-[#f8717110] border border-[#f87171]/30">
          <div className="text-[10px] text-[#f87171] mb-1.5 font-medium flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            风险提示
          </div>
          <div className="space-y-1">
            <div className="text-[10px]">
              <span className="text-[#94a3b8]">主要风险: </span>
              <span className="text-[#e2e8f0]">{outlook.risks.main}</span>
            </div>
            <div className="text-[10px]">
              <span className="text-[#94a3b8]">止损条件: </span>
              <span className="text-[#f87171]">{outlook.risks.stopLoss}</span>
            </div>
            {outlook.risks.blackSwan && (
              <div className="text-[10px]">
                <span className="text-[#94a3b8]">异常信号: </span>
                <span className="text-[#fbbf24]">{outlook.risks.blackSwan}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

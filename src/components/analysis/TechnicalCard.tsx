'use client';

import { useState, useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { getAllIndicators } from '@/lib/analysis';
import type { KLineData } from '@/lib/types';

interface TechnicalAnalysis {
  resonance: string;
  resonanceDescription: string;
  trendAssessment: {
    direction: '上升' | '下降' | '震荡';
    confidence: '高' | '中' | '低';
    basis: string;
  };
  paths: Array<{
    name: string;
    probability: number;
    condition: string;
    target: string;
    timeframe: string;
    strategy: string;
  }>;
  advice: string;
  risks: string[];
  indicators: Array<{
    name: string;
    signal: '多' | '空' | '中';
    value: string;
    description: string;
  }>;
  levels: {
    support: string;
    resistance: string;
  };
}

function generateTechnicalAnalysis(klineData: KLineData[]): TechnicalAnalysis {
  const indicators = getAllIndicators(klineData);
  const macd = indicators.macd.length > 0 ? indicators.macd[indicators.macd.length - 1] : { dif: 0, dea: 0, histogram: 0 };
  const kdj = indicators.kdj.length > 0 ? indicators.kdj[indicators.kdj.length - 1] : { k: 50, d: 50, j: 50 };
  const rsi = indicators.rsi.length > 0 ? indicators.rsi[indicators.rsi.length - 1] : { rsi: 50 };
  const boll = indicators.boll.length > 0 ? indicators.boll[indicators.boll.length - 1] : { upper: 0, middle: 0, lower: 0 };
  const ma = indicators.ma;
  const ma5 = ma[5]?.length > 0 ? ma[5][ma[5].length - 1] : 0;
  const ma10 = ma[10]?.length > 0 ? ma[10][ma[10].length - 1] : 0;
  const ma20 = ma[20]?.length > 0 ? ma[20][ma[20].length - 1] : 0;
  
  const lastPrice = klineData.length > 0 ? klineData[klineData.length - 1].close : 0;
  
  // 计算各指标信号
  const macdSignal: '多' | '空' | '中' = macd.dif > 0 && macd.dea > 0 && macd.dif > macd.dea ? '多' :
    macd.dif < 0 && macd.dea < 0 && macd.dif < macd.dea ? '空' : '中';
  
  const kdjSignal: '多' | '空' | '中' = kdj.k > kdj.d && kdj.j > 50 ? '多' :
    kdj.k < kdj.d && kdj.j < 50 ? '空' : '中';
  
  const rsiSignal: '多' | '空' | '中' = rsi.rsi > 50 ? (rsi.rsi > 70 ? '空' : '多') :
    rsi.rsi < 30 ? '多' : '空';
  
  const bollSignal: '多' | '空' | '中' = lastPrice > boll.middle ? '多' :
    lastPrice < boll.lower ? '空' : '中';
  
  const maSignal: '多' | '空' | '中' = ma5 > ma10 && ma10 > ma20 ? '多' :
    ma5 < ma10 && ma10 < ma20 ? '空' : '中';
  
  const signals = [macdSignal, kdjSignal, rsiSignal, bollSignal, maSignal];
  const bullCount = signals.filter(s => s === '多').length;
  const bearCount = signals.filter(s => s === '空').length;
  
  let resonance = '中性震荡';
  let resonanceDescription = '各指标信号不一致，市场方向不明确';
  let direction: '上升' | '下降' | '震荡' = '震荡';
  let confidence: '高' | '中' | '低' = '低';
  let basis = '指标信号分歧较大';
  
  if (bullCount >= 4) {
    resonance = '多头共振';
    resonanceDescription = `MACD${macdSignal === '多' ? '金叉' : '中性'}、KDJ${kdjSignal === '多' ? '金叉' : '中性'}、RSI${rsiSignal === '多' ? '强势' : '中性'}、价格${bollSignal === '多' ? '在中轨上方' : '在中轨附近'}、均线${maSignal === '多' ? '多头排列' : '中性'}，${bullCount}个指标看多`;
    direction = '上升';
    confidence = bullCount === 5 ? '高' : '中';
    basis = `${bullCount}个技术指标看多，${bearCount}个看空，多头占优`;
  } else if (bearCount >= 4) {
    resonance = '空头共振';
    resonanceDescription = `MACD${macdSignal === '空' ? '死叉' : '中性'}、KDJ${kdjSignal === '空' ? '死叉' : '中性'}、RSI${rsiSignal === '空' ? '弱势' : '中性'}、价格${bollSignal === '空' ? '在下轨下方' : '在中轨附近'}、均线${maSignal === '空' ? '空头排列' : '中性'}，${bearCount}个指标看空`;
    direction = '下降';
    confidence = bearCount === 5 ? '高' : '中';
    basis = `${bearCount}个技术指标看空，${bullCount}个看多，空头占优`;
  } else {
    resonance = '信号分歧';
    resonanceDescription = `${bullCount}个指标看多，${bearCount}个指标看空，信号不一致`;
    direction = '震荡';
    confidence = '低';
    basis = '多空信号交织，等待方向明确';
  }
  
  const paths: TechnicalAnalysis['paths'] = [];
  if (direction === '上升') {
    paths.push({
      name: '乐观路径',
      probability: 50,
      condition: '指标持续看多，成交量配合',
      target: `${(lastPrice * 1.08).toFixed(2)}-${(lastPrice * 1.12).toFixed(2)}`,
      timeframe: '5-8 个交易日',
      strategy: '持股待涨，关注布林带上轨',
    });
    paths.push({
      name: '中性路径',
      probability: 35,
      condition: '指标进入超买区后震荡',
      target: `${(lastPrice * 0.97).toFixed(2)}-${(lastPrice * 1.03).toFixed(2)}`,
      timeframe: '8-12 个交易日',
      strategy: '高抛低吸，关注支撑位',
    });
    paths.push({
      name: '悲观路径',
      probability: 15,
      condition: '指标共振转空',
      target: `${(lastPrice * 0.92).toFixed(2)}-${(lastPrice * 0.95).toFixed(2)}`,
      timeframe: '3-5 个交易日',
      strategy: '止损离场',
    });
  } else if (direction === '下降') {
    paths.push({
      name: '乐观路径',
      probability: 30,
      condition: '指标超卖后反弹',
      target: `${(lastPrice * 1.05).toFixed(2)}-${(lastPrice * 1.08).toFixed(2)}`,
      timeframe: '5-8 个交易日',
      strategy: '轻仓试多，止损设在低点下方',
    });
    paths.push({
      name: '中性路径',
      probability: 40,
      condition: '继续震荡下行',
      target: `${(lastPrice * 0.95).toFixed(2)}-${(lastPrice * 0.98).toFixed(2)}`,
      timeframe: '8-12 个交易日',
      strategy: '观望为主',
    });
    paths.push({
      name: '悲观路径',
      probability: 30,
      condition: '加速下跌',
      target: `${(lastPrice * 0.88).toFixed(2)}-${(lastPrice * 0.92).toFixed(2)}`,
      timeframe: '3-5 个交易日',
      strategy: '空仓等待',
    });
  } else {
    paths.push({
      name: '向上突破',
      probability: 35,
      condition: '多头指标增强',
      target: `${(lastPrice * 1.08).toFixed(2)}-${(lastPrice * 1.12).toFixed(2)}`,
      timeframe: '5-10 个交易日',
      strategy: '突破后跟进',
    });
    paths.push({
      name: '继续震荡',
      probability: 40,
      condition: '指标维持中性',
      target: `${(lastPrice * 0.97).toFixed(2)}-${(lastPrice * 1.03).toFixed(2)}`,
      timeframe: '10-15 个交易日',
      strategy: '高抛低吸',
    });
    paths.push({
      name: '向下突破',
      probability: 25,
      condition: '空头指标增强',
      target: `${(lastPrice * 0.92).toFixed(2)}-${(lastPrice * 0.95).toFixed(2)}`,
      timeframe: '5-8 个交易日',
      strategy: '止损离场',
    });
  }
  
  let advice = '';
  if (direction === '上升') {
    advice = `技术指标多头共振，建议持股。关注 MACD 柱状是否持续放大，若出现顶背离应警惕。支撑位${boll.lower.toFixed(2)}，压力位${boll.upper.toFixed(2)}`;
  } else if (direction === '下降') {
    advice = `技术指标空头共振，建议观望或轻仓。等待指标超卖后出现金叉信号。支撑位${(lastPrice * 0.95).toFixed(2)}，压力位${boll.middle.toFixed(2)}`;
  } else {
    advice = `指标信号分歧，建议观望。等待方向明确后再操作。支撑位${boll.lower.toFixed(2)}，压力位${boll.upper.toFixed(2)}`;
  }
  
  const risks: string[] = [];
  if (rsi.rsi > 70) {
    risks.push(`RSI 已进入超买区 (${rsi.rsi.toFixed(1)})，短期有回调压力`);
  } else if (rsi.rsi < 30) {
    risks.push(`RSI 已进入超卖区 (${rsi.rsi.toFixed(1)})，可能反弹`);
  }
  if (Math.abs(macd.dif - macd.dea) < 0.01) {
    risks.push('MACD 快慢线接近，可能出现金叉/死叉');
  }
  if (lastPrice > boll.upper) {
    risks.push('价格突破布林带上轨，有回归中轨需求');
  } else if (lastPrice < boll.lower) {
    risks.push('价格跌破布林带下轨，可能继续下行');
  }
  if (risks.length === 0) {
    risks.push('暂无明显风险信号');
  }
  const indicators_list: TechnicalAnalysis['indicators'] = [
    {
      name: 'MACD',
      signal: macdSignal,
      value: macd.dif > macd.dea ? '金叉' : macd.dif < macd.dea ? '死叉' : '粘合',
      description: `DIF:${macd.dif.toFixed(3)}, DEA:${macd.dea.toFixed(3)}, 柱状:${macd.histogram.toFixed(3)}`,
    },
    {
      name: 'KDJ',
      signal: kdjSignal,
      value: `K:${kdj.k.toFixed(1)}, D:${kdj.d.toFixed(1)}, J:${kdj.j.toFixed(1)}`,
      description: kdj.k > kdj.d ? 'K 线上穿 D 线，金叉' : kdj.k < kdj.d ? 'K 线下穿 D 线，死叉' : 'KDJ 粘合',
    },
    {
      name: 'RSI',
      signal: rsiSignal,
      value: rsi.rsi.toFixed(1),
      description: rsi.rsi > 70 ? '超买区' : rsi.rsi < 30 ? '超卖区' : rsi.rsi > 50 ? '强势区' : '弱势区',
    },
    {
      name: 'BOLL',
      signal: bollSignal,
      value: lastPrice > boll.upper ? '上轨上方' : lastPrice > boll.middle ? '中轨上方' : lastPrice > boll.lower ? '中轨下方' : '下轨下方',
      description: `上轨:${boll.upper.toFixed(2)}, 中轨:${boll.middle.toFixed(2)}, 下轨:${boll.lower.toFixed(2)}`,
    },
    {
      name: 'MA',
      signal: maSignal,
      value: ma5 > ma10 && ma10 > ma20 ? '多头排列' : ma5 < ma10 && ma10 < ma20 ? '空头排列' : '交叉',
      description: `MA5:${ma5.toFixed(2)}, MA10:${ma10.toFixed(2)}, MA20:${ma20.toFixed(2)}`,
    },
  ];
  
  return {
    resonance,
    resonanceDescription,
    trendAssessment: { direction, confidence, basis },
    paths,
    advice,
    risks,
    indicators: indicators_list,
    levels: {
      support: boll.lower.toFixed(2),
      resistance: boll.upper.toFixed(2),
    },
  };
}

interface TechnicalCardProps {
  visible: boolean;
  klineData?: KLineData[];
}

export function TechnicalCard({ visible, klineData = [] }: TechnicalCardProps) {
  const [expanded, setExpanded] = useState(true);
  const analysis = useMemo(() => generateTechnicalAnalysis(klineData), [klineData]);

  if (!visible) return null;

  const directionColor = analysis.trendAssessment.direction === '上升' ? 'text-[var(--accent-red)]' :
    analysis.trendAssessment.direction === '下降' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-yellow)]';

  const confidenceColor = analysis.trendAssessment.confidence === '高' ? 'text-[var(--accent-green)]' :
    analysis.trendAssessment.confidence === '中' ? 'text-[var(--accent-yellow)]' : 'text-[var(--accent-red)]';

  return (
    <div className="rounded border border-emerald-500/30 bg-[var(--bg-primary)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-emerald-500/10 border-b border-emerald-500/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-sm font-medium text-emerald-300">技术指标分析</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-emerald-400/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[300px] bg-[var(--bg-primary)] border-emerald-500/30">
                <p className="text-xs text-[var(--text-primary)]">综合 MACD、KDJ、RSI、布林带、均线系统等技术指标，判断多空信号</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-emerald-400/60 hover:text-emerald-300"
        >
          {expanded ? '收起' : '展开'}
        </button>
      </div>

      {expanded && (
        <div className="p-3 space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-secondary)]">指标共振</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-[var(--text-secondary)] cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[300px] bg-[var(--bg-primary)] border-emerald-500/30">
                    <p className="text-xs text-[var(--text-primary)]">{analysis.resonanceDescription}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-sm text-emerald-200 font-medium">{analysis.resonance}</div>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-[var(--text-secondary)]">各指标信号</span>
            <div className="grid grid-cols-1 gap-1">
              {analysis.indicators.map((ind, i) => (
                <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-[var(--bg-panel)]">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-[var(--text-primary)] w-12 cursor-help border-b border-dashed border-[var(--border-default)]">
                          {ind.name}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[250px] bg-[var(--bg-primary)] border-emerald-500/30">
                        <p className="text-xs text-[var(--text-primary)]">{ind.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    ind.signal === '多' ? 'bg-red-500/20 text-[var(--accent-red)]' :
                    ind.signal === '空' ? 'bg-green-500/20 text-[var(--accent-green)]' :
                    'bg-yellow-500/20 text-[var(--accent-yellow)]'
                  }`}>
                    {ind.signal}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)] flex-1">{ind.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 p-2 rounded bg-red-500/5 border border-red-500/20 text-center">
              <div className="text-xs text-[var(--text-secondary)]">支撑位</div>
              <div className="text-sm text-red-300 font-mono">{analysis.levels.support}</div>
            </div>
            <div className="flex-1 p-2 rounded bg-green-500/5 border border-green-500/20 text-center">
              <div className="text-xs text-[var(--text-secondary)]">压力位</div>
              <div className="text-sm text-green-300 font-mono">{analysis.levels.resistance}</div>
            </div>
          </div>

          <div className="p-2 rounded bg-emerald-500/5 border border-emerald-500/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[var(--text-secondary)]">走势研判</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${directionColor}`}>
                  {analysis.trendAssessment.direction}趋势
                </span>
                <span className={`text-xs ${confidenceColor}`}>
                  ({analysis.trendAssessment.confidence}置信)
                </span>
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">{analysis.trendAssessment.basis}</p>
          </div>

          <div className="space-y-2">
            <span className="text-xs text-[var(--text-secondary)]">技术走势推演</span>
            <div className="grid grid-cols-3 gap-1.5">
              {analysis.paths.map((path, i) => (
                <TooltipProvider key={i}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={`p-2 rounded text-center cursor-help ${
                        i === 0 ? 'bg-red-500/10 border border-red-500/20' :
                        i === 1 ? 'bg-yellow-500/10 border border-yellow-500/20' :
                        'bg-green-500/10 border border-green-500/20'
                      }`}>
                        <div className="text-xs font-medium text-[var(--text-primary)]">{path.name}</div>
                        <div className="text-xs font-medium text-[var(--text-secondary)]">{path.probability}%</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[280px] bg-[var(--bg-primary)] border-emerald-500/30">
                      <div className="space-y-1.5">
                        <p className="text-xs text-[var(--text-primary)]"><span className="text-[var(--text-secondary)]">条件:</span> {path.condition}</p>
                        <p className="text-xs text-[var(--text-primary)]"><span className="text-[var(--text-secondary)]">目标:</span> {path.target}</p>
                        <p className="text-xs text-[var(--text-primary)]"><span className="text-[var(--text-secondary)]">时间:</span> {path.timeframe}</p>
                        <p className="text-xs text-emerald-300"><span className="text-[var(--text-secondary)]">策略:</span> {path.strategy}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>

          <div className="p-2 rounded bg-emerald-500/5 border border-emerald-500/20">
            <span className="text-xs text-[var(--text-secondary)]">操作建议</span>
            <p className="text-xs text-emerald-200 mt-1">{analysis.advice}</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-[var(--accent-red)]">风险提示</span>
            {analysis.risks.map((risk, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-red-300/80">
                <span className="text-[var(--accent-red)] mt-0.5">!</span>
                <span>{risk}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

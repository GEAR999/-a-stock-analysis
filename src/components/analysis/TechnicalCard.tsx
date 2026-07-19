'use client';

import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

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

function generateTechnicalAnalysis(): TechnicalAnalysis {
  return {
    resonance: '多头共振',
    resonanceDescription: 'MACD金叉、KDJ金叉、RSI强势区、价格在布林带中轨上方、均线多头排列，5个指标中4个看多',
    trendAssessment: {
      direction: '上升',
      confidence: '高',
      basis: '多指标共振看多，MACD和KDJ同时金叉，均线多头排列确认上升趋势',
    },
    paths: [
      {
        name: '乐观路径',
        probability: 50,
        condition: 'MACD持续放大，成交量配合，突破布林带上轨',
        target: '1350-1400',
        timeframe: '5-8个交易日',
        strategy: '持股待涨，目标看布林带上轨延伸',
      },
      {
        name: '中性路径',
        probability: 35,
        condition: '指标进入超买区后震荡消化，等待新的金叉',
        target: '1250-1280',
        timeframe: '8-12个交易日',
        strategy: '高抛低吸，关注支撑位附近买入机会',
      },
      {
        name: '悲观路径',
        probability: 15,
        condition: 'MACD死叉、KDJ下穿，指标共振转空',
        target: '1180-1200',
        timeframe: '3-5个交易日',
        strategy: '止损离场，等待指标重新金叉',
      },
    ],
    advice: '当前技术指标多头共振，建议持股。关注MACD柱状是否持续放大，若出现顶背离应警惕。支撑位1220，压力位1280',
    risks: [
      'RSI已进入超买区(75)，短期有回调压力',
      'MACD柱状连续3日放大后开始缩量，动能减弱',
      '价格接近布林带上轨，有回归中轨需求',
    ],
    indicators: [
      { name: 'MACD', signal: '多', value: '金叉', description: 'DIF上穿DEA，柱状由负转正' },
      { name: 'KDJ', signal: '多', value: '金叉', description: 'K线上穿D线，J值85' },
      { name: 'RSI', signal: '多', value: '75', description: 'RSI(14)处于强势区，接近超买' },
      { name: 'BOLL', signal: '中', value: '中轨上方', description: '价格在中轨和上轨之间运行' },
      { name: 'MA', signal: '多', value: '多头排列', description: 'MA5>MA10>MA20>MA60' },
    ],
    levels: {
      support: '1220 (MA20)',
      resistance: '1280 (前高)',
    },
  };
}

interface TechnicalCardProps {
  visible: boolean;
}

export function TechnicalCard({ visible }: TechnicalCardProps) {
  const [expanded, setExpanded] = useState(true);
  const analysis = generateTechnicalAnalysis();

  if (!visible) return null;

  const directionColor = analysis.trendAssessment.direction === '上升' ? 'text-red-400' :
    analysis.trendAssessment.direction === '下降' ? 'text-green-400' : 'text-yellow-400';

  const confidenceColor = analysis.trendAssessment.confidence === '高' ? 'text-green-400' :
    analysis.trendAssessment.confidence === '中' ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="rounded border border-emerald-500/30 bg-[#0f0f1a] overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 bg-emerald-500/10 border-b border-emerald-500/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-sm font-medium text-emerald-300">技术指标分析</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-emerald-400/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[300px] bg-[#0f0f1a] border-emerald-500/30">
                <p className="text-xs text-gray-300">综合MACD、KDJ、RSI、布林带、均线系统等技术指标，判断多空信号</p>
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
          {/* 指标共振 */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">指标共振</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-gray-500 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[300px] bg-[#0f0f1a] border-emerald-500/30">
                    <p className="text-xs text-gray-300">{analysis.resonanceDescription}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-sm text-emerald-200 font-medium">{analysis.resonance}</div>
          </div>

          {/* 指标信号列表 */}
          <div className="space-y-1">
            <span className="text-xs text-gray-400">各指标信号</span>
            <div className="grid grid-cols-1 gap-1">
              {analysis.indicators.map((ind, i) => (
                <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-[#1a1a2e]">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-gray-300 w-12 cursor-help border-b border-dashed border-gray-600">
                          {ind.name}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[250px] bg-[#0f0f1a] border-emerald-500/30">
                        <p className="text-xs text-gray-300">{ind.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    ind.signal === '多' ? 'bg-red-500/20 text-red-400' :
                    ind.signal === '空' ? 'bg-green-500/20 text-green-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {ind.signal}
                  </span>
                  <span className="text-xs text-gray-400 flex-1">{ind.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 支撑压力位 */}
          <div className="flex gap-2">
            <div className="flex-1 p-2 rounded bg-red-500/5 border border-red-500/20 text-center">
              <div className="text-xs text-gray-400">支撑位</div>
              <div className="text-sm text-red-300 font-mono">{analysis.levels.support}</div>
            </div>
            <div className="flex-1 p-2 rounded bg-green-500/5 border border-green-500/20 text-center">
              <div className="text-xs text-gray-400">压力位</div>
              <div className="text-sm text-green-300 font-mono">{analysis.levels.resistance}</div>
            </div>
          </div>

          {/* 走势研判 */}
          <div className="p-2 rounded bg-emerald-500/5 border border-emerald-500/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">走势研判</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${directionColor}`}>
                  {analysis.trendAssessment.direction}趋势
                </span>
                <span className={`text-xs ${confidenceColor}`}>
                  ({analysis.trendAssessment.confidence}置信)
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400">{analysis.trendAssessment.basis}</p>
          </div>

          {/* 多路径推演 */}
          <div className="space-y-2">
            <span className="text-xs text-gray-400">技术走势推演</span>
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
                        <div className="text-xs font-medium text-gray-300">{path.name}</div>
                        <div className="text-lg font-bold text-emerald-300">{path.probability}%</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[280px] bg-[#0f0f1a] border-emerald-500/30">
                      <div className="space-y-1.5">
                        <p className="text-xs text-gray-300"><span className="text-gray-500">条件:</span> {path.condition}</p>
                        <p className="text-xs text-gray-300"><span className="text-gray-500">目标:</span> {path.target}</p>
                        <p className="text-xs text-gray-300"><span className="text-gray-500">时间:</span> {path.timeframe}</p>
                        <p className="text-xs text-emerald-300"><span className="text-gray-500">策略:</span> {path.strategy}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>

          {/* 操作建议 */}
          <div className="p-2 rounded bg-emerald-500/5 border border-emerald-500/20">
            <span className="text-xs text-gray-400">操作建议</span>
            <p className="text-xs text-emerald-200 mt-1">{analysis.advice}</p>
          </div>

          {/* 风险提示 */}
          <div className="space-y-1">
            <span className="text-xs text-red-400">风险提示</span>
            {analysis.risks.map((risk, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-red-300/80">
                <span className="text-red-500 mt-0.5">!</span>
                <span>{risk}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

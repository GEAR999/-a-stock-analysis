'use client';

import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

// 缠论分析数据类型
interface ChanlunAnalysis {
  currentStage: string;
  stageDescription: string;
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
  signals: Array<{
    type: 'buy' | 'sell' | 'neutral';
    name: string;
    description: string;
    basis: string;
  }>;
}

// 模拟数据生成
function generateChanlunAnalysis(): ChanlunAnalysis {
  return {
    currentStage: '中枢震荡后向上突破',
    stageDescription: '当前处于第二个中枢形成后的向上离开阶段，笔的方向为上升笔，尚未形成新的中枢',
    trendAssessment: {
      direction: '上升',
      confidence: '中',
      basis: '上升笔延续中，未出现顶分型，但接近前高压力位',
    },
    paths: [
      {
        name: '乐观路径',
        probability: 40,
        condition: '突破前高1280并形成第三类买点',
        target: '1350-1400',
        timeframe: '5-10个交易日',
        strategy: '持股待涨，突破后加仓',
      },
      {
        name: '中性路径',
        probability: 40,
        condition: '在前高附近震荡，形成新的中枢',
        target: '1240-1280',
        timeframe: '10-15个交易日',
        strategy: '高抛低吸，等待方向选择',
      },
      {
        name: '悲观路径',
        probability: 20,
        condition: '无法突破前高，形成顶分型后回落',
        target: '1180-1200',
        timeframe: '5-8个交易日',
        strategy: '减仓或离场，等待新的买点',
      },
    ],
    advice: '当前处于上升笔中，建议持股观察。若突破1280前高并回踩不破，可加仓；若出现顶分型且跌破5日均线，应减仓',
    risks: [
      '接近前高压力位1280，突破失败风险较大',
      '上升笔已延续8根K线，注意顶分型出现',
      '成交量未明显放大，突破力度存疑',
    ],
    signals: [
      {
        type: 'neutral',
        name: '中枢震荡',
        description: '当前处于中枢区间内震荡',
        basis: '最近10根K线的高低点重叠区域',
      },
      {
        type: 'buy',
        name: '上升笔延续',
        description: '当前笔方向向上，未出现顶分型',
        basis: '最近3根K线高点逐步抬升',
      },
    ],
  };
}

interface ChanlunCardProps {
  visible: boolean;
}

export function ChanlunCard({ visible }: ChanlunCardProps) {
  const [expanded, setExpanded] = useState(true);
  const analysis = generateChanlunAnalysis();

  if (!visible) return null;

  const directionColor = analysis.trendAssessment.direction === '上升' ? 'text-red-400' :
    analysis.trendAssessment.direction === '下降' ? 'text-green-400' : 'text-yellow-400';

  const confidenceColor = analysis.trendAssessment.confidence === '高' ? 'text-green-400' :
    analysis.trendAssessment.confidence === '中' ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="rounded border border-purple-500/30 bg-[#0f0f1a] overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 bg-purple-500/10 border-b border-purple-500/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          <span className="text-sm font-medium text-purple-300">缠论分析</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-purple-400/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[300px] bg-[#0f0f1a] border-purple-500/30">
                <p className="text-xs text-gray-300">基于缠论理论，自动识别笔、线段、中枢，判断当前走势阶段</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-purple-400/60 hover:text-purple-300"
        >
          {expanded ? '收起' : '展开'}
        </button>
      </div>

      {expanded && (
        <div className="p-3 space-y-3">
          {/* 当前结论 */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">当前阶段</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-gray-500 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[300px] bg-[#0f0f1a] border-purple-500/30">
                    <p className="text-xs text-gray-300">{analysis.stageDescription}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-sm text-purple-200 font-medium">{analysis.currentStage}</div>
          </div>

          {/* 走势研判 */}
          <div className="p-2 rounded bg-purple-500/5 border border-purple-500/20">
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

          {/* 信号列表 */}
          <div className="space-y-1">
            <span className="text-xs text-gray-400">关键信号</span>
            {analysis.signals.map((signal, i) => (
              <div key={i} className="flex items-start gap-2 p-1.5 rounded bg-[#1a1a2e]">
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  signal.type === 'buy' ? 'bg-red-500/20 text-red-400' :
                  signal.type === 'sell' ? 'bg-green-500/20 text-green-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {signal.type === 'buy' ? '多' : signal.type === 'sell' ? '空' : '中'}
                </span>
                <div className="flex-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-gray-300 cursor-help border-b border-dashed border-gray-600">
                          {signal.name}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[300px] bg-[#0f0f1a] border-purple-500/30">
                        <p className="text-xs text-gray-300 mb-1">{signal.description}</p>
                        <p className="text-xs text-purple-300">依据: {signal.basis}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            ))}
          </div>

          {/* 多路径推演 */}
          <div className="space-y-2">
            <span className="text-xs text-gray-400">走势推演</span>
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
                        <div className="text-xs font-medium text-gray-500">暂无量化评估</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[280px] bg-[#0f0f1a] border-purple-500/30">
                      <div className="space-y-1.5">
                        <p className="text-xs text-gray-300"><span className="text-gray-500">条件:</span> {path.condition}</p>
                        <p className="text-xs text-gray-300"><span className="text-gray-500">目标:</span> {path.target}</p>
                        <p className="text-xs text-gray-300"><span className="text-gray-500">时间:</span> {path.timeframe}</p>
                        <p className="text-xs text-purple-300"><span className="text-gray-500">策略:</span> {path.strategy}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>

          {/* 操作建议 */}
          <div className="p-2 rounded bg-blue-500/5 border border-blue-500/20">
            <span className="text-xs text-gray-400">操作建议</span>
            <p className="text-xs text-blue-200 mt-1">{analysis.advice}</p>
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

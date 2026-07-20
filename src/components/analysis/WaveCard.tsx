'use client';

import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface WaveAnalysis {
  currentWave: string;
  waveDescription: string;
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
  waveStructure: {
    type: '推动浪' | '调整浪';
    current: string;
    progress: string;
  };
}

function generateWaveAnalysis(): WaveAnalysis {
  return {
    currentWave: '推动浪第3浪',
    waveDescription: '当前处于5浪推动结构的第3浪（主升浪），这是推动浪中最强的一浪',
    trendAssessment: {
      direction: '上升',
      confidence: '高',
      basis: '第3浪特征明显：涨幅大于第1浪，成交量放大，市场情绪乐观',
    },
    paths: [
      {
        name: '乐观路径',
        probability: 45,
        condition: '第3浪继续延伸，目标达到第1浪的1.618倍',
        target: '1380-1420',
        timeframe: '8-12个交易日',
        strategy: '持股待涨，第3浪结束后减仓',
      },
      {
        name: '中性路径',
        probability: 35,
        condition: '第3浪即将结束，进入第4浪调整',
        target: '回调至1220-1250',
        timeframe: '3-5个交易日后开始调整',
        strategy: '逐步减仓，等待第4浪结束再介入',
      },
      {
        name: '悲观路径',
        probability: 20,
        condition: '浪型计数错误，实际处于B浪反弹',
        target: '下跌至1150',
        timeframe: '5-8个交易日',
        strategy: '立即减仓，重新评估浪型',
      },
    ],
    advice: '第3浪是主升浪，建议持股享受利润。关注第3浪结束信号（出现5子浪结构、成交量背离），及时在第4浪开始前减仓',
    risks: [
      '第3浪可能即将结束，需警惕第4浪调整',
      '若浪型计数错误，可能面临较大回撤',
      '第3浪末端容易出现过度乐观情绪',
    ],
    waveStructure: {
      type: '推动浪',
      current: '第3浪',
      progress: '3/5',
    },
  };
}

interface WaveCardProps {
  visible: boolean;
}

export function WaveCard({ visible }: WaveCardProps) {
  const [expanded, setExpanded] = useState(true);
  const analysis = generateWaveAnalysis();

  if (!visible) return null;

  const directionColor = analysis.trendAssessment.direction === '上升' ? 'text-red-400' :
    analysis.trendAssessment.direction === '下降' ? 'text-green-400' : 'text-yellow-400';

  const confidenceColor = analysis.trendAssessment.confidence === '高' ? 'text-green-400' :
    analysis.trendAssessment.confidence === '中' ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="rounded border border-blue-500/30 bg-[#0f0f1a] overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 bg-blue-500/10 border-b border-blue-500/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm font-medium text-blue-300">波浪理论分析</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-blue-400/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[300px] bg-[#0f0f1a] border-blue-500/30">
                <p className="text-xs text-gray-300">基于艾略特波浪理论，识别推动浪(1-2-3-4-5)和调整浪(A-B-C)结构</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-400/60 hover:text-blue-300"
        >
          {expanded ? '收起' : '展开'}
        </button>
      </div>

      {expanded && (
        <div className="p-3 space-y-3">
          {/* 浪型结构 */}
          <div className="flex items-center gap-3 p-2 rounded bg-blue-500/5 border border-blue-500/20">
            <div className="text-center">
              <div className="text-xs text-gray-400">浪型</div>
              <div className="text-sm text-blue-300 font-medium">{analysis.waveStructure.type}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400">当前</div>
              <div className="text-sm text-blue-200 font-bold">{analysis.waveStructure.current}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400">进度</div>
              <div className="text-sm text-blue-300">{analysis.waveStructure.progress}</div>
            </div>
          </div>

          {/* 当前结论 */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">当前位置</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-gray-500 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[300px] bg-[#0f0f1a] border-blue-500/30">
                    <p className="text-xs text-gray-300">{analysis.waveDescription}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-sm text-blue-200 font-medium">{analysis.currentWave}</div>
          </div>

          {/* 走势研判 */}
          <div className="p-2 rounded bg-blue-500/5 border border-blue-500/20">
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
            <span className="text-xs text-gray-400">浪型推演</span>
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
                    <TooltipContent side="right" className="max-w-[280px] bg-[#0f0f1a] border-blue-500/30">
                      <div className="space-y-1.5">
                        <p className="text-xs text-gray-300"><span className="text-gray-500">条件:</span> {path.condition}</p>
                        <p className="text-xs text-gray-300"><span className="text-gray-500">目标:</span> {path.target}</p>
                        <p className="text-xs text-gray-300"><span className="text-gray-500">时间:</span> {path.timeframe}</p>
                        <p className="text-xs text-blue-300"><span className="text-gray-500">策略:</span> {path.strategy}</p>
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

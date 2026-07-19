'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface AnalysisSettings {
  chanlun: boolean;
  wave: boolean;
  technical: boolean;
}

interface ComprehensiveAnalysisProps {
  settings: AnalysisSettings;
}

interface TheoryConclusion {
  name: string;
  direction: '上升' | '下降' | '震荡';
  confidence: '高' | '中' | '低';
  color: string;
}

function getTheoryConclusions(settings: AnalysisSettings): TheoryConclusion[] {
  const conclusions: TheoryConclusion[] = [];
  
  if (settings.chanlun) {
    conclusions.push({
      name: '缠论',
      direction: '上升',
      confidence: '中',
      color: 'purple',
    });
  }
  
  if (settings.wave) {
    conclusions.push({
      name: '波浪理论',
      direction: '上升',
      confidence: '高',
      color: 'blue',
    });
  }
  
  if (settings.technical) {
    conclusions.push({
      name: '技术指标',
      direction: '上升',
      confidence: '高',
      color: 'emerald',
    });
  }
  
  return conclusions;
}

export function ComprehensiveAnalysis({ settings }: ComprehensiveAnalysisProps) {
  const conclusions = getTheoryConclusions(settings);
  const enabledCount = conclusions.length;
  
  // 计算共振和分歧
  const upCount = conclusions.filter(c => c.direction === '上升').length;
  const downCount = conclusions.filter(c => c.direction === '下降').length;
  const neutralCount = conclusions.filter(c => c.direction === '震荡').length;
  
  // 判断综合方向
  let overallDirection: '看多' | '看空' | '中性';
  let overallColor: string;
  
  if (upCount > downCount && upCount > neutralCount) {
    overallDirection = '看多';
    overallColor = 'text-red-400 bg-red-500/10 border-red-500/30';
  } else if (downCount > upCount && downCount > neutralCount) {
    overallDirection = '看空';
    overallColor = 'text-green-400 bg-green-500/10 border-green-500/30';
  } else {
    overallDirection = '中性';
    overallColor = 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
  }
  
  // 判断共振情况
  const hasResonance = upCount === enabledCount || downCount === enabledCount;
  const hasDivergence = upCount > 0 && downCount > 0;
  
  // 风险等级
  const riskLevel = enabledCount === 0 ? '无' :
    hasDivergence ? '中' :
    overallDirection === '看空' ? '高' : '低';
  
  const riskColor = riskLevel === '高' ? 'text-red-400' :
    riskLevel === '中' ? 'text-yellow-400' :
    riskLevel === '低' ? 'text-green-400' : 'text-gray-400';

  if (enabledCount === 0) {
    return (
      <div className="rounded border border-amber-500/30 bg-[#0f0f1a] overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-amber-500/10 border-b border-amber-500/30">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-sm font-medium text-amber-300">综合分析</span>
          </div>
        </div>
        <div className="p-4 text-center">
          <p className="text-sm text-gray-400">请至少开启一个分析理论</p>
          <p className="text-xs text-gray-500 mt-1">开启缠论、波浪理论或技术指标中的任意一个</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border border-amber-500/30 bg-[#0f0f1a] overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 bg-amber-500/10 border-b border-amber-500/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-sm font-medium text-amber-300">综合分析</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-amber-400/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[300px] bg-[#0f0f1a] border-amber-500/30">
                <p className="text-xs text-gray-300">基于已开启的分析理论，综合判断走势方向和共振/分歧情况</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span className="text-xs text-amber-400/60">基于 {enabledCount} 个理论</span>
      </div>

      <div className="p-3 space-y-3">
        {/* 综合走势定性 */}
        <div className={`p-2 rounded border ${overallColor}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">综合走势定性</span>
            <span className={`text-sm font-bold ${overallColor.split(' ')[0]}`}>
              {overallDirection}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {enabledCount}个理论中，{upCount}个看多，{downCount}个看空，{neutralCount}个中性
          </p>
        </div>

        {/* 各理论结论 */}
        <div className="space-y-1">
          <span className="text-xs text-gray-400">各理论结论</span>
          {conclusions.map((c, i) => (
            <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-[#1a1a2e]">
              <div className={`w-2 h-2 rounded-full bg-${c.color}-500`} />
              <span className="text-xs text-gray-300 flex-1">{c.name}</span>
              <span className={`text-xs ${
                c.direction === '上升' ? 'text-red-400' :
                c.direction === '下降' ? 'text-green-400' : 'text-yellow-400'
              }`}>
                {c.direction}
              </span>
              <span className={`text-xs ${
                c.confidence === '高' ? 'text-green-400' :
                c.confidence === '中' ? 'text-yellow-400' : 'text-red-400'
              }`}>
                ({c.confidence})
              </span>
            </div>
          ))}
        </div>

        {/* 共振/分歧分析 */}
        <div className="space-y-2">
          {hasResonance && (
            <div className="p-2 rounded bg-green-500/5 border border-green-500/20">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-green-400 font-medium">多理论共振</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-green-400/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px] bg-[#0f0f1a] border-green-500/30">
                      <p className="text-xs text-gray-300">所有开启的理论得出一致结论，信号可靠性较高</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-gray-400">
                {enabledCount}个理论均{overallDirection === '看多' ? '看涨' : overallDirection === '看空' ? '看跌' : '看震荡'}，形成共振信号
              </p>
            </div>
          )}
          
          {hasDivergence && (
            <div className="p-2 rounded bg-yellow-500/5 border border-yellow-500/20">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-yellow-400 font-medium">理论分歧</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-yellow-400/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px] bg-[#0f0f1a] border-yellow-500/30">
                      <p className="text-xs text-gray-300">不同理论得出矛盾结论，建议谨慎操作，等待方向明确</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-gray-400">
                理论间存在分歧，建议降低仓位或观望，等待更多信号确认
              </p>
            </div>
          )}
        </div>

        {/* 综合操作建议 */}
        <div className="p-2 rounded bg-amber-500/5 border border-amber-500/20">
          <span className="text-xs text-gray-400">综合操作建议</span>
          <p className="text-xs text-amber-200 mt-1">
            {hasResonance && overallDirection === '看多' && '多理论共振看多，建议持股待涨，可适当加仓'}
            {hasResonance && overallDirection === '看空' && '多理论共振看空，建议减仓或离场观望'}
            {hasResonance && overallDirection === '中性' && '多理论共振看震荡，建议高抛低吸，控制仓位'}
            {hasDivergence && '理论间存在分歧，建议降低仓位，等待方向明确后再操作'}
            {!hasResonance && !hasDivergence && enabledCount === 1 && '仅一个理论开启，建议结合其他理论综合判断'}
          </p>
        </div>

        {/* 综合风险等级 */}
        <div className="flex items-center justify-between p-2 rounded bg-[#1a1a2e]">
          <span className="text-xs text-gray-400">综合风险等级</span>
          <span className={`text-sm font-bold ${riskColor}`}>
            {riskLevel === '无' ? '-' : riskLevel}
          </span>
        </div>

        {/* 关键观察点 */}
        <div className="space-y-1">
          <span className="text-xs text-gray-400">关键观察点</span>
          <div className="text-xs text-gray-300 space-y-1">
            <p>• 关注MACD是否持续金叉，确认上升趋势</p>
            <p>• 观察成交量是否配合，放量突破有效性更高</p>
            <p>• 注意前高1280压力位，突破后回踩确认是关键</p>
          </div>
        </div>
      </div>
    </div>
  );
}

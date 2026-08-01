'use client';

import { useState, useMemo } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { AIAnalysis } from '@/components/ai/AIAnalysis';
import type { KLineData } from '@/lib/types';

interface AnalysisSettings {
  chanlun: boolean;
  wave: boolean;
  technical: boolean;
}

interface TheoryConclusion {
  name: string;
  direction: '上升' | '下降' | '震荡';
  confidence: '高' | '中' | '低';
  advice: string;
  color: string;
}

interface ComprehensiveAnalysisProps {
  settings: AnalysisSettings;
  conclusions: TheoryConclusion[];
  klineData?: KLineData[];
}

// 根据风险等级计算建议仓位
function getPositionAdvice(riskLevel: string): { min: number; max: number; label: string; color: string } {
  switch (riskLevel) {
    case '低': return { min: 60, max: 80, label: '建议仓位 60-80%', color: 'text-[var(--accent-green)]' };
    case '中': return { min: 30, max: 50, label: '建议仓位 30-50%', color: 'text-[var(--accent-yellow)]' };
    case '高': return { min: 0, max: 20, label: '建议仓位 0-20%', color: 'text-orange-400' };
    case '极高': return { min: 0, max: 0, label: '建议空仓观望', color: 'text-[var(--accent-red)]' };
    default: return { min: 0, max: 0, label: '无分析数据', color: 'text-[var(--text-secondary)]' };
  }
}

// 计算综合评分 (0-100)
function calculateScore(conclusions: TheoryConclusion[]): number {
  if (conclusions.length === 0) return 50;

  const directionScore: Record<string, number> = { '上升': 80, '震荡': 50, '下降': 20 };
  const confidenceWeight: Record<string, number> = { '高': 1.0, '中': 0.7, '低': 0.4 };

  let totalWeight = 0;
  let weightedScore = 0;

  for (const c of conclusions) {
    const w = confidenceWeight[c.confidence] || 0.5;
    weightedScore += directionScore[c.direction] * w;
    totalWeight += w;
  }

  return Math.round(weightedScore / totalWeight);
}

// 计算百分位排名（基于综合评分映射）
function getPercentileRank(score: number): string {
  if (score >= 80) return `高于近60天中 ${Math.min(95, score + 10)}% 的交易日`;
  if (score >= 60) return `高于近60天中 ${score}% 的交易日`;
  if (score >= 40) return `高于近60天中 ${score}% 的交易日`;
  return `低于近60天中 ${100 - score}% 的交易日`;
}

// 计算量价关系
function getVolumePriceRelation(klineData: KLineData[] | undefined): { label: string; ratio: string } {
  if (!klineData || klineData.length < 10) {
    return { label: '数据不足', ratio: '--' };
  }

  const recent5 = klineData.slice(-5);
  const prev20 = klineData.slice(-25, -5);

  const recentAvgVolume = recent5.reduce((s, k) => s + k.volume, 0) / recent5.length;
  const prevAvgVolume = prev20.length > 0 ? prev20.reduce((s, k) => s + k.volume, 0) / prev20.length : recentAvgVolume;
  const ratio = prevAvgVolume > 0 ? (recentAvgVolume / prevAvgVolume) : 1;

  const lastPrice = klineData[klineData.length - 1].close;
  const prevPrice = klineData.length > 1 ? klineData[klineData.length - 2].close : lastPrice;
  const priceUp = lastPrice >= prevPrice;

  let label = '量价平稳';
  if (ratio > 1.5 && priceUp) label = '量价齐涨';
  else if (ratio > 1.5 && !priceUp) label = '量价齐跌';
  else if (ratio < 0.7 && priceUp) label = '缩量上涨';
  else if (ratio < 0.7 && !priceUp) label = '缩量下跌';
  else if (priceUp) label = '温和放量上涨';
  else label = '温和缩量下跌';

  return { label, ratio: ratio.toFixed(1) };
}

// 生成分析详情文本
function getAnalysisDetails(conclusions: TheoryConclusion[]): string[] {
  const details: string[] = [];
  for (const c of conclusions) {
    details.push(`${c.name}: ${c.direction}趋势 (${c.confidence}置信) - ${c.advice}`);
  }
  return details;
}

export function ComprehensiveAnalysis({ settings, conclusions, klineData }: ComprehensiveAnalysisProps) {
  const { selectedStock, currentQuote } = useAppState();
  const [showPositionAdvice, setShowPositionAdvice] = useState(true);

  // 过滤出已开启理论的结论
  const enabledConclusions = useMemo(() => {
    const map: Record<string, boolean> = {
      '缠论': settings.chanlun,
      '波浪理论': settings.wave,
      '技术指标': settings.technical,
    };
    return conclusions.filter(c => map[c.name] !== false);
  }, [conclusions, settings]);

  const enabledCount = enabledConclusions.length;

  // 计算共振和分歧
  const upCount = enabledConclusions.filter(c => c.direction === '上升').length;
  const downCount = enabledConclusions.filter(c => c.direction === '下降').length;
  const neutralCount = enabledConclusions.filter(c => c.direction === '震荡').length;

  // 判断综合方向
  let overallDirection: '看多' | '看空' | '中性';
  let overallColor: string;

  if (upCount > downCount && upCount > neutralCount) {
    overallDirection = '看多';
    overallColor = 'text-[var(--accent-red)] bg-red-500/10 border-red-500/30';
  } else if (downCount > upCount && downCount > neutralCount) {
    overallDirection = '看空';
    overallColor = 'text-[var(--accent-green)] bg-green-500/10 border-green-500/30';
  } else {
    overallDirection = '中性';
    overallColor = 'text-[var(--accent-yellow)] bg-yellow-500/10 border-yellow-500/30';
  }

  // 判断共振情况
  const hasResonance = upCount === enabledCount || downCount === enabledCount;
  const hasDivergence = upCount > 0 && downCount > 0;

  // 风险等级
  const riskLevel: string = enabledCount === 0 ? '无' :
    hasDivergence ? '中' :
    overallDirection === '看空' ? '高' : '低';

  const riskColor = riskLevel === '高' ? 'text-[var(--accent-red)]' :
    riskLevel === '中' ? 'text-[var(--accent-yellow)]' :
    riskLevel === '低' ? 'text-[var(--accent-green)]' : 'text-[var(--text-secondary)]';

  const positionAdvice = getPositionAdvice(riskLevel);

  // 综合评分
  const score = useMemo(() => calculateScore(enabledConclusions), [enabledConclusions]);

  // 百分位排名
  const percentileRank = useMemo(() => getPercentileRank(score), [score]);

  // 量价关系
  const volumePrice = useMemo(() => getVolumePriceRelation(klineData), [klineData]);

  // 分析详情
  const analysisDetails = useMemo(() => getAnalysisDetails(enabledConclusions), [enabledConclusions]);

  // 当前股票行情
  const quote = currentQuote;
  const priceChange = quote ? quote.change : 0;
  const priceChangePercent = quote ? quote.changePercent : 0;
  const isUp = priceChange >= 0;

  if (enabledCount === 0) {
    return (
      <div className="rounded border border-amber-500/30 bg-[var(--bg-primary)] overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-amber-500/10 border-b border-amber-500/30">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-sm font-medium text-amber-300">综合分析</span>
          </div>
        </div>
        <div className="p-4 text-center">
          <p className="text-sm text-[var(--text-secondary)]">请至少开启一个分析理论</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">开启缠论、波浪理论或技术指标中的任意一个</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border border-amber-500/30 bg-[var(--bg-primary)] overflow-hidden">
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
              <TooltipContent side="right" className="max-w-[300px] bg-[var(--bg-primary)] border-amber-500/30">
                <p className="text-xs text-[var(--text-primary)]">基于已开启的分析理论真实结论，综合判断走势方向和共振/分歧情况</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span className="text-xs text-amber-400/60">基于 {enabledCount} 个理论</span>
      </div>

      <div className="p-3 space-y-3">
        {/* 当前股票信息 */}
        {selectedStock && (
          <div className="p-2 rounded bg-[var(--bg-panel)] border border-[var(--border-default)]">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">{selectedStock.name}</span>
                <span className="text-[10px] text-[var(--text-secondary)]">{selectedStock.code}</span>
              </div>
              {quote && (
                <div className="text-right">
                  <span className={`text-sm font-mono font-bold ${isUp ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]'}`}>
                    {quote.price?.toFixed(2) || '--'}
                  </span>
                </div>
              )}
            </div>
            {quote && (
              <div className="flex items-center gap-3 text-[10px]">
                <span className={isUp ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]'}>
                  {isUp ? '+' : ''}{priceChange?.toFixed(2) || '0.00'}
                </span>
                <span className={isUp ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]'}>
                  {isUp ? '+' : ''}{priceChangePercent?.toFixed(2) || '0.00'}%
                </span>
                <span className="text-[var(--text-secondary)]">
                  开 {quote.open?.toFixed(2) || '--'} | 高 {quote.high?.toFixed(2) || '--'} | 低 {quote.low?.toFixed(2) || '--'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 综合评分 */}
        <div className="flex items-center justify-between p-2 rounded bg-[var(--bg-panel)] border border-[var(--border-default)]">
          <div>
            <div className="text-xs text-[var(--text-secondary)]">综合评分</div>
            <div className={`text-2xl font-bold font-mono ${
              score >= 70 ? 'text-[var(--accent-red)]' :
              score >= 40 ? 'text-[var(--accent-yellow)]' : 'text-[var(--accent-green)]'
            }`}>
              {score}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-[var(--text-secondary)]">分级</div>
            <div className="flex gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className={`w-2 h-4 rounded-sm ${
                    i <= Math.ceil(score / 20)
                      ? score >= 70 ? 'bg-red-500' : score >= 40 ? 'bg-yellow-500' : 'bg-green-500'
                      : 'bg-[var(--bg-primary)]'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 综合建议 */}
        <div className={`p-2 rounded border ${overallColor}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)]">综合建议</span>
            <span className={`text-sm font-bold ${overallColor.split(' ')[0]}`}>
              {overallDirection === '看多' ? '强烈看多' : overallDirection === '看空' ? '看空' : '中性观望'}
            </span>
          </div>
        </div>

        {/* 百分位排名 */}
        <div className="flex items-center justify-between p-2 rounded bg-[var(--bg-panel)] border border-[var(--border-default)]">
          <span className="text-xs text-[var(--text-secondary)]">百分位排名</span>
          <span className="text-xs text-[var(--text-primary)] font-mono">{percentileRank}</span>
        </div>

        {/* 量价关系 */}
        <div className="flex items-center justify-between p-2 rounded bg-[var(--bg-panel)] border border-[var(--border-default)]">
          <span className="text-xs text-[var(--text-secondary)]">量价关系</span>
          <span className="text-xs text-[var(--text-primary)]">
            {volumePrice.label}
            {volumePrice.ratio !== '--' && <span className="text-[var(--text-secondary)]">（量比{volumePrice.ratio}）</span>}
          </span>
        </div>

        {/* 分析详情 */}
        <div className="space-y-1">
          <span className="text-xs text-[var(--text-secondary)]">分析详情</span>
          {analysisDetails.map((detail, i) => (
            <div key={i} className="text-xs text-[var(--text-primary)] p-1.5 rounded bg-[var(--bg-panel)]">
              {detail}
            </div>
          ))}
        </div>

        {/* 综合走势定性 */}
        <div className={`p-2 rounded border ${overallColor}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)]">综合走势定性</span>
            <span className={`text-sm font-bold ${overallColor.split(' ')[0]}`}>
              {overallDirection}
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {enabledCount}个理论中，{upCount}个看多，{downCount}个看空，{neutralCount}个中性
          </p>
        </div>

        {/* 仓位建议 */}
        {showPositionAdvice && (
          <div className="p-2 rounded bg-[var(--bg-panel)] border border-[var(--border-default)]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-secondary)]">仓位建议</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-[var(--text-muted)] cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px] bg-[var(--bg-primary)] border-[var(--border-default)]">
                      <p className="text-xs text-[var(--text-primary)]">基于综合风险等级给出仓位建议</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-secondary)]">风险等级</span>
                <span className={`text-xs font-bold ${riskColor}`}>{riskLevel}</span>
              </div>
            </div>
            <div className={`text-sm font-medium ${positionAdvice.color} mb-1`}>
              {positionAdvice.label}
            </div>
            {/* 仓位可视化 */}
            <div className="relative h-3 bg-[var(--bg-primary)] rounded-full overflow-hidden">
              <div
                className="absolute h-full rounded-full transition-all duration-500"
                style={{
                  left: `${positionAdvice.min}%`,
                  width: `${positionAdvice.max - positionAdvice.min}%`,
                  background: riskLevel === '低' ? 'linear-gradient(90deg, #22c55e40, #22c55e80)' :
                    riskLevel === '中' ? 'linear-gradient(90deg, #eab30840, #eab30880)' :
                    riskLevel === '高' ? 'linear-gradient(90deg, #f9731640, #f9731680)' :
                    'linear-gradient(90deg, #ef444440, #ef444480)',
                }}
              />
              {/* 刻度 */}
              {[0, 25, 50, 75, 100].map((tick) => (
                <div
                  key={tick}
                  className="absolute top-0 h-full w-px bg-[var(--bg-card)]/50"
                  style={{ left: `${tick}%` }}
                />
              ))}
            </div>
            <div className="flex justify-between text-[8px] text-[var(--text-muted)] mt-0.5">
              <span>空仓 0%</span>
              <span>半仓 50%</span>
              <span>满仓 100%</span>
            </div>
            {/* 风险说明 */}
            <div className="mt-2 text-[10px] text-[var(--text-secondary)]">
              {riskLevel === '低' && '多理论共振看多，市场情绪良好，可适当提高仓位'}
              {riskLevel === '中' && '理论存在分歧，建议控制仓位，分批操作'}
              {riskLevel === '高' && '看空信号明显，建议轻仓或空仓，等待反转信号'}
              {riskLevel === '极高' && '多重风险叠加，建议空仓观望，保护本金'}
            </div>
          </div>
        )}

        {/* 各理论结论 */}
        <div className="space-y-1">
          <span className="text-xs text-[var(--text-secondary)]">各理论结论</span>
          {enabledConclusions.map((c, i) => {
            const colorMap: Record<string, string> = { '缠论': 'purple', '波浪理论': 'blue', '技术指标': 'emerald' };
            const cColor = colorMap[c.name] || 'gray';
            return (
              <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-[var(--bg-panel)]">
                <div className={`w-2 h-2 rounded-full bg-${cColor}-500`} />
                <span className="text-xs text-[var(--text-primary)] flex-1">{c.name}</span>
                <span className={`text-xs ${
                  c.direction === '上升' ? 'text-[var(--accent-red)]' :
                  c.direction === '下降' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-yellow)]'
                }`}>
                  {c.direction}
                </span>
                <span className={`text-xs ${
                  c.confidence === '高' ? 'text-[var(--accent-green)]' :
                  c.confidence === '中' ? 'text-[var(--accent-yellow)]' : 'text-[var(--accent-red)]'
                }`}>
                  ({c.confidence})
                </span>
              </div>
            );
          })}
        </div>

        {/* 共振/分歧分析 */}
        <div className="space-y-2">
          {hasResonance && (
            <div className="p-2 rounded bg-green-500/5 border border-green-500/20">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-[var(--accent-green)] font-medium">多理论共振</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-[var(--accent-green)]/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px] bg-[var(--bg-primary)] border-green-500/30">
                      <p className="text-xs text-[var(--text-primary)]">所有开启的理论得出一致结论，信号可靠性较高</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                {enabledCount}个理论均{overallDirection === '看多' ? '看涨' : overallDirection === '看空' ? '看跌' : '看震荡'}，形成共振信号
              </p>
            </div>
          )}

          {hasDivergence && (
            <div className="p-2 rounded bg-yellow-500/5 border border-yellow-500/20">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-[var(--accent-yellow)] font-medium">理论分歧</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-[var(--accent-yellow)]/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px] bg-[var(--bg-primary)] border-yellow-500/30">
                      <p className="text-xs text-[var(--text-primary)]">不同理论得出不同结论，需要综合判断，降低仓位</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                {upCount}个看多 vs {downCount}个看空，建议谨慎操作
              </p>
            </div>
          )}
        </div>

        {/* AI综合点评 */}
        <AIAnalysis
          type="summary"
          prompt="请对当前股票的技术分析结果进行综合点评，包括趋势判断、关键信号解读和操作建议。要求简洁专业，2-3句话概括。"
          context={{
            stockCode: selectedStock?.code || '',
            stockName: selectedStock?.name || '',
            conclusions: enabledConclusions,
            overallDirection,
            riskLevel,
            hasResonance,
            hasDivergence,
            score,
            volumePrice: volumePrice.label,
          }}
          title="AI综合点评"
          visible={!!selectedStock}
        />
      </div>
    </div>
  );
}

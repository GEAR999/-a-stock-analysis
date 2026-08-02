'use client';

import { useState, useMemo } from 'react';
import type { KLineData } from '@/lib/types';
import { analyzeChanlun } from '@/lib/analysis';
import { runProbabilityAnalysis, calculateConditionalProbability, calculateCombinedProbability } from '@/lib/probability/probability-engine';
import { EVENT_CATEGORIES, EVENT_DIRECTION } from '@/lib/probability/event-detector';
import type { TechnicalEvent, ProbabilitySummary, FactorEffectiveness, CombinedProbability } from '@/lib/probability/types';

// 子Tab类型
type SubTab = 'distribution' | 'factor' | 'combination' | 'calculator';

interface ProbabilityPanelProps {
  klineData: KLineData[];
}

export function ProbabilityPanel({ klineData }: ProbabilityPanelProps) {
  const [subTab, setSubTab] = useState<SubTab>('distribution');
  const [selectedFactors, setSelectedFactors] = useState<TechnicalEvent[]>([]);
  const [matchMode, setMatchMode] = useState<'AND' | 'OR'>('AND');

  // 运行概率分析（内部计算缠论）
  const analysisResult = useMemo(() => {
    if (klineData.length < 10) return null;
    const chanlunResult = analyzeChanlun(klineData);
    return runProbabilityAnalysis(klineData, chanlunResult);
  }, [klineData]);

  if (!analysisResult) {
    return (
      <div className="text-center py-8 text-[var(--text-secondary)] text-xs">
        K线数据不足（需至少10根），无法进行概率统计
      </div>
    );
  }

  const { annotated, summary } = analysisResult;

  // 因子选择切换
  const toggleFactor = (factor: TechnicalEvent) => {
    setSelectedFactors(prev =>
      prev.includes(factor) ? prev.filter(f => f !== factor) : [...prev, factor]
    );
  };

  // 条件概率计算结果
  const conditionalResult = useMemo(() => {
    if (selectedFactors.length === 0) return null;
    if (selectedFactors.length === 1) {
      return calculateConditionalProbability(annotated, selectedFactors[0]);
    }
    return calculateCombinedProbability(annotated, selectedFactors, matchMode);
  }, [annotated, selectedFactors, matchMode]);

  return (
    <div className="space-y-2">
      {/* 子Tab切换 */}
      <div className="flex gap-1">
        {([
          { key: 'distribution' as SubTab, label: '分布', color: 'cyan' },
          { key: 'factor' as SubTab, label: '因子', color: 'green' },
          { key: 'combination' as SubTab, label: '组合', color: 'amber' },
          { key: 'calculator' as SubTab, label: '测算', color: 'purple' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              subTab === t.key
                ? `bg-${t.color}-500/20 text-${t.color}-400 border border-${t.color}-500/30`
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 样本量提示 */}
      <div className="text-[10px] text-[var(--text-muted)] px-1">
        样本量: {summary.totalSamples} 根K线
      </div>

      {/* 分布Tab */}
      {subTab === 'distribution' && <DistributionView summary={summary} />}

      {/* 因子Tab */}
      {subTab === 'factor' && <FactorRankingView ranking={summary.factorRanking} />}

      {/* 组合Tab */}
      {subTab === 'combination' && <CombinationView combinations={summary.topCombinations} />}

      {/* 测算Tab */}
      {subTab === 'calculator' && (
        <CalculatorView
          selectedFactors={selectedFactors}
          matchMode={matchMode}
          onToggleFactor={toggleFactor}
          onSetMatchMode={setMatchMode}
          result={conditionalResult}
        />
      )}
    </div>
  );
}

// ========== 分布视图 ==========

function DistributionView({ summary }: { summary: ProbabilitySummary }) {
  return (
    <div className="space-y-3">
      {/* 开盘模式分布 */}
      <div>
        <div className="text-xs text-[var(--text-secondary)] mb-1.5 font-medium">开盘模式</div>
        <div className="space-y-1">
          {Object.entries(summary.openPatternDistribution).map(([pattern, count]) => {
            const percent = summary.totalSamples > 0 ? (count / summary.totalSamples * 100) : 0;
            const color = pattern.includes('高走') ? 'bg-green-500' :
                         pattern.includes('低走') ? 'bg-red-500' : 'bg-gray-500';
            return (
              <div key={pattern} className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-secondary)] w-16 shrink-0">{pattern}</span>
                <div className="flex-1 h-3 bg-[var(--bg-card)] rounded overflow-hidden">
                  <div className={`h-full ${color} opacity-60 rounded`} style={{ width: `${percent}%` }} />
                </div>
                <span className="text-[10px] text-[var(--text-muted)] w-12 text-right font-mono-num">
                  {percent.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 盘中形态分布 */}
      <div>
        <div className="text-xs text-[var(--text-secondary)] mb-1.5 font-medium">盘中形态</div>
        <div className="space-y-1">
          {Object.entries(summary.intradayPatternDistribution)
            .sort((a, b) => b[1] - a[1])
            .map(([pattern, count]) => {
              const percent = summary.totalSamples > 0 ? (count / summary.totalSamples * 100) : 0;
              return (
                <div key={pattern} className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--text-secondary)] w-16 shrink-0">{pattern}</span>
                  <div className="flex-1 h-3 bg-[var(--bg-card)] rounded overflow-hidden">
                    <div className="h-full bg-cyan-500 opacity-60 rounded" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] w-12 text-right font-mono-num">
                    {percent.toFixed(1)}%
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* K线形态分布 */}
      <div>
        <div className="text-xs text-[var(--text-secondary)] mb-1.5 font-medium">K线形态</div>
        <div className="grid grid-cols-2 gap-1">
          {Object.entries(summary.candlestickPatternDistribution)
            .sort((a, b) => b[1] - a[1])
            .map(([pattern, count]) => {
              const percent = summary.totalSamples > 0 ? (count / summary.totalSamples * 100) : 0;
              return (
                <div key={pattern} className="flex items-center justify-between px-2 py-0.5 bg-[var(--bg-card)] rounded text-[10px]">
                  <span className="text-[var(--text-secondary)]">{pattern}</span>
                  <span className="text-[var(--text-muted)] font-mono-num">{percent.toFixed(1)}%</span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

// ========== 因子排行视图 ==========

function FactorRankingView({ ranking }: { ranking: FactorEffectiveness[] }) {
  if (ranking.length === 0) {
    return <div className="text-center py-4 text-[var(--text-secondary)] text-xs">暂无有效因子数据</div>;
  }

  return (
    <div className="space-y-1">
      <div className="text-[10px] text-[var(--text-muted)] px-1 mb-2">
        按次日上涨胜率排序（样本量≥3）
      </div>
      {ranking.map((factor, idx) => {
        const direction = EVENT_DIRECTION[factor.factor];
        const directionColor = direction === 'bullish' ? 'text-green-400' :
                              direction === 'bearish' ? 'text-red-400' : 'text-gray-400';
        const winRateColor = factor.winRate >= 0.6 ? 'text-green-400' :
                            factor.winRate >= 0.4 ? 'text-yellow-400' : 'text-red-400';

        return (
          <div key={factor.factor} className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-card)] rounded">
            <span className="text-[10px] text-[var(--text-muted)] w-4 font-mono-num">{idx + 1}</span>
            <span className={`text-[10px] flex-1 ${directionColor}`}>{factor.factor}</span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono-num">
              n={factor.sampleSize}
            </span>
            <span className={`text-[10px] font-mono-num font-medium ${winRateColor}`}>
              {(factor.winRate * 100).toFixed(0)}%
            </span>
            <span className={`text-[10px] font-mono-num ${factor.avgReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {factor.avgReturn >= 0 ? '+' : ''}{(factor.avgReturn * 100).toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ========== 组合视图 ==========

function CombinationView({ combinations }: { combinations: CombinedProbability[] }) {
  if (combinations.length === 0) {
    return <div className="text-center py-4 text-[var(--text-secondary)] text-xs">暂无有效组合数据</div>;
  }

  return (
    <div className="space-y-1">
      <div className="text-[10px] text-[var(--text-muted)] px-1 mb-2">
        2因子组合 TOP10（按次日上涨概率排序）
      </div>
      {combinations.map((combo, idx) => {
        const winRateColor = combo.nextDayUpProb >= 0.6 ? 'text-green-400' :
                            combo.nextDayUpProb >= 0.4 ? 'text-yellow-400' : 'text-red-400';

        return (
          <div key={idx} className="px-2 py-1.5 bg-[var(--bg-card)] rounded space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[var(--text-muted)] w-4 font-mono-num">#{idx + 1}</span>
              <div className="flex-1 flex flex-wrap gap-1">
                {combo.conditions.map(c => (
                  <span key={c} className="text-[10px] px-1 py-0.5 bg-amber-500/10 text-amber-400 rounded">
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 pl-5">
              <span className="text-[10px] text-[var(--text-muted)]">
                n={combo.sampleSize}
              </span>
              <span className={`text-[10px] font-mono-num font-medium ${winRateColor}`}>
                次日涨: {(combo.nextDayUpProb * 100).toFixed(0)}%
              </span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono-num">
                3日涨: {(combo.threeDayUpProb * 100).toFixed(0)}%
              </span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono-num">
                5日涨: {(combo.fiveDayUpProb * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ========== 测算器视图 ==========

function CalculatorView({
  selectedFactors,
  matchMode,
  onToggleFactor,
  onSetMatchMode,
  result,
}: {
  selectedFactors: TechnicalEvent[];
  matchMode: 'AND' | 'OR';
  onToggleFactor: (f: TechnicalEvent) => void;
  onSetMatchMode: (m: 'AND' | 'OR') => void;
  result: ReturnType<typeof calculateConditionalProbability> | ReturnType<typeof calculateCombinedProbability> | null;
}) {
  return (
    <div className="space-y-2">
      {/* 逻辑模式 */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[var(--text-secondary)]">匹配模式:</span>
        <button
          onClick={() => onSetMatchMode('AND')}
          className={`px-2 py-0.5 text-[10px] rounded ${
            matchMode === 'AND' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-[var(--bg-card)] text-[var(--text-secondary)]'
          }`}
        >
          AND（同时满足）
        </button>
        <button
          onClick={() => onSetMatchMode('OR')}
          className={`px-2 py-0.5 text-[10px] rounded ${
            matchMode === 'OR' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-[var(--bg-card)] text-[var(--text-secondary)]'
          }`}
        >
          OR（任一满足）
        </button>
      </div>

      {/* 因子选择器 */}
      <div className="space-y-1.5">
        {Object.entries(EVENT_CATEGORIES).map(([category, events]) => (
          <div key={category}>
            <div className="text-[10px] text-[var(--text-muted)] mb-0.5">{category}</div>
            <div className="flex flex-wrap gap-1">
              {events.map(event => (
                <button
                  key={event}
                  onClick={() => onToggleFactor(event)}
                  className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                    selectedFactors.includes(event)
                      ? EVENT_DIRECTION[event] === 'bullish'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : EVENT_DIRECTION[event] === 'bearish'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                      : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
                  }`}
                >
                  {event}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 计算结果 */}
      {result && (
        <div className="mt-3 p-2 bg-[var(--bg-card)] rounded border border-[var(--border-default)]">
          <div className="text-xs text-[var(--text-secondary)] mb-2 font-medium">测算结果</div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-muted)]">样本量</span>
              <span className="text-[10px] text-[var(--text-primary)] font-mono-num">{result.sampleSize}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-muted)]">次日上涨概率</span>
              <span className={`text-xs font-mono-num font-medium ${
                result.nextDayUpProb >= 0.6 ? 'text-green-400' :
                result.nextDayUpProb >= 0.4 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {(result.nextDayUpProb * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-muted)]">次日平均涨跌</span>
              <span className={`text-[10px] font-mono-num ${
                result.nextDayAvgChange >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {result.nextDayAvgChange >= 0 ? '+' : ''}{(result.nextDayAvgChange * 100).toFixed(3)}%
              </span>
            </div>
            {'threeDayUpProb' in result && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-muted)]">3日内上涨概率</span>
                  <span className="text-[10px] text-[var(--text-primary)] font-mono-num">
                    {(result.threeDayUpProb * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-muted)]">5日内上涨概率</span>
                  <span className="text-[10px] text-[var(--text-primary)] font-mono-num">
                    {(result.fiveDayUpProb * 100).toFixed(1)}%
                  </span>
                </div>
              </>
            )}
            {'probabilities' in result && result.probabilities && (
              <div className="mt-2 pt-2 border-t border-[var(--border-default)]">
                <div className="text-[10px] text-[var(--text-muted)] mb-1">模式分布</div>
                {Object.entries(result.probabilities)
                  .filter(([, v]) => v !== undefined && v > 0)
                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                  .map(([pattern, prob]) => (
                    <div key={pattern} className="flex items-center justify-between">
                      <span className="text-[10px] text-[var(--text-secondary)]">{pattern}</span>
                      <span className="text-[10px] text-[var(--text-primary)] font-mono-num">
                        {((prob as number) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
          {result.sampleSize < 5 && (
            <div className="mt-2 text-[10px] text-yellow-400">
              ⚠ 样本量较小（{result.sampleSize}），统计结果仅供参考
            </div>
          )}
        </div>
      )}

      {selectedFactors.length === 0 && (
        <div className="text-center py-4 text-[var(--text-secondary)] text-[10px]">
          选择上方因子开始测算条件概率
        </div>
      )}
    </div>
  );
}

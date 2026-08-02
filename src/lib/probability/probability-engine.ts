/**
 * 条件概率统计引擎
 * 基于历史标注数据计算各类条件概率
 */

import type { KLineData, ChanlunResult } from '../types';
import { annotateAllKLines } from './pattern-classifier';
import { detectAllEvents, ALL_FILTERABLE_EVENTS } from './event-detector';
import type {
  AnnotatedKLine,
  TechnicalEvent,
  ConditionalProbability,
  CombinedProbability,
  FactorEffectiveness,
  ProbabilitySummary,
  OpenPattern,
  IntradayPattern,
} from './types';

// ========== 数据标注 ==========

/**
 * 完整标注K线数据（模式 + 事件 + 未来表现）
 */
export function annotateKLines(
  klines: KLineData[],
  chanlunResult?: ChanlunResult
): AnnotatedKLine[] {
  const patternAnnotations = annotateAllKLines(klines);
  const eventAnnotations = detectAllEvents(klines, chanlunResult);
  const results: AnnotatedKLine[] = [];

  for (let i = 0; i < klines.length; i++) {
    const kline = klines[i];
    const pattern = patternAnnotations[i];
    const events = eventAnnotations[i];

    // 计算次日表现
    const nextDayChange = i < klines.length - 1
      ? (klines[i + 1].close - kline.close) / kline.close
      : undefined;
    const nextDayDirection: 'up' | 'down' | 'flat' | undefined =
      nextDayChange !== undefined
        ? nextDayChange > 0.001 ? 'up' : nextDayChange < -0.001 ? 'down' : 'flat'
        : undefined;

    // 计算未来N天最大涨跌幅
    const futureMaxGain: Record<number, number> = {};
    const futureMaxLoss: Record<number, number> = {};
    for (const days of [1, 3, 5, 10]) {
      const futureSlice = klines.slice(i + 1, i + 1 + days);
      if (futureSlice.length > 0) {
        const maxPrice = Math.max(...futureSlice.map(k => k.high));
        const minPrice = Math.min(...futureSlice.map(k => k.low));
        futureMaxGain[days] = (maxPrice - kline.close) / kline.close;
        futureMaxLoss[days] = (minPrice - kline.close) / kline.close;
      }
    }

    results.push({
      index: i,
      kline,
      openPattern: pattern.openPattern,
      intradayPattern: pattern.intradayPattern,
      candlestickPattern: pattern.candlestickPattern,
      events: events.allEvents,
      nextDayChange,
      nextDayDirection,
      futureMaxGain,
      futureMaxLoss,
    });
  }

  return results;
}

// ========== 条件概率计算 ==========

/**
 * 计算单因子条件概率
 * P(结果 | 因子事件)
 */
export function calculateConditionalProbability(
  annotated: AnnotatedKLine[],
  factor: TechnicalEvent
): ConditionalProbability {
  // 筛选出该因子出现的所有样本
  const samples = annotated.filter(a => a.events.includes(factor));
  const total = samples.length;

  if (total === 0) {
    return {
      condition: factor,
      sampleSize: 0,
      probabilities: {},
      nextDayUpProb: 0,
      nextDayAvgChange: 0,
    };
  }

  // 统计开盘模式分布
  const openPatternCount: Record<string, number> = {};
  const intradayPatternCount: Record<string, number> = {};
  let nextDayUpCount = 0;
  let nextDayChangeSum = 0;
  let nextDayValidCount = 0;

  for (const s of samples) {
    openPatternCount[s.openPattern] = (openPatternCount[s.openPattern] || 0) + 1;
    intradayPatternCount[s.intradayPattern] = (intradayPatternCount[s.intradayPattern] || 0) + 1;
    if (s.nextDayDirection === 'up') nextDayUpCount++;
    if (s.nextDayChange !== undefined) {
      nextDayChangeSum += s.nextDayChange;
      nextDayValidCount++;
    }
  }

  const probabilities: ConditionalProbability['probabilities'] = {};
  for (const [pattern, count] of Object.entries(openPatternCount)) {
    probabilities[pattern as OpenPattern] = count / total;
  }
  for (const [pattern, count] of Object.entries(intradayPatternCount)) {
    probabilities[pattern as IntradayPattern] = count / total;
  }

  return {
    condition: factor,
    sampleSize: total,
    probabilities,
    nextDayUpProb: nextDayValidCount > 0 ? nextDayUpCount / nextDayValidCount : 0,
    nextDayAvgChange: nextDayValidCount > 0 ? nextDayChangeSum / nextDayValidCount : 0,
  };
}

/**
 * 计算多因子组合概率
 */
export function calculateCombinedProbability(
  annotated: AnnotatedKLine[],
  factors: TechnicalEvent[],
  matchMode: 'AND' | 'OR' = 'AND'
): CombinedProbability {
  const samples = annotated.filter(a => {
    if (matchMode === 'AND') {
      return factors.every(f => a.events.includes(f));
    }
    return factors.some(f => a.events.includes(f));
  });

  const total = samples.length;
  if (total === 0) {
    return {
      conditions: factors,
      sampleSize: 0,
      nextDayUpProb: 0,
      nextDayAvgChange: 0,
      threeDayUpProb: 0,
      fiveDayUpProb: 0,
    };
  }

  let nextDayUpCount = 0;
  let nextDayChangeSum = 0;
  let nextDayValidCount = 0;
  let threeDayUpCount = 0;
  let threeDayValidCount = 0;
  let fiveDayUpCount = 0;
  let fiveDayValidCount = 0;

  for (const s of samples) {
    if (s.nextDayDirection === 'up') nextDayUpCount++;
    if (s.nextDayChange !== undefined) {
      nextDayChangeSum += s.nextDayChange;
      nextDayValidCount++;
    }
    if (s.futureMaxGain && s.futureMaxGain[3] !== undefined) {
      if (s.futureMaxGain[3] > 0) threeDayUpCount++;
      threeDayValidCount++;
    }
    if (s.futureMaxGain && s.futureMaxGain[5] !== undefined) {
      if (s.futureMaxGain[5] > 0) fiveDayUpCount++;
      fiveDayValidCount++;
    }
  }

  return {
    conditions: factors,
    sampleSize: total,
    nextDayUpProb: nextDayValidCount > 0 ? nextDayUpCount / nextDayValidCount : 0,
    nextDayAvgChange: nextDayValidCount > 0 ? nextDayChangeSum / nextDayValidCount : 0,
    threeDayUpProb: threeDayValidCount > 0 ? threeDayUpCount / threeDayValidCount : 0,
    fiveDayUpProb: fiveDayValidCount > 0 ? fiveDayUpCount / fiveDayValidCount : 0,
  };
}

// ========== 因子有效性评估 ==========

/**
 * 评估单个因子的有效性
 */
export function evaluateFactor(
  annotated: AnnotatedKLine[],
  factor: TechnicalEvent
): FactorEffectiveness {
  const samples = annotated.filter(a => a.events.includes(factor));
  const validSamples = samples.filter(s => s.nextDayChange !== undefined);
  const total = validSamples.length;

  if (total === 0) {
    return {
      factor,
      sampleSize: 0,
      winRate: 0,
      avgReturn: 0,
      profitLossRatio: 0,
      maxConsecutiveWins: 0,
      maxConsecutiveLosses: 0,
    };
  }

  let winCount = 0;
  let totalGain = 0;
  let totalLoss = 0;
  let winGainSum = 0;
  let lossSum = 0;
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let currentWins = 0;
  let currentLosses = 0;

  for (const s of validSamples) {
    const change = s.nextDayChange!;
    if (change > 0) {
      winCount++;
      winGainSum += change;
      currentWins++;
      currentLosses = 0;
      maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
    } else {
      lossSum += Math.abs(change);
      currentLosses++;
      currentWins = 0;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
    }
    totalGain += change;
  }

  const winRate = winCount / total;
  const avgReturn = totalGain / total;
  const avgWin = winCount > 0 ? winGainSum / winCount : 0;
  const lossCount = total - winCount;
  const avgLoss = lossCount > 0 ? lossSum / lossCount : 0;
  const profitLossRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

  return {
    factor,
    sampleSize: total,
    winRate,
    avgReturn,
    profitLossRatio,
    maxConsecutiveWins,
    maxConsecutiveLosses,
  };
}

// ========== 最优组合搜索 ==========

/**
 * 搜索最优因子组合（2因子组合）
 */
export function findTopCombinations(
  annotated: AnnotatedKLine[],
  topN: number = 10,
  minSampleSize: number = 5
): CombinedProbability[] {
  const results: CombinedProbability[] = [];

  // 只取样本量足够的单因子
  const validFactors = ALL_FILTERABLE_EVENTS.filter(f => {
    const count = annotated.filter(a => a.events.includes(f)).length;
    return count >= minSampleSize;
  });

  // 2因子组合
  for (let i = 0; i < validFactors.length; i++) {
    for (let j = i + 1; j < validFactors.length; j++) {
      const combo = calculateCombinedProbability(annotated, [validFactors[i], validFactors[j]]);
      if (combo.sampleSize >= minSampleSize) {
        results.push(combo);
      }
    }
  }

  // 按胜率排序
  results.sort((a, b) => b.nextDayUpProb - a.nextDayUpProb);
  return results.slice(0, topN);
}

// ========== 汇总统计 ==========

/**
 * 计算概率统计汇总
 */
export function calculateProbabilitySummary(
  annotated: AnnotatedKLine[]
): ProbabilitySummary {
  const total = annotated.length;

  // 开盘模式分布
  const openPatternDistribution = {
    '高开高走': 0, '高开低走': 0, '低开高走': 0, '低开低走': 0, '平开震荡': 0,
  } as Record<OpenPattern, number>;

  // 盘中形态分布
  const intradayPatternDistribution = {
    '超跌反弹': 0, '冲高回落': 0, '横盘震荡': 0, '趋势延续': 0, '探底回升': 0, '放量突破': 0,
  } as Record<IntradayPattern, number>;

  // K线形态分布
  const candlestickPatternDistribution = {
    '大阳线': 0, '大阴线': 0, '长上影': 0, '长下影': 0, '十字星': 0, '锤子线': 0, '吞没形态': 0, '普通K线': 0,
  } as Record<string, number>;

  for (const a of annotated) {
    openPatternDistribution[a.openPattern]++;
    intradayPatternDistribution[a.intradayPattern]++;
    candlestickPatternDistribution[a.candlestickPattern]++;
  }

  // 因子有效性排行
  const factorRanking = ALL_FILTERABLE_EVENTS
    .map(f => evaluateFactor(annotated, f))
    .filter(f => f.sampleSize >= 3)
    .sort((a, b) => b.winRate - a.winRate);

  // 最优组合
  const topCombinations = findTopCombinations(annotated, 10, 3);

  return {
    openPatternDistribution,
    intradayPatternDistribution,
    candlestickPatternDistribution,
    factorRanking,
    topCombinations,
    totalSamples: total,
  };
}

// ========== 便捷API ==========

/**
 * 一站式分析：标注 + 统计
 */
export function runProbabilityAnalysis(
  klines: KLineData[],
  chanlunResult?: ChanlunResult
): {
  annotated: AnnotatedKLine[];
  summary: ProbabilitySummary;
} {
  const annotated = annotateKLines(klines, chanlunResult);
  const summary = calculateProbabilitySummary(annotated);
  return { annotated, summary };
}

/**
 * 查询当前K线位置的概率提示
 */
export function getCurrentProbabilityHint(
  annotated: AnnotatedKLine[],
  currentIndex: number
): {
  currentPattern: string;
  currentEvents: TechnicalEvent[];
  historicalWinRate: number;
  historicalAvgReturn: number;
} | null {
  if (currentIndex < 0 || currentIndex >= annotated.length) return null;

  const current = annotated[currentIndex];
  const events = current.events;

  if (events.length === 0) {
    return {
      currentPattern: `${current.openPattern} / ${current.intradayPattern}`,
      currentEvents: [],
      historicalWinRate: 0,
      historicalAvgReturn: 0,
    };
  }

  // 计算当前事件组合的历史表现
  const samples = annotated.filter(a => {
    return events.every(e => a.events.includes(e));
  });

  const validSamples = samples.filter(s => s.nextDayChange !== undefined);
  const winCount = validSamples.filter(s => s.nextDayDirection === 'up').length;

  return {
    currentPattern: `${current.openPattern} / ${current.intradayPattern}`,
    currentEvents: events,
    historicalWinRate: validSamples.length > 0 ? winCount / validSamples.length : 0,
    historicalAvgReturn: validSamples.length > 0
      ? validSamples.reduce((sum, s) => sum + (s.nextDayChange || 0), 0) / validSamples.length
      : 0,
  };
}

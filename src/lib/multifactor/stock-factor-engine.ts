// 个股因子评分引擎（S1-S7，11档）
// 每个因子独立评分 -5 ~ +5，加权合成综合评分

import type {
  StockFactorKey,
  StockFactorScore,
  StockFactorResult,
  FactorMeta,
  FACTOR_LIBRARY,
} from './types';
import type { KLineData } from '@/lib/types';
import {
  calculateMA,
  calculateMACD,
  calculateRSI,
  calculateBOLL,
} from '@/lib/analysis';

// ============ 因子输入数据 ============

export interface StockFactorInput {
  /** K线数据（日线） */
  klineData: KLineData[];
  /** 当前价格 */
  currentPrice: number;
  /** PE（市盈率） */
  pe?: number;
  /** PB（市净率） */
  pb?: number;
  /** PE历史分位（0-100） */
  pePercentile?: number;
  /** PB历史分位（0-100） */
  pbPercentile?: number;
  /** 缠论信号（从analysis.ts获取） */
  chanlunSignal?: string;
  /** 波浪位置（从analysis.ts获取） */
  wavePosition?: string;
  /** 选中的因子及权重 */
  selectedFactors: { key: StockFactorKey; weight: number }[];
}

// ============ S1 估值分位 ============

function scoreValuation(pePercentile?: number, pbPercentile?: number): { score: number; detail: string } {
  // 用PE和PB分位的平均值
  const percentiles: number[] = [];
  if (pePercentile !== undefined && !isNaN(pePercentile)) percentiles.push(pePercentile);
  if (pbPercentile !== undefined && !isNaN(pbPercentile)) percentiles.push(pbPercentile);

  if (percentiles.length === 0) {
    return { score: 0, detail: '无估值数据' };
  }

  const avg = percentiles.reduce((a, b) => a + b, 0) / percentiles.length;

  // 分位越低越便宜，评分越高
  if (avg < 10) return { score: 5, detail: `估值极低(分位${avg.toFixed(0)}%)` };
  if (avg < 20) return { score: 4, detail: `估值很低(分位${avg.toFixed(0)}%)` };
  if (avg < 30) return { score: 3, detail: `估值偏低(分位${avg.toFixed(0)}%)` };
  if (avg < 40) return { score: 2, detail: `估值合理偏低(分位${avg.toFixed(0)}%)` };
  if (avg < 50) return { score: 1, detail: `估值合理(分位${avg.toFixed(0)}%)` };
  if (avg < 60) return { score: 0, detail: `估值中性(分位${avg.toFixed(0)}%)` };
  if (avg < 70) return { score: -1, detail: `估值偏高(分位${avg.toFixed(0)}%)` };
  if (avg < 80) return { score: -2, detail: `估值较高(分位${avg.toFixed(0)}%)` };
  if (avg < 90) return { score: -3, detail: `估值很高(分位${avg.toFixed(0)}%)` };
  if (avg < 95) return { score: -4, detail: `估值极高(分位${avg.toFixed(0)}%)` };
  return { score: -5, detail: `估值泡沫(分位${avg.toFixed(0)}%)` };
}

// ============ S2 均线位置 ============

function scoreMAPosition(klineData: KLineData[], currentPrice: number): { score: number; detail: string } {
  if (klineData.length < 60) {
    return { score: 0, detail: '数据不足' };
  }

  const ma = calculateMA(klineData, [5, 20, 60]);
  const lastIdx = klineData.length - 1;

  const ma5 = ma[5]?.[lastIdx] || 0;
  const ma20 = ma[20]?.[lastIdx] || 0;
  const ma60 = ma[60]?.[lastIdx] || 0;

  if (ma5 === 0 || ma20 === 0 || ma60 === 0) {
    return { score: 0, detail: '均线计算失败' };
  }

  let score = 0;
  const details: string[] = [];

  // 价格与MA5关系
  if (currentPrice > ma5) { score += 1; details.push('价格>MA5'); }
  else if (currentPrice < ma5) { score -= 1; details.push('价格<MA5'); }

  // 价格与MA20关系
  if (currentPrice > ma20) { score += 1; details.push('价格>MA20'); }
  else if (currentPrice < ma20) { score -= 1; details.push('价格<MA20'); }

  // 价格与MA60关系
  if (currentPrice > ma60) { score += 1; details.push('价格>MA60'); }
  else if (currentPrice < ma60) { score -= 1; details.push('价格<MA60'); }

  // 均线排列
  if (ma5 > ma20 && ma20 > ma60) {
    score += 2;
    details.push('多头排列');
  } else if (ma5 < ma20 && ma20 < ma60) {
    score -= 2;
    details.push('空头排列');
  }

  // 限制在-5到+5
  score = Math.max(-5, Math.min(5, score));

  return { score, detail: details.join('，') };
}

// ============ S3 MACD ============

function scoreMACD(klineData: KLineData[]): { score: number; detail: string } {
  if (klineData.length < 30) {
    return { score: 0, detail: '数据不足' };
  }

  const macd = calculateMACD(klineData);
  const last = macd[macd.length - 1];
  const prev = macd[macd.length - 2];

  if (!last || !prev) {
    return { score: 0, detail: 'MACD计算失败' };
  }

  let score = 0;
  const details: string[] = [];

  // DIF与DEA关系
  if (last.dif > 0 && last.dea > 0) {
    score += 2;
    details.push('DIF/DEA均在零轴上');
  } else if (last.dif < 0 && last.dea < 0) {
    score -= 2;
    details.push('DIF/DEA均在零轴下');
  }

  // 金叉/死叉
  if (prev.dif <= prev.dea && last.dif > last.dea) {
    score += 3;
    details.push('MACD金叉');
  } else if (prev.dif >= prev.dea && last.dif < last.dea) {
    score -= 3;
    details.push('MACD死叉');
  } else if (last.dif > last.dea) {
    score += 1;
    details.push('DIF在DEA上方');
  } else if (last.dif < last.dea) {
    score -= 1;
    details.push('DIF在DEA下方');
  }

  // 柱状图趋势
  if (last.histogram > 0 && last.histogram > prev.histogram) {
    score += 1;
    details.push('红柱放大');
  } else if (last.histogram < 0 && last.histogram < prev.histogram) {
    score -= 1;
    details.push('绿柱放大');
  }

  score = Math.max(-5, Math.min(5, score));

  return { score, detail: details.join('，') };
}

// ============ S4 RSI ============

function scoreRSI(klineData: KLineData[]): { score: number; detail: string } {
  if (klineData.length < 15) {
    return { score: 0, detail: '数据不足' };
  }

  const rsiArr = calculateRSI(klineData);
  const lastRSI = rsiArr[rsiArr.length - 1]?.rsi;

  if (lastRSI === undefined || isNaN(lastRSI)) {
    return { score: 0, detail: 'RSI计算失败' };
  }

  // RSI < 20 超卖区 → 强买信号
  if (lastRSI < 20) return { score: 5, detail: `RSI=${lastRSI.toFixed(1)}，严重超卖` };
  if (lastRSI < 30) return { score: 4, detail: `RSI=${lastRSI.toFixed(1)}，超卖` };
  if (lastRSI < 40) return { score: 2, detail: `RSI=${lastRSI.toFixed(1)}，偏弱` };
  if (lastRSI < 50) return { score: 1, detail: `RSI=${lastRSI.toFixed(1)}，略偏弱` };
  if (lastRSI < 60) return { score: 0, detail: `RSI=${lastRSI.toFixed(1)}，中性` };
  if (lastRSI < 70) return { score: -1, detail: `RSI=${lastRSI.toFixed(1)}，偏强` };
  if (lastRSI < 80) return { score: -3, detail: `RSI=${lastRSI.toFixed(1)}，超买` };
  return { score: -5, detail: `RSI=${lastRSI.toFixed(1)}，严重超买` };
}

// ============ S5 量价关系 ============

function scoreVolumePrice(klineData: KLineData[]): { score: number; detail: string } {
  if (klineData.length < 10) {
    return { score: 0, detail: '数据不足' };
  }

  const last = klineData[klineData.length - 1];
  const prev = klineData[klineData.length - 2];

  // 近5日平均成交量
  const recent5 = klineData.slice(-6, -1);
  const avgVol = recent5.reduce((sum, d) => sum + d.volume, 0) / recent5.length;
  const volumeRatio = avgVol > 0 ? last.volume / avgVol : 1;

  const priceChange = prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : 0;

  // 放量上涨
  if (volumeRatio > 1.5 && priceChange > 2) {
    return { score: 5, detail: `放量上涨(量比${volumeRatio.toFixed(1)}，涨${priceChange.toFixed(1)}%)` };
  }
  // 放量微涨
  if (volumeRatio > 1.3 && priceChange > 0.5) {
    return { score: 3, detail: `放量微涨(量比${volumeRatio.toFixed(1)})` };
  }
  // 缩量上涨
  if (volumeRatio < 0.7 && priceChange > 0.5) {
    return { score: 2, detail: `缩量上涨(量比${volumeRatio.toFixed(1)})` };
  }
  // 平量上涨
  if (priceChange > 0.5) {
    return { score: 1, detail: `平量上涨(涨${priceChange.toFixed(1)}%)` };
  }
  // 放量下跌
  if (volumeRatio > 1.5 && priceChange < -2) {
    return { score: -5, detail: `放量下跌(量比${volumeRatio.toFixed(1)}，跌${priceChange.toFixed(1)}%)` };
  }
  // 放量微跌
  if (volumeRatio > 1.3 && priceChange < -0.5) {
    return { score: -3, detail: `放量微跌(量比${volumeRatio.toFixed(1)})` };
  }
  // 缩量下跌
  if (volumeRatio < 0.7 && priceChange < -0.5) {
    return { score: -1, detail: `缩量下跌(量比${volumeRatio.toFixed(1)})` };
  }
  // 平量下跌
  if (priceChange < -0.5) {
    return { score: -2, detail: `平量下跌(跌${priceChange.toFixed(1)}%)` };
  }

  return { score: 0, detail: `量价平稳(量比${volumeRatio.toFixed(1)})` };
}

// ============ S6 缠论因子 ============

const CHANLUN_SCORE_MAP: Record<string, { score: number; label: string }> = {
  '一买': { score: 5, label: '一买（趋势背驰）' },
  '第一类买点': { score: 5, label: '一买（趋势背驰）' },
  '二买': { score: 3, label: '二买（回踩不破前低）' },
  '第二类买点': { score: 3, label: '二买（回踩不破前低）' },
  '三买': { score: 2, label: '三买（突破中枢回踩不进）' },
  '第三类买点': { score: 2, label: '三买（突破中枢回踩不进）' },
  '中枢震荡': { score: 0, label: '中枢震荡' },
  '三卖': { score: -2, label: '三卖（跌破中枢回抽不进）' },
  '第三类卖点': { score: -2, label: '三卖（跌破中枢回抽不进）' },
  '二卖': { score: -3, label: '二卖（反弹不破前高）' },
  '第二类卖点': { score: -3, label: '二卖（反弹不破前高）' },
  '一卖': { score: -5, label: '一卖（顶背驰）' },
  '第一类卖点': { score: -5, label: '一卖（顶背驰）' },
};

function scoreChanlun(signal?: string): { score: number; detail: string } {
  if (!signal) {
    return { score: 0, detail: '无缠论信号' };
  }

  // 精确匹配
  const exact = CHANLUN_SCORE_MAP[signal];
  if (exact) {
    return { score: exact.score, detail: exact.label };
  }

  // 模糊匹配
  for (const [key, value] of Object.entries(CHANLUN_SCORE_MAP)) {
    if (signal.includes(key)) {
      return { score: value.score, detail: value.label };
    }
  }

  return { score: 0, detail: `缠论信号：${signal}` };
}

// ============ S7 波浪因子 ============

const WAVE_SCORE_MAP: Record<string, { score: number; label: string }> = {
  '1浪起点': { score: 4, label: '1浪起点（新上升趋势启动）' },
  '1浪': { score: 4, label: '1浪起点（新上升趋势启动）' },
  '3浪主升': { score: 5, label: '3浪主升段（最强上涨段）' },
  '3浪': { score: 5, label: '3浪主升段（最强上涨段）' },
  '5浪末端': { score: 1, label: '5浪末端（上涨趋势尾声）' },
  '5浪': { score: 1, label: '5浪末端（上涨趋势尾声）' },
  'A浪下跌': { score: -3, label: 'A浪下跌初期' },
  'A浪': { score: -3, label: 'A浪下跌初期' },
  'B浪反弹': { score: -1, label: 'B浪反弹（下跌中继）' },
  'B浪': { score: -1, label: 'B浪反弹（下跌中继）' },
  'C浪末端': { score: -5, label: 'C浪末端（下跌趋势尾声）' },
  'C浪': { score: -5, label: 'C浪末端（下跌趋势尾声）' },
};

function scoreWave(position?: string): { score: number; detail: string } {
  if (!position) {
    return { score: 0, detail: '无波浪信号' };
  }

  // 精确匹配
  const exact = WAVE_SCORE_MAP[position];
  if (exact) {
    return { score: exact.score, detail: exact.label };
  }

  // 模糊匹配（按key长度降序，优先匹配更具体的）
  const sortedKeys = Object.keys(WAVE_SCORE_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (position.includes(key)) {
      return { score: WAVE_SCORE_MAP[key].score, detail: WAVE_SCORE_MAP[key].label };
    }
  }

  return { score: 0, detail: `波浪位置：${position}` };
}

// ============ 主函数 ============

/**
 * 计算个股因子综合评分
 */
export function calculateStockFactors(input: StockFactorInput): StockFactorResult {
  const scoreMap: Record<StockFactorKey, { score: number; detail: string }> = {
    S1: scoreValuation(input.pePercentile, input.pbPercentile),
    S2: scoreMAPosition(input.klineData, input.currentPrice),
    S3: scoreMACD(input.klineData),
    S4: scoreRSI(input.klineData),
    S5: scoreVolumePrice(input.klineData),
    S6: scoreChanlun(input.chanlunSignal),
    S7: scoreWave(input.wavePosition),
  };

  const factorMetaMap = new Map<string, FactorMeta>();
  // FACTOR_LIBRARY is imported as a type, need to define inline
  const library: FactorMeta[] = [
    { key: 'S1', name: '估值分位', defaultWeight: 25 },
    { key: 'S2', name: '均线位置', defaultWeight: 25 },
    { key: 'S3', name: 'MACD', defaultWeight: 20 },
    { key: 'S4', name: 'RSI', defaultWeight: 15 },
    { key: 'S5', name: '量价关系', defaultWeight: 15 },
    { key: 'S6', name: '缠论因子', defaultWeight: 0 },
    { key: 'S7', name: '波浪因子', defaultWeight: 0 },
  ];
  for (const meta of library) {
    factorMetaMap.set(meta.key, meta);
  }

  const factors: StockFactorScore[] = [];
  let totalWeight = 0;

  for (const selected of input.selectedFactors) {
    const meta = factorMetaMap.get(selected.key);
    const result = scoreMap[selected.key];
    if (!meta || !result) continue;

    const weightedScore = Math.round(result.score * (selected.weight / 100) * 100) / 100;
    totalWeight += selected.weight;

    factors.push({
      key: selected.key,
      name: meta.name,
      score: result.score,
      weight: selected.weight,
      weightedScore,
      detail: result.detail,
    });
  }

  // 综合评分
  const totalScore =
    totalWeight > 0
      ? Math.round(factors.reduce((sum, f) => sum + f.weightedScore, 0) * 100) / 100
      : 0;

  // 信号强度
  const signalStrength = getSignalLabel(totalScore);

  return { factors, totalScore, signalStrength };
}

function getSignalLabel(score: number): string {
  if (score >= 4.5) return '极度看多';
  if (score >= 3.5) return '强烈看多';
  if (score >= 2.5) return '偏多';
  if (score >= 1.5) return '温和看多';
  if (score >= 0.5) return '略偏多';
  if (score > -0.5) return '中性';
  if (score > -1.5) return '略偏空';
  if (score > -2.5) return '温和看空';
  if (score > -3.5) return '偏空';
  if (score > -4.5) return '强烈看空';
  return '极度看空';
}

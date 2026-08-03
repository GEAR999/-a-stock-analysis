import * as tf from '@tensorflow/tfjs';
import { getAllIndicators } from '@/lib/analysis';
import type { KLineData } from '@/lib/types';
import {
  FEATURE_NAMES, FEATURE_DIM, INDEX_DEFS,
  type TrainingSample, type TimeSeriesSplitConfig,
  DEFAULT_SPLIT_CONFIG,
} from './types';

/** 生成指数 one-hot 编码（7维） */
function indexToOneHot(group: number): number[] {
  const oneHot = new Array(INDEX_DEFS.length).fill(0);
  oneHot[group] = 1;
  return oneHot;
}

/** 提取 40 维特征向量 */
export function extractFeatures(
  kline: KLineData,
  prevKlines: KLineData[],
  indicators: any,
  indexGroup: number = 0,
  index: number = -1,
): number[] {
  // 使用当前 K 线对应的指标索引，避免数据穿越
  const idx = index >= 0 ? index : ((indicators.ma[5]?.length ?? 1) - 1);
  const ma5 = indicators.ma[5]?.[idx] ?? kline.close;
  const ma20 = indicators.ma[20]?.[idx] ?? kline.close;
  const ma60 = indicators.ma[60]?.[idx] ?? kline.close;
  const lastMacd = indicators.macd[idx];
  const lastRsi = indicators.rsi[idx]?.rsi ?? 50;
  const lastKdj = indicators.kdj[idx];
  const lastBoll = indicators.boll[idx];
  const prevVolume = prevKlines.length > 0 ? prevKlines[prevKlines.length - 1].volume : kline.volume;
  const avgVolume5 = prevKlines.length >= 5
    ? prevKlines.slice(-5).reduce((s, k) => s + k.volume, 0) / 5
    : kline.volume;

  const bodySize = Math.abs(kline.close - kline.open);
  const totalRange = kline.high - kline.low;
  const upperShadow = kline.high - Math.max(kline.open, kline.close);
  const lowerShadow = Math.min(kline.open, kline.close) - kline.low;

  const changePct = kline.close > 0 ? (kline.close - kline.open) / kline.open : 0;
  const amplitude = totalRange > 0 ? totalRange / kline.open : 0;
  const volumeRatio = avgVolume5 > 0 ? kline.volume / avgVolume5 : 1;
  const bodyRatio = totalRange > 0 ? bodySize / totalRange : 0;
  const upperRatio = totalRange > 0 ? upperShadow / totalRange : 0;
  const lowerRatio = totalRange > 0 ? lowerShadow / totalRange : 0;
  const ma5Dev = (kline.close - ma5) / ma5;
  const ma20Dev = (kline.close - ma20) / ma20;
  const ma60Dev = ma60 > 0 ? (kline.close - ma60) / ma60 : 0;
  const volumeChange = prevVolume > 0 ? kline.volume / prevVolume : 1;
  const macdDif = lastMacd?.dif ?? 0;
  const macdHist = lastMacd?.histogram ?? 0;
  const rsi = lastRsi / 100;
  const kdjK = lastKdj?.k ?? 50 / 100;
  const kdjD = lastKdj?.d ?? 50 / 100;
  const bollUpperDev = lastBoll?.upper ? (kline.close - lastBoll.upper) / lastBoll.upper : 0;
  const bollLowerDev = lastBoll?.lower ? (kline.close - lastBoll.lower) / lastBoll.lower : 0;
  const wr = lastKdj
    ? ((kline.high - kline.close) / (kline.high - kline.low)) * 100 / 100
    : 0.5;

  // --- 时间特征 ---
  const date = kline.date ? new Date(kline.date) : new Date();
  // 星期几
  const dayOfWeek = date.getDay() / 6;

  // 连涨/连跌天数
  let consecutiveDays = 0;
  for (let j = prevKlines.length - 1; j >= 0; j--) {
    const prev = prevKlines[j];
    if (prev.close > prev.open) {
      if (consecutiveDays >= 0) consecutiveDays++;
      else break;
    } else {
      if (consecutiveDays <= 0) consecutiveDays--;
      else break;
    }
  }
  const consecutiveNorm = Math.max(-1, Math.min(1, consecutiveDays / 10));

  // ATR (14日平均真实波幅)
  let atr = 0;
  if (prevKlines.length >= 14) {
    const atrValues = [];
    for (let j = prevKlines.length - 14; j < prevKlines.length; j++) {
      const prevCandle = prevKlines[j];
      const prevClose = j > 0 ? prevKlines[j - 1].close : prevCandle.close;
      const tr = Math.max(
        prevCandle.high - prevCandle.low,
        Math.abs(prevCandle.high - prevClose),
        Math.abs(prevCandle.low - prevClose)
      );
      atrValues.push(tr);
    }
    atr = atrValues.reduce((s, v) => s + v, 0) / 14;
  }
  const atrNorm = kline.close > 0 ? Math.min(atr / kline.close, 0.1) : 0;

  // 近5日涨跌幅
  const price5dAgo = prevKlines.length >= 5 ? prevKlines[prevKlines.length - 5].close : kline.open;
  const return5d = (kline.close - price5dAgo) / price5dAgo;

  // 近20日涨跌幅
  const price20dAgo = prevKlines.length >= 20 ? prevKlines[prevKlines.length - 20].close : kline.open;
  const return20d = (kline.close - price20dAgo) / price20dAgo;

  // 成交额变化率
  const prevAmount = prevKlines.length > 0 ? prevKlines[prevKlines.length - 1].amount : kline.amount;
  const amountChange = prevAmount > 0 ? Math.min(kline.amount / prevAmount, 5) : 1;

  // ===== 交互特征 =====
  const rsiBoll = rsi * bollLowerDev;                    // RSI×BOLL下轨
  const macdVol = macdHist * volumeChange;               // MACD×成交量
  const changeConsecutive = changePct * consecutiveNorm;  // 涨跌幅×连涨天数
  const bodyVol = bodyRatio * volumeRatio;                // 实体比例×量比
  const ampAtr = amplitude * atrNorm;                     // 振幅×ATR
  const rsiWr = rsi * wr;                                 // RSI×WR

  // ===== 时间特征 =====
  const month = date.getMonth() + 1; // 1-12
  const monthSin = Math.sin(2 * Math.PI * month / 12);
  const monthCos = Math.cos(2 * Math.PI * month / 12);
  const quarterEnd = [3, 6, 9, 12].includes(month) ? 1 : 0;

  // ===== 基础24维特征（保持与原版一致） =====
  const baseFeatures = [
    changePct, amplitude, volumeRatio, bodyRatio, upperRatio,
    lowerRatio, ma5Dev, ma20Dev, ma60Dev, volumeChange,
    macdDif, macdHist, rsi, kdjK, kdjD,
    bollUpperDev, bollLowerDev, wr,
    dayOfWeek, consecutiveNorm, atrNorm, return5d, return20d, amountChange,
  ];

  // ===== 交互特征 =====
  const interactionFeatures = [
    rsiBoll, macdVol, changeConsecutive, bodyVol, ampAtr, rsiWr,
  ];

  // ===== 时间特征 =====
  const timeFeatures = [monthSin, monthCos, quarterEnd];

  // ===== 指数 one-hot 编码 =====
  const indexOneHot = indexToOneHot(indexGroup);

  // 拼接：33维基础 + 7维 one-hot = 40维
  return [
    ...baseFeatures,
    ...interactionFeatures,
    ...timeFeatures,
    ...indexOneHot,
  ];
}

/** 计算分位数标签阈值 */
export function computeQuantileThresholds(
  klineData: KLineData[],
  upPercentile: number = 60,
  downPercentile: number = 40,
): { upThreshold: number; downThreshold: number } {
  const changes: number[] = [];
  for (let i = 1; i < klineData.length; i++) {
    const change = (klineData[i].close - klineData[i - 1].close) / klineData[i - 1].close;
    changes.push(change);
  }
  changes.sort((a, b) => a - b);

  const upIdx = Math.floor(changes.length * (upPercentile / 100));
  const downIdx = Math.floor(changes.length * (downPercentile / 100));

  return {
    upThreshold: changes[Math.min(upIdx, changes.length - 1)],
    downThreshold: changes[Math.max(0, downIdx)],
  };
}

/** 准备单个指数的训练样本 */
export function prepareSingleIndex(
  klineData: KLineData[],
  indexGroup: number,
  thresholds?: { upThreshold: number; downThreshold: number },
): TrainingSample[] {
  if (klineData.length < 61) return [];

  const indicators = getAllIndicators(klineData);
  const samples: TrainingSample[] = [];

  // 如果没有提供阈值，自动计算分位数
  const th = thresholds || computeQuantileThresholds(klineData);

  for (let i = 60; i < klineData.length - 1; i++) {
    const changePct = (klineData[i + 1].close - klineData[i].close) / klineData[i].close;

    // 分位数标签：top 35% = 涨, bottom 35% = 跌, 中间 30% = 丢弃
    let label: number | null = null;
    if (changePct >= th.upThreshold) {
      label = 1;
    } else if (changePct <= th.downThreshold) {
      label = 0;
    } else {
      continue; // 中间噪音丢弃
    }

    const features = extractFeatures(
      klineData[i],
      klineData.slice(0, i),
      indicators,
      indexGroup,
      i,
    );

    samples.push({
      features,
      indexCode: INDEX_DEFS[indexGroup].code,
      label,
      date: klineData[i].date || '',
    });
  }

  return samples;
}

/** 合并多个指数的训练样本 */
export function combineAllIndices(
  allData: Map<string, KLineData[]>,
): TrainingSample[] {
  const allSamples: TrainingSample[] = [];

  for (const idx of INDEX_DEFS) {
    const klineData = allData.get(idx.code);
    if (!klineData || klineData.length < 61) continue;

    const samples = prepareSingleIndex(klineData, idx.group);
    allSamples.push(...samples);
  }

  return allSamples;
}

/** 时间序列切分（按日期排序） */
export function timeSeriesSplit(
  samples: TrainingSample[],
  config: TimeSeriesSplitConfig = DEFAULT_SPLIT_CONFIG,
): {
  trainSamples: TrainingSample[];
  valSamples: TrainingSample[];
  testSamples: TrainingSample[];
} {
  // 按日期排序
  const sorted = [...samples].sort((a, b) => a.date.localeCompare(b.date));

  const total = sorted.length;
  const trainEnd = Math.floor(total * config.trainRatio);
  const valEnd = trainEnd + Math.floor(total * config.valRatio);

  return {
    trainSamples: sorted.slice(0, trainEnd),
    valSamples: sorted.slice(trainEnd, valEnd),
    testSamples: sorted.slice(valEnd),
  };
}

/** 将样本转换为 Tensor（直接从样本数组提取特征） */
export function samplesToTensor(samples: TrainingSample[]): tf.Tensor2D {
  const features = samples.map(s => s.features);
  if (features.length === 0) return tf.tensor2d([], [0, FEATURE_DIM]);
  return tf.tensor2d(features);
}

/** 将标签转换为 Tensor */
export function labelsToTensor(samples: TrainingSample[]): tf.Tensor1D {
  const labels = samples.map(s => s.label);
  if (labels.length === 0) return tf.tensor1d([]);
  return tf.tensor1d(labels);
}

/** 完整数据管线：获取所有指数数据 → 合并 → 切分 */
export async function fetchAndPrepareData(
  fetchFn: (code: string) => Promise<KLineData[]>,
): Promise<{
  trainSamples: TrainingSample[];
  valSamples: TrainingSample[];
  testSamples: TrainingSample[];
  totalSamples: number;
  indexBreakdown: Array<{ code: string; name: string; sampleCount: number }>;
}> {
  const allData = new Map<string, KLineData[]>();

  // 并行获取所有指数数据
  await Promise.all(
    INDEX_DEFS.map(async (idx) => {
      try {
        const data = await fetchFn(idx.code);
        if (data && data.length > 60) {
          allData.set(idx.code, data);
        }
      } catch (err) {
        console.warn(`获取 ${idx.name} 数据失败:`, err);
      }
    })
  );

  // 合并所有样本
  const allSamples = combineAllIndices(allData);

  // 时间序列切分
  const { trainSamples, valSamples, testSamples } = timeSeriesSplit(allSamples);

  const indexBreakdown = INDEX_DEFS.map(idx => {
    const count = allSamples.filter(s => s.indexCode === idx.code).length;
    return { code: idx.code, name: idx.name, sampleCount: count };
  }).filter(x => x.sampleCount > 0);

  return {
    trainSamples,
    valSamples,
    testSamples,
    totalSamples: allSamples.length,
    indexBreakdown,
  };
}

// ===== 特征标准化 =====

export interface NormalizationStats {
  mean: number[];
  std: number[];
}

/** 计算训练集的特征标准化参数（均值、标准差） */
export function computeNormalizationStats(samples: TrainingSample[]): NormalizationStats {
  if (samples.length === 0) {
    return { mean: new Array(FEATURE_DIM).fill(0), std: new Array(FEATURE_DIM).fill(1) };
  }

  const dim = samples[0].features.length;
  const mean = new Array(dim).fill(0);
  const std = new Array(dim).fill(0);

  // 1. 计算均值
  for (const s of samples) {
    for (let i = 0; i < dim; i++) {
      mean[i] += s.features[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    mean[i] /= samples.length;
  }

  // 2. 计算标准差
  for (const s of samples) {
    for (let i = 0; i < dim; i++) {
      std[i] += (s.features[i] - mean[i]) ** 2;
    }
  }
  for (let i = 0; i < dim; i++) {
    std[i] = Math.sqrt(std[i] / samples.length);
    if (std[i] < 1e-8) std[i] = 1; // 防止除零
  }

  return { mean, std };
}

/** 对单个特征向量应用标准化 */
export function normalizeFeatures(features: number[], stats: NormalizationStats): number[] {
  return features.map((f, i) => (f - stats.mean[i]) / stats.std[i]);
}

/** 批量标准化样本数组 */
export function normalizeSamples(samples: TrainingSample[], stats: NormalizationStats): TrainingSample[] {
  return samples.map(s => ({
    ...s,
    features: normalizeFeatures(s.features, stats),
  }));
}

export { FEATURE_NAMES, FEATURE_DIM, INDEX_DEFS };
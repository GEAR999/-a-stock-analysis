import * as tf from '@tensorflow/tfjs';
import { getAllIndicators } from '@/lib/analysis';
import type { KLineData } from '@/lib/types';
import { FEATURE_NAMES } from './types';

/** 提取特征向量 */
export function extractFeatures(
  kline: KLineData,
  prevKlines: KLineData[],
  indicators: any,
  index: number = 0
): number[] {
  const ma5 = indicators.ma[5]?.[indicators.ma[5].length - 1] ?? kline.close;
  const ma20 = indicators.ma[20]?.[indicators.ma[20].length - 1] ?? kline.close;
  const ma60 = indicators.ma[60]?.[indicators.ma[60].length - 1] ?? kline.close;
  const lastMacd = indicators.macd[indicators.macd.length - 1];
  const lastRsi = indicators.rsi[indicators.rsi.length - 1]?.rsi ?? 50;
  const lastKdj = indicators.kdj[indicators.kdj.length - 1];
  const lastBoll = indicators.boll[indicators.boll.length - 1];
  const prevVolume = prevKlines.length > 0 ? prevKlines[prevKlines.length - 1].volume : kline.volume;
  const avgVolume5 = prevKlines.length >= 5
    ? prevKlines.slice(-5).reduce((s, k) => s + k.volume, 0) / 5
    : kline.volume;

  const bodySize = Math.abs(kline.close - kline.open);
  const totalRange = kline.high - kline.low;
  const upperShadow = kline.high - Math.max(kline.open, kline.close);
  const lowerShadow = Math.min(kline.open, kline.close) - kline.low;

  const wr = lastKdj
    ? ((kline.high - kline.close) / (kline.high - kline.low)) * 100
    : 50;
  const bollUpperDev = lastBoll?.upper ? (kline.close - lastBoll.upper) / lastBoll.upper : 0;
  const bollLowerDev = lastBoll?.lower ? (kline.close - lastBoll.lower) / lastBoll.lower : 0;

  // --- 新增特征 ---

  // 1. 星期几 (0=周日, 1=周一...6=周六, 归一化到0-1)
  const dayOfWeek = kline.date ? new Date(kline.date).getDay() / 6 : 0.5;

  // 2. 连涨/连跌天数 (正=连涨, 负=连跌, 归一化到-1~1)
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

  // 3. ATR (14日平均真实波幅, 归一化)
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

  // 4. 近5日涨跌幅
  const price5dAgo = prevKlines.length >= 5 ? prevKlines[prevKlines.length - 5].close : kline.open;
  const return5d = (kline.close - price5dAgo) / price5dAgo;

  // 5. 近20日涨跌幅
  const price20dAgo = prevKlines.length >= 20 ? prevKlines[prevKlines.length - 20].close : kline.open;
  const return20d = (kline.close - price20dAgo) / price20dAgo;

  // 6. 成交额变化率
  const prevAmount = prevKlines.length > 0 ? prevKlines[prevKlines.length - 1].amount : kline.amount;
  const amountChange = prevAmount > 0 ? kline.amount / prevAmount : 1;

  return [
    (kline.close - kline.open) / kline.open, // 涨跌幅
    totalRange > 0 ? totalRange / kline.open : 0, // 振幅
    avgVolume5 > 0 ? kline.volume / avgVolume5 : 1, // 量比
    totalRange > 0 ? bodySize / totalRange : 0, // 实体比例
    totalRange > 0 ? upperShadow / totalRange : 0, // 上影线比例
    totalRange > 0 ? lowerShadow / totalRange : 0, // 下影线比例
    (kline.close - ma5) / ma5, // MA5偏离度
    (kline.close - ma20) / ma20, // MA20偏离度
    ma60 > 0 ? (kline.close - ma60) / ma60 : 0, // MA60偏离度
    prevVolume > 0 ? kline.volume / prevVolume : 1, // 成交量变化率
    lastMacd?.dif ?? 0, // MACD.dif
    lastMacd?.histogram ?? 0, // MACD.histogram
    lastRsi / 100, // RSI归一化
    lastKdj?.k ?? 50 / 100, // KDJ.k归一化
    lastKdj?.d ?? 50 / 100, // KDJ.d归一化
    bollUpperDev, // BOLL.upper偏离度
    bollLowerDev, // BOLL.lower偏离度
    wr / 100, // WR归一化
    // 新增特征
    dayOfWeek, // 星期几
    consecutiveNorm, // 连涨/连跌天数
    atrNorm, // ATR波动率
    return5d, // 近5日涨跌幅
    return20d, // 近20日涨跌幅
    Math.min(amountChange, 5), // 成交额变化率(限幅)
  ];
}

/** 准备训练数据集（与prepareLabels的噪音过滤保持一致） */
export function prepareData(klineData: KLineData[]): tf.Tensor2D {
  if (klineData.length < 61) {
    return tf.tensor2d([], [0, 24]);
  }

  const indicators = getAllIndicators(klineData);

  const samples: number[][] = [];
  for (let i = 60; i < klineData.length - 1; i++) {
    // 与prepareLabels保持一致的过滤条件
    const changePct = (klineData[i + 1].close - klineData[i].close) / klineData[i].close;
    if (Math.abs(changePct) < 0.005) continue; // 过滤噪音

    const kline = klineData[i];
    const prevKlines = klineData.slice(0, i);
    const featureVec = extractFeatures(kline, prevKlines, indicators, i);
    samples.push(featureVec);
  }

  return tf.tensor2d(samples);
}

/** 准备训练标签（过滤噪音：±0.5%以内忽略） */
export function prepareLabels(klineData: KLineData[]): tf.Tensor1D {
  if (klineData.length < 61) {
    return tf.tensor1d([]);
  }

  const labels: number[] = [];
  for (let i = 60; i < klineData.length - 1; i++) {
    const changePct = (klineData[i + 1].close - klineData[i].close) / klineData[i].close;
    if (Math.abs(changePct) < 0.005) continue; // 过滤噪音
    const label = changePct > 0 ? 1 : 0;
    labels.push(label);
  }

  return tf.tensor1d(labels);
}

/** 划分训练集/验证集/测试集 */
export function splitDataset(
  features: tf.Tensor2D,
  labels: tf.Tensor1D,
  trainRatio: number = 0.8,
  valRatio: number = 0.1
): {
  trainX: tf.Tensor2D;
  trainY: tf.Tensor1D;
  valX: tf.Tensor2D;
  valY: tf.Tensor1D;
  testX: tf.Tensor2D;
  testY: tf.Tensor1D;
} {
  const total = features.shape[0];
  const trainEnd = Math.floor(total * trainRatio);
  const valEnd = trainEnd + Math.floor(total * valRatio);

  return {
    trainX: features.slice([0, 0], [trainEnd, -1]) as tf.Tensor2D,
    trainY: labels.slice([0], [trainEnd]) as tf.Tensor1D,
    valX: features.slice([trainEnd, 0], [valEnd - trainEnd, -1]) as tf.Tensor2D,
    valY: labels.slice([trainEnd], [valEnd - trainEnd]) as tf.Tensor1D,
    testX: features.slice([valEnd, 0], [total - valEnd, -1]) as tf.Tensor2D,
    testY: labels.slice([valEnd], [total - valEnd]) as tf.Tensor1D,
  };
}

export { FEATURE_NAMES };
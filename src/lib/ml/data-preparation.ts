import * as tf from '@tensorflow/tfjs';
import { getAllIndicators } from '@/lib/analysis';
import type { KLineData } from '@/lib/types';
import { FEATURE_NAMES } from './types';

/** 提取特征向量 */
export function extractFeatures(
  kline: KLineData,
  prevKlines: KLineData[],
  indicators: any
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
  ];
}

/** 准备训练数据集 */
export function prepareData(klineData: KLineData[]): tf.Tensor2D {
  if (klineData.length < 61) {
    return tf.tensor2d([], [0, 18]);
  }

  const indicators = getAllIndicators(klineData);

  const samples: number[][] = [];
  for (let i = 60; i < klineData.length - 1; i++) {
    const kline = klineData[i];
    const prevKlines = klineData.slice(0, i);
    const featureVec = extractFeatures(kline, prevKlines, indicators);
    samples.push(featureVec);
  }

  return tf.tensor2d(samples);
}

/** 准备训练标签 */
export function prepareLabels(klineData: KLineData[]): tf.Tensor1D {
  if (klineData.length < 61) {
    return tf.tensor1d([]);
  }

  const labels: number[] = [];
  for (let i = 60; i < klineData.length - 1; i++) {
    const label = klineData[i + 1].close > klineData[i].close ? 1 : 0;
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
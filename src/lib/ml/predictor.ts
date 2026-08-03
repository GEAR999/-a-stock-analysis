import * as tf from '@tensorflow/tfjs';
import { getAllIndicators } from '@/lib/analysis';
import type { KLineData } from '@/lib/types';
import {
  type PredictionResult, type PredictionHistoryItem, type TrainingSample,
  ENSEMBLE_CONFIG, INDEX_DEFS, FEATURE_DIM,
} from './types';
import { loadAllEnsembleModels, MODEL_NAME } from './model';
import { extractFeatures, computeQuantileThresholds } from './data-preparation';

/** 缓存已加载的模型 */
let cachedModels: tf.Sequential[] | null = null;

/** 获取已缓存的模型 */
export async function getCachedModels(): Promise<tf.Sequential[]> {
  if (cachedModels && cachedModels.length > 0) {
    return cachedModels;
  }
  cachedModels = await loadAllEnsembleModels();
  return cachedModels;
}

/** 清除模型缓存（重新训练后调用） */
export function clearModelCache(): void {
  if (cachedModels) {
    cachedModels.forEach(m => m.dispose());
    cachedModels = null;
  }
}

/** 预测次日涨跌（集成模型） */
export async function predictNextDay(
  indexCode: string,
  klineData: KLineData[],
): Promise<PredictionResult | null> {
  const models = await getCachedModels();
  if (models.length < 1) return null;

  // 找到指数对应的 group
  const idxDef = INDEX_DEFS.find(d => d.code === indexCode);
  if (!idxDef) return null;

  // 确保有足够的历史数据
  if (klineData.length < 61) return null;

  // 提取特征
  const indicators = getAllIndicators(klineData);
  const lastKline = klineData[klineData.length - 1];
  const features = extractFeatures(lastKline, klineData.slice(0, -1), indicators, idxDef.group);

  // 转换为 Tensor
  const inputTensor = tf.tensor2d([features], [1, FEATURE_DIM]);

  // 每个模型预测
  const probs: number[] = [];
  for (const model of models) {
    try {
      const pred = model.predict(inputTensor) as tf.Tensor;
      const prob = pred.dataSync()[0];
      probs.push(prob);
      pred.dispose();
    } catch (err) {
      console.warn(`模型预测失败:`, err);
    }
  }

  inputTensor.dispose();

  if (probs.length === 0) return null;

  // 集成平均概率
  const avgProb = probs.reduce((s, p) => s + p, 0) / probs.length;

  // 置信度判断
  let confidence: '高' | '中' | '低';
  const deviation = Math.abs(avgProb - 0.5) * 2; // 0-1 范围，越接近 1 越确定
  if (deviation >= 0.7) confidence = '高';
  else if (deviation >= 0.4) confidence = '中';
  else confidence = '低';

  return {
    upProb: avgProb,
    downProb: 1 - avgProb,
    confidence,
    direction: avgProb >= 0.5 ? 'up' : 'down',
    featureValues: features,
    ensembleProbs: probs,
  };
}

/** 批量预测多个指数 */
export async function predictAllIndices(
  allData: Map<string, KLineData[]>,
): Promise<Array<{
  code: string;
  name: string;
  prediction: PredictionResult | null;
}>> {
  const results = [];

  for (const idx of INDEX_DEFS) {
    const klineData = allData.get(idx.code);
    if (!klineData || klineData.length < 61) {
      results.push({ code: idx.code, name: idx.name, prediction: null });
      continue;
    }

    const prediction = await predictNextDay(idx.code, klineData);
    results.push({ code: idx.code, name: idx.name, prediction });
  }

  return results;
}

/** 生成预测历史（用于回测评估） */
export function generatePredictionHistory(
  testSamples: TrainingSample[],
  models: tf.Sequential[],
): PredictionHistoryItem[] {
  const history: PredictionHistoryItem[] = [];

  for (const sample of testSamples) {
    const inputTensor = tf.tensor2d([sample.features], [1, FEATURE_DIM]);

    const probs: number[] = [];
    for (const model of models) {
      const pred = model.predict(inputTensor) as tf.Tensor;
      probs.push(pred.dataSync()[0]);
      pred.dispose();
    }

    inputTensor.dispose();

    const avgProb = probs.reduce((s, p) => s + p, 0) / probs.length;
    const correct = (avgProb >= 0.5 && sample.label === 1) || (avgProb < 0.5 && sample.label === 0);

    history.push({
      date: sample.date,
      upProb: avgProb,
      actual: sample.label,
      correct,
    });
  }

  return history.sort((a, b) => a.date.localeCompare(b.date));
}

/** 检查模型是否已保存 */
export async function isModelTrained(): Promise<boolean> {
  const models = await getCachedModels();
  return models.length >= ENSEMBLE_CONFIG.numModels;
}

/** 获取模型训练元数据 */
export async function getModelMetadata(): Promise<Record<string, any> | null> {
  const metadataStr = localStorage.getItem(`${MODEL_NAME}-ensemble-0-metadata`);
  if (!metadataStr) return null;
  return JSON.parse(metadataStr);
}
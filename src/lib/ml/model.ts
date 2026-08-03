import * as tf from '@tensorflow/tfjs';
import { FEATURE_DIM, ENSEMBLE_CONFIG, INDEX_DEFS } from './types';

/** 模型名称 */
export const MODEL_NAME = 'a-stock-index-model';

/** 构建模型（40维输入 → 64→32→16→1） */
export function buildModel(
  inputDim: number = FEATURE_DIM,
  seed: number = 42,
  learningRate: number = 0.001,
): tf.Sequential {
  // setRandomSeed 在 tfjs 4.x 中已移除，用 kernelInitializer 保证初始化多样性
  // 5 个模型不同种子天然产生不同初始权重，无需手动设置随机种子

  const model = tf.sequential();

  // ★ 输入归一化层: 防止 sigmoid 饱和导致 loss=NaN
  model.add(tf.layers.batchNormalization({
    inputShape: [inputDim],
    axis: 1,
  }));

  // 共享层 1: 40→64
  model.add(tf.layers.dense({
    units: 64,
    activation: 'relu',
    kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
    kernelInitializer: 'heNormal',
  }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.dropout({ rate: 0.3 }));

  // 共享层 2: 64→32
  model.add(tf.layers.dense({
    units: 32,
    activation: 'relu',
    kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
    kernelInitializer: 'heNormal',
  }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.dropout({ rate: 0.2 }));

  // 共享层 3: 32→16
  model.add(tf.layers.dense({
    units: 16,
    activation: 'relu',
    kernelInitializer: 'heNormal',
  }));
  model.add(tf.layers.batchNormalization());

  // 输出层: 16→2 (softmax, 二分类: [跌概率, 涨概率])
  // softmax + sparseCategoricalCrossentropy 数值上绝对稳定
  model.add(tf.layers.dense({
    units: 2,
    activation: 'softmax',
    kernelInitializer: 'glorotNormal',
  }));

  model.compile({
    optimizer: tf.train.adam(learningRate),
    loss: 'sparseCategoricalCrossentropy',
    metrics: ['accuracy'],
  });

  return model;
}

/** 构建余弦退火学习率调度器 */
export function cosineAnnealingLR(
  initialLR: number,
  totalEpochs: number,
  currentEpoch: number,
): number {
  const minLR = initialLR * 0.01;
  return minLR + 0.5 * (initialLR - minLR) * (1 + Math.cos(Math.PI * currentEpoch / totalEpochs));
}

/** 保存单个模型（集成索引） */
export async function saveModel(
  model: tf.Sequential,
  modelIndex: number = 0,
  metadata?: Record<string, any>,
): Promise<void> {
  const modelId = `${MODEL_NAME}-ensemble-${modelIndex}`;
  await model.save(`indexeddb://${modelId}`);

  // 保存元数据
  if (metadata) {
    localStorage.setItem(`${modelId}-metadata`, JSON.stringify(metadata));
  }
}

/** 加载单个模型（集成索引） */
export async function loadModel(
  modelIndex: number = 0,
): Promise<tf.Sequential | null> {
  const modelId = `${MODEL_NAME}-ensemble-${modelIndex}`;
  try {
    const model = await tf.loadLayersModel(`indexeddb://${modelId}`);
    return model as tf.Sequential;
  } catch {
    return null;
  }
}

/** 加载所有已训练的集成模型 */
export async function loadAllEnsembleModels(): Promise<tf.Sequential[]> {
  const models: tf.Sequential[] = [];
  for (let i = 0; i < ENSEMBLE_CONFIG.numModels; i++) {
    const model = await loadModel(i);
    if (model) models.push(model);
  }
  return models;
}

/** 检查是否有已训练的模型 */
export async function checkSavedModels(): Promise<{
  isTrained: boolean;
  trainedModelCount: number;
  metadata: Record<string, any> | null;
}> {
  const models = await loadAllEnsembleModels();
  if (models.length === 0) {
    return { isTrained: false, trainedModelCount: 0, metadata: null };
  }

  const metadataStr = localStorage.getItem(`${MODEL_NAME}-ensemble-0-metadata`);
  const metadata = metadataStr ? JSON.parse(metadataStr) : null;

  return {
    isTrained: true,
    trainedModelCount: models.length,
    metadata,
  };
}

/** 删除所有已保存的模型 */
export async function clearAllModels(): Promise<void> {
  // 清除 IndexedDB 中的模型
  for (let i = 0; i < ENSEMBLE_CONFIG.numModels; i++) {
    try {
      await tf.io.removeModel(`indexeddb://${MODEL_NAME}-ensemble-${i}`);
    } catch { /* 可能不存在 */ }
    localStorage.removeItem(`${MODEL_NAME}-ensemble-${i}-metadata`);
  }
}

/** 重置 TensorFlow.js 内存 */
export function disposeModel(model: tf.Sequential): void {
  model.dispose();
  tf.disposeVariables();
  // 不完全清理，保留 Backend
}

// ===== 特征标准化参数持久化 =====

const NORM_STATS_KEY = `${MODEL_NAME}-norm-stats`;

/** 保存标准化参数 */
export function saveNormalizationStats(stats: { mean: number[]; std: number[] }): void {
  localStorage.setItem(NORM_STATS_KEY, JSON.stringify(stats));
}

/** 加载标准化参数 */
export function loadNormalizationStats(): { mean: number[]; std: number[] } | null {
  const raw = localStorage.getItem(NORM_STATS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** 清除标准化参数 */
export function clearNormalizationStats(): void {
  localStorage.removeItem(NORM_STATS_KEY);
}
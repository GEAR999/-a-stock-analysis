import * as tf from '@tensorflow/tfjs';
import { FEATURE_DIM, ENSEMBLE_CONFIG, INDEX_DEFS } from './types';

/** 模型名称 */
export const MODEL_NAME = 'a-stock-index-model';

/** 构建模型（40维输入 → 64→32→16→1） */
export function buildModel(
  learningRate: number = 0.001,
  seed: number = 42,
): tf.Sequential {
  tf.util.setRandomSeed(seed);

  const model = tf.sequential();

  // 共享层 1: 40→64
  model.add(tf.layers.dense({
    units: 64,
    activation: 'relu',
    inputShape: [FEATURE_DIM],
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

  // 输出层: 16→1
  model.add(tf.layers.dense({
    units: 1,
    activation: 'sigmoid',
    kernelInitializer: 'glorotNormal',
  }));

  model.compile({
    optimizer: tf.train.adam(learningRate),
    loss: 'binaryCrossentropy',
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
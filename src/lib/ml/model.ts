import * as tf from '@tensorflow/tfjs';

export const MODEL_NAME = 'a-stock-index-model';

/** 构建二分类模型 */
export function buildModel(inputDim: number): tf.Sequential {
  const model = tf.sequential();

  model.add(tf.layers.dense({
    inputShape: [inputDim],
    units: 64,
    activation: 'relu',
    kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
  }));
  model.add(tf.layers.dropout({ rate: 0.3 }));

  model.add(tf.layers.dense({
    units: 32,
    activation: 'relu',
    kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
  }));
  model.add(tf.layers.dropout({ rate: 0.2 }));

  model.add(tf.layers.dense({
    units: 16,
    activation: 'relu',
  }));

  model.add(tf.layers.dense({
    units: 1,
    activation: 'sigmoid',
  }));

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy'],
  });

  return model;
}

/** 保存模型 */
export async function saveModel(model: tf.Sequential): Promise<boolean> {
  try {
    await model.save(`indexeddb://${MODEL_NAME}`);
    return true;
  } catch (err) {
    console.error('保存模型失败:', err);
    return false;
  }
}

/** 加载模型 */
export async function loadModel(): Promise<tf.Sequential | null> {
  try {
    const model = await tf.loadLayersModel(`indexeddb://${MODEL_NAME}`);
    return model as tf.Sequential;
  } catch {
    return null;
  }
}

/** 检查模型是否存在 */
export async function checkModelExists(): Promise<boolean> {
  try {
    const models = await tf.io.listModels();
    return `indexeddb://${MODEL_NAME}` in models;
  } catch {
    return false;
  }
}

/** 获取模型信息 */
export async function getModelInfo(): Promise<{
  exists: boolean;
  size?: number;
  dateSaved?: Date;
}> {
  try {
    const models = await tf.io.listModels();
    const info = models[`indexeddb://${MODEL_NAME}`];
    if (info) {
      return {
        exists: true,
        size: info.modelTopologyBytes ?? 0,
        dateSaved: info.dateSaved ? new Date(info.dateSaved) : undefined,
      };
    }
  } catch {
    // 忽略
  }
  return { exists: false };
}
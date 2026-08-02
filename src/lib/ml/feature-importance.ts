import * as tf from '@tensorflow/tfjs';
import type { FeatureImportance } from './types';

/** 计算特征重要性（Permutation Importance） */
export function calculateFeatureImportance(
  model: tf.Sequential,
  testX: tf.Tensor2D,
  testY: tf.Tensor1D,
  featureNames: string[] = []
): FeatureImportance[] {
  const baseline = (model.evaluate(testX, testY) as tf.Scalar[])[1].dataSync()[0];
  const numFeatures = testX.shape[1];
  const numRows = testX.shape[0];
  const importances: FeatureImportance[] = [];

  for (let col = 0; col < numFeatures; col++) {
    const buffer = testX.bufferSync();
    // 提取该列所有值
    const colValues: number[] = [];
    for (let row = 0; row < numRows; row++) {
      colValues.push(buffer.get(row, col));
    }
    // 打乱
    tf.util.shuffle(colValues);
    // 放回
    for (let row = 0; row < numRows; row++) {
      buffer.set(colValues[row], row, col);
    }

    const shuffledTensor = buffer.toTensor() as tf.Tensor2D;
    const score = (model.evaluate(shuffledTensor, testY) as tf.Scalar[])[1].dataSync()[0];
    shuffledTensor.dispose();

    importances.push({
      name: featureNames[col] || `特征${col + 1}`,
      importance: Math.max(0, baseline - score),
      rank: 0,
    });
  }

  importances.sort((a, b) => b.importance - a.importance);
  importances.forEach((item, i) => { item.rank = i + 1; });

  return importances;
}
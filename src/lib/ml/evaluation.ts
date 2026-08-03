import * as tf from '@tensorflow/tfjs';
import type { EvaluationMetrics, ConfusionMatrix } from './types';

/** 计算混淆矩阵和评估指标 */
export function evaluateModel(
  model: tf.Sequential,
  testX: tf.Tensor2D,
  testY: tf.Tensor1D
): EvaluationMetrics & { confusionMatrix: ConfusionMatrix } {
  const predictions = model.predict(testX) as tf.Tensor;
  // 模型输出是softmax [prob_down, prob_up], 取prob_up作为涨的概率
  const upProbs = predictions.slice([0, 1], [-1, 1]) as tf.Tensor;
  const predValues = upProbs.dataSync();
  const trueValues = testY.dataSync();
  upProbs.dispose();
  predictions.dispose();

  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (let i = 0; i < predValues.length; i++) {
    const pred = predValues[i] >= 0.5 ? 1 : 0;
    const actual = trueValues[i];
    if (pred === 1 && actual === 1) tp++;
    else if (pred === 1 && actual === 0) fp++;
    else if (pred === 0 && actual === 1) fn++;
    else if (pred === 0 && actual === 0) tn++;
  }

  const total = tp + fp + tn + fn;
  const accuracy = total > 0 ? (tp + tn) / total : 0;
  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
  const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
  const f1 = (precision + recall) > 0 ? 2 * precision * recall / (precision + recall) : 0;

  return {
    accuracy,
    precision,
    recall,
    f1,
    confusionMatrix: { tp, fp, tn, fn },
  };
}
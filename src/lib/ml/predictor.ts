import * as tf from '@tensorflow/tfjs';
import { extractFeatures } from './data-preparation';
import { MODEL_NAME } from './model';
import type { KLineData } from '@/lib/types';
import type { PredictionResult } from './types';

/** 置信度等级 */
function getConfidenceLevel(prob: number): PredictionResult['confidence'] {
  if (prob >= 0.7) return '高';
  if (prob >= 0.55) return '中';
  return '低';
}

/** 预测次日涨跌 */
export async function predictNextDay(
  klineData: KLineData[],
  indicators: any,
  modelName: string = MODEL_NAME
): Promise<PredictionResult | null> {
  try {
    const model = await tf.loadLayersModel(`indexeddb://${modelName}`);
    const lastIdx = klineData.length - 1;
    const features = extractFeatures(
      klineData[lastIdx],
      klineData.slice(-60),
      indicators
    );
    const input = tf.tensor2d([features]);
    const result = model.predict(input) as tf.Tensor;
    const upProb = result.dataSync()[0];
    const confidence = getConfidenceLevel(upProb);

    input.dispose();
    result.dispose();

    return {
      upProb: Math.round(upProb * 100),
      downProb: Math.round((1 - upProb) * 100),
      confidence,
      direction: upProb > 0.5 ? 'up' : 'down',
      featureValues: features,
    };
  } catch (e) {
    console.error('预测失败:', e);
    return null;
  }
}
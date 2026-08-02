import * as tf from '@tensorflow/tfjs';
import type { KLineData } from '@/lib/types';
import type { TrainingConfig, TrainingProgress, TrainingSummary, FeatureImportance } from './types';
import { buildModel, MODEL_NAME } from './model';
import { prepareData, prepareLabels, splitDataset, extractFeatures } from './data-preparation';
import { evaluateModel } from './evaluation';
import { calculateFeatureImportance } from './feature-importance';

/** 训练模型（完整流程） */
export async function trainModel(
  klineData: KLineData[],
  config: TrainingConfig,
  onProgress?: (progress: TrainingProgress) => void
): Promise<TrainingSummary> {
  const updateProgress = (partial: Partial<TrainingProgress>) => {
    onProgress?.({
      phase: 'preparing',
      message: '',
      progress: 0,
      ...partial,
    } as TrainingProgress);
  };

  // 1. 准备数据
  updateProgress({ phase: 'preparing', message: '正在计算技术指标...', progress: 10 });
  const features = prepareData(klineData);
  const labels = prepareLabels(klineData);
  const { trainX, trainY, testX, testY } = splitDataset(features, labels);

  // 2. 构建模型
  updateProgress({ phase: 'preparing', message: '正在构建模型...', progress: 30 });
  const inputDim = features.shape[1];
  const model = buildModel(inputDim);

  // 3. 训练
  updateProgress({ phase: 'training', message: '开始训练...', progress: 40 });
  const history: Array<{ epoch: number; loss: number; accuracy: number; valAccuracy: number }> = [];

  await model.fit(trainX, trainY, {
    batchSize: config.batchSize || 32,
    epochs: config.epochs || 50,
    validationData: [testX, testY],
    callbacks: {
      onEpochEnd: (epoch: number, logs?: tf.Logs) => {
        const entry = {
          epoch: epoch + 1,
          loss: logs?.loss ?? 0,
          accuracy: logs?.acc ?? 0,
          valAccuracy: logs?.val_acc ?? 0,
        };
        history.push(entry);
        const progress = Math.min(40 + ((epoch + 1) / (config.epochs || 50)) * 40, 80);
        updateProgress({
          phase: 'training',
          message: `训练中... 第 ${epoch + 1}/${config.epochs} 轮`,
          progress,
          epoch: epoch + 1,
          totalEpochs: config.epochs,
          loss: entry.loss,
          accuracy: entry.accuracy,
          valAccuracy: entry.valAccuracy,
          history,
        });
      },
    } as tf.CustomCallbackArgs,
  });

  // 4. 评估
  updateProgress({ phase: 'evaluating', message: '正在评估模型...', progress: 85 });
  const evalResult = evaluateModel(model, testX, testY);

  // 5. 特征重要性
  updateProgress({ phase: 'evaluating', message: '正在分析特征重要性...', progress: 90 });
  const featureImportance = calculateFeatureImportance(model, testX, testY);

  // 6. 保存模型
  try {
    await model.save(`indexeddb://${MODEL_NAME}-${config.indexCode}`);
  } catch (e) {
    console.warn('模型保存失败:', e);
  }

  // 7. 清理张量
  trainX.dispose();
  trainY.dispose();
  testX.dispose();
  testY.dispose();
  features.dispose();
  labels.dispose();

  updateProgress({ phase: 'done', message: '训练完成！', progress: 100 });

  return {
    indexCode: config.indexCode,
    indexName: config.indexName,
    accuracy: evalResult.accuracy,
    precision: evalResult.precision,
    recall: evalResult.recall,
    f1: evalResult.f1,
    sampleCount: klineData.length,
    totalEpochs: config.epochs,
    trainedAt: new Date().toISOString(),
    featureImportance: [],
    confusionMatrix: evalResult.confusionMatrix,
  };
}
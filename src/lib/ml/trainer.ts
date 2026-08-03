import * as tf from '@tensorflow/tfjs';
import {
  type TrainingSample, type TrainingProgress, type TrainingSummary,
  ENSEMBLE_CONFIG, DEFAULT_TRAINING_CONFIG, INDEX_DEFS,
  type FeatureImportance, type ConfusionMatrix,
} from './types';
import { buildModel, saveModel, cosineAnnealingLR, disposeModel, clearAllModels } from './model';
import { samplesToTensor, labelsToTensor } from './data-preparation';

/** 计算评估指标 */
function calcMetrics(
  yTrue: number[],
  yPred: number[],
  threshold: number = 0.5,
): { accuracy: number; precision: number; recall: number; f1: number; tp: number; fp: number; tn: number; fn: number } {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (let i = 0; i < yTrue.length; i++) {
    const pred = yPred[i] >= threshold ? 1 : 0;
    if (yTrue[i] === 1 && pred === 1) tp++;
    else if (yTrue[i] === 0 && pred === 1) fp++;
    else if (yTrue[i] === 0 && pred === 0) tn++;
    else if (yTrue[i] === 1 && pred === 0) fn++;
  }

  const accuracy = (tp + tn) / (tp + fp + tn + fn) || 0;
  const precision = tp / (tp + fp) || 0;
  const recall = tp / (tp + fn) || 0;
  const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

  return { accuracy, precision, recall, f1, tp, fp, tn, fn };
}

/** 计算特征重要性（排列重要性） */
function calcFeatureImportance(
  model: tf.Sequential,
  valFeatures: tf.Tensor2D,
  valLabels: tf.Tensor1D,
  featureNames: string[],
): Array<{ name: string; importance: number }> {
  const basePred = model.predict(valFeatures) as tf.Tensor;
  const baseProbs = Array.from(basePred.dataSync() as Float32Array);
  const baseLabels = Array.from(valLabels.dataSync() as Float32Array);
  const baseAcc = calcMetrics(baseLabels, baseProbs).accuracy;
  basePred.dispose();

  const importances: Array<{ name: string; importance: number }> = [];
  const featureData = valFeatures.arraySync() as number[][];

  for (let f = 0; f < featureNames.length; f++) {
    const shuffled = featureData.map(row => {
      const newRow = [...row];
      // 随机打乱该特征列
      const col = row.map(r => r[f]);
      const shuffledCol = [...col].sort(() => Math.random() - 0.5);
      newRow.map((_, i) => { newRow[f] = shuffledCol[i]; });
      return newRow;
    });

    const shuffledTensor = tf.tensor2d(shuffled, [shuffled.length, featureNames.length]);
    const permPred = model.predict(shuffledTensor) as tf.Tensor;
    const permProbs = Array.from(permPred.dataSync() as Float32Array);
    const permAcc = calcMetrics(baseLabels, permProbs).accuracy;
    permPred.dispose();
    shuffledTensor.dispose();

    importances.push({
      name: featureNames[f],
      importance: Math.max(0, (baseAcc - permAcc) * 100),
    });
  }

  return importances.sort((a, b) => b.importance - a.importance);
}

/** 训练单个模型 */
export async function trainSingleModel(
  trainSamples: TrainingSample[],
  valSamples: TrainingSample[],
  config: { epochs: number; batchSize: number; learningRate: number; seed: number },
  onProgress: (progress: TrainingProgress) => void,
  modelIndex: number,
): Promise<{
  model: tf.Sequential;
  history: Array<{ epoch: number; loss: number; accuracy: number; valAccuracy: number }>;
  valAccuracy: number;
}> {
  const { epochs, batchSize, learningRate, seed } = config;

  onProgress({
    phase: 'training',
    message: `构建模型 ${modelIndex + 1}/${ENSEMBLE_CONFIG.numModels}...`,
    progress: 0,
    modelIndex,
    currentModel: modelIndex + 1,
  });

  // 构建模型
  const model = buildModel(FEATURE_DIM, seed);

  // 转换为 Tensor
  const trainFeatures = samplesToTensor(trainSamples);
  const trainLabels = labelsToTensor(trainSamples);
  const valFeatures = samplesToTensor(valSamples);
  const valLabels = labelsToTensor(valSamples);

  const history: Array<{ epoch: number; loss: number; accuracy: number; valAccuracy: number }> = [];
  const batchSizeActual = Math.min(batchSize, trainSamples.length);

  let bestValAcc = 0;
  let earlyStopCount = 0;

  // 模型已编译，不再重复编译（避免 Adam 优化器状态重置）
  // 训练 50 个 epoch，使用固定学习率 + Adam 自适应
  const result = await model.fit(trainFeatures, trainLabels, {
    batchSize: batchSizeActual,
    epochs: epochs,
    validationData: [valFeatures, valLabels],
    shuffle: true,
    initialEpoch: 0,
    callbacks: {
      onEpochEnd: async (epochNum, logs) => {
          const acc = logs?.acc ?? logs?.accuracy ?? 0;
          const valAcc = logs?.val_acc ?? logs?.val_accuracy ?? 0;
          const loss = logs?.loss ?? 0;

          history.push({
            epoch: epochNum + 1,
            loss,
            accuracy: typeof acc === 'number' ? acc : 0,
            valAccuracy: typeof valAcc === 'number' ? valAcc : 0,
          });

          // 早停
          if (valAcc > bestValAcc) {
            bestValAcc = valAcc;
            earlyStopCount = 0;
          } else {
            earlyStopCount++;
          }

          // 达到早停条件时停止训练
          if (earlyStopCount >= 10) {
            model.stopTraining = true;
          }

          const progress = ((epochNum + 1) / epochs) * 100;
          onProgress({
            phase: 'training',
            message: `模型 ${modelIndex + 1}/${ENSEMBLE_CONFIG.numModels} - Epoch ${epochNum + 1}/${epochs} | loss: ${loss.toFixed(4)} | val_acc: ${(valAcc * 100).toFixed(1)}%`,
            progress,
            epoch: epochNum + 1,
            totalEpochs: epochs,
            loss,
            accuracy: typeof acc === 'number' ? acc : 0,
            valAccuracy: typeof valAcc === 'number' ? valAcc : 0,
            history,
            modelIndex,
            currentModel: modelIndex + 1,
          });
        },
      },
    });

  }

  // 清理 Tensor
  trainFeatures.dispose();
  trainLabels.dispose();
  valFeatures.dispose();
  valLabels.dispose();

  return { model, history, valAccuracy: bestValAcc };
}

/** 训练完整集成模型 */
export async function trainEnsemble(
  trainSamples: TrainingSample[],
  valSamples: TrainingSample[],
  onProgress: (progress: TrainingProgress) => void,
): Promise<{
  summaries: TrainingSummary[];
  allModels: tf.Sequential[];
  finalAccuracy: number;
}> {
  // 清理旧模型
  await clearAllModels();

  const config = {
    epochs: DEFAULT_TRAINING_CONFIG.epochs,
    batchSize: DEFAULT_TRAINING_CONFIG.batchSize,
    learningRate: DEFAULT_TRAINING_CONFIG.learningRate,
  };

  const allModels: tf.Sequential[] = [];
  const summaries: TrainingSummary[] = [];

  onProgress({
    phase: 'preparing',
    message: `准备数据：训练集 ${trainSamples.length} 样本，验证集 ${valSamples.length} 样本`,
    progress: 0,
  });

  // 训练每个集成模型
  for (let i = 0; i < ENSEMBLE_CONFIG.numModels; i++) {
    const seed = ENSEMBLE_CONFIG.seeds[i];

    const { model, history, valAccuracy } = await trainSingleModel(
      trainSamples, valSamples, { ...config, seed },
      onProgress, i,
    );

    // 保存模型
    const trainedAt = new Date().toISOString();
    await saveModel(model, i, {
      trainedAt,
      valAccuracy,
      seed,
      sampleCount: trainSamples.length + valSamples.length,
      epochs: history.length,
    });

    allModels.push(model);

    // 计算验证集上的完整指标
    const valFeatures = samplesToTensor(valSamples);
    const valLabels = labelsToTensor(valSamples);

    const pred = model.predict(valFeatures) as tf.Tensor;
    const probs = Array.from(pred.dataSync() as Float32Array);
    const trueLabels = Array.from(valLabels.dataSync() as Float32Array);
    const metrics = calcMetrics(trueLabels, probs);
    pred.dispose();
    valFeatures.dispose();
    valLabels.dispose();

    // 按指数分解准确率
    const indexBreakdown = INDEX_DEFS
      .map(idx => {
        const idxSamples = valSamples.filter(s => s.indexCode === idx.code);
        return {
          code: idx.code,
          name: idx.name,
          sampleCount: idxSamples.length,
          accuracy: 0,
        };
      })
      .filter(x => x.sampleCount > 0);

    summaries.push({
      accuracy: metrics.accuracy,
      precision: metrics.precision,
      recall: metrics.recall,
      f1: metrics.f1,
      sampleCount: trainSamples.length + valSamples.length,
      totalEpochs: history.length,
      trainedAt,
      featureImportance: [],
      confusionMatrix: { tp: metrics.tp, fp: metrics.fp, tn: metrics.tn, fn: metrics.fn },
      ensembleAccuracy: metrics.accuracy,
      ensemblePrecision: metrics.precision,
      ensembleRecall: metrics.recall,
      ensembleF1: metrics.f1,
      indexBreakdown,
    });
  }

  // 计算集成验证准确率（所有模型平均）
  const valFeatures = samplesToTensor(valSamples);
  const valLabels = labelsToTensor(valSamples);
  const allProbs: number[][] = [];

  for (const model of allModels) {
    const pred = model.predict(valFeatures) as tf.Tensor;
    allProbs.push(Array.from(pred.dataSync() as Float32Array));
    pred.dispose();
  }

  const trueLabels = Array.from(valLabels.dataSync() as Float32Array);
  const ensembleProbs = allProbs[0].map((_, i) => {
    const sum = allProbs.reduce((s, probs) => s + probs[i], 0);
    return sum / allProbs.length;
  });
  const finalMetrics = calcMetrics(trueLabels, ensembleProbs);
  valFeatures.dispose();
  valLabels.dispose();

  onProgress({
    phase: 'evaluating',
    message: `集成模型准确率: ${(finalMetrics.accuracy * 100).toFixed(1)}%`,
    progress: 100,
  });

  return {
    summaries,
    allModels,
    finalAccuracy: finalMetrics.accuracy,
  };
}

/** 快速评估（模型已存在时使用） */
export async function quickEvaluate(
  testSamples: TrainingSample[],
  models: tf.Sequential[],
  onProgress: (progress: TrainingProgress) => void,
): Promise<{
  testAccuracy: number;
  testPrecision: number;
  testRecall: number;
  testF1: number;
  confusionMatrix: ConfusionMatrix;
  featureImportance: FeatureImportance[];
  indexBreakdown: Array<{ code: string; name: string; accuracy: number; sampleCount: number }>;
}> {
  onProgress({
    phase: 'evaluating',
    message: `评估测试集（${testSamples.length} 样本）...`,
    progress: 50,
  });

  const testFeatures = samplesToTensor(testSamples);
  const testLabels = labelsToTensor(testSamples);
  const allProbs: number[][] = [];

  for (const model of models) {
    const pred = model.predict(testFeatures) as tf.Tensor;
    allProbs.push(Array.from(pred.dataSync() as Float32Array));
    pred.dispose();
  }

  const trueLabels = Array.from(testLabels.dataSync() as Float32Array);
  const ensembleProbs = allProbs[0].map((_, i) => {
    const sum = allProbs.reduce((s, probs) => s + probs[i], 0);
    return sum / allProbs.length;
  });

  const metrics = calcMetrics(trueLabels, ensembleProbs);

  // 按指数分解
  const indexBreakdown = INDEX_DEFS.map(idx => {
    const idxSamples = testSamples.filter(s => s.indexCode === idx.code);
    if (idxSamples.length === 0) return { code: idx.code, name: idx.name, accuracy: 0, sampleCount: 0 };

    const idxFeatures = samplesToTensor(idxSamples);
    const idxProbs: number[][] = [];
    for (const model of models) {
      const pred = model.predict(idxFeatures) as tf.Tensor;
      idxProbs.push(Array.from(pred.dataSync() as Float32Array));
      pred.dispose();
    }
    idxFeatures.dispose();

    const idxEnsembleProbs = idxProbs[0].map((_, i) => {
      const sum = idxProbs.reduce((s, probs) => s + probs[i], 0);
      return sum / idxProbs.length;
    });
    const idxLabels = idxSamples.map(s => s.label);
    const idxMetrics = calcMetrics(idxLabels, idxEnsembleProbs);

    return {
      code: idx.code,
      name: idx.name,
      accuracy: idxMetrics.accuracy,
      sampleCount: idxSamples.length,
    };
  }).filter(x => x.sampleCount > 0);

  // 特征重要性
  const importance = calcFeatureImportance(
    models[0], testFeatures, testLabels,
    ['涨跌幅', '振幅', '量比', '实体比例', '上影线比例',
      '下影线比例', 'MA5偏离度', 'MA20偏离度', 'MA60偏离度', '成交量变化率',
      'MACD.dif', 'MACD.histogram', 'RSI', 'KDJ.k', 'KDJ.d',
      'BOLL.upper偏离度', 'BOLL.lower偏离度', 'WR',
      '星期几', '连涨/连跌天数', 'ATR波动率', '近5日涨跌幅', '近20日涨跌幅', '成交额变化率',
      'RSI×BOLL下轨', 'MACD×成交量', '涨跌幅×连涨天数', '实体比例×量比', '振幅×ATR', 'RSI×WR',
      '月份_sin', '月份_cos', '季度末',
      '指数_上证指数', '指数_深证成指', '指数_创业板指', '指数_上证50',
      '指数_沪深300', '指数_中证500', '指数_科创50'],
  );

  const topFeatures = importance.slice(0, 20).map((f, i) => ({
    name: f.name,
    importance: f.importance,
    rank: i + 1,
  }));

  testFeatures.dispose();
  testLabels.dispose();

  onProgress({
    phase: 'done',
    message: `测试集准确率: ${(metrics.accuracy * 100).toFixed(1)}%`,
    progress: 100,
  });

  return {
    testAccuracy: metrics.accuracy,
    testPrecision: metrics.precision,
    testRecall: metrics.recall,
    testF1: metrics.f1,
    confusionMatrix: { tp: metrics.tp, fp: metrics.fp, tn: metrics.tn, fn: metrics.fn },
    featureImportance: topFeatures,
    indexBreakdown,
  };
}
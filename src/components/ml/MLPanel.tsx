'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  INDEX_DEFS, FEATURE_NAMES, FEATURE_DIM, ENSEMBLE_CONFIG,
  type TrainingProgress, type TrainingSummary, type PredictionResult,
  type FeatureImportance, type ConfusionMatrix,
} from '@/lib/ml/types';
import { fetchAndPrepareData, timeSeriesSplit } from '@/lib/ml/data-preparation';
import { checkSavedModels, clearAllModels, loadAllEnsembleModels } from '@/lib/ml/model';
import { trainEnsemble, quickEvaluate } from '@/lib/ml/trainer';
import { predictAllIndices, clearModelCache, getModelMetadata } from '@/lib/ml/predictor';
import type { KLineData } from '@/lib/types';
import { MLTrainingProgress } from './MLTrainingProgress';
import { MLFeatureImportance } from './MLFeatureImportance';
import { MLConfusionMatrix } from './MLConfusionMatrix';
import { MLPredictionHistory } from './MLPredictionHistory';
import { MLCurrentPrediction } from './MLCurrentPrediction';

export function MLPanel() {
  // 模型状态
  const [isTrained, setIsTrained] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [trainedModelCount, setTrainedModelCount] = useState(0);
  const [modelMetadata, setModelMetadata] = useState<Record<string, any> | null>(null);

  // 训练进度
  const [progress, setProgress] = useState<TrainingProgress | null>(null);

  // 训练结果
  const [summary, setSummary] = useState<TrainingSummary | null>(null);
  const [testSummary, setTestSummary] = useState<{
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    confusionMatrix: ConfusionMatrix;
    featureImportance: FeatureImportance[];
    indexBreakdown: Array<{ code: string; name: string; accuracy: number; sampleCount: number }>;
  } | null>(null);

  // 预测结果
  const [predictions, setPredictions] = useState<Array<{
    code: string;
    name: string;
    prediction: PredictionResult | null;
  }> | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);

  // 错误信息
  const [error, setError] = useState<string | null>(null);

  // 初始化时检查模型
  useEffect(() => {
    loadModelStatus();
  }, []);

  const loadModelStatus = async () => {
    const status = await checkSavedModels();
    setIsTrained(status.isTrained);
    setTrainedModelCount(status.trainedModelCount);
    if (status.metadata) {
      setModelMetadata(status.metadata);
    }
  };

  // 训练数据获取函数
  const fetchIndexData = useCallback(async (code: string): Promise<KLineData[]> => {
    const res = await fetch(`/api/ml/index-data?code=${code}&limit=1500`);
    if (!res.ok) throw new Error(`获取 ${code} 数据失败`);
    const json = await res.json();
    return json.data || [];
  }, []);

  // 开始训练
  const handleTrain = async () => {
    setIsTraining(true);
    setError(null);
    setSummary(null);
    setTestSummary(null);
    setPredictions(null);
    clearModelCache();

    try {
      // 1. 获取数据
      setProgress({
        phase: 'preparing',
        message: '正在获取所有指数数据...',
        progress: 0,
      });

      const { trainSamples, valSamples, testSamples, totalSamples, indexBreakdown } =
        await fetchAndPrepareData(fetchIndexData);

      if (totalSamples < 100) {
        throw new Error(`数据不足（仅 ${totalSamples} 条），至少需要 100 条`);
      }

      // 2. 训练集成模型
      const { summaries, finalAccuracy } = await trainEnsemble(
        trainSamples, valSamples,
        (p) => setProgress({ ...p }),
      );

      // 3. 加载已训练的模型
      const models = await loadAllEnsembleModels();

      // 4. 测试集评估
      const testResult = await quickEvaluate(testSamples, models, (p) => setProgress({ ...p }));

      setTestSummary({
        accuracy: testResult.testAccuracy,
        precision: testResult.testPrecision,
        recall: testResult.testRecall,
        f1: testResult.testF1,
        confusionMatrix: testResult.confusionMatrix,
        featureImportance: testResult.featureImportance,
        indexBreakdown: testResult.indexBreakdown,
      });

      // 5. 汇总
      setSummary({
        accuracy: testResult.testAccuracy,
        precision: testResult.testPrecision,
        recall: testResult.testRecall,
        f1: testResult.testF1,
        sampleCount: totalSamples,
        totalEpochs: summaries[0]?.totalEpochs || 0,
        trainedAt: new Date().toISOString(),
        featureImportance: testResult.featureImportance,
        confusionMatrix: testResult.confusionMatrix,
        ensembleAccuracy: testResult.testAccuracy,
        ensemblePrecision: testResult.testPrecision,
        ensembleRecall: testResult.testRecall,
        ensembleF1: testResult.testF1,
        indexBreakdown: testResult.indexBreakdown,
      });

      // 6. 更新模型状态
      await loadModelStatus();
      setIsTraining(false);

      // 7. 自动预测
      handlePredict();

    } catch (err: any) {
      setError(err.message || '训练失败');
      setIsTraining(false);
      setProgress({
        phase: 'error',
        message: err.message || '训练失败',
        progress: 0,
      });
    }
  };

  // 清除模型
  const handleClear = async () => {
    await clearAllModels();
    clearModelCache();
    setIsTrained(false);
    setTrainedModelCount(0);
    setModelMetadata(null);
    setSummary(null);
    setTestSummary(null);
    setPredictions(null);
    setError(null);
  };

  // 预测所有指数
  const handlePredict = async () => {
    setIsPredicting(true);
    setError(null);

    try {
      const allData = new Map<string, KLineData[]>();

      // 获取所有指数最新数据
      for (const idx of INDEX_DEFS) {
        const data = await fetchIndexData(idx.code);
        if (data && data.length > 60) {
          allData.set(idx.code, data);
        }
      }

      const results = await predictAllIndices(allData);
      setPredictions(results);
    } catch (err: any) {
      setError(err.message || '预测失败');
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">ML 指数预测模型</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            多指数合并训练 · {ENSEMBLE_CONFIG.numModels} 模型集成 · {FEATURE_DIM} 维特征
          </p>
        </div>
        <div className="flex gap-2">
          {isTrained && (
            <button
              onClick={handleClear}
              disabled={isTraining}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-400 hover:border-red-600 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              清除模型
            </button>
          )}
          <button
            onClick={handleTrain}
            disabled={isTraining}
            className="px-4 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTraining ? '训练中...' : isTrained ? '重新训练' : '开始训练'}
          </button>
        </div>
      </div>

      {/* 模型状态 */}
      {isTrained && !isTraining && (
        <div className="p-3 rounded-lg bg-green-900/20 border border-green-700/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm text-green-400">
                已训练（{trainedModelCount}/{ENSEMBLE_CONFIG.numModels} 模型）
              </span>
            </div>
            {modelMetadata && (
              <span className="text-xs text-gray-500">
                训练时间：{modelMetadata.trainedAt ? new Date(modelMetadata.trainedAt).toLocaleString('zh-CN') : '未知'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 训练进度 */}
      {progress && isTraining && (
        <MLTrainingProgress progress={progress} />
      )}

      {/* 错误信息 */}
      {error && !isTraining && (
        <div className="p-3 rounded-lg bg-red-900/20 border border-red-700/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* 训练完成后的结果 */}
      {summary && !isTraining && (
        <div className="space-y-4">
          {/* 整体准确率 */}
          <div className="grid grid-cols-4 gap-2">
            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50 text-center">
              <div className="text-2xl font-bold text-white">
                {(summary.ensembleAccuracy * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">集成准确率</div>
            </div>
            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50 text-center">
              <div className="text-2xl font-bold text-blue-400">
                {(summary.ensemblePrecision * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">精确率</div>
            </div>
            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50 text-center">
              <div className="text-2xl font-bold text-green-400">
                {(summary.ensembleRecall * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">召回率</div>
            </div>
            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50 text-center">
              <div className="text-2xl font-bold text-purple-400">
                {(summary.ensembleF1 * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">F1 分数</div>
            </div>
          </div>

          {/* 各指数分解 */}
          {testSummary?.indexBreakdown && testSummary.indexBreakdown.length > 0 && (
            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
              <h4 className="text-sm font-medium text-gray-300 mb-3">各指数准确率</h4>
              <div className="grid grid-cols-2 gap-2">
                {testSummary.indexBreakdown.map((idx) => (
                  <div key={idx.code} className="flex items-center justify-between px-2 py-1.5 rounded bg-gray-800/80">
                    <span className="text-xs text-gray-400">{idx.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">({idx.sampleCount} 样本)</span>
                      <span className="text-sm font-semibold text-white">
                        {(idx.accuracy * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 混淆矩阵 */}
          {summary.confusionMatrix && (
            <MLConfusionMatrix matrix={summary.confusionMatrix} />
          )}

          {/* 特征重要性 */}
          {summary.featureImportance.length > 0 && (
            <MLFeatureImportance features={summary.featureImportance} />
          )}

          {/* 数据量 */}
          <div className="text-xs text-gray-500 text-center">
            训练数据：{summary.sampleCount} 条样本 · {summary.totalEpochs} 轮迭代
          </div>
        </div>
      )}

      {/* 预测区域 */}
      {isTrained && !isTraining && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-300">指数预测</h4>
            <button
              onClick={handlePredict}
              disabled={isPredicting}
              className="px-3 py-1 text-xs rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              {isPredicting ? '预测中...' : predictions ? '刷新预测' : '预测全部指数'}
            </button>
          </div>

          {isPredicting && (
            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50 text-center text-sm text-gray-400">
              正在预测...
            </div>
          )}

          {predictions && !isPredicting && (
            <div className="grid grid-cols-2 gap-2">
              {predictions.map((p) => (
                <MLCurrentPrediction
                  key={p.code}
                  indexName={p.name}
                  prediction={p.prediction}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 未训练提示 */}
      {!isTrained && !isTraining && (
        <div className="p-6 rounded-lg bg-gray-800/30 border border-dashed border-gray-700/50 text-center">
          <p className="text-sm text-gray-500 mb-2">
            点击"开始训练"训练多指数混合模型
          </p>
          <p className="text-xs text-gray-600">
            将自动获取 7 个指数数据，训练 {ENSEMBLE_CONFIG.numModels} 个集成模型，覆盖 {FEATURE_DIM} 维特征
          </p>
        </div>
      )}
    </div>
  );
}
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { MLTrainingProgress } from './MLTrainingProgress';
import { MLFeatureImportance } from './MLFeatureImportance';
import { MLConfusionMatrix } from './MLConfusionMatrix';
import { MLPredictionHistory } from './MLPredictionHistory';
import { MLCurrentPrediction } from './MLCurrentPrediction';
import * as tf from '@tensorflow/tfjs';
import { MODEL_NAME } from '@/lib/ml/model';
import type { TrainingProgress, TrainingSummary, IndexDef } from '@/lib/ml/types';

const INDEX_DEFS: IndexDef[] = [
  { code: '000001.SH', name: '上证指数', sampleCount: 0 },
  { code: '399001.SZ', name: '深证成指', sampleCount: 0 },
  { code: '399006.SZ', name: '创业板指', sampleCount: 0 },
];

export function MLPanel() {
  const [models, setModels] = useState<Record<string, { trained: boolean; date: string; accuracy: number; code: string }>>({});
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress | null>(null);
  const [trainingSummary, setTrainingSummary] = useState<TrainingSummary | null>(null);
  const [trainingHistory, setTrainingHistory] = useState<Array<{ epoch: number; loss: number; accuracy: number; valAccuracy: number }>>([]);
  const [selectedIndex, setSelectedIndex] = useState<string>('000001.SH');
  const [currentPrediction, setCurrentPrediction] = useState<{ upProb: number; downProb: number; confidence: '高' | '中' | '低' } | null>(null);
  const [topFeatures, setTopFeatures] = useState<Array<{ name: string; importance: number }>>([]);
  const [loadingPrediction, setLoadingPrediction] = useState<Record<string, boolean>>({});

  // 页面加载时检查已保存的模型
  useEffect(() => {
    (async () => {
      try {
        const modelsList = await tf.io.listModels();
        for (const idx of INDEX_DEFS) {
          const key = `indexeddb://${MODEL_NAME}-${idx.code}`;
          if (modelsList[key]) {
            setModels(prev => ({
              ...prev,
              [idx.code]: {
                trained: true,
                date: modelsList[key].dateSaved
                  ? new Date(modelsList[key].dateSaved!).toLocaleDateString('zh-CN')
                  : '未知',
                accuracy: 0, // 加载时无法获取准确率，但标记已训练
                code: idx.code,
              }
            }));
          }
        }
      } catch {
        // 忽略
      }
    })();
  }, []);

  const startTraining = useCallback(async (indexCode: string, indexName: string) => {
    try {
      setTrainingProgress({ phase: 'preparing', message: '正在获取指数数据...', progress: 0 });
      setTrainingSummary(null);
      setTrainingHistory([]);
      setCurrentPrediction(null);
      setTopFeatures([]);

      // 获取指数历史数据
      const res = await fetch(`/api/ml/index-data?code=${indexCode}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.error || '获取数据失败');
      const klineData = result.data;

      // 动态导入 ML 模块
      const { trainModel } = await import('@/lib/ml/trainer');

      const config = { epochs: 50, batchSize: 32, learningRate: 0.001, indexCode, indexName };
      const summary = await trainModel(
        klineData,
        config,
        (progress: TrainingProgress) => {
          setTrainingProgress(progress);
          if (progress.history) {
            setTrainingHistory(progress.history);
          }
        }
      );

      setTrainingSummary(summary);
      setModels(prev => ({
        ...prev,
        [indexCode]: { trained: true, date: new Date().toLocaleDateString(), accuracy: summary.accuracy, code: indexCode }
      }));

      // 设置特征重要性
      const features = summary.featureImportance
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 10)
        .map(f => ({ name: f.name, importance: f.importance }));
      setTopFeatures(features);

      // 训练完成后自动预测
      try {
        const { predictNextDay } = await import('@/lib/ml/predictor');
        const { getAllIndicators } = await import('@/lib/analysis');
        const indicators = getAllIndicators(klineData);
        const prediction = await predictNextDay(klineData, indicators, `${MODEL_NAME}-${indexCode}`);
        setCurrentPrediction(prediction);
      } catch {
        // 预测失败不影响训练结果
      }

    } catch (err) {
      console.error('Training failed:', err);
      setTrainingProgress({
        phase: 'error',
        message: `训练失败: ${err instanceof Error ? err.message : '未知错误'}`,
        progress: 0
      });
    }
  }, []);

  const handleTrainAll = useCallback(async () => {
    for (const idx of INDEX_DEFS) {
      setSelectedIndex(idx.code);
      await startTraining(idx.code, idx.name);
    }
  }, [startTraining]);

  // 加载已保存模型进行预测（无需重新训练）
  const loadAndPredict = useCallback(async (indexCode: string, indexName: string) => {
    if (loadingPrediction[indexCode]) return;
    try {
      setLoadingPrediction(prev => ({ ...prev, [indexCode]: true }));
      setSelectedIndex(indexCode);
      setTrainingSummary(null);
      setCurrentPrediction(null);
      setTopFeatures([]);

      setTrainingProgress({ phase: 'preparing', message: '正在获取指数数据...', progress: 10 });

      // 获取最新数据做预测
      const res = await fetch(`/api/ml/index-data?code=${indexCode}&limit=120`);
      const result = await res.json();
      if (!result.success) throw new Error(result.error || '获取数据失败');
      const klineData = result.data;

      setTrainingProgress({ phase: 'preparing', message: '正在加载已保存模型...', progress: 50 });

      const { predictNextDay } = await import('@/lib/ml/predictor');
      const { getAllIndicators } = await import('@/lib/analysis');
      const indicators = getAllIndicators(klineData);
      const prediction = await predictNextDay(klineData, indicators, `${MODEL_NAME}-${indexCode}`);

      if (!prediction) {
        throw new Error('模型版本不兼容，请点击「重新训练」更新模型（旧模型为18维，新模型为24维特征）');
      }
      setCurrentPrediction(prediction);
      setTrainingProgress({ phase: 'done', message: '预测完成！', progress: 100 });
    } catch (err) {
      setTrainingProgress({
        phase: 'error',
        message: `预测失败: ${err instanceof Error ? err.message : '未知错误'}`,
        progress: 0,
      });
    } finally {
      setLoadingPrediction(prev => ({ ...prev, [indexCode]: false }));
    }
  }, [loadingPrediction]);

  return (
    <div className="space-y-4">
      {/* 模型列表 */}
      <div className="text-xs text-gray-400 font-medium mb-2">模型列表</div>
      {INDEX_DEFS.map(idx => {
        const model = models[idx.code];
        return (
          <div key={idx.code} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm font-medium text-gray-200">{idx.name}</span>
                <span className="text-xs text-gray-500 ml-2">{idx.code}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${model ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                {model ? '✅ 已训练' : '🟡 待训练'}
              </span>
            </div>
            {model && (
              <div className="text-xs text-gray-400 space-y-1">
                <div>训练日期：{model.date}</div>
                <div>准确率：<span className="text-green-400 font-mono">{(model.accuracy * 100).toFixed(1)}%</span></div>
              </div>
            )}
            <div className="flex gap-2 mt-2">
              {!model ? (
                <button
                  onClick={() => { setSelectedIndex(idx.code); startTraining(idx.code, idx.name); }}
                  disabled={trainingProgress?.phase === 'training'}
                  className="text-xs px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
                >
                  {trainingProgress?.phase === 'training' && selectedIndex === idx.code ? '训练中...' : '开始训练'}
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => loadAndPredict(idx.code, idx.name)}
                    disabled={loadingPrediction[idx.code]}
                    className="text-xs px-3 py-1.5 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 disabled:opacity-50 transition-colors"
                  >
                    {loadingPrediction[idx.code] ? '预测中...' : '预测'}
                  </button>
                  <button
                    onClick={() => { setSelectedIndex(idx.code); startTraining(idx.code, idx.name); }}
                    disabled={trainingProgress?.phase === 'training'}
                    className="text-xs px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
                  >
                    重新训练
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* 全部训练按钮 */}
      <button
        onClick={handleTrainAll}
        disabled={trainingProgress?.phase === 'training'}
        className="w-full text-xs px-3 py-2 bg-indigo-500/20 text-indigo-400 rounded hover:bg-indigo-500/30 disabled:opacity-50 transition-colors"
      >
        {trainingProgress?.phase === 'training' ? '训练中...' : '训练全部指数模型'}
      </button>

      {/* 训练进度 */}
      {trainingProgress && trainingProgress.phase !== 'done' && trainingProgress.phase !== 'error' && (
        <MLTrainingProgress
          currentEpoch={trainingProgress.epoch ?? 0}
          totalEpochs={trainingProgress.totalEpochs ?? 50}
          history={trainingHistory}
        />
      )}

      {/* 错误提示 */}
      {trainingProgress?.phase === 'error' && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400">
          {trainingProgress.message}
        </div>
      )}

      {/* 训练完成后的结果 */}
      {trainingSummary && (
        <>
          {/* 特征重要性 */}
          {topFeatures.length > 0 && (
            <MLFeatureImportance
              features={topFeatures}
              baselineAccuracy={trainingSummary.accuracy}
            />
          )}

          {/* 混淆矩阵 */}
          <MLConfusionMatrix
            matrix={{
              truePos: trainingSummary.confusionMatrix?.tp ?? 0,
              falsePos: trainingSummary.confusionMatrix?.fp ?? 0,
              falseNeg: trainingSummary.confusionMatrix?.fn ?? 0,
              trueNeg: trainingSummary.confusionMatrix?.tn ?? 0,
            }}
            total={trainingSummary.sampleCount}
          />

          {/* 预测历史 */}
          {trainingHistory.length > 0 && (
            <MLPredictionHistory
              predictions={trainingHistory.map(h => ({
                date: `第${h.epoch}轮`,
                actual: h.valAccuracy,
                predicted: h.accuracy,
                confidence: 0.7
              }))}
            />
          )}

          </>
      )}

      {/* 当前预测（独立于 trainingSummary，训练后和预测后都显示） */}
      {currentPrediction && (
        <MLCurrentPrediction
          indexName={INDEX_DEFS.find(i => i.code === selectedIndex)?.name || '上证指数'}
          upProb={currentPrediction.upProb}
          downProb={currentPrediction.downProb}
          confidence={currentPrediction.confidence}
          topFeatures={topFeatures.slice(0, 3).map(f => ({ name: f.name, value: f.importance }))}
        />
      )}
    </div>
  );
}
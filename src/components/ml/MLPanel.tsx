'use client';

import { useState, useCallback } from 'react';
import { INDEX_DEFS, FEATURE_NAMES, type ConfusionMatrix, type FeatureImportance, type TrainingProgress } from '@/lib/ml/types';
import { MLFeatureImportance } from './MLFeatureImportance';
import { MLConfusionMatrix } from './MLConfusionMatrix';
import { MLPredictionHistory } from './MLPredictionHistory';
import { MLCurrentPrediction } from './MLCurrentPrediction';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface TrainApiResponse {
  success: boolean;
  error?: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  confusionMatrix: ConfusionMatrix;
  featureImportance: number[];
  indexBreakdown: Array<{
    code: string;
    name: string;
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    samples: number;
  }>;
  predictionHistory: Array<{
    upProb: number;
    actual: number;
    correct: boolean;
    date: string;
  }>;
  currentPredictions: Record<string, {
    upProb: number;
    confidence: number;
  }>;
  totalSamples: number;
}

const metricItems = [
  { key: 'accuracy', label: '综合准确率', getValue: (s: any) => `${(s.accuracy * 100).toFixed(1)}%`, getColor: (s: any) => s.accuracy >= 0.5 ? 'text-emerald-400' : 'text-rose-400' },
  { key: 'precision', label: '精确率', getValue: (s: any) => `${(s.ensemblePrecision * 100).toFixed(1)}%`, getColor: (s: any) => s.ensemblePrecision >= 0.5 ? 'text-emerald-400' : 'text-rose-400' },
  { key: 'recall', label: '召回率', getValue: (s: any) => `${(s.ensembleRecall * 100).toFixed(1)}%`, getColor: (s: any) => s.ensembleRecall >= 0.5 ? 'text-emerald-400' : 'text-rose-400' },
  { key: 'f1', label: 'F1 分数', getValue: (s: any) => `${(s.ensembleF1 * 100).toFixed(1)}%`, getColor: (s: any) => s.ensembleF1 >= 0.5 ? 'text-emerald-400' : 'text-rose-400' },
  { key: 'samples', label: '训练样本', getValue: (s: any) => s.sampleCount.toLocaleString(), getColor: () => 'text-blue-400' },
];

export function MLPanel() {
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress | null>(null);
  const [summary, setSummary] = useState<{
    accuracy: number;
    ensembleAccuracy: number;
    ensemblePrecision: number;
    ensembleRecall: number;
    ensembleF1: number;
    confusionMatrix: ConfusionMatrix;
    featureImportance: FeatureImportance[];
    indexBreakdown: Array<{
      code: string;
      name: string;
      accuracy: number;
      sampleCount: number;
    }>;
    sampleCount: number;
    totalEpochs: number;
    trainedAt: string;
  } | null>(null);
  const [predictions, setPredictions] = useState<Array<{
    code: string;
    name: string;
    upProb: number;
    confidence: number;
  }> | null>(null);
  const [predictionHistory, setPredictionHistory] = useState<Array<{
    upProb: number;
    actual: number;
    correct: boolean;
    date: string;
  }> | null>(null);
  const [training, setTraining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTrain = useCallback(async () => {
    setTraining(true);
    setError(null);
    setSummary(null);
    setPredictions(null);
    setPredictionHistory(null);

    try {
      setTrainingProgress({ phase: 'preparing', message: '正在请求服务器训练（获取数据 → 计算特征 → 训练模型）...', progress: 10 });

      const response = await fetch('/api/ml/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          n_estimators: 100,
          max_depth: null,
          min_samples_leaf: 5,
        }),
      });

      setTrainingProgress({ phase: 'preparing', message: '正在等待服务器训练结果...', progress: 50 });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`服务器训练失败: ${errText}`);
      }

      setTrainingProgress({ phase: 'evaluating', message: '正在解析训练结果...', progress: 90 });

      const result: TrainApiResponse = await response.json();

      if (!result.success) {
        throw new Error(`训练失败: ${result.error}`);
      }

      const fi = FEATURE_NAMES.map((name, i) => ({
        name,
        importance: result.featureImportance[i] || 0,
        rank: i + 1,
      } as FeatureImportance)).sort((a, b) => b.importance - a.importance);

      setSummary({
        accuracy: result.accuracy,
        ensembleAccuracy: result.accuracy,
        ensemblePrecision: result.precision,
        ensembleRecall: result.recall,
        ensembleF1: result.f1,
        confusionMatrix: result.confusionMatrix,
        featureImportance: fi,
        indexBreakdown: result.indexBreakdown.map(ib => ({
          code: ib.code,
          name: ib.name,
          accuracy: ib.accuracy,
          sampleCount: ib.samples,
        })),
        sampleCount: result.totalSamples,
        totalEpochs: 0,
        trainedAt: new Date().toISOString(),
      });

      setPredictionHistory(result.predictionHistory);

      const predArray = INDEX_DEFS
        .filter(idx => result.currentPredictions[idx.code])
        .map(idx => ({
          code: idx.code,
          name: idx.name,
          upProb: result.currentPredictions[idx.code].upProb,
          confidence: result.currentPredictions[idx.code].confidence,
        }));
      setPredictions(predArray);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '训练失败';
      setError(msg);
      console.error('[ML Panel] 训练失败:', err);
    } finally {
      setTraining(false);
      setTrainingProgress(null);
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* 训练按钮 */}
      <Card className="border border-white/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">A股指数方向预测</h3>
              <p className="text-sm text-gray-400 mt-1">
                基于 RandomForest 机器学习模型，预测次日涨跌方向
              </p>
            </div>
            <Button
              onClick={handleTrain}
              disabled={training}
              size="lg"
              className={training
                ? 'bg-blue-600/50 cursor-wait'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/20'
              }
            >
              {training ? '训练中...' : '开始训练'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 训练进度 */}
      {trainingProgress && (
        <Card className="border-blue-500/20 bg-blue-950/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-sm">
              {trainingProgress.phase !== 'done' && trainingProgress.phase !== 'error' && (
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
              )}
              <span className={
                trainingProgress.phase === 'error' ? 'text-red-400' :
                trainingProgress.phase === 'done' ? 'text-green-400' :
                'text-blue-300'
              }>
                {trainingProgress.message}
              </span>
              {trainingProgress.progress !== undefined && trainingProgress.progress > 0 && (
                <span className="text-gray-500 ml-auto font-mono">{trainingProgress.progress}%</span>
              )}
            </div>
            {trainingProgress.progress !== undefined && trainingProgress.progress > 0 && (
              <div className="mt-3 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${trainingProgress.progress}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 错误信息 */}
      {error && (
        <Card className="border-red-500/30 bg-red-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <span className="text-red-400 mt-0.5 shrink-0">⚠</span>
              <p className="text-red-300 text-sm leading-relaxed">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 训练结果 */}
      {summary && (
        <>
          {/* 综合指标 */}
          <Card className="border border-white/5 bg-gradient-to-br from-gray-900/80 to-gray-950/80">
            <CardContent className="pt-6">
              <div className="flex flex-wrap justify-center gap-x-10 gap-y-4">
                {metricItems.map(item => {
                  const color = item.getColor(summary);
                  const value = item.getValue(summary);
                  return (
                    <div key={item.key} className="text-center min-w-[80px]">
                      <p className={`text-2xl font-bold ${color} font-mono tabular-nums`}>{value}</p>
                      <p className="text-xs text-gray-500 whitespace-nowrap mt-1">{item.label}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 各指数准确率 */}
          <Card className="border border-white/5">
            <CardContent className="pt-6">
              <h4 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500 rounded-full" />
                各指数准确率
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {summary.indexBreakdown.map((idx) => {
                  const accColor = idx.accuracy >= 0.5 ? 'text-emerald-400' : 'text-rose-400';
                  const accBg = idx.accuracy >= 0.5 ? 'bg-emerald-500/5' : 'bg-rose-500/5';
                  return (
                    <div key={idx.code} className={`text-center p-3 rounded-lg border border-white/5 ${accBg}`}>
                      <p className="text-xs text-gray-400 mb-1">{idx.name}</p>
                      <p className={`text-lg font-bold font-mono tabular-nums ${accColor}`}>
                        {(idx.accuracy * 100).toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{idx.sampleCount} 样本</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 当前预测 */}
          {predictions && predictions.length > 0 && (
            <Card className="border border-white/5">
              <CardContent className="pt-6">
                <h4 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-amber-500 rounded-full" />
                  次日预测
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {predictions.map((p) => (
                    <MLCurrentPrediction
                      key={p.code}
                      indexName={p.name}
                      upProb={p.upProb}
                      confidence={p.confidence}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 特征重要性 */}
          <MLFeatureImportance
            features={summary.featureImportance}
          />

          {/* 混淆矩阵 */}
          <MLConfusionMatrix
            matrix={summary.confusionMatrix}
          />

          {/* 预测历史 */}
          {predictionHistory && predictionHistory.length > 0 && (
            <MLPredictionHistory
              predictions={predictionHistory}
            />
          )}
        </>
      )}
    </div>
  );
}
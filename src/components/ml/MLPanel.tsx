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

      // 发送训练请求（服务器直接从 Tushare 获取数据并计算特征）
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

      // 3. 构建特征重要性（带名称和排序）
      const fi = FEATURE_NAMES.map((name, i) => ({
        name,
        importance: result.featureImportance[i] || 0,
        rank: i + 1,
      } as FeatureImportance)).sort((a, b) => b.importance - a.importance);

      // 4. 设置结果
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

      // 5. 设置预测历史（测试集上的预测结果）
      setPredictionHistory(result.predictionHistory);

      // 6. 设置当前预测
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
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">A股指数方向预测</h3>
              <p className="text-sm text-muted-foreground mt-1">
                基于 RandomForest 机器学习模型，预测次日涨跌方向
              </p>
            </div>
            <Button
              onClick={handleTrain}
              disabled={training}
              size="lg"
            >
              {training ? '训练中...' : '开始训练'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 训练进度 */}
      {trainingProgress && (
        <Card className="border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm">
              {trainingProgress.phase !== 'done' && trainingProgress.phase !== 'error' && (
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              )}
              <span className={
                trainingProgress.phase === 'error' ? 'text-red-400' :
                trainingProgress.phase === 'done' ? 'text-green-400' :
                'text-blue-400'
              }>
                {trainingProgress.message}
              </span>
              {trainingProgress.progress !== undefined && trainingProgress.progress > 0 && (
                <span className="text-gray-400 ml-2">{trainingProgress.progress}%</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 错误信息 */}
      {error && (
        <Card className="border-red-500">
          <CardContent className="pt-6">
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* 训练结果 */}
      {summary && (
        <>
          {/* 综合准确率 */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{(summary.accuracy * 100).toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">综合准确率</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{(summary.ensemblePrecision * 100).toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">精确率</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{(summary.ensembleRecall * 100).toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">召回率</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{(summary.ensembleF1 * 100).toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">F1 分数</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{summary.sampleCount}</p>
                  <p className="text-xs text-muted-foreground">训练样本</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 各指数准确率 */}
          <Card>
            <CardContent className="pt-6">
              <h4 className="text-sm font-medium mb-3">各指数准确率</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {summary.indexBreakdown.map((idx) => (
                  <div key={idx.code} className="text-center p-2 rounded bg-muted/50">
                    <p className="text-xs text-muted-foreground">{idx.name}</p>
                    <p className="text-lg font-bold">{(idx.accuracy * 100).toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">{idx.sampleCount} 样本</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 当前预测 */}
          {predictions && predictions.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h4 className="text-sm font-medium mb-3">次日预测</h4>
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
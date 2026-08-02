/** 指数定义 */
export interface IndexDef {
  code: string;
  name: string;
  sampleCount: number;
}

/** 特征提取结果 */
export interface TrainingSample {
  features: number[];
  label: number;
}

/** 特征名称 */
export const FEATURE_NAMES: string[] = [
  '涨跌幅', '振幅', '量比', '实体比例', '上影线比例',
  '下影线比例', 'MA5偏离度', 'MA20偏离度', 'MA60偏离度', '成交量变化率',
  'MACD.dif', 'MACD.histogram', 'RSI', 'KDJ.k', 'KDJ.d',
  'BOLL.upper偏离度', 'BOLL.lower偏离度', 'WR',
];

/** 训练进度 */
export interface TrainingProgress {
  phase: 'preparing' | 'training' | 'evaluating' | 'done' | 'error';
  message: string;
  progress: number; // 0-100
  epoch?: number;
  totalEpochs?: number;
  loss?: number;
  accuracy?: number;
  valAccuracy?: number;
  history?: Array<{ epoch: number; loss: number; accuracy: number; valAccuracy: number }>;
}

/** 模型状态 */
export type ModelStatus = 'untrained' | 'training' | 'ready' | 'error';

/** 模型信息 */
export interface ModelInfo {
  isTrained: boolean;
  trainedAt: string | null;
  accuracy: number | null;
  sampleCount: number | null;
  modelSize: number | null;
  status: ModelStatus;
}

/** 预测结果 */
export interface PredictionResult {
  upProb: number;
  downProb: number;
  confidence: '高' | '中' | '低';
  direction: 'up' | 'down';
  recentAccuracy?: number;
  featureValues: number[];
}

/** 单个预测历史 */
export interface PredictionHistoryItem {
  date: string;
  upProb: number;
  actual: number;
  correct: boolean;
}

/** 混淆矩阵 */
export interface ConfusionMatrix {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

/** 评估指标 */
export interface EvaluationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  specificity: number;
  f1: number;
  totalSamples: number;
  correctPredictions: number;
  wrongPredictions: number;
}

/** 特征重要性 */
export interface FeatureImportance {
  name: string;
  importance: number;
  rank: number;
}

/** 置信度分布 */
export interface ConfidenceDistribution {
  high: { correct: number; wrong: number };
  medium: { correct: number; wrong: number };
  low: { correct: number; wrong: number };
}

/** 模型训练配置 */
export interface TrainingConfig {
  indexCode: string;
  indexName: string;
  epochs: number;
  batchSize: number;
  learningRate: number;
}

/** 训练结果摘要 */
export interface TrainingSummary {
  indexCode: string;
  indexName: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  sampleCount: number;
  totalEpochs: number;
  trainedAt: string;
  featureImportance: FeatureImportance[];
  confusionMatrix: ConfusionMatrix;
}
/** 指数定义 */
export interface IndexDef {
  code: string;
  name: string;
  group: number; // 指数分组, 用于 one-hot 编码
}

/** 7 个指数定义 */
export const INDEX_DEFS: IndexDef[] = [
  { code: '000001.SH', name: '上证指数', group: 0 },
  { code: '399001.SZ', name: '深证成指', group: 1 },
  { code: '399006.SZ', name: '创业板指', group: 2 },
  { code: '000016.SH', name: '上证50', group: 3 },
  { code: '000300.SH', name: '沪深300', group: 4 },
  { code: '000905.SH', name: '中证500', group: 5 },
  { code: '000688.SH', name: '科创50', group: 6 },
];

/** 当前特征维度 */
export const FEATURE_DIM = 40;

/** 特征名称（40维） */
export const FEATURE_NAMES: string[] = [
  // ===== 基础技术特征（24维，保持向后兼容） =====
  '涨跌幅', '振幅', '量比', '实体比例', '上影线比例',
  '下影线比例', 'MA5偏离度', 'MA20偏离度', 'MA60偏离度', '成交量变化率',
  'MACD.dif', 'MACD.histogram', 'RSI', 'KDJ.k', 'KDJ.d',
  'BOLL.upper偏离度', 'BOLL.lower偏离度', 'WR',
  '星期几', '连涨/连跌天数', 'ATR波动率', '近5日涨跌幅', '近20日涨跌幅', '成交额变化率',
  // ===== 交互特征（6维） =====
  'RSI×BOLL下轨',       // RSI超卖 + 触及下轨 = 强反弹信号
  'MACD×成交量',        // 金叉/死叉 + 放量 = 确认信号
  '涨跌幅×连涨天数',    // 趋势强度
  '实体比例×量比',      // 实体大 + 放量 = 确认走势
  '振幅×ATR',           // 波动爆发
  'RSI×WR',             // 双重超买/超卖确认
  // ===== 时间特征（3维） =====
  '月份_sin', '月份_cos', '季度末',
  // ===== 指数编码 one-hot（7维） =====
  '指数_上证指数', '指数_深证成指', '指数_创业板指', '指数_上证50',
  '指数_沪深300', '指数_中证500', '指数_科创50',
];

/** 集成模型配置 */
export const ENSEMBLE_CONFIG = {
  numModels: 5,            // 集成 5 个模型
  seeds: [42, 123, 256, 789, 1024],  // 不同初始种子
  threshold: 0.55,         // 预测阈值（>0.55 才输出预测，否则返回"低置信度"）
};

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
  modelIndex?: number; // 集成模型索引 (0-4)
  currentModel?: number; // 当前训练第几个模型
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
  featureValues: number[];
  ensembleProbs?: number[]; // 5个模型的预测概率
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

/** 模型训练配置 */
export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  learningRate: number;
}

/** 默认训练配置 */
export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  epochs: 80,
  batchSize: 64,
  learningRate: 0.001,
};

/** 训练结果摘要 */
export interface TrainingSummary {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  sampleCount: number;
  totalEpochs: number;
  trainedAt: string;
  featureImportance: FeatureImportance[];
  confusionMatrix: ConfusionMatrix;
  ensembleAccuracy: number; // 集成后的准确率
  ensemblePrecision: number;
  ensembleRecall: number;
  ensembleF1: number;
  indexBreakdown: Array<{
    code: string;
    name: string;
    accuracy: number;
    sampleCount: number;
  }>;
}

/** 训练样本（带指数编码） */
export interface TrainingSample {
  features: number[];     // 33维特征（不含指数编码）
  indexCode: string;       // 所属指数代码
  label: number;           // 0 或 1
  date: string;            // 日期
}

/** 时间序列切分配置 */
export interface TimeSeriesSplitConfig {
  trainRatio: number;
  valRatio: number;
  testRatio: number;
}

export const DEFAULT_SPLIT_CONFIG: TimeSeriesSplitConfig = {
  trainRatio: 0.7,
  valRatio: 0.15,
  testRatio: 0.15,
};
// 多因子分析系统类型定义（方案C v2.2）

// ============ 大盘情绪因子 ============

/** 情绪因子编号 */
export type SentimentFactorKey = 'M1' | 'M2' | 'M3' | 'M4' | 'M5';

/** 情绪因子原始数据（来自李富贵推送） */
export interface SentimentRawData {
  /** M1 两市成交额（亿） */
  total_volume?: number;
  /** M1 成交额变化率（%） */
  volume_change_pct?: number;
  /** M2 换手率（%） */
  turnover_rate?: number;
  /** M2 换手率变化率（%） */
  turnover_change_pct?: number;
  /** M3 涨停数 */
  limit_up_count?: number;
  /** M3 涨停数变化率（%） */
  limit_up_change_pct?: number;
  /** M4 跌停数 */
  limit_down_count?: number;
  /** M4 跌停数变化率（%） */
  limit_down_change_pct?: number;
  /** M5 融资余额（亿） */
  margin_balance?: number;
  /** M5 融资余额变化率（%） */
  margin_change_pct?: number;
}

/** 单个情绪因子评分结果 */
export interface SentimentFactorScore {
  key: SentimentFactorKey;
  name: string;
  /** 绝对值水位分（-5 ~ +5） */
  levelScore: number;
  /** 变化率趋势分（-5 ~ +5） */
  trendScore: number;
  /** 综合分 = 水位×0.6 + 趋势×0.4 */
  score: number;
  /** 原始值 */
  rawValue?: number;
  /** 变化率 */
  changePct?: number;
  /** 字段缺失，因子不参与总分平均 */
  unavailable?: boolean;
}

/** 大盘情绪评分结果 */
export interface SentimentResult {
  /** 各因子评分 */
  factors: SentimentFactorScore[];
  /** 综合情绪评分（-5 ~ +5） */
  totalScore: number;
  /** 热度等级文字 */
  heatLevel: string;
}

// ============ 个股因子 ============

/** 个股因子编号 */
export type StockFactorKey = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7';

/** 因子元信息 */
export interface FactorMeta {
  key: StockFactorKey;
  name: string;
  defaultWeight: number;
}

/** 因子库清单 */
export const FACTOR_LIBRARY: FactorMeta[] = [
  { key: 'S1', name: '估值分位', defaultWeight: 25 },
  { key: 'S2', name: '均线位置', defaultWeight: 25 },
  { key: 'S3', name: 'MACD', defaultWeight: 20 },
  { key: 'S4', name: 'RSI', defaultWeight: 15 },
  { key: 'S5', name: '量价关系', defaultWeight: 15 },
  { key: 'S6', name: '缠论因子', defaultWeight: 0 },
  { key: 'S7', name: '波浪因子', defaultWeight: 0 },
];

/** 单个因子评分 */
export interface StockFactorScore {
  key: StockFactorKey;
  name: string;
  score: number;
  weight: number;
  weightedScore: number;
  detail: string;
}

/** 个股综合评分结果 */
export interface StockFactorResult {
  factors: StockFactorScore[];
  /** 综合评分（-5 ~ +5） */
  totalScore: number;
  /** 信号强度文字 */
  signalStrength: string;
}

// ============ 仓位计算 ============

/** 情绪应对模式 */
export type SentimentMode = 'contrarian' | 'trend_follow' | 'neutral';

/** 仓位计算结果 */
export interface PositionResult {
  /** 综合评分 */
  compositeScore: number;
  /** 基础仓位（%） */
  basePosition: number;
  /** 大盘情绪评分 */
  sentimentScore: number;
  /** 情绪应对模式 */
  sentimentMode: SentimentMode;
  /** 修正系数 */
  correctionFactor: number;
  /** 最终仓位（%） */
  finalPosition: number;
}

/** 策略多因子配置 */
export interface StrategyFactorConfig {
  /** 策略名称 */
  name: string;
  /** 选中的因子及权重 */
  factors: { key: StockFactorKey; weight: number }[];
  /** 情绪应对模式 */
  sentimentMode: SentimentMode;
}

// ============ 评分常量 ============

/** 评分含义映射 */
export const SCORE_LABELS: Record<number, string> = {
  5: '极度看多',
  4: '强烈看多',
  3: '偏多',
  2: '温和看多',
  1: '略偏多',
  0: '中性',
  [-1]: '略偏空',
  [-2]: '温和看空',
  [-3]: '偏空',
  [-4]: '强烈看空',
  [-5]: '极度看空',
};

/** 情绪热度等级映射 */
export const HEAT_LABELS: Record<number, string> = {
  5: '极度狂热',
  4: '强烈过热',
  3: '过热',
  2: '偏热',
  1: '温和偏热',
  0: '中性',
  [-1]: '温和偏冷',
  [-2]: '偏冷',
  [-3]: '冷淡',
  [-4]: '强烈冷淡',
  [-5]: '极度冰点',
};

/** 情绪应对模式说明 */
export const SENTIMENT_MODE_INFO: Record<SentimentMode, { label: string; desc: string; overheat: string; cold: string }> = {
  contrarian: {
    label: '逆向',
    desc: '大盘过热时减仓（不追高），大盘冷淡时加仓（别人恐慌我贪婪）',
    overheat: '减仓',
    cold: '加仓',
  },
  trend_follow: {
    label: '顺势',
    desc: '大盘过热时减仓（不追高），大盘冷淡时减仓（不接飞刀）',
    overheat: '减仓',
    cold: '减仓',
  },
  neutral: {
    label: '中性',
    desc: '不做情绪修正，纯基本面策略',
    overheat: '不修正',
    cold: '不修正',
  },
};

// 概率统计系统类型定义

import type { KLineData } from '../types';

// ========== 模式标签 ==========

/** 开盘模式 */
export type OpenPattern = '高开高走' | '高开低走' | '低开高走' | '低开低走' | '平开震荡';

/** 盘中形态 */
export type IntradayPattern = '超跌反弹' | '冲高回落' | '横盘震荡' | '趋势延续' | '探底回升' | '放量突破';

/** K线形态 */
export type CandlestickPattern = '大阳线' | '大阴线' | '长上影' | '长下影' | '十字星' | '锤子线' | '吞没形态' | '普通K线';

// ========== 技术指标事件 ==========

/** 单因子事件 */
export type SingleFactorEvent =
  | 'MACD金叉'
  | 'MACD死叉'
  | 'RSI超卖'
  | 'RSI超买'
  | 'KDJ金叉'
  | 'KDJ死叉'
  | '布林带下轨突破'
  | '布林带上轨突破'
  | 'MA5上穿MA20'
  | 'MA5下穿MA20'
  | '成交量放大'
  | '成交量萎缩'
  | '缠论一买'
  | '缠论一卖'
  | '缠论二买'
  | '缠论二卖'
  | '缠论三买'
  | '缠论三卖';

/** 组合事件 */
export type CombinedEvent =
  | 'MACD金叉+RSI超卖'
  | 'MACD死叉+RSI超买'
  | '放量突破+MACD金叉'
  | '缩量回调+RSI超卖'
  | '连续下跌+RSI超卖'
  | '连续上涨+RSI超买'
  | '布林带收窄+成交量萎缩';

/** 所有事件类型 */
export type TechnicalEvent = SingleFactorEvent | CombinedEvent;

// ========== 标注数据 ==========

/** 单根K线的完整标注 */
export interface AnnotatedKLine {
  index: number;
  kline: KLineData;
  openPattern: OpenPattern;
  intradayPattern: IntradayPattern;
  candlestickPattern: CandlestickPattern;
  events: TechnicalEvent[];
  /** 次日涨跌 */
  nextDayChange?: number;
  /** 次日涨跌方向 */
  nextDayDirection?: 'up' | 'down' | 'flat';
  /** 未来N天最大涨幅 */
  futureMaxGain?: Record<number, number>;
  /** 未来N天最大跌幅 */
  futureMaxLoss?: Record<number, number>;
}

// ========== 概率统计 ==========

/** 单条件概率结果 */
export interface ConditionalProbability {
  condition: TechnicalEvent;
  sampleSize: number;
  probabilities: {
    [key in OpenPattern | IntradayPattern]?: number;
  };
  /** 次日上涨概率 */
  nextDayUpProb: number;
  /** 次日平均涨跌幅 */
  nextDayAvgChange: number;
}

/** 多条件组合概率结果 */
export interface CombinedProbability {
  conditions: TechnicalEvent[];
  sampleSize: number;
  nextDayUpProb: number;
  nextDayAvgChange: number;
  /** 3天内上涨概率 */
  threeDayUpProb: number;
  /** 5天内上涨概率 */
  fiveDayUpProb: number;
}

/** 因子有效性评估 */
export interface FactorEffectiveness {
  factor: TechnicalEvent;
  sampleSize: number;
  /** 次日上涨胜率 */
  winRate: number;
  /** 平均收益率 */
  avgReturn: number;
  /** 盈亏比 */
  profitLossRatio: number;
  /** 最大连续盈利次数 */
  maxConsecutiveWins: number;
  /** 最大连续亏损次数 */
  maxConsecutiveLosses: number;
}

/** 概率统计结果汇总 */
export interface ProbabilitySummary {
  /** 开盘模式分布 */
  openPatternDistribution: Record<OpenPattern, number>;
  /** 盘中形态分布 */
  intradayPatternDistribution: Record<IntradayPattern, number>;
  /** K线形态分布 */
  candlestickPatternDistribution: Record<CandlestickPattern, number>;
  /** 各因子有效性排行 */
  factorRanking: FactorEffectiveness[];
  /** 最优组合TOP10 */
  topCombinations: CombinedProbability[];
  /** 总样本数 */
  totalSamples: number;
}

// ========== UI状态 ==========

/** 概率面板筛选条件 */
export interface ProbabilityFilter {
  selectedFactors: TechnicalEvent[];
  matchMode: 'AND' | 'OR';
  /** 统计周期（天数） */
  period: number;
}

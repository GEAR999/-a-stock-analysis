// 大盘情绪因子评分引擎（M1-M5，11档）
// 每个因子：绝对值定水位 × 0.6 + 变化率定趋势 × 0.4

import type {
  SentimentFactorKey,
  SentimentFactorScore,
  SentimentRawData,
  SentimentResult,
  HEAT_LABELS,
} from './types';

// ============ 水位阈值表 ============

interface LevelThreshold {
  min: number;
  max: number;
  score: number;
}

function findLevelScore(value: number, thresholds: LevelThreshold[]): number {
  for (const t of thresholds) {
    if (value >= t.min && value < t.max) return t.score;
  }
  // 超出最高阈值
  if (thresholds.length > 0 && value >= thresholds[0].min && thresholds[0].score === 5) return 5;
  // 低于最低阈值
  if (thresholds.length > 0 && value < thresholds[thresholds.length - 1].min) {
    return thresholds[thresholds.length - 1].score;
  }
  return 0;
}

/** M1 大盘成交量水位（亿元） */
const VOLUME_LEVELS: LevelThreshold[] = [
  { min: 18000, max: Infinity, score: 5 },
  { min: 15000, max: 18000, score: 4 },
  { min: 12000, max: 15000, score: 3 },
  { min: 10000, max: 12000, score: 2 },
  { min: 8000, max: 10000, score: 1 },
  { min: 6000, max: 8000, score: 0 },
  { min: 4500, max: 6000, score: -1 },
  { min: 3000, max: 4500, score: -2 },
  { min: 2000, max: 3000, score: -3 },
  { min: 1000, max: 2000, score: -4 },
  { min: -Infinity, max: 1000, score: -5 },
];

/** M2 换手率水位（%） */
const TURNOVER_LEVELS: LevelThreshold[] = [
  { min: 3.0, max: Infinity, score: 5 },
  { min: 2.5, max: 3.0, score: 4 },
  { min: 2.0, max: 2.5, score: 3 },
  { min: 1.5, max: 2.0, score: 2 },
  { min: 1.2, max: 1.5, score: 1 },
  { min: 0.8, max: 1.2, score: 0 },
  { min: 0.6, max: 0.8, score: -1 },
  { min: 0.4, max: 0.6, score: -2 },
  { min: 0.25, max: 0.4, score: -3 },
  { min: 0.1, max: 0.25, score: -4 },
  { min: -Infinity, max: 0.1, score: -5 },
];

/** M3 涨停数水位 */
const LIMIT_UP_LEVELS: LevelThreshold[] = [
  { min: 150, max: Infinity, score: 5 },
  { min: 120, max: 150, score: 4 },
  { min: 90, max: 120, score: 3 },
  { min: 60, max: 90, score: 2 },
  { min: 40, max: 60, score: 1 },
  { min: 25, max: 40, score: 0 },
  { min: 15, max: 25, score: -1 },
  { min: 8, max: 15, score: -2 },
  { min: 3, max: 8, score: -3 },
  { min: 1, max: 3, score: -4 },
  { min: -Infinity, max: 1, score: -5 },
];

/** M4 跌停数水位（反向指标，跌停越多越冷） */
const LIMIT_DOWN_LEVELS: LevelThreshold[] = [
  { min: 80, max: Infinity, score: -5 },
  { min: 60, max: 80, score: -4 },
  { min: 40, max: 60, score: -3 },
  { min: 25, max: 40, score: -2 },
  { min: 15, max: 25, score: -1 },
  { min: 8, max: 15, score: 0 },
  { min: 4, max: 8, score: 1 },
  { min: 2, max: 4, score: 2 },
  { min: 1, max: 2, score: 3 },
  { min: 0, max: 1, score: 5 },
  { min: -Infinity, max: 0, score: 5 },
];

/** M5 融资余额水位（亿元） */
const MARGIN_LEVELS: LevelThreshold[] = [
  { min: 20000, max: Infinity, score: 5 },
  { min: 18000, max: 20000, score: 4 },
  { min: 16000, max: 18000, score: 3 },
  { min: 14000, max: 16000, score: 2 },
  { min: 12000, max: 14000, score: 1 },
  { min: 10000, max: 12000, score: 0 },
  { min: 8000, max: 10000, score: -1 },
  { min: 6000, max: 8000, score: -2 },
  { min: 4000, max: 6000, score: -3 },
  { min: 2000, max: 4000, score: -4 },
  { min: -Infinity, max: 2000, score: -5 },
];

// ============ 变化率趋势阈值 ============

/** 变化率 → 趋势分（%） */
const TREND_THRESHOLDS: LevelThreshold[] = [
  { min: 50, max: Infinity, score: 5 },
  { min: 30, max: 50, score: 4 },
  { min: 15, max: 30, score: 3 },
  { min: 5, max: 15, score: 2 },
  { min: 1, max: 5, score: 1 },
  { min: -1, max: 1, score: 0 },
  { min: -5, max: -1, score: -1 },
  { min: -15, max: -5, score: -2 },
  { min: -30, max: -15, score: -3 },
  { min: -50, max: -30, score: -4 },
  { min: -Infinity, max: -50, score: -5 },
];

// ============ 因子配置 ============

interface FactorConfig {
  key: SentimentFactorKey;
  name: string;
  levels: LevelThreshold[];
  getValue: (data: SentimentRawData) => number | undefined;
  getChangePct: (data: SentimentRawData) => number | undefined;
  /** 是否为反向指标（跌停数：值越大越冷） */
  invertTrend?: boolean;
}

const FACTOR_CONFIGS: FactorConfig[] = [
  {
    key: 'M1',
    name: '成交量',
    levels: VOLUME_LEVELS,
    getValue: (d) => d.total_volume,
    getChangePct: (d) => d.volume_change_pct,
  },
  {
    key: 'M2',
    name: '换手率',
    levels: TURNOVER_LEVELS,
    getValue: (d) => d.turnover_rate,
    getChangePct: (d) => d.turnover_change_pct,
  },
  {
    key: 'M3',
    name: '涨停数',
    levels: LIMIT_UP_LEVELS,
    getValue: (d) => d.limit_up_count,
    getChangePct: (d) => d.limit_up_change_pct,
  },
  {
    key: 'M4',
    name: '跌停数',
    levels: LIMIT_DOWN_LEVELS,
    getValue: (d) => d.limit_down_count,
    getChangePct: (d) => d.limit_down_change_pct,
    invertTrend: true, // 跌停增加 = 变冷，趋势取反
  },
  {
    key: 'M5',
    name: '融资余额',
    levels: MARGIN_LEVELS,
    getValue: (d) => d.margin_balance,
    getChangePct: (d) => d.margin_change_pct,
  },
];

// ============ 主函数 ============

/**
 * 计算大盘情绪评分
 * @param data 李富贵推送的市场数据
 * @returns 情绪评分结果
 */
export function calculateSentiment(data: SentimentRawData): SentimentResult {
  const factors: SentimentFactorScore[] = [];

  for (const config of FACTOR_CONFIGS) {
    const value = config.getValue(data);
    const changePct = config.getChangePct(data);

    // 字段缺失：因子标记为不可用，不参与总分平均
    if (value === undefined) {
      factors.push({
        key: config.key,
        name: config.name,
        levelScore: 0,
        trendScore: 0,
        score: 0,
        rawValue: undefined,
        changePct: undefined,
        unavailable: true,
      });
      continue;
    }

    // 水位分
    const levelScore = findLevelScore(value, config.levels);

    // 趋势分
    let trendScore = 0;
    if (changePct !== undefined) {
      trendScore = findLevelScore(changePct, TREND_THRESHOLDS);
      // 反向指标：跌停数增加 = 变冷，趋势分取反
      if (config.invertTrend) {
        trendScore = -trendScore;
      }
    }

    // 综合分 = 水位×0.6 + 趋势×0.4
    // 变化率缺失时退化为纯水位分（避免 0.4 权重把极值水位打折）
    const score =
      changePct !== undefined
        ? Math.round((levelScore * 0.6 + trendScore * 0.4) * 100) / 100
        : levelScore;

    factors.push({
      key: config.key,
      name: config.name,
      levelScore,
      trendScore,
      score,
      rawValue: value,
      changePct,
    });
  }

  // 综合情绪评分 = 有效因子等权平均（缺失因子不参与）
  const available = factors.filter((f) => !f.unavailable);
  const totalScore =
    available.length > 0
      ? Math.round((available.reduce((sum, f) => sum + f.score, 0) / available.length) * 100) / 100
      : 0;

  // 热度等级
  const heatLevel = getHeatLabel(totalScore);

  return { factors, totalScore, heatLevel };
}

function getHeatLabel(score: number): string {
  if (score >= 4.5) return '极度狂热';
  if (score >= 3.5) return '强烈过热';
  if (score >= 2.5) return '过热';
  if (score >= 1.5) return '偏热';
  if (score >= 0.5) return '温和偏热';
  if (score > -0.5) return '中性';
  if (score > -1.5) return '温和偏冷';
  if (score > -2.5) return '偏冷';
  if (score > -3.5) return '冷淡';
  if (score > -4.5) return '强烈冷淡';
  return '极度冰点';
}

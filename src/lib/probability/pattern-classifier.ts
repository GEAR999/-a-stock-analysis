/**
 * 模式标签分类器
 * 基于K线数据自动标注开盘模式、盘中形态、K线形态
 */

import type { KLineData } from '../types';
import type { OpenPattern, IntradayPattern, CandlestickPattern } from './types';

// ========== 开盘模式分类 ==========

/**
 * 分类开盘模式
 * 基于开盘价vs昨收、收盘价vs开盘价判断
 */
export function classifyOpenPattern(kline: KLineData, prevClose: number): OpenPattern {
  const gapPercent = (kline.open - prevClose) / prevClose;
  const bodyDirection = kline.close - kline.open;
  const bodyPercent = Math.abs(bodyDirection) / kline.open;

  const isOpenHigh = gapPercent > 0.005; // 高开 > 0.5%
  const isOpenLow = gapPercent < -0.005; // 低开 < -0.5%
  const isCloseAboveOpen = bodyDirection > 0;

  // 平开（开盘价接近昨收）
  if (!isOpenHigh && !isOpenLow) {
    return '平开震荡';
  }

  if (isOpenHigh) {
    return isCloseAboveOpen ? '高开高走' : '高开低走';
  }

  // 低开
  return isCloseAboveOpen ? '低开高走' : '低开低走';
}

// ========== ATR 自适应阈值 ==========

/**
 * 计算真实波幅 (True Range)
 */
function trueRange(kline: KLineData, prevClose: number): number {
  return Math.max(
    kline.high - kline.low,
    Math.abs(kline.high - prevClose),
    Math.abs(kline.low - prevClose)
  );
}

/**
 * 计算 ATR (Average True Range)
 * 用于衡量"正常波动幅度"，替代固定百分比阈值
 */
function calcATR(klines: KLineData[], period: number = 14): number {
  if (klines.length < 2) return klines[0] ? klines[0].high - klines[0].low : 0;
  let sum = 0;
  const start = Math.max(1, klines.length - period);
  for (let i = start; i < klines.length; i++) {
    sum += trueRange(klines[i], klines[i - 1].close);
  }
  return sum / (klines.length - start);
}

// ========== 前序趋势上下文 ==========

interface TrendContext {
  /** 近5日累计涨跌幅 */
  fiveDayChange: number;
  /** 近10日累计涨跌幅 */
  tenDayChange: number;
  /** 近10日最大回撤（从高点到低谷的跌幅，正数表示跌幅） */
  maxDrawdown10: number;
  /** 近5日最大回撤 */
  maxDrawdown5: number;
  /** 连续阴线天数 */
  consecutiveBearish: number;
  /** 连续阳线天数 */
  consecutiveBullish: number;
  /** 是否处于近20日低位（收盘价在近20日最低收盘价10%范围内） */
  near20Low: boolean;
  /** 是否处于近20日高位 */
  near20High: boolean;
  /** 前期盘整天数（突破前振幅<0.5×ATR的天数，最多看10天） */
  consolidationDays: number;
  /** 近5日平均成交量 */
  avgVolume5: number;
  /** 近10日平均成交量 */
  avgVolume10: number;
}

/**
 * 计算前序趋势上下文
 */
function calcTrendContext(
  klines: KLineData[],
  index: number,
  atr: number
): TrendContext {
  const start5 = Math.max(0, index - 5);
  const start10 = Math.max(0, index - 10);
  const start20 = Math.max(0, index - 20);

  const prev5 = klines.slice(start5, index);
  const prev10 = klines.slice(start10, index);
  const prev20 = klines.slice(start20, index);

  // 累计涨跌幅
  const fiveDayChange = prev5.length > 0
    ? (klines[index].close - prev5[0].open) / prev5[0].open
    : 0;
  const tenDayChange = prev10.length > 0
    ? (klines[index].close - prev10[0].open) / prev10[0].open
    : 0;

  // 最大回撤
  let maxDrawdown10 = 0;
  if (prev10.length > 1) {
    let peak = prev10[0].high;
    for (const k of prev10) {
      if (k.high > peak) peak = k.high;
      const dd = (peak - k.low) / peak;
      if (dd > maxDrawdown10) maxDrawdown10 = dd;
    }
  }

  let maxDrawdown5 = 0;
  if (prev5.length > 1) {
    let peak = prev5[0].high;
    for (const k of prev5) {
      if (k.high > peak) peak = k.high;
      const dd = (peak - k.low) / peak;
      if (dd > maxDrawdown5) maxDrawdown5 = dd;
    }
  }

  // 连续阴/阳线
  let consecutiveBearish = 0;
  let consecutiveBullish = 0;
  for (let i = index - 1; i >= 0; i--) {
    if (klines[i].close < klines[i].open) {
      if (consecutiveBullish > 0) break;
      consecutiveBearish++;
    } else if (klines[i].close > klines[i].open) {
      if (consecutiveBearish > 0) break;
      consecutiveBullish++;
    } else {
      break;
    }
  }

  // 近20日高低位判断
  const currClose = klines[index].close;
  if (prev20.length > 0) {
    const closes20 = prev20.map(k => k.close);
    const minClose20 = Math.min(...closes20);
    const maxClose20 = Math.max(...closes20);
    const range20 = maxClose20 - minClose20;
    const threshold = range20 * 0.15 || currClose * 0.02;
    const near20Low = currClose <= minClose20 + threshold;
    const near20High = currClose >= maxClose20 - threshold;

    // 盘整天数
    let consolidationDays = 0;
    const consolThreshold = atr * 0.5;
    for (let i = index - 1; i >= Math.max(0, index - 10); i--) {
      if (klines[i].high - klines[i].low < consolThreshold) {
        consolidationDays++;
      } else {
        break;
      }
    }

    // 平均成交量
    const avgVolume5 = prev5.length > 0
      ? prev5.reduce((s, k) => s + k.volume, 0) / prev5.length
      : 1;
    const avgVolume10 = prev10.length > 0
      ? prev10.reduce((s, k) => s + k.volume, 0) / prev10.length
      : 1;

    return {
      fiveDayChange, tenDayChange, maxDrawdown10, maxDrawdown5,
      consecutiveBearish, consecutiveBullish,
      near20Low, near20High, consolidationDays,
      avgVolume5, avgVolume10,
    };
  }

  return {
    fiveDayChange: 0, tenDayChange: 0, maxDrawdown10: 0, maxDrawdown5: 0,
    consecutiveBearish: 0, consecutiveBullish: 0,
    near20Low: false, near20High: false, consolidationDays: 0,
    avgVolume5: 1, avgVolume10: 1,
  };
}

// ========== 盘中形态评分 ==========

interface PatternScore {
  pattern: IntradayPattern;
  score: number;
  reasons: string[];
}

/**
 * 探底回升评分
 * 核心特征：长下影线 + 收盘回到高位 + 前期有下跌背景
 */
function scoreProbeRecovery(
  kline: KLineData,
  ctx: TrendContext,
  atr: number
): PatternScore {
  const reasons: string[] = [];
  const range = kline.high - kline.low;
  if (range === 0) return { pattern: '探底回升', score: 0, reasons };

  const lowerShadow = Math.min(kline.open, kline.close) - kline.low;
  const body = Math.abs(kline.close - kline.open);
  const bodyRatio = body / range;
  const recoveryRatio = (kline.close - kline.low) / range; // 收盘在振幅中的位置

  let s = 0;

  // 下影线长度（相对ATR）——最核心指标
  if (lowerShadow > 2 * atr) {
    s += 0.30;
    reasons.push(`下影线极长(${(lowerShadow / atr).toFixed(1)}×ATR)`);
  } else if (lowerShadow > 1.2 * atr) {
    s += 0.20;
    reasons.push(`下影线显著(${(lowerShadow / atr).toFixed(1)}×ATR)`);
  } else if (lowerShadow > 0.7 * atr) {
    s += 0.10;
    reasons.push(`下影线偏长`);
  }

  // 收盘回到高位（从最低点反弹到振幅上半部分）
  if (recoveryRatio > 0.75) {
    s += 0.20;
    reasons.push('收盘回到振幅高位');
  } else if (recoveryRatio > 0.5) {
    s += 0.10;
    reasons.push('收盘回到振幅中部');
  }

  // 阳线收盘（收盘>开盘）
  if (kline.close > kline.open) {
    s += 0.10;
    reasons.push('收阳线');
  }

  // 前期有下跌背景
  if (ctx.fiveDayChange < -0.05) {
    s += 0.20;
    reasons.push(`近5日跌幅${(ctx.fiveDayChange * 100).toFixed(1)}%`);
  } else if (ctx.fiveDayChange < -0.02) {
    s += 0.12;
    reasons.push(`近5日跌幅${(ctx.fiveDayChange * 100).toFixed(1)}%`);
  } else if (ctx.tenDayChange < -0.05) {
    s += 0.08;
    reasons.push(`近10日跌幅${(ctx.tenDayChange * 100).toFixed(1)}%`);
  }

  // 处于20日低位加分
  if (ctx.near20Low) {
    s += 0.10;
    reasons.push('处于20日低位');
  }

  // 小实体更有探底意味
  if (bodyRatio < 0.2) {
    s += 0.10;
    reasons.push('实体极小');
  } else if (bodyRatio < 0.35) {
    s += 0.05;
  }

  return { pattern: '探底回升', score: Math.min(s, 1), reasons };
}

/**
 * 超跌反弹评分
 * 核心特征：前期显著下跌 + 出现反弹信号（下影线/阳线）
 * 与"探底回升"区别：更强调前期跌幅深度，反弹力度可以更强
 */
function scoreOversoldBounce(
  kline: KLineData,
  ctx: TrendContext,
  atr: number
): PatternScore {
  const reasons: string[] = [];
  const range = kline.high - kline.low;
  if (range === 0) return { pattern: '超跌反弹', score: 0, reasons };

  const lowerShadow = Math.min(kline.open, kline.close) - kline.low;
  const body = Math.abs(kline.close - kline.open);
  const isBullish = kline.close > kline.open;
  const bodyPercent = body / kline.open;

  let s = 0;

  // 前期显著下跌（核心条件，权重最高）
  if (ctx.fiveDayChange < -0.08) {
    s += 0.30;
    reasons.push(`近5日暴跌${(ctx.fiveDayChange * 100).toFixed(1)}%`);
  } else if (ctx.fiveDayChange < -0.05) {
    s += 0.22;
    reasons.push(`近5日大跌${(ctx.fiveDayChange * 100).toFixed(1)}%`);
  } else if (ctx.fiveDayChange < -0.03) {
    s += 0.12;
    reasons.push(`近5日下跌${(ctx.fiveDayChange * 100).toFixed(1)}%`);
  } else if (ctx.tenDayChange < -0.10) {
    s += 0.15;
    reasons.push(`近10日大跌${(ctx.tenDayChange * 100).toFixed(1)}%`);
  }

  // 最大回撤深度
  if (ctx.maxDrawdown10 > 0.12) {
    s += 0.15;
    reasons.push(`10日最大回撤${(ctx.maxDrawdown10 * 100).toFixed(1)}%`);
  } else if (ctx.maxDrawdown10 > 0.07) {
    s += 0.08;
    reasons.push(`10日回撤${(ctx.maxDrawdown10 * 100).toFixed(1)}%`);
  }

  // 连续阴线
  if (ctx.consecutiveBearish >= 4) {
    s += 0.15;
    reasons.push(`连续${ctx.consecutiveBearish}根阴线`);
  } else if (ctx.consecutiveBearish >= 3) {
    s += 0.10;
    reasons.push(`连续${ctx.consecutiveBearish}根阴线`);
  } else if (ctx.consecutiveBearish >= 2) {
    s += 0.05;
  }

  // 反弹信号：收阳线 + 有一定实体
  if (isBullish && bodyPercent > 0.01) {
    s += 0.15;
    reasons.push('收阳线反弹');
  } else if (isBullish) {
    s += 0.08;
    reasons.push('微幅收阳');
  }

  // 下影线（触底信号）
  if (lowerShadow > 1.5 * atr) {
    s += 0.10;
    reasons.push('长下影触底');
  }

  // 处于20日低位
  if (ctx.near20Low) {
    s += 0.10;
    reasons.push('处于20日低位');
  }

  // 放量反弹更可信
  const volRatio = kline.volume / (ctx.avgVolume5 || 1);
  if (volRatio > 1.5 && isBullish) {
    s += 0.05;
    reasons.push(`放量反弹(${volRatio.toFixed(1)}倍)`);
  }

  return { pattern: '超跌反弹', score: Math.min(s, 1), reasons };
}

/**
 * 冲高回落评分
 * 核心特征：长上影线 + 前期有上涨背景（冲高才有意义）
 */
function scoreSpikeRetreat(
  kline: KLineData,
  ctx: TrendContext,
  atr: number
): PatternScore {
  const reasons: string[] = [];
  const range = kline.high - kline.low;
  if (range === 0) return { pattern: '冲高回落', score: 0, reasons };

  const upperShadow = kline.high - Math.max(kline.open, kline.close);
  const body = Math.abs(kline.close - kline.open);
  const bodyRatio = body / range;
  const upperShadowRatio = upperShadow / range;
  const isBearish = kline.close < kline.open;

  let s = 0;

  // 上影线长度（相对ATR）——最核心指标
  if (upperShadow > 2 * atr) {
    s += 0.30;
    reasons.push(`上影线极长(${(upperShadow / atr).toFixed(1)}×ATR)`);
  } else if (upperShadow > 1.2 * atr) {
    s += 0.20;
    reasons.push(`上影线显著(${(upperShadow / atr).toFixed(1)}×ATR)`);
  } else if (upperShadow > 0.7 * atr) {
    s += 0.10;
    reasons.push('上影线偏长');
  }

  // 上影线占振幅比例
  if (upperShadowRatio > 0.6) {
    s += 0.15;
    reasons.push('上影线占比>60%');
  } else if (upperShadowRatio > 0.4) {
    s += 0.08;
  }

  // 收阴线（冲高后回落收阴更典型）
  if (isBearish) {
    s += 0.10;
    reasons.push('收阴线');
  }

  // 前期有上涨（冲高才有回落的意义）
  if (ctx.fiveDayChange > 0.05) {
    s += 0.20;
    reasons.push(`近5日涨${(ctx.fiveDayChange * 100).toFixed(1)}%`);
  } else if (ctx.fiveDayChange > 0.02) {
    s += 0.12;
    reasons.push(`近5日涨${(ctx.fiveDayChange * 100).toFixed(1)}%`);
  } else if (ctx.consecutiveBullish >= 3) {
    s += 0.10;
    reasons.push(`连续${ctx.consecutiveBullish}根阳线`);
  }

  // 处于20日高位
  if (ctx.near20High) {
    s += 0.10;
    reasons.push('处于20日高位');
  }

  // 小实体更有回落意味
  if (bodyRatio < 0.2) {
    s += 0.10;
    reasons.push('实体极小');
  } else if (bodyRatio < 0.35) {
    s += 0.05;
  }

  return { pattern: '冲高回落', score: Math.min(s, 1), reasons };
}

/**
 * 放量突破评分
 * 核心特征：大阳线 + 放量 + 突破前期高点 + 收盘在高位
 */
function scoreVolumeBreakout(
  kline: KLineData,
  ctx: TrendContext,
  atr: number,
  prevKlines: KLineData[]
): PatternScore {
  const reasons: string[] = [];
  const range = kline.high - kline.low;
  if (range === 0) return { pattern: '放量突破', score: 0, reasons };

  const body = kline.close - kline.open;
  const isBullish = body > 0;
  const closePosition = (kline.close - kline.low) / range;

  if (!isBullish) return { pattern: '放量突破', score: 0, reasons };

  let s = 0;

  // 成交量放大（相对5日均量）
  const volRatio5 = kline.volume / (ctx.avgVolume5 || 1);
  const volRatio10 = kline.volume / (ctx.avgVolume10 || 1);
  if (volRatio5 > 2.5) {
    s += 0.25;
    reasons.push(`量能激增${volRatio5.toFixed(1)}倍(vs5日)`);
  } else if (volRatio5 > 1.8) {
    s += 0.18;
    reasons.push(`显著放量${volRatio5.toFixed(1)}倍`);
  } else if (volRatio5 > 1.3) {
    s += 0.10;
    reasons.push(`温和放量${volRatio5.toFixed(1)}倍`);
  }

  // 10日均量验证（避免5日均量本身偏低导致的假放量）
  if (volRatio10 > 1.5) {
    s += 0.05;
    reasons.push('10日均量也确认放量');
  }

  // 突破前期高点
  const lookback = Math.min(prevKlines.length, 10);
  const prevHighs = prevKlines.slice(-lookback).map(k => k.high);
  const prevHigh = Math.max(...prevHighs);
  if (kline.close > prevHigh) {
    const breakPct = (kline.close - prevHigh) / prevHigh;
    if (breakPct > 0.02) {
      s += 0.25;
      reasons.push(`突破${lookback}日高点${(breakPct * 100).toFixed(1)}%`);
    } else {
      s += 0.15;
      reasons.push(`突破${lookback}日高点`);
    }
  }

  // 大阳线实体
  const bodyPercent = body / kline.open;
  if (bodyPercent > 0.03) {
    s += 0.15;
    reasons.push(`大阳线${(bodyPercent * 100).toFixed(1)}%`);
  } else if (bodyPercent > 0.015) {
    s += 0.08;
    reasons.push(`中阳线${(bodyPercent * 100).toFixed(1)}%`);
  }

  // 收盘在高位（突破质量）
  if (closePosition > 0.85) {
    s += 0.10;
    reasons.push('收盘接近最高价');
  } else if (closePosition > 0.7) {
    s += 0.05;
  }

  // 前期盘整越久突破越有效
  if (ctx.consolidationDays >= 5) {
    s += 0.15;
    reasons.push(`盘整${ctx.consolidationDays}日后突破`);
  } else if (ctx.consolidationDays >= 3) {
    s += 0.08;
    reasons.push(`盘整${ctx.consolidationDays}日`);
  }

  return { pattern: '放量突破', score: Math.min(s, 1), reasons };
}

/**
 * 横盘震荡评分
 * 核心特征：振幅极小（相对ATR）
 */
function scoreSideways(
  kline: KLineData,
  atr: number
): PatternScore {
  const reasons: string[] = [];
  const range = kline.high - kline.low;
  if (range === 0) return { pattern: '横盘震荡', score: 0.5, reasons: ['无振幅'] };

  const amplitude = range / kline.open;
  const body = Math.abs(kline.close - kline.open);
  const bodyRatio = body / range;

  let s = 0;

  // 振幅相对ATR
  if (range < 0.4 * atr) {
    s += 0.40;
    reasons.push(`振幅极小(${(amplitude * 100).toFixed(2)}%)`);
  } else if (range < 0.6 * atr) {
    s += 0.25;
    reasons.push(`振幅偏小(${(amplitude * 100).toFixed(2)}%)`);
  } else if (range < 0.8 * atr) {
    s += 0.10;
    reasons.push(`振幅较小(${(amplitude * 100).toFixed(2)}%)`);
  }

  // 小实体（十字星/小阴小阳）
  if (bodyRatio < 0.3) {
    s += 0.15;
    reasons.push('小实体');
  }

  // 成交量萎缩
  // (成交量信息在外部通过 ctx 传入，这里简化处理)

  return { pattern: '横盘震荡', score: Math.min(s, 1), reasons };
}

// ========== 盘中形态分类（评分制） ==========

/** 最低识别门槛：得分必须超过此值才被识别为特定形态 */
const MIN_PATTERN_THRESHOLD = 0.35;

/**
 * 分类盘中形态（评分制）
 * 对每种形态计算0-1得分，取最高分且超过阈值的形态
 * 基于ATR自适应阈值 + 深度前序上下文
 */
export function classifyIntradayPattern(
  kline: KLineData,
  prevKlines: KLineData[],
  allKlines?: KLineData[],
  currentIndex?: number
): IntradayPattern {
  if (prevKlines.length < 3) return '趋势延续';

  const range = kline.high - kline.low;
  if (range === 0) return '横盘震荡';

  // 计算 ATR（优先使用全量数据）
  const klinesForATR = allKlines ?? prevKlines.concat(kline);
  const idx = currentIndex ?? (klinesForATR.length - 1);
  const atr = calcATR(klinesForATR.slice(0, idx + 1));
  if (atr === 0) return '横盘震荡';

  // 计算趋势上下文
  const ctx = calcTrendContext(klinesForATR, idx, atr);

  // 对每种形态评分
  const scores: PatternScore[] = [
    scoreProbeRecovery(kline, ctx, atr),
    scoreOversoldBounce(kline, ctx, atr),
    scoreSpikeRetreat(kline, ctx, atr),
    scoreVolumeBreakout(kline, ctx, atr, prevKlines),
    scoreSideways(kline, atr),
  ];

  // 取最高分
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  // 超过阈值才识别为特定形态，否则归为"趋势延续"
  if (best.score >= MIN_PATTERN_THRESHOLD) {
    return best.pattern;
  }

  return '趋势延续';
}

// ========== K线形态分类 ==========

/**
 * 分类K线形态
 * 基于实体比例、影线长度、与前一根K线的关系
 */
export function classifyCandlestickPattern(
  kline: KLineData,
  prevKline?: KLineData
): CandlestickPattern {
  const range = kline.high - kline.low;
  if (range === 0) return '十字星';

  const body = Math.abs(kline.close - kline.open);
  const upperShadow = kline.high - Math.max(kline.open, kline.close);
  const lowerShadow = Math.min(kline.open, kline.close) - kline.low;
  const bodyRatio = body / range;
  const upperShadowRatio = upperShadow / range;
  const lowerShadowRatio = lowerShadow / range;
  const isBullish = kline.close > kline.open;

  // 1. 十字星：实体极小
  if (bodyRatio < 0.1) {
    return '十字星';
  }

  // 2. 大阳线：实体占比大，阳线
  if (isBullish && bodyRatio > 0.7 && body / kline.open > 0.02) {
    return '大阳线';
  }

  // 3. 大阴线：实体占比大，阴线
  if (!isBullish && bodyRatio > 0.7 && body / kline.open > 0.02) {
    return '大阴线';
  }

  // 4. 锤子线：小实体+长下影线（下影线>实体2倍）
  if (lowerShadowRatio > 0.5 && bodyRatio < 0.3 && lowerShadow > body * 2) {
    return '锤子线';
  }

  // 5. 长上影线
  if (upperShadowRatio > 0.5 && upperShadow > body * 2) {
    return '长上影';
  }

  // 6. 长下影线
  if (lowerShadowRatio > 0.5 && lowerShadow > body * 2) {
    return '长下影';
  }

  // 7. 吞没形态：当前K线完全包裹前一根
  if (prevKline) {
    const prevBody = Math.abs(prevKline.close - prevKline.open);
    const prevBullish = prevKline.close > prevKline.open;

    // 看涨吞没：前阴后阳，当前实体>前实体
    if (!prevBullish && isBullish && body > prevBody &&
        kline.close > prevKline.open && kline.open < prevKline.close) {
      return '吞没形态';
    }

    // 看跌吞没：前阳后阴，当前实体>前实体
    if (prevBullish && !isBullish && body > prevBody &&
        kline.open > prevKline.close && kline.close < prevKline.open) {
      return '吞没形态';
    }
  }

  // 8. 普通K线
  return '普通K线';
}

// ========== 批量标注 ==========

export interface AnnotationResult {
  index: number;
  openPattern: OpenPattern;
  intradayPattern: IntradayPattern;
  candlestickPattern: CandlestickPattern;
}

/**
 * 批量标注K线数据
 */
export function annotateAllKLines(klines: KLineData[]): AnnotationResult[] {
  const results: AnnotationResult[] = [];

  for (let i = 0; i < klines.length; i++) {
    const kline = klines[i];
    const prevClose = i > 0 ? klines[i - 1].close : kline.open;
    const prevKlines = klines.slice(Math.max(0, i - 10), i); // 扩大到10根用于突破回看
    const prevKline = i > 0 ? klines[i - 1] : undefined;

    results.push({
      index: i,
      openPattern: classifyOpenPattern(kline, prevClose),
      intradayPattern: classifyIntradayPattern(kline, prevKlines, klines, i),
      candlestickPattern: classifyCandlestickPattern(kline, prevKline),
    });
  }

  return results;
}

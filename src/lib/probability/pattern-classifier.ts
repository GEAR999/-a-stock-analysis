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

// ========== 盘中形态分类 ==========

/**
 * 分类盘中形态
 * 基于K线形态、影线比例、前期趋势判断
 */
export function classifyIntradayPattern(
  kline: KLineData,
  prevKlines: KLineData[]
): IntradayPattern {
  if (prevKlines.length < 3) return '趋势延续';

  const range = kline.high - kline.low;
  if (range === 0) return '横盘震荡';

  const body = Math.abs(kline.close - kline.open);
  const upperShadow = kline.high - Math.max(kline.open, kline.close);
  const lowerShadow = Math.min(kline.open, kline.close) - kline.low;
  const bodyRatio = body / range;
  const upperShadowRatio = upperShadow / range;
  const lowerShadowRatio = lowerShadow / range;

  // 判断前期趋势
  const prev3 = prevKlines.slice(-3);
  const isDownTrend = prev3.every(k => k.close < k.open); // 连续3根阴线
  const isUpTrend = prev3.every(k => k.close > k.open);   // 连续3根阳线

  // 成交量判断
  const avgVolume = prevKlines.slice(-5).reduce((sum, k) => sum + k.volume, 0) / Math.min(prevKlines.length, 5);
  const volumeRatio = kline.volume / avgVolume;

  // 1. 超跌反弹：连续下跌后长下影线
  if (isDownTrend && lowerShadowRatio > 0.4 && kline.close > kline.open) {
    return '超跌反弹';
  }

  // 2. 探底回升：长下影线（不要求前期下跌）
  if (lowerShadowRatio > 0.5 && bodyRatio < 0.3 && kline.close > kline.open) {
    return '探底回升';
  }

  // 3. 冲高回落：长上影线
  if (upperShadowRatio > 0.4 && bodyRatio < 0.3) {
    return '冲高回落';
  }

  // 4. 放量突破：大阳线+成交量放大
  if (bodyRatio > 0.7 && kline.close > kline.open && volumeRatio > 1.5) {
    const prevHigh = Math.max(...prev3.map(k => k.high));
    if (kline.close > prevHigh) {
      return '放量突破';
    }
  }

  // 5. 横盘震荡：振幅小
  const amplitude = range / kline.open;
  if (amplitude < 0.015) {
    return '横盘震荡';
  }

  // 6. 趋势延续：默认
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
    const prevKlines = klines.slice(Math.max(0, i - 5), i);
    const prevKline = i > 0 ? klines[i - 1] : undefined;

    results.push({
      index: i,
      openPattern: classifyOpenPattern(kline, prevClose),
      intradayPattern: classifyIntradayPattern(kline, prevKlines),
      candlestickPattern: classifyCandlestickPattern(kline, prevKline),
    });
  }

  return results;
}

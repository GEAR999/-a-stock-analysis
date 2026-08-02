/**
 * 技术指标事件检测器
 * 基于技术指标数据检测各类交易信号事件
 */

import type { KLineData, TechnicalIndicators, ChanlunResult } from '../types';
import { getAllIndicators } from '../analysis';
import type { SingleFactorEvent, CombinedEvent, TechnicalEvent } from './types';

// ========== 单因子事件检测 ==========

/**
 * 检测单因子事件
 */
export function detectSingleFactorEvents(
  indicators: TechnicalIndicators,
  index: number,
  klines: KLineData[]
): SingleFactorEvent[] {
  const events: SingleFactorEvent[] = [];

  if (index < 2) return events;

  const { macd, kdj, rsi, boll, ma } = indicators;

  // MACD 金叉/死叉
  if (macd[index] && macd[index - 1]) {
    const curr = macd[index];
    const prev = macd[index - 1];
    if (curr.dif > curr.dea && prev.dif <= prev.dea) {
      events.push('MACD金叉');
    }
    if (curr.dif < curr.dea && prev.dif >= prev.dea) {
      events.push('MACD死叉');
    }
  }

  // RSI 超买/超卖
  if (rsi[index]) {
    const rsiVal = rsi[index].rsi;
    if (rsiVal < 20) events.push('RSI超卖');
    if (rsiVal > 80) events.push('RSI超买');
  }

  // KDJ 金叉/死叉
  if (kdj[index] && kdj[index - 1] && !kdj[index].isWarmup && !kdj[index - 1].isWarmup) {
    const curr = kdj[index];
    const prev = kdj[index - 1];
    if (curr.k > curr.d && prev.k <= prev.d) {
      events.push('KDJ金叉');
    }
    if (curr.k < curr.d && prev.k >= prev.d) {
      events.push('KDJ死叉');
    }
  }

  // 布林带突破
  if (boll[index]) {
    const price = klines[index].close;
    if (price <= boll[index].lower) {
      events.push('布林带下轨突破');
    }
    if (price >= boll[index].upper) {
      events.push('布林带上轨突破');
    }
  }

  // MA5/MA20 交叉
  if (ma[5] && ma[20] && ma[5][index] !== undefined && ma[20][index] !== undefined &&
      ma[5][index - 1] !== undefined && ma[20][index - 1] !== undefined) {
    const curr5 = ma[5][index];
    const curr20 = ma[20][index];
    const prev5 = ma[5][index - 1];
    const prev20 = ma[20][index - 1];
    if (curr5 > curr20 && prev5 <= prev20) {
      events.push('MA5上穿MA20');
    }
    if (curr5 < curr20 && prev5 >= prev20) {
      events.push('MA5下穿MA20');
    }
  }

  // 成交量放大/萎缩
  if (index >= 5) {
    const avgVolume = klines.slice(index - 5, index).reduce((sum, k) => sum + k.volume, 0) / 5;
    const volumeRatio = klines[index].volume / avgVolume;
    if (volumeRatio > 1.5) events.push('成交量放大');
    if (volumeRatio < 0.5) events.push('成交量萎缩');
  }

  return events;
}

// ========== 缠论买卖点事件 ==========

/**
 * 检测缠论买卖点事件
 */
export function detectChanlunEvents(
  chanlunResult: ChanlunResult,
  index: number
): SingleFactorEvent[] {
  const events: SingleFactorEvent[] = [];

  for (const sig of chanlunResult.buySignals) {
    if (sig.index === index) {
      switch (sig.type) {
        case 1: events.push('缠论一买'); break;
        case 2: events.push('缠论二买'); break;
        case 3: events.push('缠论三买'); break;
      }
    }
  }

  for (const sig of chanlunResult.sellSignals) {
    if (sig.index === index) {
      switch (sig.type) {
        case 1: events.push('缠论一卖'); break;
        case 2: events.push('缠论二卖'); break;
        case 3: events.push('缠论三卖'); break;
      }
    }
  }

  return events;
}

// ========== 组合事件检测 ==========

/**
 * 检测组合事件
 */
export function detectCombinedEvents(singleEvents: SingleFactorEvent[], klines: KLineData[], index: number): CombinedEvent[] {
  const events: CombinedEvent[] = [];
  const eventSet = new Set(singleEvents);

  // MACD金叉 + RSI超卖
  if (eventSet.has('MACD金叉') && eventSet.has('RSI超卖')) {
    events.push('MACD金叉+RSI超卖');
  }

  // MACD死叉 + RSI超买
  if (eventSet.has('MACD死叉') && eventSet.has('RSI超买')) {
    events.push('MACD死叉+RSI超买');
  }

  // 放量突破 + MACD金叉
  if (eventSet.has('成交量放大') && eventSet.has('MACD金叉')) {
    events.push('放量突破+MACD金叉');
  }

  // 缩量回调 + RSI超卖
  if (eventSet.has('成交量萎缩') && eventSet.has('RSI超卖')) {
    events.push('缩量回调+RSI超卖');
  }

  // 连续下跌 + RSI超卖
  if (index >= 3 && eventSet.has('RSI超卖')) {
    const prev3 = klines.slice(index - 2, index + 1);
    const allDown = prev3.every(k => k.close < k.open);
    if (allDown) {
      events.push('连续下跌+RSI超卖');
    }
  }

  // 连续上涨 + RSI超买
  if (index >= 3 && eventSet.has('RSI超买')) {
    const prev3 = klines.slice(index - 2, index + 1);
    const allUp = prev3.every(k => k.close > k.open);
    if (allUp) {
      events.push('连续上涨+RSI超买');
    }
  }

  // 布林带收窄 + 成交量萎缩
  if (eventSet.has('成交量萎缩')) {
    const { boll } = getAllIndicators(klines);
    if (boll[index] && boll[index - 5]) {
      const currWidth = (boll[index].upper - boll[index].lower) / boll[index].middle;
      const prevWidth = (boll[index - 5].upper - boll[index - 5].lower) / boll[index - 5].middle;
      if (currWidth < prevWidth * 0.7) {
        events.push('布林带收窄+成交量萎缩');
      }
    }
  }

  return events;
}

// ========== 全量事件检测 ==========

export interface KLineEvents {
  index: number;
  singleEvents: SingleFactorEvent[];
  combinedEvents: CombinedEvent[];
  allEvents: TechnicalEvent[];
}

/**
 * 批量检测所有K线的事件
 */
export function detectAllEvents(
  klines: KLineData[],
  chanlunResult?: ChanlunResult
): KLineEvents[] {
  const indicators = getAllIndicators(klines);
  const results: KLineEvents[] = [];

  for (let i = 0; i < klines.length; i++) {
    const singleEvents = detectSingleFactorEvents(indicators, i, klines);

    // 缠论事件
    if (chanlunResult) {
      const chanlunEvents = detectChanlunEvents(chanlunResult, i);
      singleEvents.push(...chanlunEvents);
    }

    const combinedEvents = detectCombinedEvents(singleEvents, klines, i);
    const allEvents: TechnicalEvent[] = [...singleEvents, ...combinedEvents];

    results.push({
      index: i,
      singleEvents,
      combinedEvents,
      allEvents,
    });
  }

  return results;
}

// ========== 事件元数据 ==========

/** 事件分类标签 */
export const EVENT_CATEGORIES: Record<string, TechnicalEvent[]> = {
  '趋势类': ['MACD金叉', 'MACD死叉', 'MA5上穿MA20', 'MA5下穿MA20'],
  '超买超卖': ['RSI超卖', 'RSI超买', 'KDJ金叉', 'KDJ死叉'],
  '波动类': ['布林带下轨突破', '布林带上轨突破'],
  '量能类': ['成交量放大', '成交量萎缩'],
  '缠论类': ['缠论一买', '缠论一卖', '缠论二买', '缠论二卖', '缠论三买', '缠论三卖'],
  '组合类': ['MACD金叉+RSI超卖', 'MACD死叉+RSI超买', '放量突破+MACD金叉', '缩量回调+RSI超卖', '连续下跌+RSI超卖', '连续上涨+RSI超买', '布林带收窄+成交量萎缩'],
};

/** 所有可筛选的事件列表 */
export const ALL_FILTERABLE_EVENTS: TechnicalEvent[] = Object.values(EVENT_CATEGORIES).flat();

/** 事件方向标记（利好/利空） */
export const EVENT_DIRECTION: Record<TechnicalEvent, 'bullish' | 'bearish' | 'neutral'> = {
  'MACD金叉': 'bullish',
  'MACD死叉': 'bearish',
  'RSI超卖': 'bullish',
  'RSI超买': 'bearish',
  'KDJ金叉': 'bullish',
  'KDJ死叉': 'bearish',
  '布林带下轨突破': 'bullish',
  '布林带上轨突破': 'bearish',
  'MA5上穿MA20': 'bullish',
  'MA5下穿MA20': 'bearish',
  '成交量放大': 'neutral',
  '成交量萎缩': 'neutral',
  '缠论一买': 'bullish',
  '缠论一卖': 'bearish',
  '缠论二买': 'bullish',
  '缠论二卖': 'bearish',
  '缠论三买': 'bullish',
  '缠论三卖': 'bearish',
  'MACD金叉+RSI超卖': 'bullish',
  'MACD死叉+RSI超买': 'bearish',
  '放量突破+MACD金叉': 'bullish',
  '缩量回调+RSI超卖': 'bullish',
  '连续下跌+RSI超卖': 'bullish',
  '连续上涨+RSI超买': 'bearish',
  '布林带收窄+成交量萎缩': 'neutral',
};

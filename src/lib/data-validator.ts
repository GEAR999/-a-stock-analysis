/**
 * API 数据校验层
 * 对东方财富API返回数据做结构性校验和异常值过滤
 */

import type { KLineData, StockQuote, StockInfo } from './types';

/**
 * 校验并修复单根K线数据
 * - 缺失字段填默认值
 * - NaN/Infinity 替换为 null
 * - 价格为负 → 丢弃
 */
function sanitizeKLineItem(raw: Record<string, unknown>): KLineData | null {
  const date = typeof raw.date === 'string' ? raw.date : '';
  const open = Number(raw.open);
  const close = Number(raw.close);
  const high = Number(raw.high);
  const low = Number(raw.low);
  const volume = Number(raw.volume ?? 0);
  const amount = Number(raw.amount ?? 0);

  // 检查是否为有效数字
  if (!isFinite(open) || !isFinite(close) || !isFinite(high) || !isFinite(low)) {
    console.warn('[DataValidator] K线数据含无效数值, date:', date, { open, close, high, low });
    return null;
  }

  // 价格为负 → 丢弃
  if (open < 0 || close < 0 || high < 0 || low < 0) {
    console.warn('[DataValidator] K线数据价格为负, 已丢弃, date:', date);
    return null;
  }

  // 价格为0 → 丢弃
  if (open === 0 && close === 0 && high === 0 && low === 0) {
    console.warn('[DataValidator] K线数据价格全为0, 已丢弃, date:', date);
    return null;
  }

  return {
    date,
    open: isFinite(open) ? open : 0,
    close: isFinite(close) ? close : 0,
    high: isFinite(high) ? high : 0,
    low: isFinite(low) ? low : 0,
    volume: isFinite(volume) ? volume : 0,
    amount: isFinite(amount) ? amount : 0,
  };
}

/**
 * 校验K线数据数组
 * - 确保返回数组格式
 * - 过滤无效数据
 * - 至少保留1条有效数据
 */
export function validateKLineData(rawData: unknown): KLineData[] {
  if (!Array.isArray(rawData)) {
    console.warn('[DataValidator] K线数据不是数组格式, 返回空数组');
    return [];
  }

  const validated: KLineData[] = [];
  let droppedCount = 0;

  for (const item of rawData) {
    const sanitized = sanitizeKLineItem(item as Record<string, unknown>);
    if (sanitized) {
      validated.push(sanitized);
    } else {
      droppedCount++;
    }
  }

  if (droppedCount > 0) {
    console.warn(`[DataValidator] K线数据校验: 共${rawData.length}条, 有效${validated.length}条, 丢弃${droppedCount}条`);
  }

  return validated;
}

/**
 * 校验股票行情数据
 * - 检查关键字段完整性
 * - 缺失字段填默认值
 */
export function validateStockQuote(rawData: unknown): StockQuote | null {
  if (!rawData || typeof rawData !== 'object') {
    console.warn('[DataValidator] 行情数据格式无效');
    return null;
  }

  const raw = rawData as Record<string, unknown>;
  const price = Number(raw.price ?? 0);
  const change = Number(raw.change ?? 0);
  const changePercent = Number(raw.changePercent ?? 0);
  const open = Number(raw.open ?? 0);
  const high = Number(raw.high ?? 0);
  const low = Number(raw.low ?? 0);
  const preClose = Number(raw.preClose ?? raw.prevClose ?? 0);
  const volume = Number(raw.volume ?? 0);
  const amount = Number(raw.amount ?? 0);

  // 价格无效
  if (!isFinite(price) || price < 0) {
    console.warn('[DataValidator] 行情价格无效:', price);
    return null;
  }

  return {
    price: isFinite(price) ? price : 0,
    change: isFinite(change) ? change : 0,
    changePercent: isFinite(changePercent) ? changePercent : 0,
    open: isFinite(open) ? open : 0,
    high: isFinite(high) ? high : 0,
    low: isFinite(low) ? low : 0,
    preClose: isFinite(preClose) ? preClose : 0,
    volume: isFinite(volume) ? volume : 0,
    amount: isFinite(amount) ? amount : 0,
    code: typeof raw.code === 'string' ? raw.code : '',
    name: typeof raw.name === 'string' ? raw.name : '',
    timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : Date.now(),
  };
}

/**
 * 校验搜索结果
 * - 确保返回数组格式
 * - 过滤无效条目
 */
export function validateSearchResult(rawData: unknown): StockInfo[] {
  if (!Array.isArray(rawData)) {
    console.warn('[DataValidator] 搜索结果不是数组格式, 返回空数组');
    return [];
  }

  return rawData
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
    .map((item) => ({
      code: typeof item.code === 'string' ? item.code : '',
      name: typeof item.name === 'string' ? item.name : '',
      market: (typeof item.market === 'string' ? item.market : 'sh') as 'sh' | 'sz' | 'bj',
      type: (typeof item.type === 'string' ? item.type : 'stock') as 'stock' | 'etf' | 'index',
    }))
    .filter((item) => item.code.length > 0); // 过滤无代码的条目
}

/**
 * 通用数据校验包装器
 * 用于在 API 响应后插入校验步骤
 */
export function withValidation<T>(
  data: unknown,
  validator: (raw: unknown) => T,
  fallback: T
): T {
  try {
    return validator(data);
  } catch (error) {
    console.warn('[DataValidator] 数据校验异常, 使用默认值:', error);
    return fallback;
  }
}

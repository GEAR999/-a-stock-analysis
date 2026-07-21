/**
 * mootdx 行情客户端
 * 封装对 mootdx 行情转发服务（通达信协议）的 HTTP 调用
 * 服务器地址从环境变量 MOOTDX_SERVER_URL 读取，默认 http://47.122.115.203:8888
 * 
 * mootdx 提供实时行情数据，延迟低于东方财富 HTTP API
 * 当 mootdx 不可用时，自动降级到东方财富数据源
 */

// mootdx 服务器地址
const MOOTDX_SERVER_URL = process.env.MOOTDX_SERVER_URL || 'http://47.122.115.203:8888';

// 请求超时时间（毫秒）
const REQUEST_TIMEOUT = 10000; // 10秒超时

// 缓存健康状态，避免频繁请求不可用的服务
let isHealthy = true;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 60000; // 1分钟检查一次

// ============ 类型定义 ============

export interface MootdxQuoteData {
  code: string;
  name?: string;
  price: number;        // 当前价
  open: number;         // 开盘价
  high: number;         // 最高价
  low: number;          // 最低价
  preClose: number;     // 昨收价
  volume: number;       // 成交量（手）
  amount: number;       // 成交额（元）
  bid1?: number;        // 买一价
  ask1?: number;        // 卖一价
  bid1Vol?: number;     // 买一量
  ask1Vol?: number;     // 卖一量
  date?: string;        // 日期
  time?: string;        // 时间
  [key: string]: unknown;
}

export interface MootdxKlineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
}

export interface MootdxMinuteData {
  date: string;
  price: number;
  volume: number;
}

export interface MootdxHealthResult {
  status: string;
  timestamp?: number;
}

// ============ 工具函数 ============

/**
 * 带超时的 fetch
 */
async function fetchWithTimeout(url: string, timeout = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 检查 mootdx 服务健康状态
 */
export async function checkHealth(): Promise<boolean> {
  const now = Date.now();
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return isHealthy;
  }
  
  try {
    const response = await fetchWithTimeout(`${MOOTDX_SERVER_URL}/health`);
    if (response.ok) {
      const data = await response.json() as MootdxHealthResult;
      isHealthy = data.status === 'ok';
    } else {
      isHealthy = false;
    }
  } catch {
    isHealthy = false;
  }
  
  lastHealthCheck = now;
  return isHealthy;
}

/**
 * 判断 mootdx 是否可用（快速检查）
 */
export function isMootdxAvailable(): boolean {
  // 如果最近检查过且不健康，直接返回 false
  if (!isHealthy && Date.now() - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return false;
  }
  return true;
}

/**
 * 重置健康状态（用于手动重试）
 */
export function resetHealthStatus(): void {
  isHealthy = true;
  lastHealthCheck = 0;
}

// ============ 数据获取函数 ============

/**
 * 获取单只股票实时行情
 * @param code 股票代码，如 "000858"
 */
export async function getQuote(code: string): Promise<MootdxQuoteData | null> {
  try {
    const response = await fetchWithTimeout(
      `${MOOTDX_SERVER_URL}/api/quote?code=${encodeURIComponent(code)}`
    );
    
    if (!response.ok) {
      console.warn(`[mootdx] getQuote failed for ${code}: HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json() as Record<string, unknown>;
    
    // 检查是否有错误
    if (data.detail) {
      console.warn(`[mootdx] getQuote error for ${code}:`, data.detail);
      return null;
    }
    
    return parseQuoteResponse(data, code);
  } catch (error) {
    console.warn(`[mootdx] getQuote exception for ${code}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * 批量获取股票实时行情
 * @param codes 股票代码数组，如 ["000858", "600519"]
 */
export async function getQuotes(codes: string[]): Promise<Map<string, MootdxQuoteData>> {
  const result = new Map<string, MootdxQuoteData>();
  
  if (codes.length === 0) return result;
  
  try {
    const codesParam = codes.join(',');
    const response = await fetchWithTimeout(
      `${MOOTDX_SERVER_URL}/api/quotes?codes=${encodeURIComponent(codesParam)}`
    );
    
    if (!response.ok) {
      console.warn(`[mootdx] getQuotes failed: HTTP ${response.status}`);
      return result;
    }
    
    const data = await response.json() as Record<string, unknown>;
    
    // 检查是否有错误
    if (data.detail) {
      console.warn(`[mootdx] getQuotes error:`, data.detail);
      return result;
    }
    
    // 解析批量响应
    if (Array.isArray(data.quotes)) {
      for (const item of data.quotes as Record<string, unknown>[]) {
        const code = String(item.code || '');
        if (code) {
          const parsed = parseQuoteResponse(item, code);
          if (parsed) {
            result.set(code, parsed);
          }
        }
      }
    } else if (data.data && Array.isArray(data.data)) {
      for (const item of data.data as Record<string, unknown>[]) {
        const code = String(item.code || '');
        if (code) {
          const parsed = parseQuoteResponse(item, code);
          if (parsed) {
            result.set(code, parsed);
          }
        }
      }
    }
  } catch (error) {
    console.warn(`[mootdx] getQuotes exception:`, error instanceof Error ? error.message : error);
  }
  
  return result;
}

/**
 * 获取K线数据
 * @param code 股票代码
 * @param period 周期：day/week/month/60min/30min/15min/5min
 * @param count 数据条数
 */
export async function getKline(
  code: string,
  period: string = 'day',
  count: number = 100
): Promise<MootdxKlineData[]> {
  try {
    // 映射周期参数
    const periodMap: Record<string, string> = {
      'daily': 'day',
      'weekly': 'week',
      'monthly': 'month',
      'day': 'day',
      'week': 'week',
      'month': 'month',
      '60min': '60min',
      '30min': '30min',
      '15min': '15min',
      '5min': '5min',
    };
    const mootdxPeriod = periodMap[period] || 'day';
    
    const response = await fetchWithTimeout(
      `${MOOTDX_SERVER_URL}/api/kline?code=${encodeURIComponent(code)}&period=${mootdxPeriod}&count=${count}`
    );
    
    if (!response.ok) {
      console.warn(`[mootdx] getKline failed for ${code}: HTTP ${response.status}`);
      return [];
    }
    
    const data = await response.json() as Record<string, unknown>;
    
    // 检查是否有错误
    if (data.detail) {
      console.warn(`[mootdx] getKline error for ${code}:`, data.detail);
      return [];
    }
    
    return parseKlineResponse(data);
  } catch (error) {
    console.warn(`[mootdx] getKline exception for ${code}:`, error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * 获取指数行情
 * @param code 指数代码，如 "1.000001"（上证指数）、"0.399001"（深证成指）
 */
export async function getIndexQuote(code: string): Promise<MootdxQuoteData | null> {
  try {
    const response = await fetchWithTimeout(
      `${MOOTDX_SERVER_URL}/api/index/quote?code=${encodeURIComponent(code)}`
    );
    
    if (!response.ok) {
      console.warn(`[mootdx] getIndexQuote failed for ${code}: HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json() as Record<string, unknown>;
    
    // 检查是否有错误
    if (data.detail) {
      console.warn(`[mootdx] getIndexQuote error for ${code}:`, data.detail);
      return null;
    }
    
    return parseQuoteResponse(data, code);
  } catch (error) {
    console.warn(`[mootdx] getIndexQuote exception for ${code}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * 获取分时数据
 * @param code 股票代码
 */
export async function getMinute(code: string): Promise<MootdxMinuteData[]> {
  try {
    const response = await fetchWithTimeout(
      `${MOOTDX_SERVER_URL}/api/minute?code=${encodeURIComponent(code)}`
    );
    
    if (!response.ok) {
      console.warn(`[mootdx] getMinute failed for ${code}: HTTP ${response.status}`);
      return [];
    }
    
    const data = await response.json() as Record<string, unknown>;
    
    // 检查是否有错误
    if (data.detail) {
      console.warn(`[mootdx] getMinute error for ${code}:`, data.detail);
      return [];
    }
    
    return parseMinuteResponse(data);
  } catch (error) {
    console.warn(`[mootdx] getMinute exception for ${code}:`, error instanceof Error ? error.message : error);
    return [];
  }
}

// ============ 响应解析函数 ============

function parseQuoteResponse(data: Record<string, unknown>, code: string): MootdxQuoteData | null {
  if (!data || typeof data !== 'object') return null;
  
  // mootdx 返回的字段可能是多种格式，做兼容处理
  const price = Number(data.price || data.close || data.current || 0);
  const open = Number(data.open || 0);
  const high = Number(data.high || 0);
  const low = Number(data.low || 0);
  const preClose = Number(data.preClose || data.pre_close || data.lastClose || data.last_close || 0);
  const volume = Number(data.volume || data.vol || 0);
  const amount = Number(data.amount || 0);
  
  return {
    code: String(data.code || code),
    name: data.name ? String(data.name) : undefined,
    price,
    open,
    high,
    low,
    preClose,
    volume,
    amount,
    bid1: data.bid1 ? Number(data.bid1) : undefined,
    ask1: data.ask1 ? Number(data.ask1) : undefined,
    bid1Vol: data.bid1_vol || data.bid1Vol ? Number(data.bid1_vol || data.bid1Vol) : undefined,
    ask1Vol: data.ask1_vol || data.ask1Vol ? Number(data.ask1_vol || data.ask1Vol) : undefined,
    date: data.date ? String(data.date) : undefined,
    time: data.time ? String(data.time) : undefined,
  };
}

function parseKlineResponse(data: Record<string, unknown>): MootdxKlineData[] {
  const result: MootdxKlineData[] = [];
  
  // 尝试多种响应格式
  const bars = (data.bars || data.data || data.klines || []) as Record<string, unknown>[];
  
  if (!Array.isArray(bars)) return result;
  
  for (const bar of bars) {
    if (!bar || typeof bar !== 'object') continue;
    
    const date = String(bar.date || bar.datetime || bar.time || '');
    const open = Number(bar.open || 0);
    const high = Number(bar.high || 0);
    const low = Number(bar.low || 0);
    const close = Number(bar.close || 0);
    const volume = Number(bar.volume || bar.vol || 0);
    const amount = Number(bar.amount || 0);
    
    if (date && isFinite(close) && close > 0) {
      result.push({ date, open, high, low, close, volume, amount });
    }
  }
  
  return result;
}

function parseMinuteResponse(data: Record<string, unknown>): MootdxMinuteData[] {
  const result: MootdxMinuteData[] = [];
  
  const minutes = (data.minutes || data.data || []) as Record<string, unknown>[];
  
  if (!Array.isArray(minutes)) return result;
  
  for (const item of minutes) {
    if (!item || typeof item !== 'object') continue;
    
    const date = String(item.date || item.time || '');
    const price = Number(item.price || item.close || 0);
    const volume = Number(item.volume || item.vol || 0);
    
    if (date) {
      result.push({ date, price, volume });
    }
  }
  
  return result;
}

// ============ 带降级的数据获取 ============

export interface QuoteWithSource {
  data: MootdxQuoteData;
  source: 'mootdx' | 'eastmoney';
}

/**
 * 获取行情（带降级）
 * 先尝试 mootdx，失败则降级到东方财富
 * @param code 股票代码
 * @param fallback 降级获取函数
 */
export async function getQuoteWithFallback(
  code: string,
  fallback: () => Promise<MootdxQuoteData | null>
): Promise<QuoteWithSource | null> {
  // 先检查 mootdx 是否可用
  if (isMootdxAvailable()) {
    const result = await getQuote(code);
    if (result && result.price > 0) {
      return { data: result, source: 'mootdx' };
    }
    // mootdx 返回空数据，标记为不健康
    if (!result) {
      isHealthy = false;
      lastHealthCheck = Date.now();
    }
  }
  
  // 降级到东方财富
  const fallbackResult = await fallback();
  if (fallbackResult) {
    return { data: fallbackResult, source: 'eastmoney' };
  }
  
  return null;
}

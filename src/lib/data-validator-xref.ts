/**
 * 多数据源交叉验证模块 (Cross-Reference Validator)
 * 第31轮第3批需求
 * 
 * 功能：
 * - mootdx vs Tushare 行情/K线/财务数据交叉验证
 * - 可配置阈值，异步验证不阻塞主流程
 * - 5分钟内存缓存避免重复验证
 * - 异常数据console日志记录
 */

// ============ 配置 ============

interface XrefConfig {
  enabled: boolean;
  quoteThreshold: number;       // 行情验证阈值（如0.005 = 0.5%）
  klineThreshold: number;       // K线验证阈值（如0.001 = 0.1%）
  financialThreshold: number;   // 财务验证阈值（如0.01 = 1%）
  volumeThreshold: number;      // 成交量验证阈值（如0.05 = 5%）
  cacheTtl: number;             // 缓存过期时间（秒）
}

function getConfig(): XrefConfig {
  return {
    enabled: process.env.XREF_ENABLED !== 'false',
    quoteThreshold: parseFloat(process.env.XREF_QUOTE_THRESHOLD || '0.005'),
    klineThreshold: parseFloat(process.env.XREF_KLINE_THRESHOLD || '0.001'),
    financialThreshold: parseFloat(process.env.XREF_FINANCIAL_THRESHOLD || '0.01'),
    volumeThreshold: parseFloat(process.env.XREF_VOLUME_THRESHOLD || '0.05'),
    cacheTtl: parseInt(process.env.XREF_CACHE_TTL || '300', 10),
  };
}

// ============ 类型定义 ============

interface QuoteData {
  code: string;
  name?: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  amount?: number;
  pre_close?: number;
  timestamp?: number;
}

interface KLineItem {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount?: number;
}

interface FinancialData {
  code: string;
  pe?: number;
  pb?: number;
  roe?: number;
  [key: string]: number | string | undefined;
}

interface ValidationResult {
  verified: boolean;
  source: 'mootdx' | 'tushare' | 'eastmoney';
  overridden: boolean;
  diffPercent?: number;
  message?: string;
}

interface KlineValidationResult extends ValidationResult {
  overriddenIndices?: number[];
  fullSwitch?: boolean;
}

// ============ 缓存 ============

const cache = new Map<string, { data: any; timestamp: number }>();

function getCacheKey(type: 'quote' | 'kline' | 'financial', code: string): string {
  return `xref:${type}:${code}`;
}

function getCached<T>(key: string, ttl: number): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttl * 1000) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
  // 清理过期缓存（防止内存泄漏）
  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now - v.timestamp > 600000) cache.delete(k); // 10分钟未访问则清除
    }
  }
}

// ============ 交易时间判断 ============

function isTradingTime(): boolean {
  const now = new Date();
  // 转为北京时间
  const bjTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const day = bjTime.getUTCDay();
  if (day === 0 || day === 6) return false; // 周末
  const hours = bjTime.getUTCHours();
  const minutes = bjTime.getUTCMinutes();
  const t = hours * 60 + minutes;
  // 9:15-11:30, 13:00-15:00
  return (t >= 555 && t <= 690) || (t >= 780 && t <= 900);
}

// ============ Tushare 数据获取 ============

const TUSHARE_TOKEN = process.env.TUSHARE_TOKEN || '';
const TUSHARE_API_URL = 'https://api.tushare.pro';

async function tushareRequest(apiName: string, fields: string, params: Record<string, any>): Promise<any> {
  if (!TUSHARE_TOKEN) {
    console.warn('[XREF] Tushare token not configured, skipping validation');
    return null;
  }
  try {
    const response = await fetch(TUSHARE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_name: apiName,
        token: TUSHARE_TOKEN,
        params,
        fields,
      }),
    });
    const json = await response.json();
    if (json.code !== 0) {
      console.warn(`[XREF] Tushare ${apiName} error: ${json.msg}`);
      return null;
    }
    return json.data?.items || [];
  } catch (err) {
    console.warn(`[XREF] Tushare request failed:`, err);
    return null;
  }
}

/**
 * 获取Tushare最近一条日线收盘价
 */
async function getTushareLatestClose(code: string): Promise<{ close: number; tradeDate: string } | null> {
  const tsCode = normalizeTsCode(code);
  const data = await tushareRequest(
    'daily',
    'trade_date,close',
    { ts_code: tsCode, limit: 1 }
  );
  if (!data || data.length === 0) return null;
  return { close: parseFloat(data[0][1]), tradeDate: data[0][0] };
}

/**
 * 获取Tushare最近N条K线
 */
async function getTushareKline(code: string, count: number = 5): Promise<KLineItem[]> {
  const tsCode = normalizeTsCode(code);
  const data = await tushareRequest(
    'daily',
    'trade_date,open,high,low,close,vol,amount',
    { ts_code: tsCode, limit: count }
  );
  if (!data || data.length === 0) return [];
  return data.map((row: any[]) => ({
    date: row[0],
    open: parseFloat(row[1]),
    high: parseFloat(row[2]),
    low: parseFloat(row[3]),
    close: parseFloat(row[4]),
    volume: parseFloat(row[5]),
    amount: parseFloat(row[6] || 0),
  })).reverse();
}

/**
 * 获取Tushare财务因子（PE/PB等）
 */
async function getTushareFactor(code: string): Promise<Record<string, number> | null> {
  const tsCode = normalizeTsCode(code);
  const data = await tushareRequest(
    'daily_basic',
    'trade_date,pe,pb,total_mv',
    { ts_code: tsCode, limit: 1 }
  );
  if (!data || data.length === 0) return null;
  return {
    pe: parseFloat(data[0][1] || 0),
    pb: parseFloat(data[0][2] || 0),
  };
}

/**
 * 将 sh600000 格式转换为 600000.SH 格式
 */
function normalizeTsCode(code: string): string {
  const cleaned = code.toLowerCase().replace(/^(sh|sz)/, '');
  if (code.toLowerCase().startsWith('sh')) return `${cleaned}.SH`;
  if (code.toLowerCase().startsWith('sz')) return `${cleaned}.SZ`;
  // 默认推断
  if (cleaned.startsWith('6')) return `${cleaned}.SH`;
  return `${cleaned}.SZ`;
}

// ============ 验证统计 ============

let stats = {
  total: 0,
  passed: 0,
  failed: 0,
  failedCodes: new Set<string>(),
  lastReset: Date.now(),
};

function recordStat(code: string, passed: boolean) {
  stats.total++;
  if (passed) stats.passed++;
  else {
    stats.failed++;
    stats.failedCodes.add(code);
  }
}

export function getXrefStats() {
  const result = {
    ...stats,
    failedCodes: Array.from(stats.failedCodes),
    failRate: stats.total > 0 ? (stats.failed / stats.total).toFixed(4) : '0',
  };
  return result;
}

export function resetXrefStats() {
  stats = { total: 0, passed: 0, failed: 0, failedCodes: new Set(), lastReset: Date.now() };
}

// ============ 核心验证方法 ============

/**
 * 实时行情交叉验证
 * mootdx返回实时行情后，用Tushare最近一条日线收盘价做对比
 * 
 * 验证规则：
 * - 价格差异 ≤ 阈值 → 通过，使用mootdx数据
 * - 价格差异 > 阈值 → 标记异常，使用Tushare数据覆盖
 * - mootdx请求失败 → 直接用Tushare
 * - 非交易时间不做验证
 */
export async function crossValidateQuote(
  mootdxQuote: QuoteData | null
): Promise<{ data: QuoteData | null; validation: ValidationResult }> {
  const config = getConfig();
  if (!config.enabled) {
    return {
      data: mootdxQuote,
      validation: { verified: false, source: 'mootdx', overridden: false, message: 'xref disabled' },
    };
  }

  if (!mootdxQuote) {
    return {
      data: null,
      validation: { verified: false, source: 'mootdx', overridden: false, message: 'no mootdx data' },
    };
  }

  // 非交易时间不验证
  if (!isTradingTime()) {
    return {
      data: mootdxQuote,
      validation: { verified: false, source: 'mootdx', overridden: false, message: 'non-trading hours' },
    };
  }

  // 检查缓存
  const cacheKey = getCacheKey('quote', mootdxQuote.code);
  const cached = getCached<ValidationResult>(cacheKey, config.cacheTtl);
  if (cached) {
    return { data: mootdxQuote, validation: { ...cached, message: (cached.message || '') + ' (cached)' } };
  }

  // 获取Tushare验证数据
  const tsData = await getTushareLatestClose(mootdxQuote.code);
  if (!tsData) {
    const result: ValidationResult = { verified: false, source: 'mootdx', overridden: false, message: 'tushare unavailable' };
    setCache(cacheKey, result);
    return { data: mootdxQuote, validation: result };
  }

  const diff = Math.abs(mootdxQuote.price - tsData.close) / tsData.close;
  const passed = diff <= config.quoteThreshold;

  recordStat(mootdxQuote.code, passed);

  if (passed) {
    const result: ValidationResult = {
      verified: true,
      source: 'mootdx',
      overridden: false,
      diffPercent: parseFloat((diff * 100).toFixed(4)),
      message: `mootdx vs tushare diff ${(diff * 100).toFixed(3)}%`,
    };
    setCache(cacheKey, result);
    return { data: mootdxQuote, validation: result };
  } else {
    // 差异超过阈值，记录异常日志
    console.warn(
      `[XREF] quote mismatch ${mootdxQuote.code}: mootdx=${mootdxQuote.price} tushare=${tsData.close} diff=${(diff * 100).toFixed(3)}%`
    );
    const result: ValidationResult = {
      verified: false,
      source: 'tushare',
      overridden: true,
      diffPercent: parseFloat((diff * 100).toFixed(4)),
      message: `overridden by tushare, diff ${(diff * 100).toFixed(3)}%`,
    };
    setCache(cacheKey, result);
    // 使用Tushare数据覆盖价格
    const overriddenQuote: QuoteData = {
      ...mootdxQuote,
      price: tsData.close,
    };
    return { data: overriddenQuote, validation: result };
  }
}

/**
 * K线数据交叉验证
 * mootdx返回K线数据后，抽样最后5条与Tushare对比
 * 
 * 验证规则：
 * - OHLC任一字段差异 ≤ 阈值 → 通过
 * - 差异 > 阈值 → 使用Tushare数据覆盖该条K线
 * - 连续3条以上异常 → 全量切换为Tushare数据
 * - 成交量差异 > volumeThreshold → 标记异常
 */
export async function crossValidateKline(
  code: string,
  mootdxKline: KLineItem[],
  period: string = 'day'
): Promise<{ data: KLineItem[]; validation: KlineValidationResult }> {
  const config = getConfig();
  if (!config.enabled) {
    return {
      data: mootdxKline,
      validation: { verified: false, source: 'mootdx', overridden: false, message: 'xref disabled' },
    };
  }

  if (!mootdxKline || mootdxKline.length === 0) {
    return {
      data: [],
      validation: { verified: false, source: 'mootdx', overridden: false, message: 'no mootdx data' },
    };
  }

  // 分钟级K线不做验证
  if (['1min', '5min', '15min', '30min', '60min'].includes(period)) {
    return {
      data: mootdxKline,
      validation: { verified: false, source: 'mootdx', overridden: false, message: 'minute kline skipped' },
    };
  }

  // 检查缓存
  const cacheKey = getCacheKey('kline', code);
  const cached = getCached<KlineValidationResult>(cacheKey, config.cacheTtl);
  if (cached) {
    return { data: mootdxKline, validation: { ...cached, message: (cached.message || '') + ' (cached)' } };
  }

  // 获取Tushare K线数据对比（取最后5条）
  const sampleCount = Math.min(5, mootdxKline.length);
  const tsKline = await getTushareKline(code, sampleCount);

  if (!tsKline || tsKline.length === 0) {
    const result: KlineValidationResult = { verified: false, source: 'mootdx', overridden: false, message: 'tushare unavailable' };
    setCache(cacheKey, result);
    return { data: mootdxKline, validation: result };
  }

  // 对比最后N条K线
  const startIdx = Math.max(0, mootdxKline.length - sampleCount);
  const lastN = mootdxKline.slice(startIdx);
  const overriddenIndices: number[] = [];
  let consecutiveErrors = 0;
  let maxConsecutive = 0;

  for (let i = 0; i < Math.min(lastN.length, tsKline.length); i++) {
    const m = lastN[i];
    const t = tsKline[i];
    let hasError = false;

    // 对比OHLC
    const fields: (keyof KLineItem)[] = ['open', 'high', 'low', 'close'];
    for (const field of fields) {
      const mVal = m[field] as number;
      const tVal = t[field] as number;
      if (tVal === 0) continue;
      const diff = Math.abs(mVal - tVal) / tVal;
      if (diff > config.klineThreshold) {
        hasError = true;
        break;
      }
    }

    // 对比成交量
    if (!hasError && t.volume > 0) {
      const volDiff = Math.abs(m.volume - t.volume) / t.volume;
      if (volDiff > config.volumeThreshold) {
        hasError = true;
      }
    }

    if (hasError) {
      overriddenIndices.push(startIdx + i);
      consecutiveErrors++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveErrors);
    } else {
      consecutiveErrors = 0;
    }
  }

  recordStat(code, overriddenIndices.length === 0);

  // 连续3条以上异常 → 全量切换
  if (maxConsecutive >= 3) {
    console.warn(
      `[XREF] kline full-switch ${code}: ${maxConsecutive} consecutive errors, switching to tushare`
    );
    const result: KlineValidationResult = {
      verified: false,
      source: 'tushare',
      overridden: true,
      fullSwitch: true,
      overriddenIndices,
      message: `full switch to tushare, ${maxConsecutive} consecutive errors`,
    };
    setCache(cacheKey, result);
    return { data: tsKline, validation: result };
  }

  // 逐条覆盖异常K线
  if (overriddenIndices.length > 0) {
    const merged = [...mootdxKline];
    for (let i = 0; i < overriddenIndices.length; i++) {
      const idx = overriddenIndices[i];
      const tsIdx = idx - startIdx;
      if (tsIdx >= 0 && tsIdx < tsKline.length) {
        console.warn(
          `[XREF] kline override ${code}[${idx}]: mootdx close=${merged[idx].close} tushare close=${tsKline[tsIdx].close}`
        );
        merged[idx] = tsKline[tsIdx];
      }
    }
    const result: KlineValidationResult = {
      verified: true,
      source: 'mootdx',
      overridden: true,
      overriddenIndices,
      message: `overridden ${overriddenIndices.length} kline items`,
    };
    setCache(cacheKey, result);
    return { data: merged, validation: result };
  }

  // 全部通过
  const result: KlineValidationResult = {
    verified: true,
    source: 'mootdx',
    overridden: false,
    message: 'all passed',
  };
  setCache(cacheKey, result);
  return { data: mootdxKline, validation: result };
}

/**
 * 财务数据交叉验证
 * 东方财富返回PE/PB/ROE等指标后，与Tushare stk_factor对比
 * 
 * 验证规则：
 * - 差异 ≤ 阈值 → 通过
 * - 差异 > 阈值 → 使用Tushare数据
 */
export async function crossValidateFinancial(
  code: string,
  eastmoneyData: FinancialData | null
): Promise<{ data: FinancialData | null; validation: ValidationResult }> {
  const config = getConfig();
  if (!config.enabled) {
    return {
      data: eastmoneyData,
      validation: { verified: false, source: 'eastmoney', overridden: false, message: 'xref disabled' },
    };
  }

  if (!eastmoneyData) {
    return {
      data: null,
      validation: { verified: false, source: 'eastmoney', overridden: false, message: 'no eastmoney data' },
    };
  }

  // 检查缓存
  const cacheKey = getCacheKey('financial', code);
  const cached = getCached<ValidationResult>(cacheKey, config.cacheTtl);
  if (cached) {
    return { data: eastmoneyData, validation: { ...cached, message: (cached.message || '') + ' (cached)' } };
  }

  // 获取Tushare财务因子
  const tsFactor = await getTushareFactor(code);
  if (!tsFactor) {
    const result: ValidationResult = { verified: false, source: 'eastmoney', overridden: false, message: 'tushare unavailable' };
    setCache(cacheKey, result);
    return { data: eastmoneyData, validation: result };
  }

  let hasAnomaly = false;
  let maxDiff = 0;

  // 对比PE和PB
  const checkFields: Array<{ key: string; emVal: number | undefined; tsVal: number }> = [
    { key: 'pe', emVal: eastmoneyData.pe, tsVal: tsFactor.pe || 0 },
    { key: 'pb', emVal: eastmoneyData.pb, tsVal: tsFactor.pb || 0 },
  ];

  for (const { key, emVal, tsVal } of checkFields) {
    if (emVal === undefined || tsVal === 0) continue;
    const diff = Math.abs(emVal - tsVal) / Math.abs(tsVal);
    maxDiff = Math.max(maxDiff, diff);
    if (diff > config.financialThreshold) {
      console.warn(
        `[XREF] financial mismatch ${code}.${key}: eastmoney=${emVal} tushare=${tsVal} diff=${(diff * 100).toFixed(3)}%`
      );
      hasAnomaly = true;
    }
  }

  recordStat(code, !hasAnomaly);

  if (hasAnomaly) {
    // 使用Tushare数据覆盖
    const overriddenData: FinancialData = {
      ...eastmoneyData,
      pe: tsFactor.pe || eastmoneyData.pe,
      pb: tsFactor.pb || eastmoneyData.pb,
    };
    const result: ValidationResult = {
      verified: false,
      source: 'tushare',
      overridden: true,
      diffPercent: parseFloat((maxDiff * 100).toFixed(4)),
      message: `financial overridden, max diff ${(maxDiff * 100).toFixed(3)}%`,
    };
    setCache(cacheKey, result);
    return { data: overriddenData, validation: result };
  }

  const result: ValidationResult = {
    verified: true,
    source: 'eastmoney',
    overridden: false,
    diffPercent: parseFloat((maxDiff * 100).toFixed(4)),
    message: 'financial data verified',
  };
  setCache(cacheKey, result);
  return { data: eastmoneyData, validation: result };
}

// 导出类型供外部使用
export type { QuoteData, KLineItem, FinancialData, ValidationResult, KlineValidationResult };

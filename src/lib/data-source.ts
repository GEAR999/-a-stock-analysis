/**
 * 统一数据源管理器
 * 
 * 实现多数据源分层架构：
 * 1. Tushare Pro（主力）- 稳定、不限流
 * 2. 东方财富（备用）- 当 Tushare 失败时降级
 * 3. 本地缓存（兜底）- IndexedDB 缓存
 * 
 * 智能路由策略：
 * - 优先使用 Tushare
 * - Tushare 失败/超时自动降级到东方财富
 * - 两者都失败时返回缓存数据 + 提示
 * - 同一股票同一天数据只请求一次
 */

import type { KLineData } from "./types";
import { getCachedKline, setCachedKline } from "./idb-cache";

// ============================================================================
// 类型定义
// ============================================================================

export type KLinePeriod = "daily" | "weekly" | "monthly";

export interface DataSourceResult {
  success: boolean;
  data: KLineData[];
  source: "tushare" | "eastmoney" | "cache" | "none";
  error?: string;
  cachedAt?: number; // 缓存时间戳（如果是缓存数据）
}

export interface DataSourceConfig {
  // 数据源优先级（默认：tushare → eastmoney → cache）
  priority: ("tushare" | "eastmoney" | "cache")[];
  // Tushare 超时时间（毫秒）
  tushareTimeout: number;
  // 东方财富超时时间（毫秒）
  eastmoneyTimeout: number;
  // 是否启用缓存
  enableCache: boolean;
  // 缓存有效期（毫秒，默认24小时）
  cacheTTL: number;
}

const DEFAULT_CONFIG: DataSourceConfig = {
  priority: ["tushare", "eastmoney", "cache"],
  tushareTimeout: 10000,
  eastmoneyTimeout: 10000,
  enableCache: true,
  cacheTTL: 24 * 60 * 60 * 1000, // 24小时
};

// 内存缓存：同一股票同一天只请求一次
const requestCache = new Map<string, { data: KLineData[]; timestamp: number }>();
const REQUEST_CACHE_TTL = 60 * 60 * 1000; // 1小时

// ============================================================================
// Tushare 数据源
// ============================================================================

async function fetchFromTushare(
  code: string,
  period: KLinePeriod,
  startDate?: string,
  endDate?: string,
  timeout = 10000
): Promise<DataSourceResult> {
  const params = new URLSearchParams({
    code,
    period,
  });
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`/api/data/tushare?${params.toString()}`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return {
        success: false,
        data: [],
        source: "tushare",
        error: errorData?.error || `HTTP ${response.status}`,
      };
    }

    const result = await response.json();

    if (!result.success) {
      return {
        success: false,
        data: [],
        source: "tushare",
        error: result.error || "Tushare 返回失败",
      };
    }

    // 转换数据格式
    const data: KLineData[] = (result.data || []).map((item: {
      date: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      amount: number;
    }) => ({
      date: item.date,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
      amount: item.amount || 0,
    }));

    return {
      success: true,
      data,
      source: "tushare",
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      data: [],
      source: "tushare",
      error: errMsg.includes("abort") ? "请求超时" : errMsg,
    };
  }
}

// ============================================================================
// 东方财富数据源
// ============================================================================

async function fetchFromEastMoney(
  code: string,
  period: KLinePeriod,
  limit = 500,
  timeout = 10000
): Promise<DataSourceResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const params = new URLSearchParams({
      action: "kline",
      code,
      period,
      limit: limit.toString(),
    });

    const response = await fetch(`/api/stock?${params.toString()}`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        data: [],
        source: "eastmoney",
        error: `HTTP ${response.status}`,
      };
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      return {
        success: false,
        data: [],
        source: "eastmoney",
        error: result.error || "东方财富返回空数据",
      };
    }

    return {
      success: true,
      data: result.data,
      source: "eastmoney",
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      data: [],
      source: "eastmoney",
      error: errMsg.includes("abort") ? "请求超时" : errMsg,
    };
  }
}

// ============================================================================
// 缓存数据源
// ============================================================================

async function fetchFromCache(
  code: string,
  period: KLinePeriod
): Promise<DataSourceResult> {
  try {
    const cached = await getCachedKline(code, period);
    
    if (!cached || !Array.isArray(cached) || cached.length === 0) {
      return {
        success: false,
        data: [],
        source: "cache",
        error: "无缓存数据",
      };
    }

    // 转换为 KLineData 格式
    const data: KLineData[] = cached.map((item: unknown) => {
      const itemObj = item as Record<string, unknown>;
      return {
        date: String(itemObj.date || ""),
        open: Number(itemObj.open) || 0,
        high: Number(itemObj.high) || 0,
        low: Number(itemObj.low) || 0,
        close: Number(itemObj.close) || 0,
        volume: Number(itemObj.volume) || 0,
        amount: Number(itemObj.amount) || 0,
      };
    });

    return {
      success: true,
      data,
      source: "cache",
      cachedAt: Date.now(),
    };
  } catch {
    return {
      success: false,
      data: [],
      source: "cache",
      error: "读取缓存失败",
    };
  }
}

// ============================================================================
// 缓存写入
// ============================================================================

async function saveToCache(
  code: string,
  period: KLinePeriod,
  data: KLineData[]
): Promise<void> {
  try {
    await setCachedKline(code, period, data as unknown[]);
  } catch {
    // 缓存写入失败不影响主流程
    console.warn("[DataSource] 缓存写入失败:", code, period);
  }
}

// ============================================================================
// 内存缓存
// ============================================================================

function getMemoryCacheKey(code: string, period: KLinePeriod): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${code}:${period}:${today}`;
}

function getFromMemoryCache(code: string, period: KLinePeriod): KLineData[] | null {
  const key = getMemoryCacheKey(code, period);
  const cached = requestCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < REQUEST_CACHE_TTL) {
    return cached.data;
  }
  
  requestCache.delete(key);
  return null;
}

function setMemoryCache(code: string, period: KLinePeriod, data: KLineData[]): void {
  const key = getMemoryCacheKey(code, period);
  requestCache.set(key, { data, timestamp: Date.now() });
}

// ============================================================================
// 统一数据获取接口
// ============================================================================

/**
 * 获取K线数据（统一入口）
 * 
 * 智能路由策略：
 * 1. 先检查内存缓存（同一股票同一天只请求一次）
 * 2. 按优先级依次尝试各数据源
 * 3. 成功获取后写入缓存
 * 
 * @param code 股票代码（如 000001, 600519）
 * @param period K线周期（daily/weekly/monthly）
 * @param options 可选参数
 * @returns DataSourceResult 包含数据、来源、错误信息
 */
export async function fetchKLineData(
  code: string,
  period: KLinePeriod = "daily",
  options: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    config?: Partial<DataSourceConfig>;
  } = {}
): Promise<DataSourceResult> {
  const config = { ...DEFAULT_CONFIG, ...options.config };
  const { startDate, endDate, limit = 500 } = options;

  // 1. 检查内存缓存
  const memoryCached = getFromMemoryCache(code, period);
  if (memoryCached && memoryCached.length > 0) {
    return {
      success: true,
      data: memoryCached,
      source: "cache",
      cachedAt: Date.now(),
    };
  }

  // 2. 按优先级尝试各数据源
  const errors: string[] = [];

  for (const source of config.priority) {
    let result: DataSourceResult;

    switch (source) {
      case "tushare":
        result = await fetchFromTushare(code, period, startDate, endDate, config.tushareTimeout);
        break;
      case "eastmoney":
        result = await fetchFromEastMoney(code, period, limit, config.eastmoneyTimeout);
        break;
      case "cache":
        result = await fetchFromCache(code, period);
        break;
      default:
        continue;
    }

    if (result.success && result.data.length > 0) {
      // 成功获取数据，写入缓存
      if (config.enableCache && source !== "cache") {
        await saveToCache(code, period, result.data);
      }
      setMemoryCache(code, period, result.data);
      
      return result;
    }

    // 记录错误，继续尝试下一个数据源
    if (result.error) {
      errors.push(`[${source}] ${result.error}`);
    }
  }

  // 3. 所有数据源都失败
  return {
    success: false,
    data: [],
    source: "none",
    error: `所有数据源均失败: ${errors.join("; ")}`,
  };
}

/**
 * 批量获取K线数据
 */
export async function fetchKLineDataBatch(
  codes: string[],
  period: KLinePeriod = "daily",
  options: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    config?: Partial<DataSourceConfig>;
    onProgress?: (current: number, total: number, code: string) => void;
  } = {}
): Promise<Map<string, DataSourceResult>> {
  const results = new Map<string, DataSourceResult>();
  const { onProgress } = options;

  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    
    if (onProgress) {
      onProgress(i, codes.length, code);
    }

    const result = await fetchKLineData(code, period, options);
    results.set(code, result);
  }

  if (onProgress) {
    onProgress(codes.length, codes.length, "");
  }

  return results;
}

/**
 * 清除缓存
 */
export async function clearDataCache(code?: string): Promise<void> {
  // 清除内存缓存
  requestCache.clear();
  
  // 注意：IndexedDB 缓存的清除需要调用 idb-cache.ts 中的函数
  // 这里只清除内存缓存，避免误删重要数据
  if (code) {
    console.log("[DataSource] 已清除内存缓存:", code);
  } else {
    console.log("[DataSource] 已清除全部内存缓存");
  }
}

/**
 * 获取数据源状态
 */
export function getDataSourceStatus(): {
  memoryCacheSize: number;
  tushareAvailable: boolean;
} {
  return {
    memoryCacheSize: requestCache.size,
    tushareAvailable: true, // 实际可用性需要运行时检测
  };
}

/**
 * 统一数据源管理器
 *
 * 数据源架构（2026-08 改造）：
 * 1. Tushare Pro（历史数据主力，2000 积分）- 稳定、数据全
 * 2. /api/stock 备用通道（服务端 Tushare + 缓存）
 * 3. 本地缓存（兜底）- IndexedDB 缓存
 *
 * 已废弃：mootdx（连接成功但查询返回空数据）、东方财富 K 线直连（限流）
 *
 * 智能路由策略：
 * - Tushare → 备用通道 → 缓存
 * - 同一股票同一天数据只请求一次
 * - 请求队列避免并发限流
 */

import type { KLineData } from "./types";
import { getCachedKline, setCachedKline } from "./idb-cache";

// ============================================================================
// 类型定义
// ============================================================================

export type KLinePeriod = "daily" | "weekly" | "monthly";

// ============================================================================
// 错误类型定义
// ============================================================================

export enum DataSourceError {
  TUSHARE_RATE_LIMIT = 'TUSHARE_RATE_LIMIT',
  MOOTDX_UNAVAILABLE = 'MOOTDX_UNAVAILABLE',
  EASTMONEY_RATE_LIMIT = 'EASTMONEY_RATE_LIMIT',
  ALL_SOURCES_FAILED = 'ALL_SOURCES_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',
  SERVER_ERROR = 'SERVER_ERROR',
  NO_DATA = 'NO_DATA',
  DATA_FORMAT_ERROR = 'DATA_FORMAT_ERROR',
  CACHE_EXPIRED = 'CACHE_EXPIRED',
}

export interface DataSourceResult {
  success: boolean;
  data: KLineData[];
  source: "tushare" | "backup" | "cache" | "database" | "none";
  error?: DataSourceError;
  errorMessage?: string; // 面向用户的错误信息
  suggestion?: string; // 解决方案建议
  cachedAt?: number; // 缓存时间戳（如果是缓存数据）
}

// 错误信息映射（面向用户，避免技术术语）
export const ERROR_MESSAGES: Record<DataSourceError, { message: string; suggestion: string }> = {
  [DataSourceError.TUSHARE_RATE_LIMIT]: {
    message: '数据源请求频繁',
    suggestion: '已自动切换到备用数据源，数据可能略有延迟',
  },
  [DataSourceError.MOOTDX_UNAVAILABLE]: {
    message: '本地数据服务不可用',
    suggestion: '已切换到备用数据源，请检查服务状态',
  },
  [DataSourceError.EASTMONEY_RATE_LIMIT]: {
    message: '数据源请求频繁',
    suggestion: '请 30 秒后重试，或稍后再试',
  },
  [DataSourceError.ALL_SOURCES_FAILED]: {
    message: '数据服务暂时不可用',
    suggestion: '请稍后重试，或检查网络连接',
  },
  [DataSourceError.NETWORK_ERROR]: {
    message: '网络连接异常',
    suggestion: '请检查网络设置或刷新页面',
  },
  [DataSourceError.REQUEST_TIMEOUT]: {
    message: '请求超时',
    suggestion: '请稍后重试，或检查网络连接',
  },
  [DataSourceError.SERVER_ERROR]: {
    message: '服务器暂时不可用',
    suggestion: '请稍后重试，或联系管理员',
  },
  [DataSourceError.NO_DATA]: {
    message: '该股票暂无数据',
    suggestion: '可能停牌或退市，请确认股票代码',
  },
  [DataSourceError.DATA_FORMAT_ERROR]: {
    message: '数据格式异常',
    suggestion: '请联系管理员处理',
  },
  [DataSourceError.CACHE_EXPIRED]: {
    message: '缓存数据已过期',
    suggestion: '正在重新获取数据...',
  },
};

export interface DataSourceConfig {
  // 数据源优先级（默认：tushare → backup(/api/stock 备用通道) → cache）
  priority: ("tushare" | "backup" | "cache")[];
  // Tushare 超时时间（毫秒）
  tushareTimeout: number;
  // 备用通道超时时间（毫秒）
  backupTimeout: number;
  // 是否启用缓存
  enableCache: boolean;
  // 历史数据缓存有效期（毫秒，默认 7 天）
  historicalCacheTTL: number;
  // 实时数据缓存有效期（毫秒，默认 5 分钟）
  realtimeCacheTTL: number;
  // 数据源开关（用户可配置）
  enabled?: {
    tushare: boolean;
    backup: boolean;
  };
}

const DEFAULT_CONFIG: DataSourceConfig = {
  priority: ["tushare", "backup", "cache"],
  tushareTimeout: 10000,
  backupTimeout: 10000,
  enableCache: true,
  historicalCacheTTL: 7 * 24 * 60 * 60 * 1000, // 7 天
  realtimeCacheTTL: 5 * 60 * 1000, // 5 分钟
  enabled: {
    tushare: true,
    backup: true, // /api/stock 备用通道（服务端 Tushare + 缓存）
  },
};

/**
 * 从 localStorage 读取用户配置的数据源开关
 */
export function getUserDataSourceConfig(): DataSourceConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  
  const saved = localStorage.getItem('dataSourceConfig');
  if (!saved) return DEFAULT_CONFIG;
  
  try {
    const userConfig = JSON.parse(saved);
    return {
      ...DEFAULT_CONFIG,
      enabled: {
        tushare: userConfig.tushare ?? true,
        backup: userConfig.backup ?? true,
      },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

// 内存缓存：同一股票同一天只请求一次
const requestCache = new Map<string, { data: KLineData[]; timestamp: number }>();
const REQUEST_CACHE_TTL = 60 * 60 * 1000; // 1 小时

// ============================================================================
// 请求队列（避免并发限流）
// ============================================================================

class RequestQueue {
  private queue = new Map<string, Promise<any>>();
  private timeout = 8000; // 8 秒超时

  async request<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // 相同股票的请求，复用 Promise
    if (this.queue.has(key)) {
      return this.queue.get(key)!;
    }

    // 添加超时控制，避免慢请求阻塞队列
    const promise = Promise.race([
      fn(),
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('请求超时')), this.timeout)
      )
    ]).finally(() => {
      this.queue.delete(key);
    });

    this.queue.set(key, promise as Promise<T>);
    return promise as Promise<T>;
  }
}

const klineQueue = new RequestQueue();

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 服务端内部自调用凭证
 * middleware 校验 Authorization: Bearer <PUSH_TOKEN> 后放行，
 * 仅服务端生效（客户端 process.env.PUSH_TOKEN 为 undefined，不会注入 bundle）
 */
function internalAuthHeaders(): Record<string, string> {
  if (typeof window !== "undefined") return {};
  const token = process.env.PUSH_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * 判断是否为实时数据
 * - 日 K 线且请求条数<=5，视为实时数据
 * - 分钟线视为实时数据
 */
function isRealtimeData(period: KLinePeriod, limit: number): boolean {
  if (period === "daily" && limit <= 5) return true;
  if (period.includes("min")) return true;
  return false;
}

/**
 * 获取缓存 TTL
 */
function getCacheTTL(isRealtime: boolean, config: DataSourceConfig): number {
  return isRealtime ? config.realtimeCacheTTL : config.historicalCacheTTL;
}

// ============================================================================
// Tushare 数据源
// ============================================================================

async function fetchFromTushare(
  code: string,
  period: KLinePeriod,
  startDate?: string,
  endDate?: string,
  timeout = 10000,
  limit = 250
): Promise<DataSourceResult> {
  const params = new URLSearchParams({
    code,
    period,
    limit: String(limit),
  });
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // 后端环境需要使用完整 URL
    const baseUrl = typeof window === 'undefined' 
      ? (process.env.COZE_PROJECT_DOMAIN_DEFAULT || `http://localhost:${process.env.DEPLOY_RUN_PORT || 5000}`)
      : '';
    const tushareUrl = `${baseUrl}/api/data/tushare?${params.toString()}`;
    
    const response = await fetch(tushareUrl, {
      signal: controller.signal,
      headers: internalAuthHeaders(),
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
      error: errMsg.includes("abort") ? DataSourceError.REQUEST_TIMEOUT : DataSourceError.SERVER_ERROR,
    };
  }
}

// ============================================================================
// 备用通道（/api/stock，服务端 Tushare + 缓存）
// ============================================================================


// ============================================================================
// 缓存数据源
// ============================================================================

async function fetchFromCache(
  code: string,
  period: KLinePeriod,
  isRealtime = false,
  config: DataSourceConfig = DEFAULT_CONFIG
): Promise<DataSourceResult> {
  try {
    const cached = await getCachedKline(code, period, isRealtime);
    
    if (!cached || !Array.isArray(cached) || cached.length === 0) {
      return {
        success: false,
        data: [],
        source: "cache",
        error: DataSourceError.NO_DATA,
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
      error: DataSourceError.DATA_FORMAT_ERROR,
    };
  }
}

// ============================================================================
// 缓存写入
// ============================================================================

async function saveToCache(
  code: string,
  period: KLinePeriod,
  data: KLineData[],
  isRealtime = false
): Promise<void> {
  try {
    await setCachedKline(code, period, data as unknown[], isRealtime);
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
 * 获取 K 线数据（统一入口）
 * 
 * 智能路由策略：
 * 1. 先检查内存缓存（同一股票同一天只请求一次）
 * 2. 按优先级依次尝试各数据源
 * 3. 成功获取后写入缓存
 * 
 * @param code 股票代码（如 000001, 600519）
 * @param period K 线周期（daily/weekly/monthly）
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
  // 合并配置：默认配置 → 用户配置 → 传入配置
  const userConfig = getUserDataSourceConfig();
  const config = { ...DEFAULT_CONFIG, ...userConfig, ...options.config };
  const { startDate, endDate, limit = 500 } = options;

  // 判断是否为实时数据
  const isRealtime = isRealtimeData(period, limit);

  // 如果未指定优先级，默认：Tushare → 备用通道 → 缓存
  if (!options.config?.priority) {
    config.priority = ["tushare", "backup", "cache"];
  }

  // 使用请求队列，避免并发限流
  const queueKey = `${code}:${period}:${limit}`;
  
  return klineQueue.request(queueKey, async () => {
    // 1. 检查内存缓存
    const memoryCached = getFromMemoryCache(code, period);
    if (memoryCached && memoryCached.length > 0) {
      return {
        success: true,
        data: memoryCached,
        source: "cache" as const,
        cachedAt: Date.now(),
      };
    }

    // 2. 检查数据库缓存（后端）
    try {
      // 后端环境需要使用完整 URL
      const baseUrl = typeof window === 'undefined' 
        ? (process.env.COZE_PROJECT_DOMAIN_DEFAULT || `http://localhost:${process.env.DEPLOY_RUN_PORT || 5000}`)
        : '';
      const dbCacheUrl = `${baseUrl}/api/cache/kline?code=${code}&period=${period}&isRealtime=${isRealtime}`;
      const dbCacheResponse = await fetch(dbCacheUrl, { headers: internalAuthHeaders() });
      if (dbCacheResponse.ok) {
        const dbCacheResult = await dbCacheResponse.json();
        if (dbCacheResult.success && dbCacheResult.data) {
          // 写入内存缓存
          setMemoryCache(code, period, dbCacheResult.data);
          return {
            success: true,
            data: dbCacheResult.data,
            source: "database" as const,
            cachedAt: Date.now(),
          };
        }
      }
    } catch (error) {
      console.log('[DataSource] Database cache check failed:', error);
    }

    // 3. 按优先级尝试各数据源（只使用启用的数据源）
    const errors: string[] = [];

    for (const source of config.priority) {
      // 检查数据源是否启用
      if (source !== "cache" && config.enabled && !config.enabled[source as keyof typeof config.enabled]) {
        console.log(`[DataSource] ${source} is disabled, skipping`);
        continue;
      }

      let result: DataSourceResult;

      switch (source) {
        case "tushare":
          result = await fetchFromTushare(code, period, startDate, endDate, config.tushareTimeout, limit);
          break;
        case "backup":
          // backup 通道已废弃（原东方财富），降级为 Tushare
          result = await fetchFromTushare(code, period, startDate, endDate, config.tushareTimeout, limit);
          break;
        case "cache":
          result = await fetchFromCache(code, period, isRealtime, config);
          break;
        default:
          continue;
      }

      if (result.success && result.data.length > 0) {
        // 成功获取数据，写入缓存
        if (config.enableCache && source !== "cache") {
          await saveToCache(code, period, result.data, isRealtime);
          
          // 写入数据库缓存（后端）
          try {
            const baseUrl = typeof window === 'undefined' 
              ? (process.env.COZE_PROJECT_DOMAIN_DEFAULT || `http://localhost:${process.env.DEPLOY_RUN_PORT || 5000}`)
              : '';
            await fetch(`${baseUrl}/api/cache/kline`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...internalAuthHeaders() },
              body: JSON.stringify({
                code,
                period,
                data: result.data,
                source: result.source,
                isRealtime,
              }),
            });
          } catch (error) {
            console.log('[DataSource] Database cache save failed:', error);
          }
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
      source: "none" as const,
      error: DataSourceError.ALL_SOURCES_FAILED,
    };
  });
}

/**
 * 批量获取 K 线数据
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

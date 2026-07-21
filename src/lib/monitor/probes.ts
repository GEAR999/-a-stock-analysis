/**
 * 健康检查探针模块
 * 第31轮第4批需求
 * 
 * 对三个数据源进行健康探测：
 * - mootdx: HTTP health endpoint
 * - Tushare: API调用测试
 * - 东方财富: HTTP请求测试
 */

import { ProbeResult, DataSourceName, SourceStatus, HealthSnapshot } from './types';

// ============ 配置 ============

const MOOTDX_BASE_URL = process.env.MOOTDX_SERVER_URL || 'http://47.122.115.203:8888';
const MOOTDX_HEALTH_URL = process.env.MOOTDX_HEALTH_URL || `${MOOTDX_BASE_URL}/health`;
const PROBE_TIMEOUT = parseInt(process.env.PROBE_TIMEOUT || '5000', 10);
const CACHE_TTL = parseInt(process.env.HEALTH_CHECK_CACHE_TTL || '60', 10);
const TUSHARE_TOKEN = process.env.TUSHARE_TOKEN || '';

// ============ 探针缓存 ============

const probeCache = new Map<DataSourceName, { result: ProbeResult; timestamp: number }>();

function getCachedProbe(source: DataSourceName): ProbeResult | null {
  const entry = probeCache.get(source);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL * 1000) {
    probeCache.delete(source);
    return null;
  }
  return entry.result;
}

function setProbeCache(source: DataSourceName, result: ProbeResult): void {
  probeCache.set(source, { result, timestamp: Date.now() });
}

// ============ 通用请求（带超时） ============

async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ============ mootdx 探针 ============

async function probeMootdx(): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(MOOTDX_HEALTH_URL, PROBE_TIMEOUT);
    const latency = Date.now() - start;
    if (!res.ok) {
      return {
        source: 'mootdx',
        status: 'degraded',
        latency,
        lastCheck: new Date().toISOString(),
        lastError: `HTTP ${res.status}`,
      };
    }
    const data = await res.json();
    if (data.status === 'ok') {
      return {
        source: 'mootdx',
        status: 'ok',
        latency,
        lastCheck: new Date().toISOString(),
        lastError: null,
      };
    }
    return {
      source: 'mootdx',
      status: 'degraded',
      latency,
      lastCheck: new Date().toISOString(),
      lastError: `Unexpected response: ${JSON.stringify(data)}`,
    };
  } catch (err) {
    const latency = Date.now() - start;
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      source: 'mootdx',
      status: 'down',
      latency,
      lastCheck: new Date().toISOString(),
      lastError: errMsg.includes('abort') ? 'Timeout' : errMsg,
    };
  }
}

// ============ Tushare 探针 ============

async function probeTushare(): Promise<ProbeResult> {
  if (!TUSHARE_TOKEN) {
    return {
      source: 'tushare',
      status: 'down',
      latency: 0,
      lastCheck: new Date().toISOString(),
      lastError: 'TUSHARE_TOKEN not configured',
    };
  }

  const start = Date.now();
  try {
    const res = await fetchWithTimeout('https://api.tushare.pro', PROBE_TIMEOUT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_name: 'trade_cal',
        token: TUSHARE_TOKEN,
        params: { exchange: 'SSE', start_date: '20260101', end_date: '20260102' },
        fields: 'cal_date',
      }),
    });
    const latency = Date.now() - start;
    const json = await res.json();

    if (json.code === 0) {
      return {
        source: 'tushare',
        status: 'ok',
        latency,
        lastCheck: new Date().toISOString(),
        lastError: null,
      };
    }

    // 限流错误
    if (json.code === -2004 || json.code === -2001) {
      return {
        source: 'tushare',
        status: 'degraded',
        latency,
        lastCheck: new Date().toISOString(),
        lastError: `Rate limited: ${json.msg}`,
      };
    }

    return {
      source: 'tushare',
      status: 'degraded',
      latency,
      lastCheck: new Date().toISOString(),
      lastError: `API error: ${json.msg}`,
    };
  } catch (err) {
    const latency = Date.now() - start;
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      source: 'tushare',
      status: 'down',
      latency,
      lastCheck: new Date().toISOString(),
      lastError: errMsg.includes('abort') ? 'Timeout' : errMsg,
    };
  }
}

// ============ 东方财富 探针 ============

async function probeEastmoney(): Promise<ProbeResult> {
  const start = Date.now();
  try {
    // 东方财富实时行情接口（测试用，查上证指数）
    const url = 'https://push2.eastmoney.com/api/qt/stock/get?secid=1.000001&fields=f43,f44,f45,f46,f47';
    const res = await fetchWithTimeout(url, PROBE_TIMEOUT, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://quote.eastmoney.com/',
      },
    });
    const latency = Date.now() - start;

    if (res.status === 403) {
      return {
        source: 'eastmoney',
        status: 'down',
        latency,
        lastCheck: new Date().toISOString(),
        lastError: 'IP blocked (403)',
      };
    }

    if (res.status >= 500) {
      return {
        source: 'eastmoney',
        status: 'degraded',
        latency,
        lastCheck: new Date().toISOString(),
        lastError: `Server error: HTTP ${res.status}`,
      };
    }

    if (!res.ok) {
      return {
        source: 'eastmoney',
        status: 'degraded',
        latency,
        lastCheck: new Date().toISOString(),
        lastError: `HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    if (data?.data?.f43) {
      return {
        source: 'eastmoney',
        status: 'ok',
        latency,
        lastCheck: new Date().toISOString(),
        lastError: null,
      };
    }

    return {
      source: 'eastmoney',
      status: 'degraded',
      latency,
      lastCheck: new Date().toISOString(),
      lastError: 'Invalid data returned',
    };
  } catch (err) {
    const latency = Date.now() - start;
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      source: 'eastmoney',
      status: 'down',
      latency,
      lastCheck: new Date().toISOString(),
      lastError: errMsg.includes('abort') ? 'Timeout' : errMsg,
    };
  }
}

// ============ 探针调度 ============

const PROBE_MAP: Record<DataSourceName, () => Promise<ProbeResult>> = {
  mootdx: probeMootdx,
  tushare: probeTushare,
  eastmoney: probeEastmoney,
};

/**
 * 执行单个数据源探针检测
 */
export async function runProbe(source: DataSourceName, forceRefresh = false): Promise<ProbeResult> {
  if (!forceRefresh) {
    const cached = getCachedProbe(source);
    if (cached) return cached;
  }
  const probeFn = PROBE_MAP[source];
  if (!probeFn) {
    return {
      source,
      status: 'down',
      latency: 0,
      lastCheck: new Date().toISOString(),
      lastError: `Unknown source: ${source}`,
    };
  }
  const result = await probeFn();
  setProbeCache(source, result);
  return result;
}

/**
 * 执行全量探针检测
 */
export async function runAllProbes(forceRefresh = false): Promise<Record<DataSourceName, ProbeResult>> {
  const [mootdx, tushare, eastmoney] = await Promise.all([
    runProbe('mootdx', forceRefresh),
    runProbe('tushare', forceRefresh),
    runProbe('eastmoney', forceRefresh),
  ]);
  return { mootdx, tushare, eastmoney };
}

/**
 * 获取探针缓存结果（不发起请求）
 */
export function getCachedProbes(): Record<DataSourceName, ProbeResult> | null {
  const m = getCachedProbe('mootdx');
  const t = getCachedProbe('tushare');
  const e = getCachedProbe('eastmoney');
  if (!m || !t || !e) return null;
  return { mootdx: m, tushare: t, eastmoney: e };
}

/**
 * 清除探针缓存
 */
export function clearProbeCache(): void {
  probeCache.clear();
}

/**
 * 将探针结果转为健康快照（用于存DB）
 */
export function probeToSnapshot(probe: ProbeResult): HealthSnapshot {
  return {
    source_name: probe.source,
    status: probe.status,
    latency_ms: probe.latency,
    error_message: probe.lastError,
    checked_at: probe.lastCheck,
  };
}

/**
 * 自动修复（数据源降级/恢复）模块
 * 第31轮第4批需求
 * 
 * 数据源自动降级策略：
 * - mootdx挂了 → 切Tushare
 * - Tushare限流 → 等待10秒后恢复
 * - 东方财富封IP → 标记30分钟不可用
 * - 所有源都挂 → 返回缓存数据
 */

import { DataSourceName, SourceStatus, FallbackRecord, HealthEvent } from './types';
import { runProbe } from './probes';
import { alertSourceDown, alertAllSourcesDown, alertSourceRecovered, alertFallback } from './alert';

// ============ 数据源状态管理 ============

interface SourceState {
  status: SourceStatus;
  unavailableUntil: number;  // 0 = 正常可用
  lastError: string | null;
  fallbackTo: DataSourceName | 'cache' | null;
}

const sourceStates: Record<DataSourceName, SourceState> = {
  mootdx: { status: 'ok', unavailableUntil: 0, lastError: null, fallbackTo: null },
  tushare: { status: 'ok', unavailableUntil: 0, lastError: null, fallbackTo: null },
  eastmoney: { status: 'ok', unavailableUntil: 0, lastError: null, fallbackTo: null },
};

// ============ 降级记录 ============

const fallbackHistory: FallbackRecord[] = [];
const MAX_FALLBACK_HISTORY = 200;

function recordFallback(record: FallbackRecord): void {
  fallbackHistory.unshift(record);
  if (fallbackHistory.length > MAX_FALLBACK_HISTORY) {
    fallbackHistory.length = MAX_FALLBACK_HISTORY;
  }
}

export function getFallbackHistory(): FallbackRecord[] {
  return [...fallbackHistory];
}

// ============ 数据源优先级 ============

// 主数据源排序：mootdx > tushare > eastmoney
const SOURCE_PRIORITY: DataSourceName[] = ['mootdx', 'tushare', 'eastmoney'];

function getNextAvailableSource(exclude: DataSourceName): DataSourceName | null {
  for (const src of SOURCE_PRIORITY) {
    if (src === exclude) continue;
    const state = sourceStates[src];
    if (state.status !== 'down' && Date.now() > state.unavailableUntil) {
      return src;
    }
  }
  return null;
}

// ============ 自动降级 ============

/**
 * 当数据源出错时自动降级
 * @returns 降级后应使用的数据源
 */
export async function autoFallback(
  currentSource: DataSourceName,
  error: Error | string
): Promise<{ targetSource: DataSourceName | 'cache'; reason: string }> {
  const errMsg = error instanceof Error ? error.message : error;
  const state = sourceStates[currentSource];

  // 更新当前源状态
  state.status = 'down';
  state.lastError = errMsg;

  // 根据错误类型设置不可用时间
  if (currentSource === 'tushare' && errMsg.includes('rate') || errMsg.includes('限流')) {
    // Tushare限流 → 10秒后恢复
    state.unavailableUntil = Date.now() + 10000;
    state.status = 'degraded';
  } else if (currentSource === 'eastmoney' && errMsg.includes('403')) {
    // 东方财富封IP → 30分钟不可用
    state.unavailableUntil = Date.now() + 30 * 60 * 1000;
  } else {
    // 其他错误 → 5分钟后尝试
    state.unavailableUntil = Date.now() + 5 * 60 * 1000;
  }

  // 寻找替代源
  const altSource = getNextAvailableSource(currentSource);

  if (!altSource) {
    // 所有源都挂了
    await alertAllSourcesDown();
    recordFallback({
      timestamp: new Date().toISOString(),
      reason: `所有数据源不可用: ${errMsg}`,
      fromSource: currentSource,
      toSource: 'cache',
    });
    return { targetSource: 'cache', reason: '所有数据源不可用，使用缓存数据' };
  }

  // 切换
  state.fallbackTo = altSource;
  await alertFallback(currentSource, errMsg);

  recordFallback({
    timestamp: new Date().toISOString(),
    reason: errMsg,
    fromSource: currentSource,
    toSource: altSource,
  });

  console.log(`[AUTO-FIX] ${currentSource} → ${altSource} (reason: ${errMsg})`);

  return { targetSource: altSource, reason: `${currentSource}降级: ${errMsg}` };
}

// ============ 自动恢复 ============

/**
 * 检查并恢复已恢复的数据源
 * 在每次数据请求前调用（低频开销）
 */
export async function checkRecovery(): Promise<DataSourceName[]> {
  const recovered: DataSourceName[] = [];
  const now = Date.now();

  for (const source of SOURCE_PRIORITY) {
    const state = sourceStates[source];
    if (state.status === 'ok') continue;
    if (now < state.unavailableUntil) continue;

    // 尝试探测
    const probe = await runProbe(source, true);
    if (probe.status === 'ok') {
      const wasDown = state.status === 'down';
      state.status = 'ok';
      state.unavailableUntil = 0;
      state.lastError = null;
      state.fallbackTo = null;

      if (wasDown) {
        recovered.push(source);
        await alertSourceRecovered(source);
        console.log(`[AUTO-FIX] ${source} 已恢复`);
      }
    } else {
      // 仍未恢复，延长不可用时间
      state.unavailableUntil = now + 60000; // 1分钟后重试
    }
  }

  return recovered;
}

// ============ 获取当前可用数据源 ============

/**
 * 获取当前最佳可用数据源
 */
export function getBestAvailableSource(): DataSourceName {
  const now = Date.now();
  for (const source of SOURCE_PRIORITY) {
    const state = sourceStates[source];
    if (state.status === 'down' && now < state.unavailableUntil) continue;
    if (now >= state.unavailableUntil && state.status !== 'ok') {
      // 标记为可用，等待下次请求验证
      state.status = 'ok';
      state.unavailableUntil = 0;
    }
    return source;
  }
  // 都不可用时返回第一优先级（让调用方处理错误）
  return 'mootdx';
}

/**
 * 获取所有数据源状态
 */
export function getAllSourceStates(): Record<DataSourceName, SourceState> {
  return { ...sourceStates };
}

/**
 * 手动设置数据源状态
 */
export function setSourceState(source: DataSourceName, state: Partial<SourceState>): void {
  Object.assign(sourceStates[source], state);
}

/**
 * 重置所有状态
 */
export function resetAllStates(): void {
  for (const src of SOURCE_PRIORITY) {
    sourceStates[src] = { status: 'ok', unavailableUntil: 0, lastError: null, fallbackTo: null };
  }
}

// ============ 请求统计 ============

interface StatsEntry {
  total: number;
  success: number;
  failed: number;
  totalLatency: number;
  fallbackCount: number;
  resetAt: number;
}

const hourlyStats: StatsEntry = {
  total: 0,
  success: 0,
  failed: 0,
  totalLatency: 0,
  fallbackCount: 0,
  resetAt: Date.now() + 3600000, // 1小时后重置
};

export function recordRequest(success: boolean, latency: number, isFallback: boolean = false): void {
  // 检查是否需要重置
  if (Date.now() > hourlyStats.resetAt) {
    hourlyStats.total = 0;
    hourlyStats.success = 0;
    hourlyStats.failed = 0;
    hourlyStats.totalLatency = 0;
    hourlyStats.fallbackCount = 0;
    hourlyStats.resetAt = Date.now() + 3600000;
  }

  hourlyStats.total++;
  if (success) hourlyStats.success++;
  else hourlyStats.failed++;
  hourlyStats.totalLatency += latency;
  if (isFallback) hourlyStats.fallbackCount++;
}

export function getHourlyStats() {
  return {
    last1h_requests: hourlyStats.total,
    last1h_success_rate: hourlyStats.total > 0 ? hourlyStats.success / hourlyStats.total : 1,
    last1h_avg_latency: hourlyStats.total > 0 ? Math.round(hourlyStats.totalLatency / hourlyStats.total) : 0,
    last1h_fallback_count: hourlyStats.fallbackCount,
  };
}

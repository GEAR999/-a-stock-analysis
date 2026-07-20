/**
 * API Client - 统一请求层
 * 功能：指数退避重试、请求去重、超时控制、离线缓存兜底
 */

// ============================================================
// 类型定义
// ============================================================

export type ApiErrorType = 'network' | 'timeout' | 'not_found' | 'server' | 'unknown';

export interface ApiError extends Error {
  type: ApiErrorType;
  status?: number;
  url: string;
  retryable: boolean;
}

export interface FetchWithRetryOptions extends RequestInit {
  /** 最大重试次数，默认3 */
  maxRetries?: number;
  /** 单次请求超时时间(ms)，默认10000 */
  timeout?: number;
  /** 缓存key，用于去重和离线缓存。不传则自动生成 */
  cacheKey?: string;
  /** 是否启用请求去重，默认true */
  dedupe?: boolean;
  /** 是否启用离线缓存兜底，默认false */
  offlineFallback?: boolean;
  /** 离线缓存的key（用于IndexedDB存储），不传则用cacheKey */
  offlineCacheKey?: string;
}

// ============================================================
// 错误分类
// ============================================================

function classifyError(error: unknown, url: string): ApiError {
  const apiError = new Error() as ApiError;
  apiError.url = url;

  if (error instanceof DOMException && error.name === 'AbortError') {
    apiError.type = 'timeout';
    apiError.message = '数据请求超时';
    apiError.retryable = true;
    return apiError;
  }

  if (error instanceof TypeError) {
    // Network errors (CORS, DNS, offline, etc.)
    apiError.type = 'network';
    apiError.message = '网络连接失败';
    apiError.retryable = true;
    return apiError;
  }

  if (error instanceof Response) {
    const status = error.status;
    apiError.status = status;
    if (status === 404) {
      apiError.type = 'not_found';
      apiError.message = '数据暂不可用';
      apiError.retryable = false;
    } else if (status >= 500) {
      apiError.type = 'server';
      apiError.message = '数据服务暂时繁忙';
      apiError.retryable = true;
    } else if (status >= 400) {
      apiError.type = 'unknown';
      apiError.message = `请求错误 (${status})`;
      apiError.retryable = false;
    } else {
      apiError.type = 'unknown';
      apiError.message = `未知错误 (${status})`;
      apiError.retryable = false;
    }
    return apiError;
  }

  apiError.type = 'unknown';
  apiError.message = error instanceof Error ? error.message : '未知错误';
  apiError.retryable = false;
  return apiError;
}

function getErrorMessage(type: ApiErrorType, status?: number): string {
  switch (type) {
    case 'network':
      return '网络连接失败，请检查网络后重试';
    case 'timeout':
      return '数据请求超时，正在重试...';
    case 'not_found':
      return '该股票数据暂不可用';
    case 'server':
      return `数据服务暂时繁忙${status ? ` (${status})` : ''}，请稍后重试`;
    default:
      return status ? `请求错误 (${status})` : '未知错误，请稍后重试';
  }
}

export { getErrorMessage };

// ============================================================
// 请求去重
// ============================================================

const pendingRequests = new Map<string, Promise<Response>>();

function buildDedupeKey(url: string, options?: RequestInit): string {
  const method = options?.method || 'GET';
  const body = options?.body ? String(options.body) : '';
  return `${method}:${url}:${body}`;
}

// ============================================================
// 离线缓存 (IndexedDB)
// ============================================================

const OFFLINE_DB_NAME = 'api_offline_cache';
const OFFLINE_STORE_NAME = 'responses';
const OFFLINE_DB_VERSION = 1;
const OFFLINE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface OfflineCacheEntry {
  key: string;
  data: unknown;
  cachedAt: number;
}

function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFLINE_STORE_NAME)) {
        db.createObjectStore(OFFLINE_STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedResponse(key: string): Promise<{ data: unknown; cachedAt: number } | null> {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction(OFFLINE_STORE_NAME, 'readonly');
      const store = tx.objectStore(OFFLINE_STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const entry = request.result as OfflineCacheEntry | undefined;
        if (!entry) {
          resolve(null);
          return;
        }
        if (Date.now() - entry.cachedAt > OFFLINE_CACHE_TTL) {
          resolve(null);
          return;
        }
        resolve({ data: entry.data, cachedAt: entry.cachedAt });
      };
      request.onerror = () => resolve(null);
      db.close();
    });
  } catch {
    return null;
  }
}

async function setCachedResponse(key: string, data: unknown): Promise<void> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(OFFLINE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(OFFLINE_STORE_NAME);
    store.put({ key, data, cachedAt: Date.now() } as OfflineCacheEntry);
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    // silently fail
  }
}

// ============================================================
// 核心：fetchWithRetry
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  options?: FetchWithRetryOptions
): Promise<Response> {
  const {
    maxRetries = 3,
    timeout = 10000,
    cacheKey,
    dedupe = true,
    offlineFallback = false,
    offlineCacheKey,
    ...fetchOptions
  } = options || {};

  const dedupeKey = buildDedupeKey(url, fetchOptions);

  // 请求去重：如果相同请求正在进行中，直接复用
  if (dedupe && pendingRequests.has(dedupeKey)) {
    return pendingRequests.get(dedupeKey)!;
  }

  const doFetch = async (): Promise<Response> => {
    let lastError: ApiError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // 指数退避：1s, 2s, 4s
      if (attempt > 0) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.warn(`[API] 重试第${attempt}次:`, url);
        await sleep(delay);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // 4xx 不重试
        if (response.status >= 400 && response.status < 500) {
          if (!response.ok) {
            const err = classifyError(response, url);
            err.message = getErrorMessage(err.type, err.status);
            throw err;
          }
          return response;
        }

        // 5xx 可重试
        if (response.status >= 500) {
          lastError = classifyError(response, url);
          lastError.message = getErrorMessage(lastError.type, lastError.status);
          continue;
        }

        // 成功 - 缓存到离线存储
        if (response.ok && offlineFallback) {
          const key = offlineCacheKey || cacheKey || dedupeKey;
          try {
            const data = await response.clone().json();
            await setCachedResponse(key, data);
          } catch {
            // 缓存失败不影响正常流程
          }
        }

        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = classifyError(error, url);
        lastError.message = getErrorMessage(lastError.type, lastError.status);

        // 不可重试的错误直接抛出
        if (!lastError.retryable) {
          throw lastError;
        }
      }
    }

    // 所有重试都失败了
    throw lastError || new Error('请求失败');
  };

  // 去重逻辑
  if (dedupe) {
    const promise = doFetch().finally(() => {
      pendingRequests.delete(dedupeKey);
    });
    pendingRequests.set(dedupeKey, promise);
    return promise;
  }

  return doFetch();
}

// ============================================================
// dedupedFetch - 独立去重函数
// ============================================================

export async function dedupedFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  return fetchWithRetry(url, { ...options, dedupe: true, maxRetries: 0 });
}

// ============================================================
// fetchWithOfflineFallback - 带离线缓存兜底的请求
// ============================================================

export async function fetchWithOfflineFallback(
  url: string,
  cacheKey: string,
  options?: Omit<FetchWithRetryOptions, 'offlineFallback' | 'offlineCacheKey'>
): Promise<{ data: unknown; isOffline: boolean; cachedAt?: number }> {
  try {
    const response = await fetchWithRetry(url, {
      ...options,
      offlineFallback: true,
      offlineCacheKey: cacheKey,
    });
    const data = await response.json();
    return { data, isOffline: false };
  } catch (error) {
    // 尝试从离线缓存读取
    const cached = await getCachedResponse(cacheKey);
    if (cached) {
      return { data: cached.data, isOffline: true, cachedAt: cached.cachedAt };
    }
    // 缓存也没有，抛出原始错误
    throw error;
  }
}

// ============================================================
// 网络状态监听
// ============================================================

export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

// ============================================================
// 业务API封装 (兼容原有 api 对象调用方式)
// ============================================================

interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function apiRequest<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const res = await fetchWithRetry(url, { ...options, dedupe: false });
    const json = await res.json();
    if (json.success) {
      return { ok: true, data: json.data as T };
    }
    return { ok: false, error: json.error || '请求失败' };
  } catch (error) {
    const apiError = error as ApiError;
    return { ok: false, error: apiError.message || '网络错误' };
  }
}

export const api = {
  auth: {
    me: () => apiRequest('/api/auth/me'),
    login: (email: string, password: string) =>
      apiRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }),
    register: (email: string, username: string, password: string) =>
      apiRequest('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
      }),
    logout: () => apiRequest('/api/auth/logout', { method: 'POST' }),
  },
  accounts: {
    create: (data: Record<string, unknown>) =>
      apiRequest('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    list: () => apiRequest('/api/accounts'),
    delete: (id: string) =>
      apiRequest(`/api/accounts/${id}`, { method: 'DELETE' }),
  },
  transactions: {
    create: (data: Record<string, unknown>) =>
      apiRequest('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    list: (accountId?: string) =>
      apiRequest(`/api/transactions${accountId ? `?accountId=${accountId}` : ''}`),
  },
  watchlist: {
    add: (data: Record<string, unknown>) =>
      apiRequest('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    list: () => apiRequest('/api/watchlist'),
    remove: (id: string) =>
      apiRequest(`/api/watchlist?id=${id}`, { method: 'DELETE' }),
  },
  strategies: {
    createCustom: (data: Record<string, unknown>) =>
      apiRequest('/api/strategies/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    createTemplate: (data: Record<string, unknown>) =>
      apiRequest('/api/strategies/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    listCustom: () => apiRequest('/api/strategies/custom'),
    listTemplates: () => apiRequest('/api/strategies/templates'),
  },
  positions: {
    list: (accountId?: string) =>
      apiRequest(`/api/positions${accountId ? `?accountId=${accountId}` : ''}`),
  },
};

// ============================================================
// 数据校验集成
// ============================================================

import { validateKLineData, validateStockQuote, validateSearchResult, withValidation } from './data-validator';

/**
 * 带数据校验的API请求
 * 自动校验返回数据的结构完整性
 */
export async function fetchWithValidation<T>(
  url: string,
  validator: (raw: unknown) => T,
  fallback: T,
  options?: { maxRetries?: number; timeout?: number; cacheKey?: string }
): Promise<T> {
  try {
    const response = await fetchWithRetry(url, options);
    const json = await response.json();

    if (json.success && json.data !== undefined) {
      return withValidation(json.data, validator, fallback);
    }

    return fallback;
  } catch (error) {
    console.warn('[API] fetchWithValidation error:', url, error);
    return fallback;
  }
}

// 导出校验函数供直接使用
export { validateKLineData, validateStockQuote, validateSearchResult };

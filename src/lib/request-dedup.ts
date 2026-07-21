/**
 * 请求去重工具
 * 在指定时间内（默认10秒）对相同key的请求进行去重，避免重复请求
 */

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

// 全局缓存，存储正在进行的请求
const pendingRequests = new Map<string, PendingRequest<unknown>>();

// 默认去重时间（毫秒）
const DEFAULT_DEDUP_TIME = 10000;

/**
 * 执行去重请求
 * @param key 请求唯一标识
 * @param requestFn 请求函数
 * @param dedupTime 去重时间（毫秒），默认10秒
 * @returns Promise<T>
 */
export async function dedupRequest<T>(
  key: string,
  requestFn: () => Promise<T>,
  dedupTime: number = DEFAULT_DEDUP_TIME
): Promise<T> {
  const now = Date.now();
  
  // 检查是否有相同key的 pending 请求且在去重时间内
  const pending = pendingRequests.get(key) as PendingRequest<T> | undefined;
  if (pending && now - pending.timestamp < dedupTime) {
    // 返回已有的 promise
    return pending.promise;
  }
  
  // 创建新请求
  const promise = requestFn().finally(() => {
    // 请求完成后，延迟删除缓存（保持去重窗口）
    setTimeout(() => {
      const current = pendingRequests.get(key);
      if (current && current.promise === promise) {
        pendingRequests.delete(key);
      }
    }, dedupTime);
  });
  
  // 缓存请求
  pendingRequests.set(key, { promise, timestamp: now });
  
  return promise;
}

/**
 * 清除指定key的缓存
 * @param key 请求唯一标识
 */
export function clearDedupCache(key: string): void {
  pendingRequests.delete(key);
}

/**
 * 清除所有缓存
 */
export function clearAllDedupCache(): void {
  pendingRequests.clear();
}

/**
 * 检查指定key是否有 pending 请求
 * @param key 请求唯一标识
 */
export function hasPendingRequest(key: string): boolean {
  const pending = pendingRequests.get(key);
  if (!pending) return false;
  return Date.now() - pending.timestamp < DEFAULT_DEDUP_TIME;
}

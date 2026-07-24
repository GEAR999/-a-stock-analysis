/**
 * IndexedDB K-line data cache
 * 库名：stock_cache，表名：kline_data
 * 缓存有效期：
 *   - 历史数据：7 天
 *   - 实时数据：5 分钟
 * 缓存容量上限：500MB（LRU 清理）
 */

const DB_NAME = 'stock_cache';
const STORE_NAME = 'kline_data';
const DB_VERSION = 2; // 升级版本，支持缓存类型区分
const MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB

// 历史数据缓存 7 天，实时数据缓存 5 分钟
const HISTORICAL_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const REALTIME_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  id?: number; // IndexedDB 自动生成的主键
  stockCode: string;
  period: string;
  data: unknown[];
  cachedAt: number;
  size: number;
  isRealtime?: boolean; // 是否为实时数据缓存
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('idx_code_period', ['stockCode', 'period'], { unique: false });
        store.createIndex('idx_cachedAt', 'cachedAt', { unique: false });
        store.createIndex('idx_code_period_realtime', ['stockCode', 'period', 'isRealtime'], { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get cached K-line data (returns null if expired or not found)
 * @param stockCode 股票代码
 * @param period K 线周期
 * @param isRealtime 是否为实时数据（决定使用哪个 TTL）
 */
export async function getCachedKline(
  stockCode: string,
  period: string,
  isRealtime = false
): Promise<unknown[] | null> {
  try {
    const db = await openDB();
    const ttl = isRealtime ? REALTIME_CACHE_TTL : HISTORICAL_CACHE_TTL;
    
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('idx_code_period');
      const request = index.getAll([stockCode, period]);

      request.onsuccess = () => {
        const results = request.result as CacheEntry[];
        if (results.length === 0) {
          resolve(null);
          return;
        }
        // Get the most recent entry
        const entry = results.sort((a, b) => b.cachedAt - a.cachedAt)[0];
        // Check TTL
        if (Date.now() - entry.cachedAt > ttl) {
          resolve(null);
          return;
        }
        resolve(entry.data);
      };
      request.onerror = () => resolve(null);
      db.close();
    });
  } catch {
    return null;
  }
}

/**
 * Save K-line data to cache
 * @param stockCode 股票代码
 * @param period K 线周期
 * @param data K 线数据
 * @param isRealtime 是否为实时数据（决定使用哪个 TTL）
 */
export async function setCachedKline(
  stockCode: string,
  period: string,
  data: unknown[],
  isRealtime = false
): Promise<void> {
  try {
    const db = await openDB();
    const size = JSON.stringify(data).length * 2; // rough byte estimate

    // Remove old entries for same stock+period
    const tx1 = db.transaction(STORE_NAME, 'readwrite');
    const store1 = tx1.objectStore(STORE_NAME);
    const index1 = store1.index('idx_code_period');
    const cursorReq = index1.openCursor(IDBKeyRange.only([stockCode, period]));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    await new Promise<void>((resolve) => {
      tx1.oncomplete = () => resolve();
      tx1.onerror = () => resolve();
    });

    // Insert new entry
    const tx2 = db.transaction(STORE_NAME, 'readwrite');
    const store2 = tx2.objectStore(STORE_NAME);
    store2.add({
      stockCode,
      period,
      data,
      cachedAt: Date.now(),
      size,
      isRealtime,
    });

    await new Promise<void>((resolve) => {
      tx2.oncomplete = () => resolve();
      tx2.onerror = () => resolve();
    });

    db.close();

    // Check size limit and cleanup if needed
    await cleanupIfNeeded();
  } catch (e) {
    console.warn('[IDBCache] Failed to save:', e);
  }
}

/** LRU cleanup when cache exceeds size limit */
async function cleanupIfNeeded(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = async () => {
      const entries = request.result as CacheEntry[];
      const totalSize = entries.reduce((sum, e) => sum + e.size, 0);

      if (totalSize > MAX_CACHE_SIZE) {
        // Sort by cachedAt ascending (oldest first)
        entries.sort((a, b) => a.cachedAt - b.cachedAt);

        let freed = 0;
        const target = totalSize - MAX_CACHE_SIZE;

        const writeTx = db.transaction(STORE_NAME, 'readwrite');
        const writeStore = writeTx.objectStore(STORE_NAME);

        for (const entry of entries) {
          if (freed >= target) break;
          if (entry.id !== undefined) {
            writeStore.delete(entry.id);
          }
          freed += entry.size;
        }

        await new Promise<void>((resolve) => {
          writeTx.oncomplete = () => resolve();
          writeTx.onerror = () => resolve();
        });
      }

      db.close();
    };

    request.onerror = () => db.close();
  } catch (e) {
    console.warn('[IDBCache] Cleanup failed:', e);
  }
}

/** Clear all cached data for a specific stock or all stocks */
export async function clearCachedKline(stockCode?: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    if (stockCode) {
      const index = store.index('idx_code_period');
      const request = index.getAllKeys();

      request.onsuccess = () => {
        const keys = request.result as Array<[string, string]>;
        for (const key of keys) {
          if (key[0] === stockCode) {
            const delReq = index.openCursor(IDBKeyRange.only(key));
            delReq.onsuccess = () => {
              const cursor = delReq.result;
              if (cursor) {
                cursor.delete();
                cursor.continue();
              }
            };
          }
        }
      };
    } else {
      store.clear();
    }

    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });

    db.close();
  } catch (e) {
    console.warn('[IDBCache] Clear failed:', e);
  }
}

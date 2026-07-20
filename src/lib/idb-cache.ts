/**
 * IndexedDB K-line data cache
 * 库名：stock_cache，表名：kline_data
 * 缓存有效期：24小时
 * 缓存容量上限：500MB（LRU清理）
 */

const DB_NAME = 'stock_cache';
const STORE_NAME = 'kline_data';
const DB_VERSION = 1;
const MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  stockCode: string;
  period: string;
  data: unknown[];
  cachedAt: number;
  size: number;
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
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Get cached K-line data (returns null if expired or not found) */
export async function getCachedKline(stockCode: string, period: string): Promise<unknown[] | null> {
  try {
    const db = await openDB();
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
        if (Date.now() - entry.cachedAt > CACHE_TTL) {
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

/** Save K-line data to cache */
export async function setCachedKline(stockCode: string, period: string, data: unknown[]): Promise<void> {
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
    } as CacheEntry);

    await new Promise<void>((resolve) => {
      tx2.oncomplete = () => resolve();
      tx2.onerror = () => resolve();
    });

    db.close();

    // LRU cleanup if over size limit
    await cleanupIfNeeded();
  } catch {
    // silently fail
  }
}

/** Remove oldest entries if total cache size exceeds limit */
async function cleanupIfNeeded(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('idx_cachedAt');

    // Get all entries sorted by cachedAt (oldest first)
    const request = index.getAll();
    await new Promise<void>((resolve) => {
      request.onsuccess = () => {
        const entries = request.result as CacheEntry[];
        const totalSize = entries.reduce((sum, e) => sum + e.size, 0);

        if (totalSize > MAX_CACHE_SIZE) {
          // Delete oldest entries until under limit
          let freed = 0;
          const target = totalSize - MAX_CACHE_SIZE * 0.8; // free down to 80%
          const sorted = entries.sort((a, b) => a.cachedAt - b.cachedAt);
          for (const entry of sorted) {
            if (freed >= target) break;
            store.delete(entry.stockCode + '_' + entry.period + '_' + entry.cachedAt);
            freed += entry.size;
          }
        }
        resolve();
      };
      request.onerror = () => resolve();
    });

    db.close();
  } catch {
    // silently fail
  }
}

/** Clear all cached data */
export async function clearKlineCache(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    db.close();
  } catch {
    // silently fail
  }
}

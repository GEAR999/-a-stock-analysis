/**
 * IndexedDB 账户存储层
 * 将账户数据从 localStorage 迁移到 IndexedDB，突破 5MB 限制
 * 数据库：a_stock_backtest
 * 对象存储：accounts（账户）、trades（交易记录）、equity_curves（资金曲线）
 */

import type { Account, Trade, EquityPoint } from './types';

const DB_NAME = 'a_stock_backtest';
const DB_VERSION = 1;
const ACCOUNTS_STORE = 'accounts';
const TRADES_STORE = 'trades';
const EQUITY_STORE = 'equity_curves';

// localStorage 缓存前缀（用于快速启动）
const CACHE_PREFIX = 'idb_cache_';
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB

let dbInstance: IDBDatabase | null = null;

// 打开数据库
function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 创建账户存储
      if (!db.objectStoreNames.contains(ACCOUNTS_STORE)) {
        db.createObjectStore(ACCOUNTS_STORE, { keyPath: 'id' });
      }

      // 创建交易记录存储
      if (!db.objectStoreNames.contains(TRADES_STORE)) {
        const tradesStore = db.createObjectStore(TRADES_STORE, { keyPath: 'tradeId' });
        tradesStore.createIndex('accountId', 'accountId', { unique: false });
        tradesStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // 创建资金曲线存储
      if (!db.objectStoreNames.contains(EQUITY_STORE)) {
        const equityStore = db.createObjectStore(EQUITY_STORE, { keyPath: 'id' });
        equityStore.createIndex('accountId', 'accountId', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

// 保存账户到 IndexedDB
export async function saveAccountToIDB(account: Account): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(ACCOUNTS_STORE, 'readwrite');
  const store = tx.objectStore(ACCOUNTS_STORE);

  // 分离交易记录（避免账户对象过大）
  const { trades, ...accountData } = account;

  // 保存账户基本信息
  await new Promise<void>((resolve, reject) => {
    const req = store.put(accountData);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // 单独保存交易记录
  if (trades && trades.length > 0) {
    const tradesTx = db.transaction(TRADES_STORE, 'readwrite');
    const tradesStore = tradesTx.objectStore(TRADES_STORE);

    for (const trade of trades) {
      const tradeRecord = {
        ...trade,
        tradeId: trade.id,
        accountId: account.id,
      };
      await new Promise<void>((resolve, reject) => {
        const req = tradesStore.put(tradeRecord);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  }

  // 同时更新 localStorage 缓存（用于快速启动）
  try {
    const cacheData = JSON.stringify(account);
    if (cacheData.length < MAX_CACHE_SIZE) {
      localStorage.setItem(`${CACHE_PREFIX}${account.id}`, cacheData);
    }
  } catch {
    // localStorage 满了，忽略
  }
}

// 从 IndexedDB 加载账户
export async function loadAccountFromIDB(id: string): Promise<Account | null> {
  const db = await openDB();

  // 先尝试从 localStorage 缓存读取（快速启动）
  const cached = localStorage.getItem(`${CACHE_PREFIX}${id}`);
  if (cached) {
    try {
      return JSON.parse(cached) as Account;
    } catch {
      // 缓存损坏，继续从 IDB 读取
    }
  }

  // 从 IndexedDB 读取
  const tx = db.transaction(ACCOUNTS_STORE, 'readonly');
  const store = tx.objectStore(ACCOUNTS_STORE);

  const account = await new Promise<Account | null>((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  if (!account) return null;

  // 加载交易记录
  const tradesTx = db.transaction(TRADES_STORE, 'readonly');
  const tradesStore = tradesTx.objectStore(TRADES_STORE);
  const index = tradesStore.index('accountId');

  const trades = await new Promise<Trade[]>((resolve, reject) => {
    const req = index.getAll(id);
    req.onsuccess = () => {
      const results = req.result || [];
      resolve(results.map(t => {
        const { tradeId, accountId, ...tradeData } = t;
        return { ...tradeData, id: tradeId } as Trade;
      }));
    };
    req.onerror = () => reject(req.error);
  });

  const fullAccount: Account = {
    ...account,
    trades: trades.sort((a, b) => a.timestamp - b.timestamp),
  };

  // 更新缓存
  try {
    localStorage.setItem(`${CACHE_PREFIX}${id}`, JSON.stringify(fullAccount));
  } catch {
    // 忽略缓存错误
  }

  return fullAccount;
}

// 删除账户
export async function deleteAccountFromIDB(id: string): Promise<void> {
  const db = await openDB();

  // 删除账户
  const tx = db.transaction(ACCOUNTS_STORE, 'readwrite');
  const store = tx.objectStore(ACCOUNTS_STORE);
  await new Promise<void>((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // 删除相关交易记录
  const tradesTx = db.transaction(TRADES_STORE, 'readwrite');
  const tradesStore = tradesTx.objectStore(TRADES_STORE);
  const index = tradesStore.index('accountId');

  const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
    const req = index.getAllKeys(id);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  for (const key of keys) {
    await new Promise<void>((resolve, reject) => {
      const req = tradesStore.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // 清除缓存
  localStorage.removeItem(`${CACHE_PREFIX}${id}`);
}

// 获取所有账户摘要
export async function getAllAccountSummariesFromIDB(): Promise<Array<{
  id: string;
  name: string;
  type: string;
  initialCapital: number;
  currentCapital: number;
  positionCount: number;
  tradeCount: number;
  totalPnl: number;
  totalPnlPercent: number;
  createdAt: number;
  updatedAt: number;
}>> {
  const db = await openDB();
  const tx = db.transaction(ACCOUNTS_STORE, 'readonly');
  const store = tx.objectStore(ACCOUNTS_STORE);

  const accounts = await new Promise<Account[]>((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  // 获取每个账户的交易数量
  const summaries = await Promise.all(accounts.map(async (acc) => {
    const tradesTx = db.transaction(TRADES_STORE, 'readonly');
    const tradesStore = tradesTx.objectStore(TRADES_STORE);
    const index = tradesStore.index('accountId');

    const tradeCount = await new Promise<number>((resolve, reject) => {
      const req = index.count(IDBKeyRange.only(acc.id));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const totalAssets = acc.currentCapital + acc.positions.reduce((sum, p) => sum + (p.marketValue || 0), 0);
    const totalPnl = totalAssets - acc.initialCapital;
    const totalPnlPercent = (totalPnl / acc.initialCapital) * 100;

    return {
      id: acc.id,
      name: acc.name,
      type: acc.type,
      initialCapital: acc.initialCapital,
      currentCapital: acc.currentCapital,
      positionCount: acc.positions.length,
      tradeCount,
      totalPnl,
      totalPnlPercent,
      createdAt: acc.createdAt,
      updatedAt: acc.updatedAt,
    };
  }));

  return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
}

// 保存资金曲线
export async function saveEquityCurveToIDB(
  accountId: string,
  date: string,
  points: EquityPoint[]
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(EQUITY_STORE, 'readwrite');
  const store = tx.objectStore(EQUITY_STORE);

  const record = {
    id: `${accountId}_${date}`,
    accountId,
    date,
    points,
    savedAt: Date.now(),
  };

  await new Promise<void>((resolve, reject) => {
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// 加载资金曲线
export async function loadEquityCurveFromIDB(
  accountId: string,
  date: string
): Promise<EquityPoint[] | null> {
  const db = await openDB();
  const tx = db.transaction(EQUITY_STORE, 'readonly');
  const store = tx.objectStore(EQUITY_STORE);

  const record = await new Promise<{ points: EquityPoint[] } | null>((resolve, reject) => {
    const req = store.get(`${accountId}_${date}`);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  return record?.points || null;
}

// 从 localStorage 迁移数据到 IndexedDB
export async function migrateFromLocalStorage(): Promise<{ migrated: number; errors: string[] }> {
  const errors: string[] = [];
  let migrated = 0;

  // 查找所有 localStorage 中的账户数据
  const keys = Object.keys(localStorage);
  const accountKeys = keys.filter(k => k.startsWith('backtest_account_'));

  for (const key of accountKeys) {
    try {
      const data = localStorage.getItem(key);
      if (!data) continue;

      const account = JSON.parse(data) as Account;
      await saveAccountToIDB(account);
      migrated++;

      // 迁移成功后，标记旧数据（不立即删除，等验证后再删）
      localStorage.setItem(`${key}_migrated`, 'true');
    } catch (err) {
      errors.push(`Failed to migrate ${key}: ${err}`);
    }
  }

  // 迁移活跃账户设置
  const activeId = localStorage.getItem('backtest_active_account');
  if (activeId) {
    localStorage.setItem('idb_active_account', activeId);
  }

  return { migrated, errors };
}

// 清理已迁移的 localStorage 数据
export function cleanupMigratedData(): void {
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (key.startsWith('backtest_account_') && localStorage.getItem(`${key}_migrated`) === 'true') {
      localStorage.removeItem(key);
      localStorage.removeItem(`${key}_migrated`);
    }
  }
}

// 检查是否需要迁移
export function needsMigration(): boolean {
  const keys = Object.keys(localStorage);
  return keys.some(k => k.startsWith('backtest_account_') && !localStorage.getItem(`${k}_migrated`));
}

// 获取 IndexedDB 使用量估算
export async function getIDBUsageEstimate(): Promise<{ usage: number; quota: number }> {
  if (!navigator.storage?.estimate) {
    return { usage: 0, quota: 0 };
  }

  const estimate = await navigator.storage.estimate();
  return {
    usage: estimate.usage || 0,
    quota: estimate.quota || 0,
  };
}

// 检查是否需要清理（超过 50MB）
export async function needsCleanup(): Promise<boolean> {
  const { usage } = await getIDBUsageEstimate();
  return usage > MAX_CACHE_SIZE;
}

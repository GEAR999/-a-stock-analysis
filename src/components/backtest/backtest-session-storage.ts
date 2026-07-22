/**
 * 历史量化回测会话存储层
 * 
 * 使用 IndexedDB 持久化回测会话（配置 + 结果 + 交易记录 + 买卖依据）
 * 每次回测是一条独立记录，可保存/回溯/对比/删除
 */

import type { StrategyType } from '@/lib/backtest-engine';

const DB_NAME = 'stock-analysis-backtest-sessions';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

// ============ 数据模型 ============

/** 回测配置快照 */
export interface BacktestSessionConfig {
  stocks: Array<{ code: string; name: string }>;
  dateRange: { start: string; end: string };
  strategies: StrategyType[];
  initialCapital: number;
  commission: number;
  slippage: number;
  positionSize: number;
}

/** 交易记录（增强版，含指标快照） */
export interface BacktestTradeRecord {
  id: string;
  date: string;
  stockCode: string;
  stockName: string;
  direction: 'buy' | 'sell';
  price: number;
  quantity: number;
  amount: number;
  commission: number;
  strategy: StrategyType;
  /** 规则依据（回测时立即生成） */
  reasoning?: TradeReasoning;
  /** 用户手动标注 */
  userNote?: string;
}

/** 买卖依据 */
export interface TradeReasoning {
  strategyLabel: string;
  indicatorSnapshot: {
    macd?: { dif: number; dea: number; histogram: number };
    kdj?: { k: number; d: number; j: number };
    rsi?: number;
    boll?: { upper: number; middle: number; lower: number };
    ma?: { ma5: number; ma20: number };
  };
  ohlcvSnapshot: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
  description: string;
}

/** 持仓快照 */
export interface BacktestPositionSnapshot {
  stockCode: string;
  stockName: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  entryDate: string;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

/** 每日记录 */
export interface BacktestDailyRecord {
  date: string;
  capital: number;
  position: number;
  positionValue: number;
  totalValue: number;
  benchmark: number;
}

/** 绩效指标 */
export interface BacktestMetrics {
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitLossRatio: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
}

/** 回测会话（完整的一条记录） */
export interface BacktestSession {
  id: string;
  name: string;
  createdAt: number;
  config: BacktestSessionConfig;
  status: 'running' | 'completed' | 'failed';
  /** 每只股票的回测结果 */
  results: Array<{
    stockCode: string;
    stockName: string;
    trades: BacktestTradeRecord[];
    dailyRecords: BacktestDailyRecord[];
    metrics: BacktestMetrics;
    finalPosition: BacktestPositionSnapshot | null;
  }>;
  /** 汇总指标（多股票加权） */
  summaryMetrics: BacktestMetrics;
  /** 资金曲线（多股票合计） */
  equityCurve: BacktestDailyRecord[];
  /** AI 复盘总结（可选，按需生成） */
  aiReview?: string;
}

// ============ IndexedDB 操作（原生 API） ============

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (_event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (_event) => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = (_event) => {
      reject(request.error);
    };
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** 生成唯一 ID */
function generateId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/** 保存回测会话 */
export async function saveSession(session: Omit<BacktestSession, 'id' | 'createdAt'>): Promise<BacktestSession> {
  const db = await openDB();
  const fullSession: BacktestSession = {
    ...session,
    id: generateId(),
    createdAt: Date.now(),
  };
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await idbRequest(tx.objectStore(STORE_NAME).put(fullSession));
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(fullSession);
    tx.onerror = () => reject(tx.error);
  });
}

/** 更新回测会话（如添加 AI 复盘、用户标注等） */
export async function updateSession(session: BacktestSession): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await idbRequest(tx.objectStore(STORE_NAME).put(session));
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 获取单个会话 */
export async function getSession(id: string): Promise<BacktestSession | undefined> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const result = await idbRequest(tx.objectStore(STORE_NAME).get(id));
  return result;
}

/** 获取所有会话列表（按创建时间倒序） */
export async function getAllSessions(): Promise<BacktestSession[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const result = await idbRequest(tx.objectStore(STORE_NAME).getAll());
  return (result || []).sort((a: BacktestSession, b: BacktestSession) => b.createdAt - a.createdAt);
}

/** 删除会话 */
export async function deleteSession(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await idbRequest(tx.objectStore(STORE_NAME).delete(id));
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 批量删除 */
export async function deleteSessions(ids: string[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  for (const id of ids) {
    await idbRequest(store.delete(id));
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 清空所有会话 */
export async function clearAllSessions(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await idbRequest(tx.objectStore(STORE_NAME).clear());
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 获取存储统计信息 */
export async function getStorageStats(): Promise<{ count: number; estimatedSize: number }> {
  const sessions = await getAllSessions();
  const jsonStr = JSON.stringify(sessions);
  return {
    count: sessions.length,
    estimatedSize: Math.round(jsonStr.length / 1024), // KB
  };
}

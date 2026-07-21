/**
 * 统一 API 客户端 - Neon 数据库同步层
 * 
 * 提供前端与 Neon PostgreSQL 的通信能力。
 * 所有方法都是"尽力而为"：如果数据库不可用，返回 null/空数组，不抛异常。
 * 调用方（storage.ts）负责 localStorage 优先 + 异步同步到云端。
 */

// ============ 类型定义 ============

export interface DbAccount {
  id: string;
  user_id?: string;
  name: string;
  type: "manual" | "quant";
  initial_capital: number;
  current_capital: number;
  quant_threshold?: number;
  auto_trade?: boolean;
  max_position_ratio?: number;
  stop_loss_ratio?: number;
  take_profit_ratio?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DbPosition {
  id: string;
  account_id: string;
  stock_code: string;
  stock_name: string;
  quantity: number;
  avg_cost: number;
  current_price?: number;
  market_value?: number;
  profit_loss?: number;
  profit_loss_ratio?: number;
  open_date?: string;
  updated_at?: string;
}

export interface DbTransaction {
  id: string;
  account_id: string;
  stock_code: string;
  stock_name: string;
  type: "buy" | "sell";
  price: number;
  quantity: number;
  amount: number;
  fee?: number;
  strategy_signals?: Record<string, unknown>;
  note?: string;
  traded_at?: string;
  created_at?: string;
}

export interface DbWatchlistItem {
  id: string;
  user_id: string;
  stock_code: string;
  stock_name: string;
  group_name?: string;
  alert_price_high?: number;
  alert_price_low?: number;
  note?: string;
  sort_order?: number;
  added_at?: string;
}

export interface DbStrategyWeight {
  id: string;
  account_id: string;
  strategy_id: string;
  strategy_name: string;
  strategy_type: "builtin" | "custom";
  weight: number;
  confidence?: number;
  is_enabled?: boolean;
  sort_order?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============ 同步状态 ============

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";

let _syncStatus: SyncStatus = "idle";
let _lastSyncTime = 0;
let _syncError: string | null = null;
const _listeners: Set<(status: SyncStatus, error?: string) => void> = new Set();

export function getSyncStatus(): SyncStatus {
  return _syncStatus;
}

export function getLastSyncTime(): number {
  return _lastSyncTime;
}

export function getSyncError(): string | null {
  return _syncError;
}

export function onSyncStatusChange(listener: (status: SyncStatus, error?: string) => void): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

function setSyncStatus(status: SyncStatus, error?: string) {
  _syncStatus = status;
  _syncError = error || null;
  if (status === "synced") _lastSyncTime = Date.now();
  _listeners.forEach((fn) => fn(status, error));
}

// ============ 基础请求 ============

const USER_ID_KEY = "backtest_user_id";

function getUserId(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem(USER_ID_KEY) || "default";
  }
  return "default";
}

export function setUserId(id: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(USER_ID_KEY, id);
  }
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-user-id": getUserId(),
        ...options?.headers,
      },
    });
    const json = await res.json();
    if (json.success) return json.data as T;
    console.warn(`[API] ${url} failed:`, json.error);
    return null;
  } catch (err) {
    console.warn(`[API] ${url} error:`, err);
    return null;
  }
}

async function apiPost<T>(url: string, body: unknown): Promise<T | null> {
  return apiFetch<T>(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function apiPut<T>(url: string, body: unknown): Promise<T | null> {
  return apiFetch<T>(url, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

async function apiDelete<T>(url: string): Promise<T | null> {
  return apiFetch<T>(url, { method: "DELETE" });
}

// ============ 迁移 ============

export async function runMigration(): Promise<{ success: boolean; missingTables: string[] }> {
  setSyncStatus("syncing");
  const result = await apiPost<{ allTablesPresent: boolean; missingTables: string[] }>("/api/migrate", {});
  if (result?.allTablesPresent) {
    setSyncStatus("synced");
    return { success: true, missingTables: [] };
  }
  setSyncStatus("error", "Migration incomplete");
  return { success: false, missingTables: result?.missingTables || [] };
}

export async function checkMigrationStatus(): Promise<{ allTablesPresent: boolean; missingTables: string[] }> {
  const result = await apiFetch<{ allTablesPresent: boolean; missingTables: string[] }>("/api/migrate");
  return result || { allTablesPresent: false, missingTables: [] };
}

// ============ 账户 ============

export async function fetchAccounts(): Promise<DbAccount[]> {
  const data = await apiFetch<DbAccount[]>("/api/accounts");
  return data || [];
}

export async function createDbAccount(params: {
  name: string;
  type: "manual" | "quant";
  initial_capital: number;
  quant_threshold?: number;
  auto_trade?: boolean;
  max_position_ratio?: number;
  stop_loss_ratio?: number;
  take_profit_ratio?: number;
}): Promise<DbAccount | null> {
  return apiPost<DbAccount>("/api/accounts", {
    user_id: getUserId(),
    ...params,
  });
}

export async function updateDbAccount(
  id: string,
  params: Partial<Pick<DbAccount, "name" | "quant_threshold" | "auto_trade" | "max_position_ratio" | "stop_loss_ratio" | "take_profit_ratio">>
): Promise<DbAccount | null> {
  return apiPut<DbAccount>(`/api/accounts/${id}`, params);
}

export async function deleteDbAccount(id: string): Promise<boolean> {
  const result = await apiDelete<{ success: boolean }>(`/api/accounts?id=${id}`);
  return result !== null;
}

export async function fetchAccountDetail(id: string): Promise<{
  account: DbAccount;
  positions: DbPosition[];
  transactions: DbTransaction[];
} | null> {
  const data = await apiFetch<{
    id: string;
    name: string;
    positions: DbPosition[];
    transactions: DbTransaction[];
    [key: string]: unknown;
  }>(`/api/accounts/${id}`);
  if (!data) return null;
  const { positions, transactions, ...account } = data;
  return { account: account as unknown as DbAccount, positions, transactions };
}

// ============ 交易 ============

export async function createTransaction(params: {
  account_id: string;
  stock_code: string;
  stock_name: string;
  type: "buy" | "sell";
  price: number;
  quantity: number;
  amount: number;
  fee?: number;
  strategy_signals?: Record<string, unknown>;
  note?: string;
}): Promise<DbTransaction | null> {
  return apiPost<DbTransaction>("/api/transactions", params);
}

export async function fetchTransactions(accountId: string, stockCode?: string): Promise<DbTransaction[]> {
  const params = new URLSearchParams({ accountId });
  if (stockCode) params.set("stockCode", stockCode);
  const data = await apiFetch<DbTransaction[]>(`/api/transactions?${params}`);
  return data || [];
}

// ============ 持仓 ============

export async function fetchPositions(accountId: string): Promise<DbPosition[]> {
  const data = await apiFetch<DbPosition[]>(`/api/positions?accountId=${accountId}`);
  return data || [];
}

export async function updatePosition(params: {
  accountId: string;
  stockCode: string;
  quantity?: number;
  avgCost?: number;
  currentPrice?: number;
  marketValue?: number;
  profitLoss?: number;
  profitLossRatio?: number;
}): Promise<DbPosition | null> {
  return apiPut<DbPosition>("/api/positions", params);
}

// ============ 自选股 ============

export async function fetchWatchlist(userId?: string): Promise<DbWatchlistItem[]> {
  const uid = userId || getUserId();
  const data = await apiFetch<DbWatchlistItem[]>(`/api/watchlist?userId=${uid}`);
  return data || [];
}

export async function addToWatchlist(params: {
  stockCode: string;
  stockName: string;
  groupName?: string;
  note?: string;
  alertPriceHigh?: number;
  alertPriceLow?: number;
}): Promise<DbWatchlistItem | null> {
  return apiPost<DbWatchlistItem>("/api/watchlist", {
    userId: getUserId(),
    ...params,
  });
}

export async function updateWatchlistItem(params: {
  stockCode: string;
  sortOrder?: number;
  note?: string;
  groupName?: string;
  alertPriceHigh?: number;
  alertPriceLow?: number;
}): Promise<DbWatchlistItem | null> {
  return apiPut<DbWatchlistItem>("/api/watchlist", {
    userId: getUserId(),
    ...params,
  });
}

export async function removeFromWatchlist(stockCode: string): Promise<boolean> {
  const uid = getUserId();
  const result = await apiDelete<{ success: boolean }>(`/api/watchlist?userId=${uid}&stockCode=${stockCode}`);
  return result !== null;
}

// ============ 策略权重 ============

export async function fetchStrategyWeights(accountId: string): Promise<DbStrategyWeight[]> {
  const data = await apiFetch<DbStrategyWeight[]>(`/api/strategy-weights?accountId=${accountId}`);
  return data || [];
}

export async function saveStrategyWeights(
  accountId: string,
  weights: Array<{
    strategyId: string;
    strategyName?: string;
    strategyType?: "builtin" | "custom";
    weight: number;
    confidence?: number;
    enabled?: boolean;
  }>
): Promise<DbStrategyWeight[]> {
  const data = await apiPost<DbStrategyWeight[]>("/api/strategy-weights", { accountId, weights });
  return data || [];
}

// ============ 分析缓存 ============

export async function fetchAnalysisCache(stockCode: string, analysisType?: string) {
  const params = new URLSearchParams({ stockCode });
  if (analysisType) params.set("type", analysisType);
  return apiFetch<unknown[]>(`/api/analysis-cache?${params}`);
}

export async function saveAnalysisCache(params: {
  stockCode: string;
  analysisType: string;
  result: unknown;
  score?: number;
  signal?: string;
}) {
  return apiPost<unknown>("/api/analysis-cache", params);
}

// ============ 批量同步 ============

/**
 * 全量同步账户到数据库（用于首次连接或手动同步）
 */
export async function syncAccountToDb(account: {
  id: string;
  name: string;
  type: "manual" | "quant";
  initialCapital: number;
  currentCapital: number;
  positions: Array<{
    stockCode: string;
    stockName: string;
    quantity: number;
    avgCost: number;
    currentPrice: number;
    marketValue: number;
    pnl: number;
    pnlPercent: number;
  }>;
  trades: Array<{
    stockCode: string;
    stockName: string;
    direction: "buy" | "sell";
    price: number;
    quantity: number;
    amount: number;
    reason?: string;
    timestamp: number;
  }>;
}): Promise<boolean> {
  setSyncStatus("syncing");
  try {
    // 1. 创建或更新账户
    const dbAccount = await createDbAccount({
      name: account.name,
      type: account.type,
      initial_capital: account.initialCapital,
    });

    if (!dbAccount) {
      // 可能已存在，尝试更新
      await updateDbAccount(account.id, { name: account.name });
    }

    // 2. 同步持仓
    for (const pos of account.positions) {
      await updatePosition({
        accountId: account.id,
        stockCode: pos.stockCode,
        quantity: pos.quantity,
        avgCost: pos.avgCost,
        currentPrice: pos.currentPrice,
        marketValue: pos.marketValue,
        profitLoss: pos.pnl,
        profitLossRatio: pos.pnlPercent,
      });
    }

    // 3. 同步交易
    for (const trade of account.trades) {
      await createTransaction({
        account_id: account.id,
        stock_code: trade.stockCode,
        stock_name: trade.stockName,
        type: trade.direction,
        price: trade.price,
        quantity: trade.quantity,
        amount: trade.amount,
        note: trade.reason,
      });
    }

    setSyncStatus("synced");
    return true;
  } catch (err) {
    setSyncStatus("error", err instanceof Error ? err.message : "Sync failed");
    return false;
  }
}

/**
 * 检查数据库连接是否可用
 */
export async function checkDbConnection(): Promise<boolean> {
  try {
    const result = await checkMigrationStatus();
    return result.allTablesPresent;
  } catch {
    return false;
  }
}

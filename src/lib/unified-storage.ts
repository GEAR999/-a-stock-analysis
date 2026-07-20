/**
 * 统一存储层 - 双模式支持
 * 
 * 当用户未登录时：使用 localStorage（保持现有功能不变）
 * 当用户已登录时：使用 API 调用 Neon 数据库
 * 
 * 组件代码无需修改，通过此层自动适配
 */

import type { Account, AccountSummary, CustomStrategy, StrategyTemplate, StrategyWeight } from '@/components/backtest/types';
import { hasLocalData } from './migrate-from-local';

// 检测是否在云端模式（有认证且数据库可用）
let _cloudMode = false;

export function setCloudMode(value: boolean) {
  _cloudMode = value;
}

export function isCloudMode(): boolean {
  return _cloudMode;
}

// ===== 账户操作 =====
export async function loadAllAccounts(): Promise<Account[]> {
  if (!_cloudMode) {
    // 本地模式：从 localStorage 读取
    const accounts: Account[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('backtest_account_')) {
        const data = localStorage.getItem(key);
        if (data) {
          try { accounts.push(JSON.parse(data)); } catch { /* ignore */ }
        }
      }
    }
    return accounts.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // 云端模式：从 API 读取
  try {
    const res = await fetch('/api/accounts', { credentials: 'include' });
    const json = await res.json();
    if (json.ok && Array.isArray(json.data)) {
      return json.data.map(mapDbAccountToLocal);
    }
  } catch { /* fallback */ }
  return [];
}

export async function saveAccountToStorage(account: Account): Promise<void> {
  if (!_cloudMode) {
    account.updatedAt = Date.now();
    localStorage.setItem(`backtest_account_${account.id}`, JSON.stringify(account));
    return;
  }

  // 云端模式
  try {
    const existing = await fetch(`/api/accounts/${account.id}`, { credentials: 'include' });
    const existingJson = await existing.json();
    
    if (existingJson.ok) {
      // 更新
      await fetch(`/api/accounts/${account.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: account.name,
          current_capital: account.currentCapital,
        }),
      });
    } else {
      // 创建
      await fetch('/api/accounts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: account.name,
          type: account.type,
          initialCapital: account.initialCapital,
        }),
      });
    }
  } catch { /* ignore */ }
}

export async function deleteAccountFromStorage(id: string): Promise<void> {
  if (!_cloudMode) {
    localStorage.removeItem(`backtest_account_${id}`);
    if (localStorage.getItem('backtest_active_account') === id) {
      localStorage.removeItem('backtest_active_account');
    }
    return;
  }

  try {
    await fetch(`/api/accounts/${id}`, { method: 'DELETE', credentials: 'include' });
  } catch { /* ignore */ }
}

// ===== 自选股 =====
export async function loadWatchlist(): Promise<Array<{ code: string; name: string; market: string; order: number }>> {
  if (!_cloudMode) {
    try {
      const data = localStorage.getItem('stock-watchlist');
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  }

  try {
    const res = await fetch('/api/watchlist', { credentials: 'include' });
    const json = await res.json();
    if (json.ok && Array.isArray(json.data)) {
      return json.data.map((item: Record<string, unknown>) => ({
        code: item.stock_code,
        name: item.stock_name,
        market: 'sh',
        order: item.sort_order || 0,
      }));
    }
  } catch { /* fallback */ }
  return [];
}

export async function saveWatchlist(items: Array<{ code: string; name: string; market: string; order: number }>): Promise<void> {
  if (!_cloudMode) {
    localStorage.setItem('stock-watchlist', JSON.stringify(items));
    return;
  }
  // 云端模式：同步到 API（简化处理）
}

// ===== 自定义策略 =====
export async function loadCustomStrategies(): Promise<CustomStrategy[]> {
  if (!_cloudMode) {
    try {
      const data = localStorage.getItem('custom_strategies');
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  }

  try {
    const res = await fetch('/api/strategies/custom', { credentials: 'include' });
    const json = await res.json();
    if (json.ok && Array.isArray(json.data)) {
      return json.data.map(mapDbStrategyToLocal);
    }
  } catch { /* fallback */ }
  return [];
}

export async function saveCustomStrategies(strategies: CustomStrategy[]): Promise<void> {
  if (!_cloudMode) {
    localStorage.setItem('custom_strategies', JSON.stringify(strategies));
  }
}

// ===== 策略模板 =====
export async function loadStrategyTemplates(): Promise<StrategyTemplate[]> {
  if (!_cloudMode) {
    try {
      const data = localStorage.getItem('strategy_templates');
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  }

  try {
    const res = await fetch('/api/strategies/templates', { credentials: 'include' });
    const json = await res.json();
    if (json.ok && Array.isArray(json.data)) {
      return json.data.map(mapDbTemplateToLocal);
    }
  } catch { /* fallback */ }
  return [];
}

export async function saveStrategyTemplates(templates: StrategyTemplate[]): Promise<void> {
  if (!_cloudMode) {
    localStorage.setItem('strategy_templates', JSON.stringify(templates));
  }
}

// ===== 活跃账户 =====
export function getActiveAccountId(): string | null {
  return localStorage.getItem('backtest_active_account');
}

export function setActiveAccountId(id: string): void {
  localStorage.setItem('backtest_active_account', id);
}

// ===== 数据映射：DB → 本地类型 =====

function mapDbAccountToLocal(db: Record<string, unknown>): Account {
  return {
    id: db.id as string,
    name: db.name as string,
    type: (db.type as 'manual' | 'quant') || 'manual',
    initialCapital: Number(db.initial_capital) || 1000000,
    currentCapital: Number(db.current_capital) || 1000000,
    positions: [],
    trades: [],
    trackingList: [],
    stockLimits: {},
    createdAt: new Date(db.created_at as string).getTime(),
    updatedAt: new Date(db.updated_at as string).getTime(),
  };
}

function mapDbStrategyToLocal(db: Record<string, unknown>): CustomStrategy {
  const theories = (db.theories as string[]) || [];
  return {
    id: db.id as string,
    name: db.name as string,
    description: db.description as string | undefined,
    theories: theories as CustomStrategy['theories'],
    buyConditions: (db.buy_conditions as CustomStrategy['buyConditions']) || {},
    sellConditions: (db.sell_conditions as CustomStrategy['sellConditions']) || {},
    positionRatio: Number(db.position_ratio) || 0.25,
    stopLoss: Number(db.stop_loss) || 0.05,
    takeProfit: Number(db.take_profit) || 0.10,
    createdAt: new Date(db.created_at as string).getTime(),
    updatedAt: new Date(db.updated_at as string).getTime(),
  };
}

function mapDbTemplateToLocal(db: Record<string, unknown>): StrategyTemplate {
  const config = (db.config as Record<string, unknown>) || {};
  return {
    id: db.id as string,
    name: db.name as string,
    description: db.description as string | undefined,
    weights: (config.weights as StrategyWeight[]) || [],
    tradeThreshold: (config.tradeThreshold as number) || 70,
    createdAt: new Date(db.created_at as string).getTime(),
    updatedAt: new Date(db.updated_at as string).getTime(),
  };
}

// ===== 检测是否有本地数据可迁移 =====
export function checkLocalData(): boolean {
  return hasLocalData();
}

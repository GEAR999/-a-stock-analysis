/**
 * localStorage → Neon 数据库迁移工具
 * 用户首次登录后，检测 localStorage 中是否有旧数据，提示导入
 */

import { api } from './api-client';

// 检查 localStorage 中是否有旧数据
export function hasLocalData(): boolean {
  if (typeof window === 'undefined') return false;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('backtest_account_')) return true;
  }
  // 检查自选股
  const watchlist = localStorage.getItem('stock-watchlist');
  if (watchlist && watchlist !== '[]') return true;
  // 检查自定义策略
  const strategies = localStorage.getItem('custom_strategies');
  if (strategies && strategies !== '[]') return true;
  // 检查策略模板
  const templates = localStorage.getItem('strategy_templates');
  if (templates && templates !== '[]') return true;
  return false;
}

// 获取本地数据摘要（用于提示用户）
export function getLocalDataSummary(): { accounts: number; watchlist: number; strategies: number; templates: number } {
  let accounts = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('backtest_account_')) accounts++;
  }
  const watchlist = JSON.parse(localStorage.getItem('stock-watchlist') || '[]');
  const strategies = JSON.parse(localStorage.getItem('custom_strategies') || '[]');
  const templates = JSON.parse(localStorage.getItem('strategy_templates') || '[]');
  return { accounts, watchlist: watchlist.length, strategies: strategies.length, templates: templates.length };
}

// 执行迁移
export async function migrateLocalData(): Promise<{ success: boolean; message: string; details: Record<string, number> }> {
  const details: Record<string, number> = { accounts: 0, watchlist: 0, strategies: 0, templates: 0 };
  const errors: string[] = [];

  // 1. 迁移账户
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('backtest_account_')) continue;
    try {
      const data = localStorage.getItem(key);
      if (!data) continue;
      const account = JSON.parse(data);

      // 创建账户
      const res = await api.accounts.create({
        name: account.name || '导入账户',
        type: account.type || 'manual',
        initialCapital: account.initialCapital || 1000000,
      });

      if (res.ok && res.data) {
        details.accounts++;
        const newAccountId = (res.data as Record<string, string>).id;

        // 迁移交易记录
        if (account.trades?.length > 0) {
          for (const trade of account.trades) {
            await api.transactions.create({
              accountId: newAccountId,
              stockCode: trade.stockCode,
              stockName: trade.stockName,
              type: trade.direction,
              price: trade.price,
              quantity: trade.quantity,
              amount: trade.amount,
              note: trade.reason || '',
            });
          }
        }
      }
    } catch (err) {
      errors.push(`账户迁移失败: ${key}`);
    }
  }

  // 2. 迁移自选股
  try {
    const watchlistData = localStorage.getItem('stock-watchlist');
    if (watchlistData) {
      const items = JSON.parse(watchlistData);
      for (const item of items) {
        const res = await api.watchlist.add({
          stockCode: item.code,
          stockName: item.name,
          groupName: '默认',
        });
        if (res.ok) details.watchlist++;
      }
    }
  } catch (err) {
    errors.push('自选股迁移失败');
  }

  // 3. 迁移自定义策略
  try {
    const strategiesData = localStorage.getItem('custom_strategies');
    if (strategiesData) {
      const items = JSON.parse(strategiesData);
      for (const item of items) {
        const res = await api.strategies.createCustom({
          name: item.name,
          description: item.description,
          theories: item.theories,
          buyConditions: item.buyConditions,
          sellConditions: item.sellConditions,
          positionRatio: item.positionRatio,
          stopLoss: item.stopLoss,
          takeProfit: item.takeProfit,
        });
        if (res.ok) details.strategies++;
      }
    }
  } catch (err) {
    errors.push('自定义策略迁移失败');
  }

  // 4. 迁移策略模板
  try {
    const templatesData = localStorage.getItem('strategy_templates');
    if (templatesData) {
      const items = JSON.parse(templatesData);
      for (const item of items) {
        const res = await api.strategies.createTemplate({
          name: item.name,
          description: item.description,
          config: { weights: item.weights, tradeThreshold: item.tradeThreshold },
        });
        if (res.ok) details.templates++;
      }
    }
  } catch (err) {
    errors.push('策略模板迁移失败');
  }

  const totalMigrated = details.accounts + details.watchlist + details.strategies + details.templates;
  const message = errors.length > 0
    ? `迁移完成（部分失败）：成功${totalMigrated}项，失败${errors.length}项`
    : `迁移完成：共导入${totalMigrated}项数据`;

  return { success: errors.length === 0, message, details };
}

// 迁移完成后清理 localStorage
export function clearMigratedData(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('backtest_account_')) keysToRemove.push(key);
  }
  keysToRemove.push('backtest_active_account');
  keysToRemove.push('stock-watchlist');
  keysToRemove.push('custom_strategies');
  keysToRemove.push('strategy_templates');
  keysToRemove.push('stock-chat-messages');
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}

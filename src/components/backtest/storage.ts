import type { Account, AccountSummary, Trade, Position, StrategyMetrics, EquityPoint } from "./types";

const STORAGE_PREFIX = "backtest_account_";
const ACTIVE_ACCOUNT_KEY = "backtest_active_account";

// 生成唯一ID
export function generateId(): string {
  return `acc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// 保存账户到localStorage
export function saveAccount(account: Account): void {
  account.updatedAt = Date.now();
  localStorage.setItem(`${STORAGE_PREFIX}${account.id}`, JSON.stringify(account));
}

// 从localStorage加载账户
export function loadAccount(id: string): Account | null {
  const data = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
  if (!data) return null;
  try {
    return JSON.parse(data) as Account;
  } catch {
    return null;
  }
}

// 删除账户
export function deleteAccount(id: string): void {
  localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
  // 如果删除的是当前活跃账户，清除活跃标记
  if (localStorage.getItem(ACTIVE_ACCOUNT_KEY) === id) {
    localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  }
}

// 获取所有账户
export function getAllAccounts(): Account[] {
  const accounts: Account[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          accounts.push(JSON.parse(data) as Account);
        } catch {
          // 忽略损坏的数据
        }
      }
    }
  }
  return accounts.sort((a, b) => b.updatedAt - a.updatedAt);
}

// 获取所有账户摘要
export function getAllAccountSummaries(): AccountSummary[] {
  return getAllAccounts().map((acc) => {
    const marketValue = acc.positions.reduce((sum, p) => sum + p.marketValue, 0);
    const totalAssets = acc.currentCapital + marketValue;
    const totalPnl = totalAssets - acc.initialCapital;
    const totalPnlPercent = acc.initialCapital > 0 ? (totalPnl / acc.initialCapital) * 100 : 0;
    return {
      id: acc.id,
      name: acc.name,
      initialCapital: acc.initialCapital,
      totalAssets,
      totalPnl,
      totalPnlPercent,
      positionCount: acc.positions.length,
      trackingCount: acc.trackingList.length,
    };
  });
}

// 获取/设置活跃账户ID
export function getActiveAccountId(): string | null {
  return localStorage.getItem(ACTIVE_ACCOUNT_KEY);
}

export function setActiveAccountId(id: string): void {
  localStorage.setItem(ACTIVE_ACCOUNT_KEY, id);
}

// 创建新账户
export function createAccount(name: string, initialCapital: number): Account {
  const account: Account = {
    id: generateId(),
    name,
    initialCapital,
    currentCapital: initialCapital,
    positions: [],
    trades: [],
    trackingList: [],
    stockLimits: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  saveAccount(account);
  return account;
}

// 计算策略指标
export function calculateMetrics(account: Account): StrategyMetrics {
  const sellTrades = account.trades.filter((t) => t.direction === "sell");
  const profitableTrades = sellTrades.filter((t) => (t.pnl || 0) > 0);
  const losingTrades = sellTrades.filter((t) => (t.pnl || 0) < 0);

  const totalReturn = account.initialCapital > 0
    ? ((getTotalAssets(account) - account.initialCapital) / account.initialCapital) * 100
    : 0;

  const daysSinceCreation = Math.max(1, (Date.now() - account.createdAt) / 86400000);
  const annualReturn = daysSinceCreation > 0 ? totalReturn * (365 / daysSinceCreation) : 0;

  // 简化的最大回撤计算
  const maxDrawdown = calculateMaxDrawdown(account);

  const avgReturn = sellTrades.length > 0
    ? sellTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / sellTrades.length
    : 0;
  const avgProfit = profitableTrades.length > 0
    ? profitableTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / profitableTrades.length
    : 0;
  const avgLoss = losingTrades.length > 0
    ? Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / losingTrades.length)
    : 1;

  return {
    totalReturn: Math.round(totalReturn * 100) / 100,
    annualReturn: Math.round(annualReturn * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    sharpeRatio: avgReturn > 0 ? Math.round((avgReturn / (avgLoss || 1)) * 100) / 100 : 0,
    winRate: sellTrades.length > 0
      ? Math.round((profitableTrades.length / sellTrades.length) * 10000) / 100
      : 0,
    profitLossRatio: avgLoss > 0 ? Math.round((avgProfit / avgLoss) * 100) / 100 : 0,
    totalTrades: account.trades.length,
    profitableTrades: profitableTrades.length,
    losingTrades: losingTrades.length,
  };
}

// 计算总资产
export function getTotalAssets(account: Account): number {
  const marketValue = account.positions.reduce((sum, p) => sum + p.marketValue, 0);
  return account.currentCapital + marketValue;
}

// 计算最大回撤
function calculateMaxDrawdown(account: Account): number {
  if (account.trades.length < 2) return 0;

  // 按时间排序的交易
  const sortedTrades = [...account.trades].sort((a, b) => a.timestamp - b.timestamp);

  let peak = account.initialCapital;
  let maxDrawdown = 0;
  let currentAssets = account.initialCapital;

  for (const trade of sortedTrades) {
    if (trade.direction === "buy") {
      currentAssets -= trade.amount;
    } else {
      currentAssets += trade.amount + (trade.pnl || 0);
      if (currentAssets > peak) peak = currentAssets;
      const drawdown = ((peak - currentAssets) / peak) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

// 生成资金曲线
export function generateEquityCurve(account: Account): EquityPoint[] {
  const points: EquityPoint[] = [];
  const now = Date.now();
  const days = 30;

  // 按时间排序的交易
  const sortedTrades = [...account.trades].sort((a, b) => a.timestamp - b.timestamp);

  for (let i = days; i >= 0; i--) {
    const timestamp = now - i * 86400000;
    // 计算到该时间点为止的交易
    const tradesBefore = sortedTrades.filter((t) => t.timestamp <= timestamp);
    let cash = account.initialCapital;
    const positionsAtTime: Record<string, { qty: number; cost: number }> = {};

    for (const trade of tradesBefore) {
      if (trade.direction === "buy") {
        cash -= trade.amount;
        const existing = positionsAtTime[trade.stockCode] || { qty: 0, cost: 0 };
        const newQty = existing.qty + trade.quantity;
        const newCost = newQty > 0 ? (existing.cost * existing.qty + trade.amount) / newQty : 0;
        positionsAtTime[trade.stockCode] = { qty: newQty, cost: newCost };
      } else {
        cash += trade.amount;
        const existing = positionsAtTime[trade.stockCode];
        if (existing) {
          existing.qty -= trade.quantity;
          if (existing.qty <= 0) delete positionsAtTime[trade.stockCode];
        }
      }
    }

    const marketValue = Object.values(positionsAtTime).reduce((sum, p) => {
      return sum + p.qty * p.cost * (1 + (Math.random() * 0.02 - 0.01)); // 模拟价格波动
    }, 0);

    points.push({
      timestamp,
      totalAssets: cash + marketValue,
      cash,
      marketValue,
    });
  }

  return points;
}

// 检查是否可以买入
export function canBuyStock(account: Account, code: string, amount: number): { can: boolean; reason: string } {
  const limit = account.stockLimits[code];
  if (limit !== undefined) {
    const currentHolding = account.positions
      .filter((p) => p.stockCode === code)
      .reduce((sum, p) => sum + p.marketValue, 0);
    if (currentHolding + amount > limit) {
      return { can: false, reason: `该股票已达到买入上限(¥${limit.toLocaleString()})` };
    }
  }

  if (account.currentCapital < amount) {
    return { can: false, reason: "账户资金不足" };
  }

  return { can: true, reason: "" };
}

// 执行买入
export function executeBuy(account: Account, code: string, name: string, price: number, amount: number, reason: string, isAuto: boolean = false): Account {
  const quantity = Math.floor(amount / price / 100) * 100; // A股100股整数倍
  if (quantity <= 0) return account;

  const actualAmount = quantity * price;
  if (actualAmount > account.currentCapital) return account;

  const trade: Trade = {
    id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    stockCode: code,
    stockName: name,
    direction: "buy",
    price,
    quantity,
    amount: actualAmount,
    reason,
    isAuto,
  };

  // 更新持仓
  const existingPos = account.positions.find((p) => p.stockCode === code);
  let newPositions: Position[];
  if (existingPos) {
    const newQty = existingPos.quantity + quantity;
    const newAvgCost = (existingPos.avgCost * existingPos.quantity + actualAmount) / newQty;
    newPositions = account.positions.map((p) =>
      p.stockCode === code
        ? { ...p, quantity: newQty, avgCost: newAvgCost }
        : p
    );
  } else {
    newPositions = [
      ...account.positions,
      {
        stockCode: code,
        stockName: name,
        quantity,
        avgCost: price,
        currentPrice: price,
        marketValue: actualAmount,
        pnl: 0,
        pnlPercent: 0,
        positionPercent: 0,
      },
    ];
  }

  // 重新计算仓位占比
  const totalMarketValue = newPositions.reduce((sum, p) => sum + p.marketValue, 0);
  if (totalMarketValue > 0) {
    newPositions = newPositions.map((p) => ({
      ...p,
      positionPercent: Math.round((p.marketValue / (account.currentCapital - actualAmount + totalMarketValue)) * 10000) / 100,
    }));
  }

  const updatedAccount: Account = {
    ...account,
    currentCapital: account.currentCapital - actualAmount,
    positions: newPositions,
    trades: [...account.trades, trade],
  };

  saveAccount(updatedAccount);
  return updatedAccount;
}

// 执行卖出
export function executeSell(account: Account, code: string, price: number, quantity: number, reason: string, isAuto: boolean = false): Account {
  const existingPos = account.positions.find((p) => p.stockCode === code);
  if (!existingPos || existingPos.quantity < quantity) return account;

  const amount = quantity * price;
  const pnl = (price - existingPos.avgCost) * quantity;

  const trade: Trade = {
    id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    stockCode: code,
    stockName: existingPos.stockName,
    direction: "sell",
    price,
    quantity,
    amount,
    reason,
    pnl,
    isAuto,
  };

  // 更新持仓
  let newPositions: Position[];
  if (existingPos.quantity === quantity) {
    newPositions = account.positions.filter((p) => p.stockCode !== code);
  } else {
    const newQty = existingPos.quantity - quantity;
    newPositions = account.positions.map((p) =>
      p.stockCode === code
        ? { ...p, quantity: newQty, marketValue: newQty * p.currentPrice }
        : p
    );
  }

  // 重新计算仓位占比
  const totalMarketValue = newPositions.reduce((sum, p) => sum + p.marketValue, 0);
  const totalAssets = account.currentCapital + amount + totalMarketValue;
  if (totalAssets > 0) {
    newPositions = newPositions.map((p) => ({
      ...p,
      positionPercent: Math.round((p.marketValue / totalAssets) * 10000) / 100,
    }));
  }

  const updatedAccount: Account = {
    ...account,
    currentCapital: account.currentCapital + amount,
    positions: newPositions,
    trades: [...account.trades, trade],
  };

  saveAccount(updatedAccount);
  return updatedAccount;
}

// 清理垃圾数据
export function cleanGarbageData(account: Account): { deletedTrades: number; deletedRecords: number } {
  const thirtyDaysAgo = Date.now() - 30 * 86400000;
  const holdingCodes = new Set(account.positions.map((p) => p.stockCode));

  const beforeCount = account.trades.length;
  const cleanedTrades = account.trades.filter((trade) => {
    // 保留持仓中的股票记录
    if (holdingCodes.has(trade.stockCode)) return true;
    // 删除已平仓且超过30天的交易
    if (trade.timestamp < thirtyDaysAgo) return false;
    // 删除收益率为0的无效交易
    if (trade.pnl === 0 && trade.direction === "sell") return false;
    return true;
  });

  const deletedTrades = beforeCount - cleanedTrades.length;

  const updatedAccount: Account = {
    ...account,
    trades: cleanedTrades,
  };
  saveAccount(updatedAccount);

  return { deletedTrades, deletedRecords: deletedTrades };
}

// 重置账户
export function resetAccount(account: Account): Account {
  const resetAccountData: Account = {
    ...account,
    currentCapital: account.initialCapital,
    positions: [],
    trades: [],
    // 保留跟踪列表和额度设置
    updatedAt: Date.now(),
  };
  saveAccount(resetAccountData);
  return resetAccountData;
}

// 生成模拟数据（用于演示）
export function generateDemoAccount(): Account {
  const now = Date.now();
  const account: Account = {
    id: generateId(),
    name: "演示账户",
    initialCapital: 1000000,
    currentCapital: 862750,
    positions: [
      { stockCode: "000858", stockName: "五粮液", quantity: 500, avgCost: 145, currentPrice: 152.5, marketValue: 76250, pnl: 3750, pnlPercent: 5.17, positionPercent: 7.3 },
      { stockCode: "300750", stockName: "宁德时代", quantity: 300, avgCost: 198, currentPrice: 205.8, marketValue: 61740, pnl: 2340, pnlPercent: 3.94, positionPercent: 5.9 },
    ],
    trades: [
      { id: "d1", timestamp: now - 86400000 * 10, stockCode: "600519", stockName: "贵州茅台", direction: "buy", price: 1180, quantity: 100, amount: 118000, reason: "缠论二买信号", isAuto: true },
      { id: "d2", timestamp: now - 86400000 * 7, stockCode: "000858", stockName: "五粮液", direction: "buy", price: 145, quantity: 500, amount: 72500, reason: "波浪理论第3浪启动", isAuto: true },
      { id: "d3", timestamp: now - 86400000 * 5, stockCode: "600519", stockName: "贵州茅台", direction: "sell", price: 1250, quantity: 100, amount: 125000, reason: "技术指标超买", pnl: 7000, isAuto: true },
      { id: "d4", timestamp: now - 86400000 * 3, stockCode: "300750", stockName: "宁德时代", direction: "buy", price: 198, quantity: 300, amount: 59400, reason: "板块热度高", isAuto: false },
      { id: "d5", timestamp: now - 86400000 * 2, stockCode: "300124", stockName: "汇川技术", direction: "buy", price: 68.5, quantity: 200, amount: 13700, reason: "缠论三买", isAuto: true },
      { id: "d6", timestamp: now - 86400000, stockCode: "300124", stockName: "汇川技术", direction: "sell", price: 72.3, quantity: 200, amount: 14460, reason: "止盈出局", pnl: 760, isAuto: true },
    ],
    trackingList: ["000858", "300750", "300124", "688256", "002475"],
    stockLimits: {
      "000858": 100000,
      "300750": 80000,
      "688256": 50000,
      "300124": 30000,
    },
    createdAt: now - 86400000 * 30,
    updatedAt: now,
  };

  saveAccount(account);
  return account;
}

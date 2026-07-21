import type { Account, AccountSummary, Trade, Position, StrategyMetrics, EquityPoint, SingleStrategyStats, FailureStats, FailureReason, StrategySource, AccountType, QuantStrategy, RunMode } from "./types";
import { applySlippage } from "@/lib/slippage";
import * as CloudAPI from "@/lib/api-client-db";

const STORAGE_PREFIX = "backtest_account_";
const ACTIVE_ACCOUNT_KEY = "backtest_active_account";

// 生成唯一ID
export function generateId(): string {
  return `acc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// 保存账户到localStorage + 触发云端同步
export function saveAccount(account: Account): void {
  account.updatedAt = Date.now();
  localStorage.setItem(`${STORAGE_PREFIX}${account.id}`, JSON.stringify(account));
  // 异步同步到云端（防抖）
  debouncedSyncAccount(account.id);
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

// 创建默认量化策略
export function createDefaultStrategy(): QuantStrategy {
  return {
    name: "默认量化策略",
    theories: ["composite"],
    stopLossPercent: 8,
    takeProfitPercent: 15,
    maxPositionPercent: 30,
    autoTrade: false,
  };
}

// 创建新账户
export function createAccount(name: string, initialCapital: number, type: AccountType = "manual", strategy?: QuantStrategy, runMode?: RunMode): Account {
  const account: Account = {
    id: generateId(),
    name,
    type,
    initialCapital,
    currentCapital: initialCapital,
    positions: [],
    trades: [],
    trackingList: [],
    stockLimits: {},
    strategy: type === "quant" ? (strategy || createDefaultStrategy()) : undefined,
    runMode: type === "quant" ? (runMode || "backtest") : undefined,
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

// 生成资金曲线（基于真实交易数据）
export function generateEquityCurve(account: Account): EquityPoint[] {
  const points: EquityPoint[] = [];
  
  // 如果没有交易记录，返回空数组
  if (!account.trades || account.trades.length === 0) {
    return points;
  }

  // 按时间排序的交易
  const sortedTrades = [...account.trades].sort((a, b) => a.timestamp - b.timestamp);
  
  // 确定时间范围：从第一笔交易到最后一笔交易（或今天）
  const firstTradeTime = sortedTrades[0].timestamp;
  const lastTradeTime = sortedTrades[sortedTrades.length - 1].timestamp;
  
  // 检查是否有未平仓持仓
  const finalPositions: Record<string, { qty: number; cost: number; lastPrice: number }> = {};
  let finalCash = account.initialCapital;
  
  for (const trade of sortedTrades) {
    if (trade.direction === "buy") {
      finalCash -= trade.amount;
      const existing = finalPositions[trade.stockCode] || { qty: 0, cost: 0, lastPrice: trade.price };
      const newQty = existing.qty + trade.quantity;
      const newCost = newQty > 0 ? (existing.cost * existing.qty + trade.amount) / newQty : 0;
      finalPositions[trade.stockCode] = { qty: newQty, cost: newCost, lastPrice: trade.price };
    } else {
      finalCash += trade.amount;
      const existing = finalPositions[trade.stockCode];
      if (existing) {
        existing.qty -= trade.quantity;
        existing.lastPrice = trade.price;
        if (existing.qty <= 0) delete finalPositions[trade.stockCode];
      }
    }
  }
  
  // 如果有未平仓持仓，结束日期为今天；否则为最后一笔交易日
  const hasOpenPositions = Object.keys(finalPositions).length > 0;
  const endTime = hasOpenPositions ? Date.now() : lastTradeTime;
  
  // 生成每日数据点
  const MS_PER_DAY = 86400000;
  const startDate = new Date(firstTradeTime);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(endTime);
  endDate.setHours(23, 59, 59, 999);
  
  // 构建交易日列表（只包含有交易的日期 + 起始日期 + 结束日期）
  const tradeDates = new Set<number>();
  tradeDates.add(startDate.getTime());
  for (const trade of sortedTrades) {
    const tradeDate = new Date(trade.timestamp);
    tradeDate.setHours(0, 0, 0, 0);
    tradeDates.add(tradeDate.getTime());
  }
  tradeDates.add(endDate.getTime());
  
  const sortedDates = Array.from(tradeDates).sort((a, b) => a - b);
  
  // 对每个交易日计算资金状况
  for (const dateTimestamp of sortedDates) {
    const dayEnd = dateTimestamp + MS_PER_DAY - 1;
    
    // 计算到该日期为止的所有交易
    const tradesBefore = sortedTrades.filter(t => t.timestamp <= dayEnd);
    
    let cash = account.initialCapital;
    const positionsAtDay: Record<string, { qty: number; cost: number; lastPrice: number }> = {};
    
    for (const trade of tradesBefore) {
      if (trade.direction === "buy") {
        cash -= trade.amount;
        const existing = positionsAtDay[trade.stockCode] || { qty: 0, cost: 0, lastPrice: trade.price };
        const newQty = existing.qty + trade.quantity;
        const newCost = newQty > 0 ? (existing.cost * existing.qty + trade.amount) / newQty : 0;
        positionsAtDay[trade.stockCode] = { qty: newQty, cost: newCost, lastPrice: trade.price };
      } else {
        cash += trade.amount;
        const existing = positionsAtDay[trade.stockCode];
        if (existing) {
          existing.qty -= trade.quantity;
          existing.lastPrice = trade.price;
          if (existing.qty <= 0) delete positionsAtDay[trade.stockCode];
        }
      }
    }
    
    // 计算持仓市值（使用最后交易价格）
    const marketValue = Object.values(positionsAtDay).reduce((sum, p) => {
      return sum + p.qty * p.lastPrice;
    }, 0);
    
    points.push({
      timestamp: dateTimestamp,
      totalAssets: cash + marketValue,
      cash,
      marketValue,
    });
  }

  return points;
}

// 生成演示资金曲线（用于无交易记录时的展示）
export function generateDemoEquityCurve(initialCapital: number = 1000000): EquityPoint[] {
  const points: EquityPoint[] = [];
  const now = Date.now();
  const days = 30;

  let cash = initialCapital;
  let marketValue = 0;
  
  for (let i = days; i >= 0; i--) {
    const timestamp = now - i * 86400000;
    
    // 模拟每日波动
    const dailyReturn = (Math.random() - 0.48) * 0.02; // 略微偏向上涨
    marketValue = marketValue * (1 + dailyReturn);
    
    // 随机交易模拟
    if (i === 25) {
      cash -= 300000;
      marketValue += 300000;
    } else if (i === 15) {
      cash += 50000;
      marketValue -= 50000;
    } else if (i === 5) {
      cash -= 200000;
      marketValue += 200000;
    }
    
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
export function canBuyStock(account: Account, code: string, buyBudget: number): { can: boolean; reason: string } {
  const limit = account.stockLimits[code];
  if (limit !== undefined) {
    const currentHolding = account.positions
      .filter((p) => p.stockCode === code)
      .reduce((sum, p) => sum + p.marketValue, 0);
    if (currentHolding + buyBudget > limit) {
      return { can: false, reason: `该股票已达到买入上限(¥${limit.toLocaleString()})` };
    }
  }

  if (account.currentCapital < buyBudget) {
    return { can: false, reason: "账户资金不足" };
  }

  return { can: true, reason: "" };
}

// 执行买入
export function executeBuy(account: Account, code: string, name: string, price: number, buyBudget: number, reason: string, isAuto: boolean = false): Account {
  // 自动交易应用滑点
  const actualPrice = isAuto ? applySlippage(price, 'buy') : price;
  const quantity = Math.floor(buyBudget / actualPrice / 100) * 100; // A股100股整数倍
  if (quantity <= 0) return account;

  // buyCost = 买入总花费（元）= price × quantity
  const buyCost = quantity * actualPrice;
  if (buyCost > account.currentCapital) return account;

  const trade: Trade = {
    id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    stockCode: code,
    stockName: name,
    direction: "buy",
    price: actualPrice,
    suggestedPrice: isAuto ? price : undefined,
    quantity,
    amount: buyCost,
    reason,
    isAuto,
  };

  // 更新持仓
  const existingPos = account.positions.find((p) => p.stockCode === code);
  let newPositions: Position[];
  if (existingPos) {
    const newQty = existingPos.quantity + quantity;
    // 加仓均价 = (旧均价 × 旧数量 + 买入总花费) / 新数量
    const newAvgCost = (existingPos.avgCost * existingPos.quantity + buyCost) / newQty;
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
        marketValue: buyCost,
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
      positionPercent: Math.round((p.marketValue / (account.currentCapital - buyCost + totalMarketValue)) * 10000) / 100,
    }));
  }

  const updatedAccount: Account = {
    ...account,
    currentCapital: account.currentCapital - buyCost,
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

  // 自动交易应用滑点
  const actualPrice = isAuto ? applySlippage(price, 'sell') : price;
  const amount = quantity * actualPrice;
  const pnl = (actualPrice - existingPos.avgCost) * quantity;

  const trade: Trade = {
    id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    stockCode: code,
    stockName: existingPos.stockName,
    direction: "sell",
    price: actualPrice,
    suggestedPrice: isAuto ? price : undefined,
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
    type: "manual",
    initialCapital: 1000000,
    currentCapital: 862750,
    positions: [
      {
        stockCode: "000858", stockName: "五粮液", quantity: 500, avgCost: 145,
        currentPrice: 152.5, marketValue: 76250, pnl: 3750, pnlPercent: 5.17, positionPercent: 7.3,
        buyTime: now - 86400000 * 7, buyReason: "波浪理论第3浪启动，MACD金叉共振",
        strategy: "wave", holdingDays: 7,
        buySignals: [{ type: "buy", label: "波浪第3浪启动", price: 145, strategy: "wave", triggered: true, timestamp: now - 86400000 * 7 }],
        sellSignals: [
          { type: "sell", label: "目标价¥165(第3浪顶)", price: 165, strategy: "wave", triggered: false },
          { type: "sell", label: "MACD顶背离", price: 160, strategy: "technical", triggered: false },
        ],
        stopLossSignals: [
          { type: "stop_loss", label: "跌破MA20均线", price: 138, strategy: "technical", triggered: false },
          { type: "stop_loss", label: "亏损超8%强制止损", price: 133.4, strategy: "composite", triggered: false },
        ],
      },
      {
        stockCode: "300750", stockName: "宁德时代", quantity: 300, avgCost: 198,
        currentPrice: 205.8, marketValue: 61740, pnl: 2340, pnlPercent: 3.94, positionPercent: 5.9,
        buyTime: now - 86400000 * 3, buyReason: "板块热度高+缠论中枢上移",
        strategy: "composite", holdingDays: 3,
        buySignals: [
          { type: "buy", label: "缠论中枢上移", price: 198, strategy: "chanlun", triggered: true, timestamp: now - 86400000 * 3 },
          { type: "buy", label: "板块资金净流入TOP3", price: 198, strategy: "technical", triggered: true, timestamp: now - 86400000 * 3 },
        ],
        sellSignals: [
          { type: "sell", label: "突破前高¥220后回落", price: 220, strategy: "wave", triggered: false },
          { type: "sell", label: "RSI超买>80", price: 215, strategy: "technical", triggered: false },
        ],
        stopLossSignals: [
          { type: "stop_loss", label: "跌破布林带中轨", price: 192, strategy: "technical", triggered: false },
          { type: "stop_loss", label: "亏损超10%清仓", price: 178.2, strategy: "composite", triggered: false },
        ],
      },
    ],
    trades: [
      {
        id: "d1", timestamp: now - 86400000 * 10, stockCode: "600519", stockName: "贵州茅台",
        direction: "buy", price: 1180, quantity: 100, amount: 118000, reason: "缠论二买信号",
        isAuto: true, strategy: "chanlun",
        decision: { signalSource: "chanlun", signalLabel: "缠论二买", marketState: "大盘震荡偏强，情绪评分62", sentimentScore: 62, supportLevel: 1150, resistanceLevel: 1280, suggestedPrice: 1175, actualPrice: 1180 },
      },
      {
        id: "d2", timestamp: now - 86400000 * 7, stockCode: "000858", stockName: "五粮液",
        direction: "buy", price: 145, quantity: 500, amount: 72500, reason: "波浪理论第3浪启动",
        isAuto: true, strategy: "wave",
        decision: { signalSource: "wave", signalLabel: "第3浪启动", marketState: "消费板块回暖，北向资金流入", sentimentScore: 58, supportLevel: 140, resistanceLevel: 165, suggestedPrice: 143, actualPrice: 145 },
      },
      {
        id: "d3", timestamp: now - 86400000 * 5, stockCode: "600519", stockName: "贵州茅台",
        direction: "sell", price: 1250, quantity: 100, amount: 125000, reason: "技术指标超买，RSI>80",
        pnl: 7000, isAuto: true, strategy: "technical",
        decision: { signalSource: "technical", signalLabel: "RSI超买+MACD顶背离", marketState: "大盘情绪高涨，评分78", sentimentScore: 78 },
      },
      {
        id: "d4", timestamp: now - 86400000 * 3, stockCode: "300750", stockName: "宁德时代",
        direction: "buy", price: 198, quantity: 300, amount: 59400, reason: "板块热度高+缠论中枢上移",
        isAuto: false, strategy: "composite",
        decision: { signalSource: "composite", signalLabel: "缠论+板块共振", marketState: "新能源板块领涨", sentimentScore: 65, supportLevel: 190, resistanceLevel: 220 },
      },
      {
        id: "d5", timestamp: now - 86400000 * 12, stockCode: "002475", stockName: "立讯精密",
        direction: "buy", price: 42.5, quantity: 500, amount: 21250, reason: "追涨消费电子热点",
        isAuto: false, strategy: "manual",
        decision: { signalSource: "manual", signalLabel: "手动追涨", marketState: "消费电子概念爆发", sentimentScore: 72 },
      },
      {
        id: "d6", timestamp: now - 86400000 * 9, stockCode: "002475", stockName: "立讯精密",
        direction: "sell", price: 38.8, quantity: 500, amount: 19400, reason: "止损出局",
        pnl: -1850, isAuto: false, strategy: "manual",
        failureReasons: ["chase_high", "no_stop_loss"],
        decision: { signalSource: "manual", signalLabel: "追涨买入", marketState: "热点退潮", sentimentScore: 45 },
      },
      {
        id: "d7", timestamp: now - 86400000 * 8, stockCode: "688256", stockName: "寒武纪",
        direction: "buy", price: 310, quantity: 100, amount: 31000, reason: "缠论三买+AI算力链热度",
        isAuto: true, strategy: "chanlun",
        decision: { signalSource: "chanlun", signalLabel: "缠论三买", marketState: "AI板块强势", sentimentScore: 70, supportLevel: 290, resistanceLevel: 350 },
      },
      {
        id: "d8", timestamp: now - 86400000 * 6, stockCode: "688256", stockName: "寒武纪",
        direction: "sell", price: 285, quantity: 100, amount: 28500, reason: "大盘暴跌触发止损",
        pnl: -2500, isAuto: true, strategy: "chanlun",
        failureReasons: ["market_crash"],
        decision: { signalSource: "chanlun", signalLabel: "缠论三买", marketState: "大盘突发暴跌2.8%", sentimentScore: 25 },
      },
      {
        id: "d9", timestamp: now - 86400000 * 2, stockCode: "300124", stockName: "汇川技术",
        direction: "buy", price: 68.5, quantity: 200, amount: 13700, reason: "缠论三买",
        isAuto: true, strategy: "chanlun",
        decision: { signalSource: "chanlun", signalLabel: "缠论三买", marketState: "工控板块企稳", sentimentScore: 55 },
      },
      {
        id: "d10", timestamp: now - 86400000, stockCode: "300124", stockName: "汇川技术",
        direction: "sell", price: 72.3, quantity: 200, amount: 14460, reason: "止盈出局",
        pnl: 760, isAuto: true, strategy: "chanlun",
        decision: { signalSource: "chanlun", signalLabel: "目标价达成", marketState: "板块轮动", sentimentScore: 58 },
      },
      {
        id: "d11", timestamp: now - 86400000 * 4, stockCode: "601012", stockName: "隆基绿能",
        direction: "buy", price: 25.8, quantity: 800, amount: 20640, reason: "技术指标MACD金叉+超卖反弹",
        isAuto: true, strategy: "technical",
        decision: { signalSource: "technical", signalLabel: "MACD金叉+KDJ超卖", marketState: "光伏板块超跌", sentimentScore: 35 },
      },
      {
        id: "d12", timestamp: now - 86400000 * 1.5, stockCode: "601012", stockName: "隆基绿能",
        direction: "sell", price: 24.2, quantity: 800, amount: 19360, reason: "止损出局，跌破支撑",
        pnl: -1280, isAuto: true, strategy: "technical",
        failureReasons: ["bad_timing", "overweight"],
        decision: { signalSource: "technical", signalLabel: "MACD金叉", marketState: "光伏继续下探", sentimentScore: 28 },
      },
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

// 计算单策略统计
export function calculateStrategyStats(account: Account): SingleStrategyStats[] {
  const strategies: { key: StrategySource; label: string; color: string }[] = [
    { key: "chanlun", label: "缠论", color: "#a855f7" },
    { key: "wave", label: "波浪理论", color: "#3b82f6" },
    { key: "technical", label: "技术指标", color: "#22c55e" },
    { key: "composite", label: "综合策略", color: "#f59e0b" },
    { key: "manual", label: "手动操作", color: "#94a3b8" },
  ];

  const sellTrades = account.trades.filter((t) => t.direction === "sell");

  return strategies.map(({ key, label, color }) => {
    const trades = sellTrades.filter((t) => t.strategy === key);
    const profitable = trades.filter((t) => (t.pnl || 0) > 0);
    const losing = trades.filter((t) => (t.pnl || 0) < 0);
    const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
    const avgProfit = profitable.length > 0 ? profitable.reduce((s, t) => s + (t.pnl || 0), 0) / profitable.length : 0;
    const avgLoss = losing.length > 0 ? Math.abs(losing.reduce((s, t) => s + (t.pnl || 0), 0) / losing.length) : 0;

    return {
      strategy: key,
      label,
      color,
      totalTrades: trades.length,
      profitableTrades: profitable.length,
      losingTrades: losing.length,
      winRate: trades.length > 0 ? Math.round((profitable.length / trades.length) * 10000) / 100 : 0,
      avgProfit: Math.round(avgProfit),
      avgLoss: Math.round(avgLoss),
      profitLossRatio: avgLoss > 0 ? Math.round((avgProfit / avgLoss) * 100) / 100 : 0,
      totalPnl: Math.round(totalPnl),
    };
  }).filter((s) => s.totalTrades > 0);
}

// 计算失败原因统计
export function calculateFailureStats(account: Account): FailureStats[] {
  const reasonMap: Record<FailureReason, { label: string; color: string }> = {
    theory_fail: { label: "理论失效", color: "#ef4444" },
    market_crash: { label: "市场异常", color: "#f97316" },
    chase_high: { label: "追涨杀跌", color: "#eab308" },
    overweight: { label: "仓位过重", color: "#3b82f6" },
    no_stop_loss: { label: "止损不及时", color: "#8b5cf6" },
    bad_timing: { label: "择时失误", color: "#06b6d4" },
  };

  const sellTrades = account.trades.filter((t) => t.direction === "sell" && (t.pnl || 0) < 0);
  const stats: FailureStats[] = [];

  for (const [reason, meta] of Object.entries(reasonMap)) {
    const trades = sellTrades.filter((t) =>
      t.failureReasons?.includes(reason as FailureReason) || t.failureReason === reason
    );
    if (trades.length > 0) {
      stats.push({
        reason: reason as FailureReason,
        label: meta.label,
        color: meta.color,
        count: trades.length,
        totalLoss: Math.round(trades.reduce((s, t) => s + (t.pnl || 0), 0)),
        trades,
      });
    }
  }

  return stats.sort((a, b) => b.count - a.count);
}

// 根据风险等级计算建议仓位
export function getSuggestedPosition(riskLevel: "低" | "中" | "高" | "极高"): { min: number; max: number; label: string } {
  switch (riskLevel) {
    case "低": return { min: 60, max: 80, label: "建议仓位 60-80%" };
    case "中": return { min: 30, max: 50, label: "建议仓位 30-50%" };
    case "高": return { min: 0, max: 20, label: "建议仓位 0-20%" };
    case "极高": return { min: 0, max: 0, label: "建议空仓观望" };
  }
}

// 基准对比数据类型
export interface BenchmarkData {
  date: string;
  strategyReturn: number;  // 策略收益率 %
  benchmarkReturn: number; // 基准收益率 %
  buyHoldReturn: number;   // 买入持有收益率 %
}

// 计算基准对比数据（模拟沪深300和买入持有）
export function calculateBenchmarkComparison(account: Account): BenchmarkData[] {
  const equityCurve = generateEquityCurve(account);
  if (equityCurve.length === 0) return [];

  const initialCapital = account.initialCapital;
  
  // 模拟沪深300基准数据（基于时间范围的随机但合理的走势）
  const benchmarkReturns: number[] = [];
  let benchmarkCumulative = 0;
  
  // 模拟买入持有的收益（基于持仓股票的平均表现）
  let buyHoldCumulative = 0;

  return equityCurve.map((point, index) => {
    const strategyReturn = ((point.totalAssets - initialCapital) / initialCapital) * 100;
    
    // 模拟基准每日涨跌（使用确定性种子）
    const seed = index * 7 + 13;
    const dailyBenchmarkChange = Math.sin(seed * 0.1) * 0.8 + Math.cos(seed * 0.05) * 0.5;
    benchmarkCumulative += dailyBenchmarkChange;
    
    // 模拟买入持有（略低于策略，高于基准）
    const dailyBuyHoldChange = dailyBenchmarkChange * 0.7 + strategyReturn * 0.001;
    buyHoldCumulative += dailyBuyHoldChange;
    
    return {
      date: new Date(point.timestamp).toISOString().slice(0, 10),
      strategyReturn: Math.round(strategyReturn * 100) / 100,
      benchmarkReturn: Math.round(benchmarkCumulative * 100) / 100,
      buyHoldReturn: Math.round(buyHoldCumulative * 100) / 100,
    };
  });
}

// 计算连续亏损次数
export function calculateConsecutiveLosses(account: Account): { current: number; max: number } {
  const sellTrades = account.trades
    .filter(t => t.direction === "sell" && t.pnl !== undefined)
    .sort((a, b) => a.timestamp - b.timestamp);

  let current = 0;
  let max = 0;
  let tempCurrent = 0;

  for (const trade of sellTrades) {
    if ((trade.pnl || 0) < 0) {
      tempCurrent++;
      max = Math.max(max, tempCurrent);
    } else {
      tempCurrent = 0;
    }
  }

  // 计算当前连续亏损（从最后一笔交易往前数）
  for (let i = sellTrades.length - 1; i >= 0; i--) {
    if ((sellTrades[i].pnl || 0) < 0) {
      current++;
    } else {
      break;
    }
  }

  return { current, max };
}

// 计算最大回撤区间
export function calculateMaxDrawdownPeriod(account: Account): { start: string; end: string; drawdown: number } | null {
  const equityCurve = generateEquityCurve(account);
  if (equityCurve.length < 2) return null;

  let maxDrawdown = 0;
  let peakIndex = 0;
  let troughIndex = 0;
  let tempPeakIndex = 0;

  for (let i = 0; i < equityCurve.length; i++) {
    if (equityCurve[i].totalAssets > equityCurve[tempPeakIndex].totalAssets) {
      tempPeakIndex = i;
    }
    const drawdown = ((equityCurve[tempPeakIndex].totalAssets - equityCurve[i].totalAssets) / equityCurve[tempPeakIndex].totalAssets) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      peakIndex = tempPeakIndex;
      troughIndex = i;
    }
  }

  if (maxDrawdown === 0) return null;

  return {
    start: new Date(equityCurve[peakIndex].timestamp).toISOString().slice(0, 10),
    end: new Date(equityCurve[troughIndex].timestamp).toISOString().slice(0, 10),
    drawdown: Math.round(maxDrawdown * 100) / 100,
  };
}

// 计算单日最大亏损
export function calculateMaxDailyLoss(account: Account): { date: string; loss: number } | null {
  const equityCurve = generateEquityCurve(account);
  if (equityCurve.length < 2) return null;

  let maxLoss = 0;
  let maxLossDate = "";

  for (let i = 1; i < equityCurve.length; i++) {
    const dailyChange = equityCurve[i].totalAssets - equityCurve[i - 1].totalAssets;
    if (dailyChange < maxLoss) {
      maxLoss = dailyChange;
      maxLossDate = new Date(equityCurve[i].timestamp).toISOString().slice(0, 10);
    }
  }

  if (maxLoss === 0) return null;

  return { date: maxLossDate, loss: Math.round(maxLoss) };
}

// 计算滑点统计
export interface SlippageStats {
  totalTrades: number;
  avgSlippage: number;      // 平均滑点 %
  maxSlippage: number;      // 最大滑点 %
  totalSlippageCost: number; // 总滑点成本
}

export function calculateSlippageStats(account: Account): SlippageStats | null {
  const tradesWithDecision = account.trades.filter(t => t.decision?.suggestedPrice && t.decision?.actualPrice);
  if (tradesWithDecision.length === 0) return null;

  let totalSlippage = 0;
  let maxSlippage = 0;
  let totalCost = 0;

  for (const trade of tradesWithDecision) {
    const suggested = trade.decision!.suggestedPrice!;
    const actual = trade.decision!.actualPrice!;
    const slippage = Math.abs((actual - suggested) / suggested) * 100;
    const cost = Math.abs(actual - suggested) * trade.quantity;
    
    totalSlippage += slippage;
    maxSlippage = Math.max(maxSlippage, slippage);
    totalCost += cost;
  }

  return {
    totalTrades: tradesWithDecision.length,
    avgSlippage: Math.round((totalSlippage / tradesWithDecision.length) * 100) / 100,
    maxSlippage: Math.round(maxSlippage * 100) / 100,
    totalSlippageCost: Math.round(totalCost),
  };
}

// ==================== 策略验证报告 ====================

// 信号质量统计
export interface SignalQuality {
  strategyName: string;
  strategyKey: string;
  totalSignals: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  falsePositiveRate: number;
}

// 收益归因
export interface ProfitAttribution {
  strategyName: string;
  strategyKey: string;
  totalProfit: number;
  tradeCount: number;
  avgProfit: number;
  winRate: number;
  profitPercent: number; // 占总盈亏百分比
}

// 策略相关性
export interface StrategyCorrelation {
  strategy1: string;
  strategy2: string;
  correlation: number;
  overlapRate: number;
}

// 时间分布
export interface TimeDistributionCell {
  day: number;    // 0-4 (周一到周五)
  hour: number;   // 9-15
  count: number;
  profit: number;
}

// 连续亏损
export interface ConsecutiveLossInfo {
  strategyName: string;
  strategyKey: string;
  maxConsecutive: number;
  currentConsecutive: number;
  totalLossStreaks: number; // 连续亏损次数
}

// 综合评级
export interface OverallRating {
  score: number;         // 0-100
  grade: "A" | "B" | "C" | "D";
  signalScore: number;   // 信号命中率得分
  profitScore: number;   // 收益贡献得分
  riskScore: number;     // 风险控制得分
  diversityScore: number;// 策略多样性得分
  suggestions: string[]; // 改进建议
}

// 策略标签映射
const STRATEGY_LABELS: Record<string, string> = {
  chanlun: "缠论",
  wave: "波浪理论",
  technical: "技术指标",
  composite: "综合策略",
  manual: "手动交易",
};

// 计算信号质量
export function calculateSignalQuality(account: Account): SignalQuality[] {
  const trades = account.trades.filter(t => t.strategy);
  const strategyMap = new Map<string, { total: number; hit: number; miss: number }>();

  // 统计每个策略的信号
  for (const trade of trades) {
    const key = trade.strategy || "manual";
    if (!strategyMap.has(key)) {
      strategyMap.set(key, { total: 0, hit: 0, miss: 0 });
    }
    const stats = strategyMap.get(key)!;
    stats.total++;
    // 买入信号：如果后续卖出时盈利则命中
    if (trade.direction === "buy") {
      // 查找对应的卖出交易
      const sellTrade = trades.find(t =>
        t.stockCode === trade.stockCode &&
        t.direction === "sell" &&
        t.timestamp > trade.timestamp
      );
      if (sellTrade && (sellTrade.pnl ?? 0) > 0) {
        stats.hit++;
      } else if (sellTrade) {
        stats.miss++;
      }
    }
  }

  return Array.from(strategyMap.entries()).map(([key, stats]) => ({
    strategyName: STRATEGY_LABELS[key] || key,
    strategyKey: key,
    totalSignals: stats.total,
    hitCount: stats.hit,
    missCount: stats.miss,
    hitRate: stats.hit + stats.miss > 0
      ? Math.round((stats.hit / (stats.hit + stats.miss)) * 10000) / 100
      : 0,
    falsePositiveRate: stats.total > 0
      ? Math.round((stats.miss / stats.total) * 10000) / 100
      : 0,
  }));
}

// 计算收益归因
export function calculateProfitAttribution(account: Account): ProfitAttribution[] {
  const trades = account.trades.filter(t => t.pnl !== undefined && t.pnl !== 0);
  const strategyMap = new Map<string, { totalProfit: number; count: number; wins: number }>();

  let grandTotal = 0;
  for (const trade of trades) {
    const key = trade.strategy || "manual";
    if (!strategyMap.has(key)) {
      strategyMap.set(key, { totalProfit: 0, count: 0, wins: 0 });
    }
    const stats = strategyMap.get(key)!;
    const pnl = trade.pnl ?? 0;
    stats.totalProfit += pnl;
    stats.count++;
    grandTotal += Math.abs(pnl);
    if (pnl > 0) stats.wins++;
  }

  return Array.from(strategyMap.entries()).map(([key, stats]) => ({
    strategyName: STRATEGY_LABELS[key] || key,
    strategyKey: key,
    totalProfit: Math.round(stats.totalProfit * 100) / 100,
    tradeCount: stats.count,
    avgProfit: stats.count > 0 ? Math.round((stats.totalProfit / stats.count) * 100) / 100 : 0,
    winRate: stats.count > 0 ? Math.round((stats.wins / stats.count) * 10000) / 100 : 0,
    profitPercent: grandTotal > 0
      ? Math.round((Math.abs(stats.totalProfit) / grandTotal) * 10000) / 100
      : 0,
  }));
}

// 计算策略相关性
export function calculateStrategyCorrelation(account: Account): StrategyCorrelation[] {
  const trades = account.trades.filter(t => t.strategy);
  const strategies = [...new Set(trades.map(t => t.strategy!))];
  
  if (strategies.length < 2) return [];

  // 为每个策略构建信号时间序列（按股票+日期）
  const strategySignals = new Map<string, Set<string>>();
  for (const s of strategies) {
    const signals = new Set<string>();
    for (const t of trades) {
      if (t.strategy === s) {
        const dateKey = `${t.stockCode}_${new Date(t.timestamp).toISOString().slice(0, 10)}`;
        signals.add(dateKey);
      }
    }
    strategySignals.set(s, signals);
  }

  const correlations: StrategyCorrelation[] = [];
  for (let i = 0; i < strategies.length; i++) {
    for (let j = i + 1; j < strategies.length; j++) {
      const s1 = strategies[i];
      const s2 = strategies[j];
      const set1 = strategySignals.get(s1)!;
      const set2 = strategySignals.get(s2)!;
      
      // 计算重合率
      const union = new Set([...set1, ...set2]);
      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const overlapRate = union.size > 0
        ? Math.round((intersection.size / union.size) * 10000) / 100
        : 0;
      
      // Jaccard相似度作为相关性
      correlations.push({
        strategy1: s1,
        strategy2: s2,
        correlation: Math.round((overlapRate / 100) * 100) / 100,
        overlapRate,
      });
    }
  }

  return correlations;
}

// 计算时间分布
export function calculateTimeDistribution(account: Account): TimeDistributionCell[] {
  const trades = account.trades;
  const cellMap = new Map<string, { count: number; profit: number }>();

  for (const trade of trades) {
    const date = new Date(trade.timestamp);
    const day = date.getDay(); // 0=Sun, 1=Mon...
    if (day === 0 || day === 6) continue; // 跳过周末
    const hour = date.getHours();
    if (hour < 9 || hour > 15) continue; // 跳过非交易时间
    
    const dayIdx = day - 1; // 0=Mon, 4=Fri
    const key = `${dayIdx}_${hour}`;
    if (!cellMap.has(key)) {
      cellMap.set(key, { count: 0, profit: 0 });
    }
    const cell = cellMap.get(key)!;
    cell.count++;
    cell.profit += trade.pnl ?? 0;
  }

  const result: TimeDistributionCell[] = [];
  for (let day = 0; day < 5; day++) {
    for (let hour = 9; hour <= 15; hour++) {
      const key = `${day}_${hour}`;
      const cell = cellMap.get(key) || { count: 0, profit: 0 };
      result.push({
        day,
        hour,
        count: cell.count,
        profit: Math.round(cell.profit * 100) / 100,
      });
    }
  }
  return result;
}

// 按策略计算连续亏损
export function calculateConsecutiveLossesByStrategy(account: Account): ConsecutiveLossInfo[] {
  const trades = account.trades
    .filter(t => t.pnl !== undefined)
    .sort((a, b) => a.timestamp - b.timestamp);
  
  const strategies = [...new Set(trades.map(t => t.strategy || "manual"))];
  
  return strategies.map(key => {
    const strategyTrades = trades
      .filter(t => (t.strategy || "manual") === key && t.direction === "sell")
      .sort((a, b) => a.timestamp - b.timestamp);
    
    let maxConsecutive = 0;
    let currentConsecutive = 0;
    let totalLossStreaks = 0;
    let inStreak = false;
    
    for (const trade of strategyTrades) {
      if ((trade.pnl ?? 0) < 0) {
        currentConsecutive++;
        if (!inStreak) {
          inStreak = true;
          totalLossStreaks++;
        }
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 0;
        inStreak = false;
      }
    }
    
    return {
      strategyName: STRATEGY_LABELS[key] || key,
      strategyKey: key,
      maxConsecutive,
      currentConsecutive,
      totalLossStreaks,
    };
  });
}

// 计算综合评级
export function calculateOverallRating(
  signalQuality: SignalQuality[],
  profitAttribution: ProfitAttribution[],
  consecutiveLosses: ConsecutiveLossInfo[],
  correlations: StrategyCorrelation[]
): OverallRating {
  const suggestions: string[] = [];
  
  // 1. 信号命中率得分 (30%)
  const avgHitRate = signalQuality.length > 0
    ? signalQuality.reduce((sum, s) => sum + s.hitRate, 0) / signalQuality.length
    : 50;
  const signalScore = Math.min(100, Math.round(avgHitRate * 1.5));
  
  // 2. 收益贡献得分 (30%)
  const profitableStrategies = profitAttribution.filter(p => p.totalProfit > 0);
  const totalProfit = profitAttribution.reduce((sum, p) => sum + p.totalProfit, 0);
  const profitScore = totalProfit > 0
    ? Math.min(100, Math.round((profitableStrategies.length / Math.max(1, profitAttribution.length)) * 100))
    : 20;
  
  // 3. 风险控制得分 (20%)
  const maxConsecutive = consecutiveLosses.length > 0
    ? Math.max(...consecutiveLosses.map(c => c.maxConsecutive))
    : 0;
  const riskScore = maxConsecutive <= 2 ? 100 : maxConsecutive <= 5 ? 60 : 20;
  
  // 4. 策略多样性得分 (20%)
  const highCorrelations = correlations.filter(c => c.overlapRate > 70);
  const diversityScore = highCorrelations.length === 0
    ? 100
    : Math.max(20, 100 - highCorrelations.length * 30);
  
  // 综合得分
  const score = Math.round(
    signalScore * 0.3 +
    profitScore * 0.3 +
    riskScore * 0.2 +
    diversityScore * 0.2
  );
  
  // 评级
  const grade: "A" | "B" | "C" | "D" = 
    score >= 85 ? "A" :
    score >= 70 ? "B" :
    score >= 50 ? "C" : "D";
  
  // 生成建议
  if (avgHitRate < 40) {
    suggestions.push("信号命中率偏低，建议检查策略参数或降低交易频率");
  }
  if (maxConsecutive > 5) {
    suggestions.push("连续亏损次数过多，建议加强止损机制");
  }
  for (const corr of highCorrelations) {
    const name1 = STRATEGY_LABELS[corr.strategy1] || corr.strategy1;
    const name2 = STRATEGY_LABELS[corr.strategy2] || corr.strategy2;
    suggestions.push(`建议移除${name1}或${name2}，两者信号重合率${corr.overlapRate}%，高度冗余`);
  }
  if (totalProfit <= 0) {
    suggestions.push("整体收益为负，建议暂停交易并复盘策略");
  }
  if (profitAttribution.length === 1 && profitAttribution[0].tradeCount > 10) {
    suggestions.push("策略过于单一，建议增加其他策略分散风险");
  }
  if (suggestions.length === 0) {
    suggestions.push("策略表现良好，继续保持当前配置");
  }
  
  return {
    score,
    grade,
    signalScore,
    profitScore,
    riskScore,
    diversityScore,
    suggestions,
  };
}

// ==================== 云端同步层 ====================

// 同步队列（防抖）
const _syncQueue = new Map<string, number>();
let _syncTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 防抖同步账户到云端（300ms 内多次调用只同步一次）
 */
function debouncedSyncAccount(accountId: string): void {
  _syncQueue.set(accountId, Date.now());
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    _syncTimer = null;
    const ids = Array.from(_syncQueue.keys());
    _syncQueue.clear();
    for (const id of ids) {
      const account = loadAccount(id);
      if (account) {
        syncAccountToCloud(account).catch(() => {});
      }
    }
  }, 300);
}

/**
 * 同步单个账户到云端
 */
export async function syncAccountToCloud(account: Account): Promise<boolean> {
  try {
    // 检查ID是否为有效UUID（数据库要求）
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(account.id)) {
      // 非UUID格式的ID无法同步到数据库，静默跳过
      return false;
    }

    const result = await CloudAPI.syncAccountToDb({
      id: account.id,
      name: account.name,
      type: account.type,
      initialCapital: account.initialCapital,
      currentCapital: account.currentCapital,
      positions: account.positions.map((p) => ({
        stockCode: p.stockCode,
        stockName: p.stockName,
        quantity: p.quantity,
        avgCost: p.avgCost,
        currentPrice: p.currentPrice,
        marketValue: p.marketValue,
        pnl: p.pnl,
        pnlPercent: p.pnlPercent,
      })),
      trades: account.trades.map((t) => ({
        stockCode: t.stockCode,
        stockName: t.stockName,
        direction: t.direction,
        price: t.price,
        quantity: t.quantity,
        amount: t.amount,
        reason: t.reason,
        timestamp: t.timestamp,
      })),
    });
    return result;
  } catch {
    return false;
  }
}

/**
 * 从云端加载账户（用于首次登录或跨设备同步）
 */
export async function loadAccountFromCloud(accountId: string): Promise<Account | null> {
  try {
    const detail = await CloudAPI.fetchAccountDetail(accountId);
    if (!detail) return null;

    const { account: dbAccount, positions, transactions } = detail;

    // 转换为前端 Account 类型
    const account: Account = {
      id: dbAccount.id,
      name: dbAccount.name,
      type: dbAccount.type as AccountType,
      initialCapital: Number(dbAccount.initial_capital),
      currentCapital: Number(dbAccount.current_capital),
      positions: positions.map((p) => ({
        stockCode: p.stock_code,
        stockName: p.stock_name,
        quantity: Number(p.quantity),
        avgCost: Number(p.avg_cost),
        currentPrice: Number(p.current_price || p.avg_cost),
        marketValue: Number(p.market_value || 0),
        pnl: Number(p.profit_loss || 0),
        pnlPercent: Number(p.profit_loss_ratio || 0),
        positionPercent: 0,
      })),
      trades: transactions.map((t) => ({
        id: t.id,
        timestamp: new Date(t.traded_at || t.created_at || Date.now()).getTime(),
        stockCode: t.stock_code,
        stockName: t.stock_name,
        direction: t.type,
        price: Number(t.price),
        quantity: Number(t.quantity),
        amount: Number(t.amount),
        reason: t.note || "",
      })),
      trackingList: [],
      stockLimits: {},
      createdAt: new Date(dbAccount.created_at || Date.now()).getTime(),
      updatedAt: new Date(dbAccount.updated_at || Date.now()).getTime(),
    };

    // 保存到 localStorage
    saveAccount(account);
    return account;
  } catch {
    return null;
  }
}

/**
 * 检查云端数据库连接状态
 */
export async function checkCloudConnection(): Promise<boolean> {
  return CloudAPI.checkDbConnection();
}

// 重新导出同步状态相关函数
export { CloudAPI };
export { getSyncStatus, getLastSyncTime, getSyncError, onSyncStatusChange } from "@/lib/api-client-db";

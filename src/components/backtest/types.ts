// 交易记录
export interface Trade {
  id: string;
  timestamp: number;
  stockCode: string;
  stockName: string;
  direction: "buy" | "sell";
  price: number;
  quantity: number;
  amount: number;
  reason: string;
  pnl?: number; // 卖出时的盈亏
}

// 持仓
export interface Position {
  stockCode: string;
  stockName: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPercent: number;
  positionPercent: number; // 占总资产比例
}

// 账户信息
export interface Account {
  initialCapital: number;
  totalAssets: number;
  availableCash: number;
  marketValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  positionPercent: number;
}

// 策略评估指标
export interface StrategyMetrics {
  totalReturn: number; // 累计收益率
  annualReturn: number; // 年化收益率
  maxDrawdown: number; // 最大回撤
  sharpeRatio: number; // 夏普比率
  winRate: number; // 胜率
  profitLossRatio: number; // 盈亏比
  totalTrades: number; // 交易次数
  profitableTrades: number; // 盈利交易数
  losingTrades: number; // 亏损交易数
}

// 资金曲线数据点
export interface EquityPoint {
  timestamp: number;
  totalAssets: number;
  cash: number;
  marketValue: number;
}

// 仓位建议
export interface PositionAdvice {
  stockCode: string;
  stockName: string;
  currentPosition: number; // 当前仓位百分比
  suggestedPosition: number; // 建议仓位百分比
  action: "加仓" | "减仓" | "持有" | "建仓" | "清仓";
  riskLevel: "低" | "中" | "高" | "极高";
  reason: string;
}

// 回测配置
export interface BacktestConfig {
  initialCapital: number;
  startDate: string;
  endDate: string;
  commission: number; // 手续费率
  slippage: number; // 滑点
}

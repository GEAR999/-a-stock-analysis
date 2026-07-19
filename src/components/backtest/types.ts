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
  pnl?: number;
  isAuto?: boolean; // 是否自动操作
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
  positionPercent: number;
}

// 账户信息
export interface Account {
  id: string;
  name: string;
  initialCapital: number;
  currentCapital: number;
  positions: Position[];
  trades: Trade[];
  trackingList: string[];
  stockLimits: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

// 账户摘要（用于列表展示）
export interface AccountSummary {
  id: string;
  name: string;
  initialCapital: number;
  totalAssets: number;
  totalPnl: number;
  totalPnlPercent: number;
  positionCount: number;
  trackingCount: number;
}

// 策略评估指标
export interface StrategyMetrics {
  totalReturn: number;
  annualReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitLossRatio: number;
  totalTrades: number;
  profitableTrades: number;
  losingTrades: number;
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
  currentPosition: number;
  suggestedPosition: number;
  action: "加仓" | "减仓" | "持有" | "建仓" | "清仓";
  riskLevel: "低" | "中" | "高" | "极高";
  reason: string;
}

// Toast通知
export interface ToastMessage {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
}

// 买入信号
export interface BuySignal {
  stockCode: string;
  stockName: string;
  price: number;
  amount: number;
  reason: string;
}

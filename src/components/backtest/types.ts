// 策略来源
export type StrategySource = "chanlun" | "wave" | "technical" | "composite" | "manual";

// 失败原因标签
export type FailureReason =
  | "theory_fail"       // 理论失效
  | "market_crash"      // 市场异常(黑天鹅)
  | "chase_high"        // 追涨杀跌
  | "overweight"        // 仓位过重
  | "no_stop_loss"      // 止损不及时
  | "bad_timing";       // 择时失误

// 买卖点信号
export interface SignalPoint {
  type: "buy" | "sell" | "stop_loss";
  label: string;         // 如 "缠论二买", "MACD金叉", "跌破支撑位"
  price: number;
  strategy: StrategySource;
  triggered?: boolean;   // 是否已触发
  timestamp?: number;
}

// 交易决策快照
export interface TradeDecision {
  signalSource: StrategySource;   // 哪个理论给出的信号
  signalLabel: string;            // 信号描述
  marketState: string;            // 当时市场状态
  sentimentScore?: number;        // 当时情绪评分
  supportLevel?: number;          // 当时支撑位
  resistanceLevel?: number;       // 当时压力位
  suggestedPrice?: number;        // 建议价格
  actualPrice?: number;           // 实际价格
}

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
  isAuto?: boolean;
  strategy?: StrategySource;      // 策略来源
  decision?: TradeDecision;       // 决策快照
  failureReason?: FailureReason;  // 失败原因(亏损交易)
  failureReasons?: FailureReason[]; // 多个失败原因
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
  buyTime?: number;               // 买入时间
  buyReason?: string;             // 买入依据
  strategy?: StrategySource;      // 策略来源
  holdingDays?: number;           // 持仓天数
  buySignals?: SignalPoint[];     // 买入信号
  sellSignals?: SignalPoint[];    // 卖出信号
  stopLossSignals?: SignalPoint[];// 清仓信号
}

// 账户类型
export type AccountType = "manual" | "quant";

// 量化策略配置
export interface QuantStrategy {
  name: string;
  theories: StrategySource[];  // 使用的分析理论
  stopLossPercent: number;     // 止损百分比
  takeProfitPercent: number;   // 止盈百分比
  maxPositionPercent: number;  // 单只股票最大仓位
  autoTrade: boolean;          // 是否自动交易
}

// 账户信息
export interface Account {
  id: string;
  name: string;
  type: AccountType;           // 账户类型
  initialCapital: number;
  currentCapital: number;
  positions: Position[];
  trades: Trade[];
  trackingList: string[];
  stockLimits: Record<string, number>;
  equityCurve?: EquityPoint[];  // 资金曲线
  strategy?: QuantStrategy;     // 量化策略配置（仅quant类型）
  createdAt: number;
  updatedAt: number;
}

// 账户摘要
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

// 单策略统计
export interface SingleStrategyStats {
  strategy: StrategySource;
  label: string;
  color: string;
  totalTrades: number;
  profitableTrades: number;
  losingTrades: number;
  winRate: number;
  avgProfit: number;
  avgLoss: number;
  profitLossRatio: number;
  totalPnl: number;
}

// 失败原因统计
export interface FailureStats {
  reason: FailureReason;
  label: string;
  color: string;
  count: number;
  totalLoss: number;
  trades: Trade[];
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
  strategy?: StrategySource;
}

// 风险警告
export interface RiskAlert {
  type: "market" | "stock" | "position";
  level: "warning" | "danger";
  title: string;
  message: string;
  timestamp: number;
}

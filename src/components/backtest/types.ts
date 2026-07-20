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
  aiReasoning?: string;           // AI判断理由
  failureReason?: FailureReason;  // 失败原因(亏损交易)
  failureReasons?: FailureReason[]; // 多个失败原因
  suggestedPrice?: number;        // 建议价格（用于计算滑点）
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
export type RunMode = "backtest" | "realtime";

// 量化策略配置
export interface QuantStrategy {
  name: string;
  theories: StrategySource[];  // 使用的分析理论
  stopLossPercent: number;     // 止损百分比
  takeProfitPercent: number;   // 止盈百分比
  maxPositionPercent: number;  // 单只股票最大仓位
  autoTrade: boolean;          // 是否自动交易
  // 自定义权重模式
  weightMode?: "auto" | "custom";  // 权重分配模式
  customWeights?: Record<string, number>;  // 自定义权重（策略ID -> 百分比）
  // AI辅助判断配置
  aiEnabled?: boolean;         // 是否启用AI辅助
  aiType?: "none" | "rule-based" | "api";  // AI适配器类型
  aiWeight?: number;           // AI权重占比(0-50)，默认20
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
  runMode?: RunMode;            // 运行模式（仅quant类型，创建后不可更改）
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

// ===== 自定义策略类型 =====

// 价格条件类型
export type PriceConditionType = 
  | "above_ma"        // 突破均线
  | "below_ma"        // 跌破均线
  | "above_price"     // 突破价位
  | "below_price"     // 跌破价位
  | "above_high"      // 突破新高
  | "below_low";      // 跌破新低

// 成交量条件类型
export type VolumeConditionType = 
  | "above_avg"       // 放量到均量倍数
  | "below_avg"       // 缩量到均量倍数
  | "volume_surge";   // 成交量突增

// 指标条件
export interface IndicatorCondition {
  indicator: "macd" | "kdj" | "rsi" | "boll" | "ma";
  condition: "golden_cross" | "death_cross" | "above" | "below" | "divergence_up" | "divergence_down";
  value?: number;
  period?: number;
}

// 形态条件
export type PatternCondition = 
  | "hammer"          // 锤子线
  | "engulfing_bull"  // 看涨吞没
  | "engulfing_bear"  // 看跌吞没
  | "doji"            // 十字星
  | "morning_star"    // 晨星
  | "evening_star"    // 暮星
  | "double_bottom"   // 双底
  | "double_top";     // 双顶

// 买卖条件
export interface TradeConditions {
  priceCondition?: {
    type: PriceConditionType;
    value: number;
    maPeriod?: number;
  };
  volumeCondition?: {
    type: VolumeConditionType;
    multiplier: number;
  };
  indicatorConditions?: IndicatorCondition[];
  patternConditions?: PatternCondition[];
}

// 自定义策略
export interface CustomStrategy {
  id: string;
  name: string;
  description?: string;
  theories: StrategySource[];  // 使用的理论组合
  buyConditions: TradeConditions;
  sellConditions: TradeConditions;
  positionRatio: number;       // 仓位比例 0-1
  stopLoss: number;            // 止损比例 0-1
  takeProfit: number;          // 止盈比例 0-1
  createdAt: number;
  updatedAt: number;
}

// 策略权重配置
export interface StrategyWeight {
  strategyId: string;
  strategyName: string;
  weight: number;              // 权重百分比 0-100
  confidence: number;          // 置信度 0-100
  enabled: boolean;
  source: "builtin" | "custom"; // 来源：内置或自定义
}

// 策略模板
export interface StrategyTemplate {
  id: string;
  name: string;
  description?: string;
  weights: StrategyWeight[];
  tradeThreshold: number;      // 交易阈值（综合评分达到多少分才执行）
  createdAt: number;
  updatedAt: number;
}

// 量化账户多策略配置
export interface QuantMultiStrategy {
  weights: StrategyWeight[];
  tradeThreshold: number;      // 交易阈值
  templateId?: string;         // 使用的模板ID
}

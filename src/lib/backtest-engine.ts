// 历史回测引擎 - Web Worker
import type { KLineData as AnalysisKLineData } from '@/lib/types';
import { getAllIndicators, analyzeChanlun, analyzeWaves } from '@/lib/analysis';

// 策略类型
export type StrategyType =
  | "macd_golden_cross" | "macd_death_cross"
  | "kdj_oversold" | "kdj_overbought"
  | "rsi_oversold" | "rsi_overbought"
  | "boll_lower_touch" | "boll_upper_touch"
  | "ma_golden_cross" | "ma_death_cross"
  // 分析引擎策略
  | "chanlun_buy" | "chanlun_sell"
  | "wave_buy" | "wave_sell"
  | "tech_resonance_buy" | "tech_resonance_sell";

// 仓位控制配置
export interface PositionControl {
  maxTotalPosition: number;      // 总仓位上限（0-1），如 0.8 = 最多 80% 仓位
  maxSinglePosition: number;     // 单股仓位上限（0-1），如 0.3 = 单只最多 30%
  minCashReserve: number;        // 最低现金储备（0-1），如 0.1 = 至少留 10% 现金
  positionSize: number;          // 单次买入比例（0-1）
  enablePyramiding: boolean;     // 是否允许加仓
  maxPyramidLevels: number;      // 最多加仓次数
}

// 风险控制配置
export interface RiskControl {
  stopLoss: number;              // 止损比例（0-1），如 0.05 = 亏损 5% 止损
  takeProfit: number;            // 止盈比例（0-1），如 0.15 = 盈利 15% 止盈
  trailingStop: number;          // 移动止损比例（0-1），如 0.08 = 从最高点回落 8% 止损
  maxHoldingDays: number;        // 最长持仓天数（0 = 不限制）
}

// 交易成本配置
export interface CostConfig {
  commission: number;            // 手续费率（如 0.0003 = 万三）
  slippage: number;              // 滑点（如 0.001 = 0.1%）
}

// 信号条件配置
export interface SignalConfig {
  buySignals: StrategyType[];    // 买入信号池
  sellSignals: StrategyType[];   // 卖出信号池
  buyLogic: "AND" | "OR";        // 买入逻辑
  sellLogic: "AND" | "OR";       // 卖出逻辑
  minBuyMatch: number;           // 买入最少匹配数
  minSellMatch: number;          // 卖出最少匹配数
}

// 完整策略配置（用于自定义策略库）
export interface FullStrategyConfig {
  id: string;
  name: string;
  description: string;
  signals: SignalConfig;
  position: PositionControl;
  risk: RiskControl;
  cost: CostConfig;
}

// 默认仓位控制配置
export const DEFAULT_POSITION_CONTROL: PositionControl = {
  maxTotalPosition: 1.0,
  maxSinglePosition: 1.0,
  minCashReserve: 0,
  positionSize: 1.0,
  enablePyramiding: false,
  maxPyramidLevels: 1,
};

// 默认风险控制配置
export const DEFAULT_RISK_CONTROL: RiskControl = {
  stopLoss: 0,
  takeProfit: 0,
  trailingStop: 0,
  maxHoldingDays: 0,
};

// 默认交易成本配置
export const DEFAULT_COST_CONFIG: CostConfig = {
  commission: 0.0003,
  slippage: 0.001,
};

// 回测配置（向后兼容旧接口）
export interface BacktestConfig {
  strategies: StrategyType[];
  initialCapital: number;
  commission: number; // 手续费率
  slippage: number; // 滑点（百分比）
  positionSize: number; // 每次交易仓位比例（0-1）
  onProgress?: (current: number, total: number) => void; // 进度回调
}

// 完整回测配置（使用 FullStrategyConfig）
export interface FullBacktestConfig {
  strategy: FullStrategyConfig;
  initialCapital: number;
  onProgress?: (current: number, total: number) => void;
}

export interface BacktestTrade {
  date: string;
  type: "buy" | "sell";
  price: number;
  shares: number;
  amount: number;
  commission: number;
  strategy: StrategyType;
}

export interface BacktestDailyRecord {
  date: string;
  capital: number;
  position: number;
  positionValue: number;
  totalValue: number;
  benchmark: number; // 基准值（沪深300归一化）
}

export interface BacktestResult {
  trades: BacktestTrade[];
  dailyRecords: BacktestDailyRecord[];
  metrics: {
    totalReturn: number;
    annualizedReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
    winRate: number;
    profitLossRatio: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
  };
}

// K线数据
interface KLineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// 技术指标计算
function calcEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  ema[0] = data[0];
  for (let i = 1; i < data.length; i++) {
    ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
  }
  return ema;
}

function calcMACD(closes: number[]): { dif: number[]; dea: number[]; macd: number[] } {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const dif = ema12.map((v, i) => v - ema26[i]);
  const dea = calcEMA(dif, 9);
  const macd = dif.map((v, i) => (v - dea[i]) * 2);
  return { dif, dea, macd };
}

function calcKDJ(highs: number[], lows: number[], closes: number[], period = 9): { k: number[]; d: number[]; j: number[] } {
  const k: number[] = [];
  const d: number[] = [];
  const j: number[] = [];
  
  for (let i = 0; i < closes.length; i++) {
    const start = Math.max(0, i - period + 1);
    const highSlice = highs.slice(start, i + 1);
    const lowSlice = lows.slice(start, i + 1);
    const highestHigh = Math.max(...highSlice);
    const lowestLow = Math.min(...lowSlice);
    
    const rsv = highestHigh === lowestLow ? 50 : ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100;
    
    if (i === 0) {
      k[i] = 50;
      d[i] = 50;
    } else {
      k[i] = (2 / 3) * k[i - 1] + (1 / 3) * rsv;
      d[i] = (2 / 3) * d[i - 1] + (1 / 3) * k[i];
    }
    j[i] = 3 * k[i] - 2 * d[i];
  }
  
  return { k, d, j };
}

function calcRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }
  
  rsi[0] = 50;
  for (let i = period; i < gains.length; i++) {
    const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
    rsi[i + 1] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  
  return rsi;
}

function calcMA(closes: number[], period: number): number[] {
  const ma: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      ma[i] = closes[i];
    } else {
      ma[i] = closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
    }
  }
  return ma;
}

function calcBoll(closes: number[], period = 20, multiplier = 2): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = calcMA(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper[i] = middle[i];
      lower[i] = middle[i];
    } else {
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = middle[i];
      const std = Math.sqrt(slice.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / period);
      upper[i] = mean + multiplier * std;
      lower[i] = mean - multiplier * std;
    }
  }
  
  return { upper, middle, lower };
}

// 分析引擎策略适配器 - 复用 analysis.ts 中的分析函数
// 批量生成信号（只运行一次分析引擎，避免逐bar重复计算）
function generateAnalysisEngineSignals(kline: KLineData[], strategies: StrategyType[]): { index: number; signal: "buy" | "sell"; strategy: StrategyType }[] {
  const signals: { index: number; signal: "buy" | "sell"; strategy: StrategyType }[] = [];
  if (kline.length < 30) return signals;

  const analysisData: AnalysisKLineData[] = kline.map(k => ({
    date: k.date,
    open: k.open,
    close: k.close,
    high: k.high,
    low: k.low,
    volume: k.volume,
    amount: k.volume * k.close,
  }));

  const hasChanlun = strategies.includes("chanlun_buy") || strategies.includes("chanlun_sell");
  const hasWave = strategies.includes("wave_buy") || strategies.includes("wave_sell");
  const hasTechResonance = strategies.includes("tech_resonance_buy") || strategies.includes("tech_resonance_sell");

  // 缠论信号
  if (hasChanlun) {
    const chanlun = analyzeChanlun(analysisData);
    for (const bs of chanlun.buySignals) {
      if (strategies.includes("chanlun_buy")) {
        signals.push({ index: bs.index, signal: "buy", strategy: "chanlun_buy" });
      }
    }
    for (const ss of chanlun.sellSignals) {
      if (strategies.includes("chanlun_sell")) {
        signals.push({ index: ss.index, signal: "sell", strategy: "chanlun_sell" });
      }
    }
  }

  // 波浪理论信号 - 在推动浪第1浪起点买入，第5浪终点卖出
  if (hasWave) {
    const waveResult = analyzeWaves(analysisData);
    for (const wave of waveResult.waves) {
      if (wave.type === "impulse") {
        if (wave.label === "1" && strategies.includes("wave_buy")) {
          signals.push({ index: wave.start, signal: "buy", strategy: "wave_buy" });
        }
        if (wave.label === "5" && strategies.includes("wave_sell")) {
          signals.push({ index: wave.end, signal: "sell", strategy: "wave_sell" });
        }
      }
    }
  }

  // 技术指标共振信号 - 基于 getAllIndicators 结果检测多指标共振
  if (hasTechResonance) {
    const indicators = getAllIndicators(analysisData);

    for (let i = 1; i < kline.length; i++) {
      const currMACD = indicators.macd[i];
      const prevMACD = indicators.macd[i - 1];
      const currKDJ = indicators.kdj[i];
      const prevKDJ = indicators.kdj[i - 1];
      const currRSI = indicators.rsi[i];
      const prevRSI = indicators.rsi[i - 1];
      const currBOLL = indicators.boll[i];

      // 买入共振：MACD金叉 + KDJ金叉 + RSI超卖回升 + 布林下轨支撑
      let buyCount = 0;
      if (currMACD.dif > currMACD.dea && prevMACD.dif <= prevMACD.dea) buyCount++;
      if (currKDJ.k > currKDJ.d && prevKDJ.k <= prevKDJ.d && currKDJ.k < 50) buyCount++;
      if (currRSI.rsi < 40 && prevRSI.rsi <= currRSI.rsi) buyCount++;
      if (kline[i].close <= currBOLL.lower) buyCount++;

      if (buyCount >= 2 && strategies.includes("tech_resonance_buy")) {
        signals.push({ index: i, signal: "buy", strategy: "tech_resonance_buy" });
      }

      // 卖出共振：MACD死叉 + KDJ死叉 + RSI超买回落 + 布林上轨压力
      let sellCount = 0;
      if (currMACD.dif < currMACD.dea && prevMACD.dif >= prevMACD.dea) sellCount++;
      if (currKDJ.k < currKDJ.d && prevKDJ.k >= prevKDJ.d && currKDJ.k > 50) sellCount++;
      if (currRSI.rsi > 60 && prevRSI.rsi >= currRSI.rsi) sellCount++;
      if (kline[i].close >= currBOLL.upper) sellCount++;

      if (sellCount >= 2 && strategies.includes("tech_resonance_sell")) {
        signals.push({ index: i, signal: "sell", strategy: "tech_resonance_sell" });
      }
    }
  }

  return signals;
}

// 生成交易信号
function generateSignals(kline: KLineData[], strategies: StrategyType[]): { index: number; signal: "buy" | "sell"; strategy: StrategyType }[] {
  const signals: { index: number; signal: "buy" | "sell"; strategy: StrategyType }[] = [];
  const closes = kline.map(k => k.close);
  const highs = kline.map(k => k.high);
  const lows = kline.map(k => k.low);
  
  const macd = calcMACD(closes);
  const kdj = calcKDJ(highs, lows, closes);
  const rsi = calcRSI(closes);
  const ma5 = calcMA(closes, 5);
  const ma20 = calcMA(closes, 20);
  const boll = calcBoll(closes);
  
  for (let i = 1; i < kline.length; i++) {
    for (const strategy of strategies) {
      switch (strategy) {
        case "macd_golden_cross":
          if (macd.dif[i] > macd.dea[i] && macd.dif[i - 1] <= macd.dea[i - 1]) {
            signals.push({ index: i, signal: "buy", strategy });
          }
          break;
        case "macd_death_cross":
          if (macd.dif[i] < macd.dea[i] && macd.dif[i - 1] >= macd.dea[i - 1]) {
            signals.push({ index: i, signal: "sell", strategy });
          }
          break;
        case "kdj_oversold":
          if (kdj.k[i] < 20 && kdj.k[i] > kdj.d[i] && kdj.k[i - 1] <= kdj.d[i - 1]) {
            signals.push({ index: i, signal: "buy", strategy });
          }
          break;
        case "kdj_overbought":
          if (kdj.k[i] > 80 && kdj.k[i] < kdj.d[i] && kdj.k[i - 1] >= kdj.d[i - 1]) {
            signals.push({ index: i, signal: "sell", strategy });
          }
          break;
        case "rsi_oversold":
          if (rsi[i] < 30 && rsi[i - 1] >= 30) {
            signals.push({ index: i, signal: "buy", strategy });
          }
          break;
        case "rsi_overbought":
          if (rsi[i] > 70 && rsi[i - 1] <= 70) {
            signals.push({ index: i, signal: "sell", strategy });
          }
          break;
        case "boll_lower_touch":
          if (closes[i] <= boll.lower[i] && closes[i - 1] > boll.lower[i - 1]) {
            signals.push({ index: i, signal: "buy", strategy });
          }
          break;
        case "boll_upper_touch":
          if (closes[i] >= boll.upper[i] && closes[i - 1] < boll.upper[i - 1]) {
            signals.push({ index: i, signal: "sell", strategy });
          }
          break;
        case "ma_golden_cross":
          if (ma5[i] > ma20[i] && ma5[i - 1] <= ma20[i - 1]) {
            signals.push({ index: i, signal: "buy", strategy });
          }
          break;
        case "ma_death_cross":
          if (ma5[i] < ma20[i] && ma5[i - 1] >= ma20[i - 1]) {
            signals.push({ index: i, signal: "sell", strategy });
          }
          break;
      }
    }
  }

  // 分析引擎策略 - 批量生成信号（只运行一次分析引擎）
  const hasAnalysisStrategy = strategies.some(s =>
    s === "chanlun_buy" || s === "chanlun_sell" ||
    s === "wave_buy" || s === "wave_sell" ||
    s === "tech_resonance_buy" || s === "tech_resonance_sell"
  );

  if (hasAnalysisStrategy) {
    const analysisSignals = generateAnalysisEngineSignals(kline, strategies);
    signals.push(...analysisSignals);
  }
  
  return signals.sort((a, b) => a.index - b.index);
}

// 执行回测
export function runBacktest(kline: KLineData[], config: BacktestConfig): BacktestResult {
  const signals = generateSignals(kline, config.strategies);
  const trades: BacktestTrade[] = [];
  const dailyRecords: BacktestDailyRecord[] = [];
  
  let capital = config.initialCapital;
  let position = 0;
  const initialPrice = kline[0].close;
  
  let signalIdx = 0;
  
  for (let i = 0; i < kline.length; i++) {
    const bar = kline[i];

    // 进度回调
    if (config.onProgress && i % 50 === 0) {
      config.onProgress(i, kline.length);
    }
    
    // 处理当天的信号
    while (signalIdx < signals.length && signals[signalIdx].index === i) {
      const sig = signals[signalIdx];
      const price = bar.close * (1 + (sig.signal === "buy" ? config.slippage : -config.slippage));
      
      if (sig.signal === "buy" && position === 0) {
        const investAmount = capital * config.positionSize;
        const shares = Math.floor(investAmount / price / 100) * 100; // 整手
        if (shares > 0) {
          const amount = shares * price;
          const commission = Math.max(amount * config.commission, 5);
          capital -= (amount + commission);
          position = shares;
          trades.push({
            date: bar.date,
            type: "buy",
            price,
            shares,
            amount,
            commission,
            strategy: sig.strategy,
          });
        }
      } else if (sig.signal === "sell" && position > 0) {
        const amount = position * price;
        const commission = Math.max(amount * config.commission, 5);
        capital += (amount - commission);
        trades.push({
          date: bar.date,
          type: "sell",
          price,
          shares: position,
          amount,
          commission,
          strategy: sig.strategy,
        });
        position = 0;
      }
      signalIdx++;
    }
    
    // 记录每日状态
    const positionValue = position * bar.close;
    const totalValue = capital + positionValue;
    const benchmark = (bar.close / initialPrice) * config.initialCapital;
    
    dailyRecords.push({
      date: bar.date,
      capital,
      position,
      positionValue,
      totalValue,
      benchmark,
    });
  }
  
  // 计算指标
  const metrics = calculateMetrics(trades, dailyRecords, config.initialCapital);
  
  return { trades, dailyRecords, metrics };
}

function calculateMetrics(trades: BacktestTrade[], dailyRecords: BacktestDailyRecord[], initialCapital: number): BacktestResult["metrics"] {
  const finalValue = dailyRecords.length > 0 ? dailyRecords[dailyRecords.length - 1].totalValue : initialCapital;
  const totalReturn = (finalValue - initialCapital) / initialCapital;
  
  // 年化收益率
  const days = dailyRecords.length;
  const years = days / 252;
  const annualizedReturn = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;
  
  // 最大回撤
  let maxDrawdown = 0;
  let peak = initialCapital;
  for (const record of dailyRecords) {
    if (record.totalValue > peak) peak = record.totalValue;
    const drawdown = (peak - record.totalValue) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  
  // 夏普比率
  const returns: number[] = [];
  for (let i = 1; i < dailyRecords.length; i++) {
    returns.push((dailyRecords[i].totalValue - dailyRecords[i - 1].totalValue) / dailyRecords[i - 1].totalValue);
  }
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdReturn = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
  const sharpeRatio = stdReturn > 0 ? (avgReturn * 252) / (stdReturn * Math.sqrt(252)) : 0;
  
  // 胜率和盈亏比
  const completedTrades: { profit: number }[] = [];
  let buyPrice = 0;
  for (const trade of trades) {
    if (trade.type === "buy") {
      buyPrice = trade.price;
    } else if (trade.type === "sell" && buyPrice > 0) {
      completedTrades.push({ profit: (trade.price - buyPrice) / buyPrice });
      buyPrice = 0;
    }
  }
  
  const winningTrades = completedTrades.filter(t => t.profit > 0);
  const losingTrades = completedTrades.filter(t => t.profit <= 0);
  const winRate = completedTrades.length > 0 ? winningTrades.length / completedTrades.length : 0;
  
  const avgWin = winningTrades.length > 0 ? winningTrades.reduce((s, t) => s + t.profit, 0) / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((s, t) => s + t.profit, 0) / losingTrades.length) : 1;
  const profitLossRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
  
  return {
    totalReturn,
    annualizedReturn,
    maxDrawdown,
    sharpeRatio,
    winRate,
    profitLossRatio,
    totalTrades: completedTrades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
  };
}

// ============ 增强版回测（含指标快照） ============

/** 指标快照 */
export interface IndicatorSnapshot {
  macd?: { dif: number; dea: number; histogram: number };
  kdj?: { k: number; d: number; j: number };
  rsi?: number;
  boll?: { upper: number; middle: number; lower: number };
  ma?: { ma5: number; ma20: number };
}

/** 增强版交易记录（含指标快照） */
export interface EnhancedBacktestTrade extends BacktestTrade {
  indicatorSnapshot: IndicatorSnapshot;
  ohlcvSnapshot: { open: number; high: number; low: number; close: number; volume: number };
  reasoningDescription: string;
}

/** 增强版回测结果 */
export interface EnhancedBacktestResult extends BacktestResult {
  trades: EnhancedBacktestTrade[];
}

/** 策略中文标签 */
export function getStrategyLabel(strategy: StrategyType): string {
  const labels: Record<StrategyType, string> = {
    macd_golden_cross: 'MACD金叉',
    macd_death_cross: 'MACD死叉',
    kdj_oversold: 'KDJ超卖',
    kdj_overbought: 'KDJ超买',
    rsi_oversold: 'RSI超卖',
    rsi_overbought: 'RSI超买',
    boll_lower_touch: '触及布林下轨',
    boll_upper_touch: '触及布林上轨',
    ma_golden_cross: '均线金叉',
    ma_death_cross: '均线死叉',
    chanlun_buy: '缠论买点',
    chanlun_sell: '缠论卖点',
    wave_buy: '波浪起点',
    wave_sell: '波浪终点',
    tech_resonance_buy: '多指标共振买入',
    tech_resonance_sell: '多指标共振卖出',
  };
  return labels[strategy] || strategy;
}

/** 生成买卖依据描述 */
function generateReasoningDescription(
  strategy: StrategyType,
  direction: 'buy' | 'sell',
  snapshot: IndicatorSnapshot,
  kline: { open: number; high: number; low: number; close: number }
): string {
  const parts: string[] = [];
  const label = getStrategyLabel(strategy);
  parts.push(`${label}触发${direction === 'buy' ? '买入' : '卖出'}信号`);

  if (snapshot.macd) {
    const { dif, dea, histogram } = snapshot.macd;
    parts.push(`MACD: DIF=${dif.toFixed(3)}, DEA=${dea.toFixed(3)}, 柱=${histogram.toFixed(3)}`);
  }
  if (snapshot.kdj) {
    const { k, d, j } = snapshot.kdj;
    parts.push(`KDJ: K=${k.toFixed(1)}, D=${d.toFixed(1)}, J=${j.toFixed(1)}`);
  }
  if (snapshot.rsi !== undefined) {
    const zone = snapshot.rsi < 30 ? '超卖区' : snapshot.rsi > 70 ? '超买区' : '中性区';
    parts.push(`RSI: ${snapshot.rsi.toFixed(1)}（${zone}）`);
  }
  if (snapshot.boll) {
    const { upper, middle, lower } = snapshot.boll;
    const pos = kline.close >= upper ? '触及上轨' : kline.close <= lower ? '触及下轨' : '轨道内';
    parts.push(`BOLL: 上${upper.toFixed(2)} 中${middle.toFixed(2)} 下${lower.toFixed(2)}（${pos}）`);
  }
  if (snapshot.ma) {
    const { ma5, ma20 } = snapshot.ma;
    const trend = ma5 > ma20 ? '多头排列' : '空头排列';
    parts.push(`MA: 5日${ma5.toFixed(2)} 20日${ma20.toFixed(2)}（${trend}）`);
  }

  return parts.join('；');
}

/** 增强版回测（记录每笔交易的指标快照） */
export function runBacktestEnhanced(kline: KLineData[], config: BacktestConfig): EnhancedBacktestResult {
  const signals = generateSignals(kline, config.strategies);
  const trades: EnhancedBacktestTrade[] = [];
  const dailyRecords: BacktestDailyRecord[] = [];

  // 预计算所有指标
  const closes = kline.map(k => k.close);
  const highs = kline.map(k => k.high);
  const lows = kline.map(k => k.low);
  const macd = calcMACD(closes);
  const kdj = calcKDJ(highs, lows, closes);
  const rsi = calcRSI(closes);
  const ma5 = calcMA(closes, 5);
  const ma20 = calcMA(closes, 20);
  const boll = calcBoll(closes);

  let capital = config.initialCapital;
  let position = 0;
  const initialPrice = kline[0].close;
  let signalIdx = 0;

  for (let i = 0; i < kline.length; i++) {
    const bar = kline[i];

    if (config.onProgress && i % 50 === 0) {
      config.onProgress(i, kline.length);
    }

    while (signalIdx < signals.length && signals[signalIdx].index === i) {
      const sig = signals[signalIdx];
      const price = bar.close * (1 + (sig.signal === "buy" ? config.slippage : -config.slippage));

      // 构建指标快照
      const snapshot: IndicatorSnapshot = {
        macd: { dif: macd.dif[i], dea: macd.dea[i], histogram: macd.macd[i] },
        kdj: { k: kdj.k[i], d: kdj.d[i], j: kdj.j[i] },
        rsi: rsi[i],
        boll: { upper: boll.upper[i], middle: boll.middle[i], lower: boll.lower[i] },
        ma: { ma5: ma5[i], ma20: ma20[i] },
      };

      const ohlcv = { open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume };
      const reasoning = generateReasoningDescription(sig.strategy, sig.signal, snapshot, bar);

      if (sig.signal === "buy" && position === 0) {
        const investAmount = capital * config.positionSize;
        const shares = Math.floor(investAmount / price / 100) * 100;
        if (shares > 0) {
          const amount = shares * price;
          const commission = Math.max(amount * config.commission, 5);
          capital -= (amount + commission);
          position = shares;
          trades.push({
            date: bar.date, type: "buy", price, shares, amount, commission,
            strategy: sig.strategy, indicatorSnapshot: snapshot, ohlcvSnapshot: ohlcv,
            reasoningDescription: reasoning,
          });
        }
      } else if (sig.signal === "sell" && position > 0) {
        const amount = position * price;
        const commission = Math.max(amount * config.commission, 5);
        capital += (amount - commission);
        trades.push({
          date: bar.date, type: "sell", price, shares: position, amount, commission,
          strategy: sig.strategy, indicatorSnapshot: snapshot, ohlcvSnapshot: ohlcv,
          reasoningDescription: reasoning,
        });
        position = 0;
      }
      signalIdx++;
    }

    const positionValue = position * bar.close;
    const totalValue = capital + positionValue;
    const benchmark = (bar.close / initialPrice) * config.initialCapital;
    dailyRecords.push({ date: bar.date, capital, position, positionValue, totalValue, benchmark });
  }

  const metrics = calculateMetrics(trades, dailyRecords, config.initialCapital);
  return { trades, dailyRecords, metrics };
}

// ============ 完整版回测（支持仓位控制和风控） ============

/** 完整回测结果 */
export interface FullBacktestResult extends EnhancedBacktestResult {
  positionLogs: { date: string; ratio: number; cashRatio: number }[];  // 仓位日志
  riskEvents: { date: string; type: string; price: number }[];  // 风控事件（止损/止盈）
}

/** 运行完整版回测 */
export function runBacktestFull(kline: KLineData[], config: FullBacktestConfig): FullBacktestResult {
  const { strategy, initialCapital } = config;
  const signals = generateSignals(kline, strategy.signals.buySignals.concat(strategy.signals.sellSignals));
  const trades: EnhancedBacktestTrade[] = [];
  const dailyRecords: BacktestDailyRecord[] = [];
  const positionLogs: { date: string; ratio: number; cashRatio: number }[] = [];
  const riskEvents: { date: string; type: string; price: number }[] = [];

  // 预计算所有指标
  const closes = kline.map(k => k.close);
  const highs = kline.map(k => k.high);
  const lows = kline.map(k => k.low);
  const macd = calcMACD(closes);
  const kdj = calcKDJ(highs, lows, closes);
  const rsi = calcRSI(closes);
  const ma5 = calcMA(closes, 5);
  const ma20 = calcMA(closes, 20);
  const boll = calcBoll(closes);

  let capital = initialCapital;
  let position = 0;
  let buyPrice = 0;
  let highestPrice = 0;
  const initialPrice = kline[0].close;
  let signalIdx = 0;

  for (let i = 0; i < kline.length; i++) {
    const bar = kline[i];

    if (config.onProgress && i % 50 === 0) {
      config.onProgress(i, kline.length);
    }

    const currentPrice = bar.close;
    const positionValue = position * currentPrice;
    const totalValue = capital + positionValue;

    // 记录仓位日志
    positionLogs.push({
      date: bar.date,
      ratio: totalValue > 0 ? positionValue / totalValue : 0,
      cashRatio: totalValue > 0 ? capital / totalValue : 0,
    });

    // 风控检查（止损/止盈/移动止损）
    if (position > 0 && buyPrice > 0) {
      const profitRatio = (currentPrice - buyPrice) / buyPrice;

      // 止损检查
      if (strategy.risk.stopLoss > 0 && profitRatio <= -strategy.risk.stopLoss) {
        const sellPrice = currentPrice * (1 - strategy.cost.slippage);
        const amount = position * sellPrice;
        const commission = Math.max(amount * strategy.cost.commission, 5);
        capital += amount - commission;
        trades.push({
          date: bar.date,
          type: "sell",
          price: sellPrice,
          shares: position,
          amount,
          commission,
          strategy: "macd_death_cross",
          indicatorSnapshot: {
            macd: { dif: macd.dif[i], dea: macd.dea[i], histogram: macd.macd[i] },
            kdj: { k: kdj.k[i], d: kdj.d[i], j: kdj.j[i] },
            rsi: rsi[i],
            boll: { upper: boll.upper[i], middle: boll.middle[i], lower: boll.lower[i] },
            ma: { ma5: ma5[i], ma20: ma20[i] },
          },
          ohlcvSnapshot: { open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume },
          reasoningDescription: `止损触发：亏损${(profitRatio * 100).toFixed(2)}%，超过止损线${(strategy.risk.stopLoss * 100).toFixed(1)}%`,
        });
        riskEvents.push({ date: bar.date, type: "止损", price: sellPrice });
        position = 0;
        buyPrice = 0;
        highestPrice = 0;
        continue;
      }

      // 止盈检查
      if (strategy.risk.takeProfit > 0 && profitRatio >= strategy.risk.takeProfit) {
        const sellPrice = currentPrice * (1 - strategy.cost.slippage);
        const amount = position * sellPrice;
        const commission = Math.max(amount * strategy.cost.commission, 5);
        capital += amount - commission;
        trades.push({
          date: bar.date,
          type: "sell",
          price: sellPrice,
          shares: position,
          amount,
          commission,
          strategy: "macd_death_cross",
          indicatorSnapshot: {
            macd: { dif: macd.dif[i], dea: macd.dea[i], histogram: macd.macd[i] },
            kdj: { k: kdj.k[i], d: kdj.d[i], j: kdj.j[i] },
            rsi: rsi[i],
            boll: { upper: boll.upper[i], middle: boll.middle[i], lower: boll.lower[i] },
            ma: { ma5: ma5[i], ma20: ma20[i] },
          },
          ohlcvSnapshot: { open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume },
          reasoningDescription: `止盈触发：盈利${(profitRatio * 100).toFixed(2)}%，超过止盈线${(strategy.risk.takeProfit * 100).toFixed(1)}%`,
        });
        riskEvents.push({ date: bar.date, type: "止盈", price: sellPrice });
        position = 0;
        buyPrice = 0;
        highestPrice = 0;
        continue;
      }

      // 移动止损检查
      if (strategy.risk.trailingStop > 0 && highestPrice > 0) {
        const drawdown = (highestPrice - currentPrice) / highestPrice;
        if (drawdown >= strategy.risk.trailingStop) {
          const sellPrice = currentPrice * (1 - strategy.cost.slippage);
          const amount = position * sellPrice;
          const commission = Math.max(amount * strategy.cost.commission, 5);
          capital += amount - commission;
          trades.push({
            date: bar.date,
            type: "sell",
            price: sellPrice,
            shares: position,
            amount,
            commission,
            strategy: "macd_death_cross",
            indicatorSnapshot: {
              macd: { dif: macd.dif[i], dea: macd.dea[i], histogram: macd.macd[i] },
              kdj: { k: kdj.k[i], d: kdj.d[i], j: kdj.j[i] },
              rsi: rsi[i],
              boll: { upper: boll.upper[i], middle: boll.middle[i], lower: boll.lower[i] },
              ma: { ma5: ma5[i], ma20: ma20[i] },
            },
            ohlcvSnapshot: { open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume },
            reasoningDescription: `移动止损触发：从最高点${highestPrice.toFixed(2)}回落${(drawdown * 100).toFixed(2)}%，超过移动止损线${(strategy.risk.trailingStop * 100).toFixed(1)}%`,
          });
          riskEvents.push({ date: bar.date, type: "移动止损", price: sellPrice });
          position = 0;
          buyPrice = 0;
          highestPrice = 0;
          continue;
        }
      }

      // 更新最高价
      if (currentPrice > highestPrice) {
        highestPrice = currentPrice;
      }
    }

    // 处理信号
    while (signalIdx < signals.length && signals[signalIdx].index === i) {
      const sig = signals[signalIdx];

      if (sig.signal === "buy" && position === 0) {
        // 仓位控制检查
        const cashRatio = totalValue > 0 ? capital / totalValue : 1;
        if (cashRatio <= strategy.position.minCashReserve) {
          signalIdx++;
          continue;  // 现金不足，跳过
        }

        const price = currentPrice * (1 + strategy.cost.slippage);
        const availableCapital = capital - (totalValue * strategy.position.minCashReserve);
        const investAmount = Math.min(availableCapital * strategy.position.positionSize, totalValue * strategy.position.maxSinglePosition);
        const shares = Math.floor(investAmount / price / 100) * 100;

        if (shares > 0) {
          const amount = shares * price;
          const commission = Math.max(amount * strategy.cost.commission, 5);
          capital -= amount + commission;
          position = shares;
          buyPrice = price;
          highestPrice = price;
          trades.push({
            date: bar.date,
            type: "buy",
            price,
            shares,
            amount,
            commission,
            strategy: sig.strategy,
            indicatorSnapshot: {
              macd: { dif: macd.dif[i], dea: macd.dea[i], histogram: macd.macd[i] },
              kdj: { k: kdj.k[i], d: kdj.d[i], j: kdj.j[i] },
              rsi: rsi[i],
              boll: { upper: boll.upper[i], middle: boll.middle[i], lower: boll.lower[i] },
              ma: { ma5: ma5[i], ma20: ma20[i] },
            },
            ohlcvSnapshot: { open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume },
            reasoningDescription: generateReasoningDescription(sig.strategy, "buy", {
              macd: { dif: macd.dif[i], dea: macd.dea[i], histogram: macd.macd[i] },
              kdj: { k: kdj.k[i], d: kdj.d[i], j: kdj.j[i] },
              rsi: rsi[i],
              boll: { upper: boll.upper[i], middle: boll.middle[i], lower: boll.lower[i] },
              ma: { ma5: ma5[i], ma20: ma20[i] },
            }, bar),
          });
        }
      } else if (sig.signal === "sell" && position > 0) {
        const price = currentPrice * (1 - strategy.cost.slippage);
        const amount = position * price;
        const commission = Math.max(amount * strategy.cost.commission, 5);
        capital += amount - commission;
        trades.push({
          date: bar.date,
          type: "sell",
          price,
          shares: position,
          amount,
          commission,
          strategy: sig.strategy,
          indicatorSnapshot: {
            macd: { dif: macd.dif[i], dea: macd.dea[i], histogram: macd.macd[i] },
            kdj: { k: kdj.k[i], d: kdj.d[i], j: kdj.j[i] },
            rsi: rsi[i],
            boll: { upper: boll.upper[i], middle: boll.middle[i], lower: boll.lower[i] },
            ma: { ma5: ma5[i], ma20: ma20[i] },
          },
          ohlcvSnapshot: { open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume },
          reasoningDescription: generateReasoningDescription(sig.strategy, "sell", {
            macd: { dif: macd.dif[i], dea: macd.dea[i], histogram: macd.macd[i] },
            kdj: { k: kdj.k[i], d: kdj.d[i], j: kdj.j[i] },
            rsi: rsi[i],
            boll: { upper: boll.upper[i], middle: boll.middle[i], lower: boll.lower[i] },
            ma: { ma5: ma5[i], ma20: ma20[i] },
          }, bar),
        });
        position = 0;
        buyPrice = 0;
        highestPrice = 0;
      }
      signalIdx++;
    }

    // 记录每日状态
    const benchmark = (bar.close / initialPrice) * initialCapital;

    dailyRecords.push({
      date: bar.date,
      capital,
      position,
      positionValue: position * bar.close,
      totalValue: capital + position * bar.close,
      benchmark,
    });
  }

  // 计算指标
  const metrics = calculateMetrics(trades, dailyRecords, initialCapital);

  return { trades, dailyRecords, metrics, positionLogs, riskEvents };
}

// 注意：此模块作为普通模块使用，通过 setTimeout 在组件中异步调用以避免阻塞UI
// 如需真正的 Web Worker，可将此文件单独打包为 worker

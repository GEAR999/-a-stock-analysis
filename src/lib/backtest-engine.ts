// 历史回测引擎 - Web Worker

// 策略类型
export type StrategyType = "macd_golden_cross" | "macd_death_cross" | "kdj_oversold" | "kdj_overbought" | "rsi_oversold" | "rsi_overbought" | "boll_lower_touch" | "boll_upper_touch" | "ma_golden_cross" | "ma_death_cross";

export interface BacktestConfig {
  strategies: StrategyType[];
  initialCapital: number;
  commission: number; // 手续费率
  slippage: number; // 滑点（百分比）
  positionSize: number; // 每次交易仓位比例（0-1）
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

// 注意：此模块作为普通模块使用，通过 setTimeout 在组件中异步调用以避免阻塞UI
// 如需真正的 Web Worker，可将此文件单独打包为 worker

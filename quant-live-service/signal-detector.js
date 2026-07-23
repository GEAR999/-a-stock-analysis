// 信号检测引擎 - 复用 backtest-engine.ts 的逻辑
// 用于量化实时账户的分时数据信号检测

// 技术指标计算函数（从 backtest-engine.ts 复制）
function calcEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  const k = 2 / (period + 1);
  ema[0] = data[0];
  for (let i = 1; i < data.length; i++) {
    ema[i] = data[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

function calcMACD(closes: number[]) {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const dif = ema12.map((v, i) => v - ema26[i]);
  const dea = calcEMA(dif, 9);
  const macd = dif.map((v, i) => 2 * (v - dea[i]));
  return { dif, dea, macd };
}

function calcKDJ(highs: number[], lows: number[], closes: number[], period = 9) {
  const k: number[] = [];
  const d: number[] = [];
  const rsv: number[] = [];
  
  let prevK = 50;
  let prevD = 50;
  
  for (let i = 0; i < closes.length; i++) {
    const start = Math.max(0, i - period + 1);
    const periodHighs = highs.slice(start, i + 1);
    const periodLows = lows.slice(start, i + 1);
    
    const highest = Math.max(...periodHighs);
    const lowest = Math.min(...periodLows);
    
    if (highest === lowest) {
      rsv[i] = 50;
    } else {
      rsv[i] = ((closes[i] - lowest) / (highest - lowest)) * 100;
    }
    
    k[i] = (2 / 3) * prevK + (1 / 3) * rsv[i];
    d[i] = (2 / 3) * prevD + (1 / 3) * k[i];
    
    prevK = k[i];
    prevD = d[i];
  }
  
  return { k, d, rsv };
}

function calcRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = [];
  let avgGain = 0;
  let avgLoss = 0;
  
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  
  avgGain /= period;
  avgLoss /= period;
  
  for (let i = period; i < closes.length; i++) {
    if (i > period) {
      const change = closes[i] - closes[i - 1];
      avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (change < 0 ? Math.abs(change) : 0)) / period;
    }
    
    if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi[i] = 100 - (100 / (1 + rs));
    }
  }
  
  return rsi;
}

function calcBoll(closes: number[], period = 20) {
  const upper: number[] = [];
  const middle: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper[i] = closes[i];
      middle[i] = closes[i];
      lower[i] = closes[i];
      continue;
    }
    
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const std = Math.sqrt(variance);
    
    middle[i] = mean;
    upper[i] = mean + 2 * std;
    lower[i] = mean - 2 * std;
  }
  
  return { upper, middle, lower };
}

function calcMA(closes: number[], period: number): number[] {
  const ma: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      ma[i] = closes[i];
      continue;
    }
    const slice = closes.slice(i - period + 1, i + 1);
    ma[i] = slice.reduce((a, b) => a + b, 0) / period;
  }
  return ma;
}

// 信号检测
export interface Signal {
  index: number;
  signal: 'buy' | 'sell';
  strategy: string;
  price: number;
  timestamp: string;
}

export interface MinuteData {
  time: string;
  price: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function detectSignals(
  minuteData: MinuteData[],
  strategyConfig: {
    signals: {
      buySignals: string[];
      sellSignals: string[];
      buyLogic: 'AND' | 'OR';
      sellLogic: 'AND' | 'OR';
      minBuyMatch: number;
      minSellMatch: number;
    };
  }
): Signal[] {
  const signals: Signal[] = [];
  
  if (minuteData.length < 30) {
    return signals; // 数据不足，无法计算指标
  }
  
  const closes = minuteData.map(d => d.close);
  const highs = minuteData.map(d => d.high);
  const lows = minuteData.map(d => d.low);
  
  // 计算技术指标
  const macd = calcMACD(closes);
  const kdj = calcKDJ(highs, lows, closes);
  const rsi = calcRSI(closes);
  const ma5 = calcMA(closes, 5);
  const ma20 = calcMA(closes, 20);
  const boll = calcBoll(closes);
  
  // 检测每个时间点的信号
  for (let i = 1; i < minuteData.length; i++) {
    const buySignalCount = checkBuySignals(
      i, macd, kdj, rsi, ma5, ma20, boll, closes,
      strategyConfig.signals.buySignals
    );
    
    const sellSignalCount = checkSellSignals(
      i, macd, kdj, rsi, ma5, ma20, boll, closes,
      strategyConfig.signals.sellSignals
    );
    
    // 买入信号判断
    const buyMatch = strategyConfig.signals.buyLogic === 'AND'
      ? buySignalCount === strategyConfig.signals.buySignals.length
      : buySignalCount >= strategyConfig.signals.minBuyMatch;
    
    // 卖出信号判断
    const sellMatch = strategyConfig.signals.sellLogic === 'AND'
      ? sellSignalCount === strategyConfig.signals.sellSignals.length
      : sellSignalCount >= strategyConfig.signals.minSellMatch;
    
    if (buyMatch) {
      signals.push({
        index: i,
        signal: 'buy',
        strategy: 'strategy',
        price: minuteData[i].close,
        timestamp: minuteData[i].time
      });
    }
    
    if (sellMatch) {
      signals.push({
        index: i,
        signal: 'sell',
        strategy: 'strategy',
        price: minuteData[i].close,
        timestamp: minuteData[i].time
      });
    }
  }
  
  return signals;
}

function checkBuySignals(
  i: number,
  macd: any,
  kdj: any,
  rsi: number[],
  ma5: number[],
  ma20: number[],
  boll: any,
  closes: number[],
  buySignals: string[]
): number {
  let count = 0;
  
  for (const signal of buySignals) {
    switch (signal) {
      case 'macd_golden_cross':
        if (macd.dif[i] > macd.dea[i] && macd.dif[i - 1] <= macd.dea[i - 1]) {
          count++;
        }
        break;
      case 'kdj_oversold':
        if (kdj.k[i] < 20 && kdj.d[i] < 20 && kdj.k[i] > kdj.d[i] && kdj.k[i - 1] <= kdj.d[i - 1]) {
          count++;
        }
        break;
      case 'rsi_oversold':
        if (rsi[i] < 30 && rsi[i - 1] >= 30) {
          count++;
        }
        break;
      case 'boll_lower_touch':
        if (closes[i] <= boll.lower[i] && closes[i - 1] > boll.lower[i - 1]) {
          count++;
        }
        break;
      case 'ma_golden_cross':
        if (ma5[i] > ma20[i] && ma5[i - 1] <= ma20[i - 1]) {
          count++;
        }
        break;
    }
  }
  
  return count;
}

function checkSellSignals(
  i: number,
  macd: any,
  kdj: any,
  rsi: number[],
  ma5: number[],
  ma20: number[],
  boll: any,
  closes: number[],
  sellSignals: string[]
): number {
  let count = 0;
  
  for (const signal of sellSignals) {
    switch (signal) {
      case 'macd_death_cross':
        if (macd.dif[i] < macd.dea[i] && macd.dif[i - 1] >= macd.dea[i - 1]) {
          count++;
        }
        break;
      case 'kdj_overbought':
        if (kdj.k[i] > 80 && kdj.d[i] > 80 && kdj.k[i] < kdj.d[i] && kdj.k[i - 1] >= kdj.d[i - 1]) {
          count++;
        }
        break;
      case 'rsi_overbought':
        if (rsi[i] > 70 && rsi[i - 1] <= 70) {
          count++;
        }
        break;
      case 'boll_upper_touch':
        if (closes[i] >= boll.upper[i] && closes[i - 1] < boll.upper[i - 1]) {
          count++;
        }
        break;
      case 'ma_death_cross':
        if (ma5[i] < ma20[i] && ma5[i - 1] >= ma20[i - 1]) {
          count++;
        }
        break;
    }
  }
  
  return count;
}

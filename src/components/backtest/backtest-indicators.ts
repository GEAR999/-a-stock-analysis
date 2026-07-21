// 回测技术指标计算（独立于analysis.ts，供回测引擎使用）

export function calcEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  ema[0] = data[0];
  for (let i = 1; i < data.length; i++) {
    ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
  }
  return ema;
}

export function calcMACD(closes: number[]): { dif: number[]; dea: number[]; macd: number[] } {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const dif = ema12.map((v, i) => v - ema26[i]);
  const dea = calcEMA(dif, 9);
  const macd = dif.map((v, i) => (v - dea[i]) * 2);
  return { dif, dea, macd };
}

export function calcKDJ(highs: number[], lows: number[], closes: number[], period = 9): { k: number[]; d: number[]; j: number[] } {
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

export function calcRSI(closes: number[], period = 14): number[] {
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

export function calcBoll(closes: number[], period = 20, multiplier = 2): { upper: number[]; middle: number[]; lower: number[] } {
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

export function calcMA(closes: number[], period: number): number[] {
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

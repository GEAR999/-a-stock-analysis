import type { KLineData, ChanlunResult, WaveResult, TechnicalIndicators } from '@/lib/types';

// Calculate MA (Moving Average)
export function calculateMA(data: KLineData[], periods: number[]): Record<number, number[]> {
  const result: Record<number, number[]> = {};
  for (const period of periods) {
    result[period] = data.map((_, i) => {
      if (i < period - 1) return 0;
      const slice = data.slice(i - period + 1, i + 1);
      return slice.reduce((sum, d) => sum + d.close, 0) / period;
    });
  }
  return result;
}

// Calculate MACD
export function calculateMACD(data: KLineData[], short = 12, long = 26, signal = 9) {
  const closes = data.map(d => d.close);
  const ema = (arr: number[], period: number): number[] => {
    const k = 2 / (period + 1);
    const result = [arr[0]];
    for (let i = 1; i < arr.length; i++) {
      result.push(arr[i] * k + result[i - 1] * (1 - k));
    }
    return result;
  };

  const emaShort = ema(closes, short);
  const emaLong = ema(closes, long);
  const dif = emaShort.map((v, i) => v - emaLong[i]);
  const dea = ema(dif, signal);
  const histogram = dif.map((v, i) => (v - dea[i]) * 2);

  return data.map((_, i) => ({
    dif: Math.round(dif[i] * 100) / 100,
    dea: Math.round(dea[i] * 100) / 100,
    histogram: Math.round(histogram[i] * 100) / 100,
  }));
}

// Calculate KDJ
export function calculateKDJ(data: KLineData[], period = 9) {
  return data.map((_, i) => {
    if (i < period - 1) return { k: 50, d: 50, j: 50 };
    const slice = data.slice(i - period + 1, i + 1);
    const high = Math.max(...slice.map(d => d.high));
    const low = Math.min(...slice.map(d => d.low));
    const rsv = high === low ? 50 : ((data[i].close - low) / (high - low)) * 100;

    const prevK = i > 0 ? calculateKDJSingle(data, i - 1, period).k : 50;
    const prevD = i > 0 ? calculateKDJSingle(data, i - 1, period).d : 50;

    const k = (2 / 3) * prevK + (1 / 3) * rsv;
    const d = (2 / 3) * prevD + (1 / 3) * k;
    const j = 3 * k - 2 * d;

    return {
      k: Math.round(k * 100) / 100,
      d: Math.round(d * 100) / 100,
      j: Math.round(j * 100) / 100,
    };
  });
}

function calculateKDJSingle(data: KLineData[], index: number, period: number) {
  if (index < period - 1) return { k: 50, d: 50, j: 50 };
  const slice = data.slice(index - period + 1, index + 1);
  const high = Math.max(...slice.map(d => d.high));
  const low = Math.min(...slice.map(d => d.low));
  const rsv = high === low ? 50 : ((data[index].close - low) / (high - low)) * 100;
  const k = rsv;
  const d = k;
  const j = 3 * k - 2 * d;
  return { k, d, j };
}

// Calculate RSI
export function calculateRSI(data: KLineData[], period = 14) {
  return data.map((_, i) => {
    if (i < period) return { rsi: 50 };
    const slice = data.slice(i - period, i + 1);
    let gains = 0;
    let losses = 0;
    for (let j = 1; j < slice.length; j++) {
      const diff = slice[j].close - slice[j - 1].close;
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    return { rsi: Math.round(rsi * 100) / 100 };
  });
}

// Calculate Bollinger Bands
export function calculateBOLL(data: KLineData[], period = 20, multiplier = 2) {
  return data.map((_, i) => {
    if (i < period - 1) {
      return { upper: data[i].close, middle: data[i].close, lower: data[i].close };
    }
    const slice = data.slice(i - period + 1, i + 1);
    const middle = slice.reduce((sum, d) => sum + d.close, 0) / period;
    const variance = slice.reduce((sum, d) => sum + Math.pow(d.close - middle, 2), 0) / period;
    const std = Math.sqrt(variance);
    return {
      upper: Math.round((middle + multiplier * std) * 100) / 100,
      middle: Math.round(middle * 100) / 100,
      lower: Math.round((middle - multiplier * std) * 100) / 100,
    };
  });
}

// Simplified Chanlun Analysis
export function analyzeChanlun(data: KLineData[]): ChanlunResult {
  if (data.length < 10) {
    return { strokes: [], segments: [], centers: [], buySignals: [], sellSignals: [] };
  }

  // Find fractals (顶底分型)
  const tops: number[] = [];
  const bottoms: number[] = [];

  for (let i = 2; i < data.length - 2; i++) {
    if (data[i].high > data[i - 1].high && data[i].high > data[i + 1].high &&
        data[i].high > data[i - 2].high && data[i].high > data[i + 2].high) {
      tops.push(i);
    }
    if (data[i].low < data[i - 1].low && data[i].low < data[i + 1].low &&
        data[i].low < data[i - 2].low && data[i].low < data[i + 2].low) {
      bottoms.push(i);
    }
  }

  // Build strokes from alternating tops and bottoms
  const strokes: ChanlunResult['strokes'] = [];
  const points: Array<{ index: number; type: 'top' | 'bottom' }> = [];

  tops.forEach(t => points.push({ index: t, type: 'top' }));
  bottoms.forEach(b => points.push({ index: b, type: 'bottom' }));
  points.sort((a, b) => a.index - b.index);

  // Alternate top-bottom
  const filtered: typeof points = [];
  for (const p of points) {
    if (filtered.length === 0) {
      filtered.push(p);
    } else {
      const last = filtered[filtered.length - 1];
      if (last.type !== p.type) {
        filtered.push(p);
      } else if (p.type === 'top' && data[p.index].high > data[last.index].high) {
        filtered[filtered.length - 1] = p;
      } else if (p.type === 'bottom' && data[p.index].low < data[last.index].low) {
        filtered[filtered.length - 1] = p;
      }
    }
  }

  for (let i = 0; i < filtered.length - 1; i++) {
    const start = filtered[i];
    const end = filtered[i + 1];
    strokes.push({
      start: start.index,
      end: end.index,
      direction: start.type === 'bottom' ? 'up' : 'down',
    });
  }

  // Identify centers (中枢) - at least 3 overlapping strokes
  const centers: ChanlunResult['centers'] = [];
  for (let i = 0; i < strokes.length - 2; i++) {
    const s1 = strokes[i];
    const s2 = strokes[i + 1];
    const s3 = strokes[i + 2];

    const high = Math.min(
      Math.max(data[s1.start].high, data[s1.end].high),
      Math.max(data[s2.start].high, data[s2.end].high),
      Math.max(data[s3.start].high, data[s3.end].high)
    );
    const low = Math.max(
      Math.min(data[s1.start].low, data[s1.end].low),
      Math.min(data[s2.start].low, data[s2.end].low),
      Math.min(data[s3.start].low, data[s3.end].low)
    );

    if (high > low) {
      centers.push({ start: s1.start, end: s3.end, high, low });
    }
  }

  // Generate buy/sell signals
  const buySignals: ChanlunResult['buySignals'] = [];
  const sellSignals: ChanlunResult['sellSignals'] = [];

  // First buy: after downtrend, bottom fractal
  for (let i = 1; i < filtered.length; i++) {
    if (filtered[i].type === 'bottom' && i >= 3) {
      const prevStroke = strokes[i - 1];
      if (prevStroke && prevStroke.direction === 'down') {
        buySignals.push({
          index: filtered[i].index,
          type: 1,
          price: data[filtered[i].index].low,
        });
      }
    }
    if (filtered[i].type === 'top' && i >= 3) {
      const prevStroke = strokes[i - 1];
      if (prevStroke && prevStroke.direction === 'up') {
        sellSignals.push({
          index: filtered[i].index,
          type: 1,
          price: data[filtered[i].index].high,
        });
      }
    }
  }

  return {
    strokes,
    segments: strokes.length > 3 ? [{ start: strokes[0].start, end: strokes[strokes.length - 1].end, direction: strokes[strokes.length - 1].direction }] : [],
    centers: centers.slice(0, 5),
    buySignals: buySignals.slice(-5),
    sellSignals: sellSignals.slice(-5),
  };
}

// Simplified Wave Analysis
export function analyzeWaves(data: KLineData[]): WaveResult {
  if (data.length < 10) {
    return { waves: [] };
  }

  // Find significant pivots with adaptive lookback
  const pivots: Array<{ index: number; price: number; type: 'high' | 'low' }> = [];
  const lookback = Math.max(3, Math.min(8, Math.floor(data.length / 15)));

  for (let i = lookback; i < data.length - lookback; i++) {
    const window = data.slice(i - lookback, i + lookback + 1);
    const highs = window.map(d => d.high);
    const lows = window.map(d => d.low);

    if (data[i].high === Math.max(...highs)) {
      pivots.push({ index: i, price: data[i].high, type: 'high' });
    }
    if (data[i].low === Math.min(...lows)) {
      pivots.push({ index: i, price: data[i].low, type: 'low' });
    }
  }

  // Remove consecutive same-type pivots, keeping the more extreme one
  const filtered: typeof pivots = [];
  for (const p of pivots) {
    if (filtered.length === 0 || filtered[filtered.length - 1].type !== p.type) {
      filtered.push(p);
    } else {
      const last = filtered[filtered.length - 1];
      if (p.type === 'high' && p.price > last.price) {
        filtered[filtered.length - 1] = p;
      } else if (p.type === 'low' && p.price < last.price) {
        filtered[filtered.length - 1] = p;
      }
    }
  }

  const waves: WaveResult['waves'] = [];
  const impulseLabels = ['1', '2', '3', '4', '5'];
  const correctiveLabels = ['A', 'B', 'C'];

  if (filtered.length < 4) {
    return { waves: [] };
  }

  // Try to find impulse wave pattern (5 waves) in the last N pivots
  // Look for the best 6-pivot sequence that forms an impulse pattern
  let bestImpulse: typeof filtered = [];
  let bestImpulseScore = 0;

  for (let start = Math.max(0, filtered.length - 10); start <= filtered.length - 6; start++) {
    const seq = filtered.slice(start, start + 6);
    if (seq.length < 6) continue;

    // Check upward impulse: low-high-low-high-low-high with increasing highs
    let upScore = 0;
    if (seq[0].type === 'low') {
      for (let i = 1; i < seq.length; i++) {
        if (i % 2 === 1 && seq[i].price > seq[i - 1].price) upScore += 2;
        else if (i % 2 === 0 && seq[i].price < seq[i - 1].price) upScore += 1;
      }
      // Bonus for wave 3 being the longest (most common pattern)
      const w1Len = Math.abs(seq[1].price - seq[0].price);
      const w3Len = Math.abs(seq[3].price - seq[2].price);
      if (w3Len > w1Len) upScore += 2;
    }

    // Check downward impulse: high-low-high-low-high-low
    let downScore = 0;
    if (seq[0].type === 'high') {
      for (let i = 1; i < seq.length; i++) {
        if (i % 2 === 1 && seq[i].price < seq[i - 1].price) downScore += 2;
        else if (i % 2 === 0 && seq[i].price > seq[i - 1].price) downScore += 1;
      }
      const w1Len = Math.abs(seq[1].price - seq[0].price);
      const w3Len = Math.abs(seq[3].price - seq[2].price);
      if (w3Len > w1Len) downScore += 2;
    }

    const score = Math.max(upScore, downScore);
    if (score > bestImpulseScore) {
      bestImpulseScore = score;
      bestImpulse = seq;
    }
  }

  // If we found a decent impulse pattern, label it
  if (bestImpulseScore >= 4 && bestImpulse.length >= 6) {
    for (let i = 0; i < 5 && i < bestImpulse.length - 1; i++) {
      waves.push({
        start: bestImpulse[i].index,
        end: bestImpulse[i + 1].index,
        label: impulseLabels[i],
        type: 'impulse',
      });
    }
  } else {
    // Fall back to labeling the last few segments as corrective waves
    const lastN = filtered.slice(-4);
    if (lastN.length >= 4) {
      for (let i = 0; i < 3 && i < lastN.length - 1; i++) {
        waves.push({
          start: lastN[i].index,
          end: lastN[i + 1].index,
          label: correctiveLabels[i],
          type: 'corrective',
        });
      }
    }
  }

  return { waves };
}

// Get all technical indicators
export function getAllIndicators(data: KLineData[]): TechnicalIndicators {
  return {
    macd: calculateMACD(data),
    kdj: calculateKDJ(data),
    rsi: calculateRSI(data),
    boll: calculateBOLL(data),
    ma: calculateMA(data, [5, 10, 20, 60, 120, 250]),
  };
}

// Generate comprehensive advice
export function generateAdvice(
  data: KLineData[],
  indicators: TechnicalIndicators,
  chanlun: ChanlunResult,
  wave: WaveResult
): { overall: string; score: number; details: string[]; risk: string[] } {
  const details: string[] = [];
  let bullScore = 0;
  let totalScore = 0;

  // MACD analysis
  const lastMACD = indicators.macd[indicators.macd.length - 1];
  if (lastMACD) {
    totalScore += 20;
    if (lastMACD.dif > lastMACD.dea && lastMACD.histogram > 0) {
      bullScore += 15;
      details.push('MACD: 金叉状态，多头动能增强');
    } else if (lastMACD.dif < lastMACD.dea && lastMACD.histogram < 0) {
      bullScore += 5;
      details.push('MACD: 死叉状态，空头占优');
    } else {
      bullScore += 10;
      details.push('MACD: 信号不明确，观望为主');
    }
  }

  // KDJ analysis
  const lastKDJ = indicators.kdj[indicators.kdj.length - 1];
  if (lastKDJ) {
    totalScore += 20;
    if (lastKDJ.j < 20) {
      bullScore += 18;
      details.push('KDJ: J值超卖区，存在反弹机会');
    } else if (lastKDJ.j > 80) {
      bullScore += 5;
      details.push('KDJ: J值超买区，注意回调风险');
    } else {
      bullScore += 10;
      details.push('KDJ: 中性区间');
    }
  }

  // RSI analysis
  const lastRSI = indicators.rsi[indicators.rsi.length - 1];
  if (lastRSI) {
    totalScore += 20;
    if (lastRSI.rsi < 30) {
      bullScore += 16;
      details.push('RSI: 超卖区域，关注反弹信号');
    } else if (lastRSI.rsi > 70) {
      bullScore += 4;
      details.push('RSI: 超买区域，谨慎追高');
    } else {
      bullScore += 10;
      details.push(`RSI: ${lastRSI.rsi.toFixed(1)}，处于中性区间`);
    }
  }

  // BOLL analysis
  const lastBOLL = indicators.boll[indicators.boll.length - 1];
  const lastClose = data[data.length - 1]?.close || 0;
  if (lastBOLL && lastClose) {
    totalScore += 20;
    if (lastClose < lastBOLL.lower) {
      bullScore += 15;
      details.push('BOLL: 价格跌破下轨，超卖状态');
    } else if (lastClose > lastBOLL.upper) {
      bullScore += 5;
      details.push('BOLL: 价格突破上轨，注意回调');
    } else {
      bullScore += 10;
      details.push('BOLL: 价格在通道内运行');
    }
  }

  // Chanlun analysis
  if (chanlun.buySignals.length > 0) {
    totalScore += 20;
    bullScore += 15;
    details.push(`缠论: 发现${chanlun.buySignals.length}个买点信号`);
  }
  if (chanlun.sellSignals.length > 0) {
    totalScore += 20;
    bullScore += 5;
    details.push(`缠论: 发现${chanlun.sellSignals.length}个卖点信号`);
  }

  const score = totalScore > 0 ? Math.round((bullScore / totalScore) * 100) : 50;
  let overall: string;
  if (score >= 65) overall = '看多';
  else if (score <= 35) overall = '看空';
  else overall = '中性';

  const risk: string[] = [
    '以上分析仅供参考，不构成投资建议',
    '股市有风险，投资需谨慎',
    '技术指标存在滞后性，请结合基本面综合判断',
  ];

  return { overall, score, details, risk };
}

// Calculate individual stock sentiment
export function calculateStockSentiment(
  data: KLineData[],
  quote: { code: string; name: string; price: number; changePercent: number }
): {
  code: string;
  name: string;
  price: number;
  changePercent: number;
  technicalScore: number;
  volumeRatio: number;
  volumeTrend: '放量' | '缩量' | '平量';
  momentumScore: number;
  supportLevel: number;
  resistanceLevel: number;
  heatScore: number;
  timestamp: number;
} {
  if (data.length < 5) {
    return {
      code: quote.code,
      name: quote.name,
      price: quote.price,
      changePercent: quote.changePercent,
      technicalScore: 50,
      volumeRatio: 1,
      volumeTrend: '平量',
      momentumScore: 0,
      supportLevel: quote.price * 0.95,
      resistanceLevel: quote.price * 1.05,
      heatScore: 50,
      timestamp: Date.now(),
    };
  }

  const last = data[data.length - 1];
  const recent = data.slice(-5);

  // Volume analysis: compare today's volume with 5-day average
  const avgVol5d = data.slice(-6, -1).reduce((sum, d) => sum + d.volume, 0) / Math.min(5, data.length - 1);
  const volumeRatio = avgVol5d > 0 ? last.volume / avgVol5d : 1;
  let volumeTrend: '放量' | '缩量' | '平量';
  if (volumeRatio > 1.3) volumeTrend = '放量';
  else if (volumeRatio < 0.7) volumeTrend = '缩量';
  else volumeTrend = '平量';

  // Technical score based on multiple factors
  let techScore = 50;

  // Price position relative to MAs
  const ma5 = recent.reduce((s, d) => s + d.close, 0) / recent.length;
  const ma20 = data.slice(-20).reduce((s, d) => s + d.close, 0) / Math.min(20, data.length);
  if (last.close > ma5) techScore += 10;
  if (last.close > ma20) techScore += 10;
  if (ma5 > ma20) techScore += 10; // Golden cross

  // Momentum: rate of change over recent periods
  const roc5 = data.length >= 6 ? ((last.close - data[data.length - 6].close) / data[data.length - 6].close) * 100 : 0;
  const momentumScore = Math.max(-100, Math.min(100, Math.round(roc5 * 10)));

  // Adjust tech score based on momentum
  if (momentumScore > 20) techScore += 15;
  else if (momentumScore > 0) techScore += 5;
  else if (momentumScore < -20) techScore -= 15;
  else if (momentumScore < 0) techScore -= 5;

  // Volume-price coordination
  if (last.close > data[data.length - 2].close && volumeRatio > 1.2) {
    techScore += 10; // Price up with volume = bullish
  }
  if (last.close < data[data.length - 2].close && volumeRatio > 1.5) {
    techScore -= 10; // Price down with heavy volume = bearish
  }

  techScore = Math.max(0, Math.min(100, techScore));

  // Support and resistance levels (simple: recent lows/highs)
  const recentLows = data.slice(-20).map(d => d.low);
  const recentHighs = data.slice(-20).map(d => d.high);
  const supportLevel = Math.min(...recentLows);
  const resistanceLevel = Math.max(...recentHighs);

  // Heat score: combination of volume activity, price volatility, and momentum strength
  const volatility = (Math.max(...recentHighs) - Math.min(...recentLows)) / last.close * 100;
  const heatScore = Math.max(0, Math.min(100, Math.round(
    volumeRatio * 25 +
    Math.abs(momentumScore) * 0.3 +
    volatility * 3 +
    (Math.abs(quote.changePercent) > 3 ? 20 : 0)
  )));

  return {
    code: quote.code,
    name: quote.name,
    price: quote.price,
    changePercent: quote.changePercent,
    technicalScore: techScore,
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    volumeTrend,
    momentumScore,
    supportLevel: Math.round(supportLevel * 100) / 100,
    resistanceLevel: Math.round(resistanceLevel * 100) / 100,
    heatScore,
    timestamp: Date.now(),
  };
}

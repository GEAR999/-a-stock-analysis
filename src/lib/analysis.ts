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

    // 边界条件处理
    if (avgGain === 0 && avgLoss === 0) return { rsi: 50 }; // 无波动
    if (avgLoss === 0) return { rsi: 100 }; // 全部上涨
    if (avgGain === 0) return { rsi: 0 }; // 全部下跌

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    // clamp 确保在 [0, 100] 范围内
    return { rsi: Math.round(Math.max(0, Math.min(100, rsi)) * 100) / 100 };
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

// 包含关系处理 - 缠论第一步
// 合并后每根K线记录原始index映射（用于买卖点定位回原始K线位置）
interface MergedKLine extends KLineData {
  originalIndex: number; // 映射到原始K线数组的index
}

export function mergeInclusiveKLines(data: KLineData[]): MergedKLine[] {
  if (data.length < 2) {
    return data.map((d, i) => ({ ...d, originalIndex: i }));
  }

  const result: MergedKLine[] = [{ ...data[0], originalIndex: 0 }];

  for (let i = 1; i < data.length; i++) {
    const curr = data[i];
    const prev = result[result.length - 1];

    // 检查包含关系: curr包含prev 或 prev包含curr
    const isInclusive =
      (curr.high <= prev.high && curr.low >= prev.low) ||
      (curr.high >= prev.high && curr.low <= prev.low);

    if (isInclusive) {
      // 确定方向：看prev之前的一根K线
      let direction: 'up' | 'down' = 'up'; // 默认上涨
      if (result.length >= 2) {
        const prevPrev = result[result.length - 2];
        if (prev.high < prevPrev.high) {
          direction = 'down';
        } else {
          direction = 'up';
        }
      }

      if (direction === 'up') {
        // 上涨方向：取高的高低的高（取大值）
        result[result.length - 1] = {
          date: prev.date,
          open: prev.open,
          close: curr.close,
          high: Math.max(prev.high, curr.high),
          low: Math.max(prev.low, curr.low),
          volume: prev.volume + curr.volume,
          amount: prev.amount + curr.amount,
          originalIndex: prev.originalIndex, // 保留较早的原始index
        };
      } else {
        // 下跌方向：取低的高的低（取小值）
        result[result.length - 1] = {
          date: prev.date,
          open: prev.open,
          close: curr.close,
          high: Math.min(prev.high, curr.high),
          low: Math.min(prev.low, curr.low),
          volume: prev.volume + curr.volume,
          amount: prev.amount + curr.amount,
          originalIndex: prev.originalIndex,
        };
      }
      // 合并后继续与下一根比较（递归合并）
    } else {
      result.push({ ...curr, originalIndex: i });
    }
  }

  return result;
}

// Simplified Chanlun Analysis
export function analyzeChanlun(data: KLineData[]): ChanlunResult {
  if (data.length < 10) {
    return { strokes: [], segments: [], centers: [], buySignals: [], sellSignals: [] };
  }

  // Step 1: 包含关系处理
  const merged = mergeInclusiveKLines(data);
  if (merged.length < 5) {
    return { strokes: [], segments: [], centers: [], buySignals: [], sellSignals: [] };
  }

  // Step 2: 在合并后数据上识别顶底分型
  const tops: number[] = [];
  const bottoms: number[] = [];

  for (let i = 1; i < merged.length - 1; i++) {
    // 顶分型：中间K线的高点 > 左右两根的高点
    if (merged[i].high > merged[i - 1].high && merged[i].high > merged[i + 1].high) {
      tops.push(i);
    }
    // 底分型：中间K线的低点 < 左右两根的低点
    if (merged[i].low < merged[i - 1].low && merged[i].low < merged[i + 1].low) {
      bottoms.push(i);
    }
  }

  // Step 3: 构建笔 - 交替筛选 + 最少5根K线距离校验
  const points: Array<{ index: number; type: 'top' | 'bottom' }> = [];
  tops.forEach(t => points.push({ index: t, type: 'top' }));
  bottoms.forEach(b => points.push({ index: b, type: 'bottom' }));
  points.sort((a, b) => a.index - b.index);

  const filtered: typeof points = [];
  for (const p of points) {
    if (filtered.length === 0) {
      filtered.push(p);
    } else {
      const last = filtered[filtered.length - 1];
      const distance = p.index - last.index;

      if (last.type !== p.type) {
        // 不同类型：检查距离 >= 4（一笔至少5根合并K线）
        if (distance >= 4) {
          filtered.push(p);
        }
        // 距离不够则跳过此分型
      } else {
        // 同类型取极值
        if (p.type === 'top' && merged[p.index].high > merged[last.index].high) {
          filtered[filtered.length - 1] = p;
        } else if (p.type === 'bottom' && merged[p.index].low < merged[last.index].low) {
          filtered[filtered.length - 1] = p;
        }
      }
    }
  }

  // Step 4: 构建笔（index映射回原始K线）
  const strokes: ChanlunResult['strokes'] = [];
  for (let i = 0; i < filtered.length - 1; i++) {
    const start = filtered[i];
    const end = filtered[i + 1];
    strokes.push({
      start: merged[start.index].originalIndex,
      end: merged[end.index].originalIndex,
      direction: start.type === 'bottom' ? 'up' : 'down',
    });
  }

  // Step 5: 中枢识别（使用原始K线数据获取价格）
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

  // Step 6: 买卖点信号（index已经是原始K线位置）
  const buySignals: ChanlunResult['buySignals'] = [];
  const sellSignals: ChanlunResult['sellSignals'] = [];

  // 一买：下跌笔后的底分型
  for (let i = 1; i < filtered.length; i++) {
    if (filtered[i].type === 'bottom' && i >= 3) {
      const prevStroke = strokes[i - 1];
      if (prevStroke && prevStroke.direction === 'down') {
        const origIdx = merged[filtered[i].index].originalIndex;
        buySignals.push({
          index: origIdx,
          type: 1,
          price: data[origIdx].low,
        });
      }
    }
    // 一卖：上涨笔后的顶分型
    if (filtered[i].type === 'top' && i >= 3) {
      const prevStroke = strokes[i - 1];
      if (prevStroke && prevStroke.direction === 'up') {
        const origIdx = merged[filtered[i].index].originalIndex;
        sellSignals.push({
          index: origIdx,
          type: 1,
          price: data[origIdx].high,
        });
      }
    }
  }

  // 二买：一买后回调不破一买低点
  for (let i = 0; i < buySignals.length; i++) {
    const firstBuy = buySignals[i];
    for (let j = 0; j < filtered.length; j++) {
      const fIdx = merged[filtered[j].index].originalIndex;
      if (fIdx > firstBuy.index && filtered[j].type === 'bottom') {
        const pullbackLow = data[fIdx].low;
        if (pullbackLow > firstBuy.price) {
          const hasUpStroke = strokes.some(s =>
            s.direction === 'up' &&
            s.end > firstBuy.index &&
            s.start < fIdx
          );
          if (hasUpStroke) {
            buySignals.push({
              index: fIdx,
              type: 2,
              price: pullbackLow,
            });
            break;
          }
        }
        break;
      }
    }
  }

  // 二卖：一卖后反弹不破一卖高点
  for (let i = 0; i < sellSignals.length; i++) {
    const firstSell = sellSignals[i];
    for (let j = 0; j < filtered.length; j++) {
      const fIdx = merged[filtered[j].index].originalIndex;
      if (fIdx > firstSell.index && filtered[j].type === 'top') {
        const bounceHigh = data[fIdx].high;
        if (bounceHigh < firstSell.price) {
          const hasDownStroke = strokes.some(s =>
            s.direction === 'down' &&
            s.end > firstSell.index &&
            s.start < fIdx
          );
          if (hasDownStroke) {
            sellSignals.push({
              index: fIdx,
              type: 2,
              price: bounceHigh,
            });
            break;
          }
        }
        break;
      }
    }
  }

  // 三买：离开中枢向上后回调不进入中枢
  for (const center of centers) {
    const afterCenterStrokes = strokes.filter(s => s.start >= center.end);

    for (let i = 0; i < afterCenterStrokes.length - 1; i++) {
      const stroke = afterCenterStrokes[i];
      if (stroke.direction === 'up') {
        const strokeHigh = Math.max(data[stroke.start].high, data[stroke.end].high);
        if (strokeHigh > center.high) {
          const nextDown = afterCenterStrokes[i + 1];
          if (nextDown && nextDown.direction === 'down') {
            const pullbackLow = Math.min(data[nextDown.start].low, data[nextDown.end].low);
            if (pullbackLow > center.high) {
              buySignals.push({
                index: nextDown.end,
                type: 3,
                price: pullbackLow,
              });
            }
          }
        }
      }
    }

    // 三卖：离开中枢向下后反弹不进入中枢
    for (let i = 0; i < afterCenterStrokes.length - 1; i++) {
      const stroke = afterCenterStrokes[i];
      if (stroke.direction === 'down') {
        const strokeLow = Math.min(data[stroke.start].low, data[stroke.end].low);
        if (strokeLow < center.low) {
          const nextUp = afterCenterStrokes[i + 1];
          if (nextUp && nextUp.direction === 'up') {
            const bounceHigh = Math.max(data[nextUp.start].high, data[nextUp.end].high);
            if (bounceHigh < center.low) {
              sellSignals.push({
                index: nextUp.end,
                type: 3,
                price: bounceHigh,
              });
            }
          }
        }
      }
    }
  }

  // Sort signals by index and deduplicate
  buySignals.sort((a, b) => a.index - b.index);
  sellSignals.sort((a, b) => a.index - b.index);

  return {
    strokes,
    segments: strokes.length > 3 ? [{ start: strokes[0].start, end: strokes[strokes.length - 1].end, direction: strokes[strokes.length - 1].direction }] : [],
    centers: centers.slice(0, 5),
    buySignals: buySignals.slice(-10),
    sellSignals: sellSignals.slice(-10),
  };
}

// Simplified Wave Analysis
// 计算ATR（真实波动幅度）
function calculateATR(data: KLineData[], period = 14): number {
  if (data.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trs.push(tr);
  }
  // 取最近period个TR的平均值
  const recent = trs.slice(-period);
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

// 波浪灵敏度类型
export type WaveSensitivity = 'high' | 'medium' | 'low';

export function analyzeWaves(data: KLineData[], sensitivity: WaveSensitivity = 'medium'): WaveResult {
  if (data.length < 10) {
    return { waves: [] };
  }

  // 计算最小振幅阈值
  const atr = calculateATR(data, 14);
  const priceRange = Math.max(...data.map(d => d.high)) - Math.min(...data.map(d => d.low));
  const sensitivityMultiplier = sensitivity === 'high' ? 0.3 : sensitivity === 'low' ? 1.0 : 0.5;
  const minAmplitude = Math.max(atr * sensitivityMultiplier, priceRange * 0.02);

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
  const deduped: typeof pivots = [];
  for (const p of pivots) {
    if (deduped.length === 0 || deduped[deduped.length - 1].type !== p.type) {
      deduped.push(p);
    } else {
      const last = deduped[deduped.length - 1];
      if (p.type === 'high' && p.price > last.price) {
        deduped[deduped.length - 1] = p;
      } else if (p.type === 'low' && p.price < last.price) {
        deduped[deduped.length - 1] = p;
      }
    }
  }

  // 最小振幅过滤：移除振幅 < minAmplitude 的枢轴点
  const filtered: typeof pivots = [];
  for (const p of deduped) {
    if (filtered.length === 0) {
      filtered.push(p);
    } else {
      const last = filtered[filtered.length - 1];
      const amplitude = Math.abs(p.price - last.price);
      if (amplitude >= minAmplitude) {
        filtered.push(p);
      } else {
        // 振幅不够，忽略较小的那个枢轴点
        // 如果当前枢轴更极端，替换前一个
        if (p.type === last.type) {
          if ((p.type === 'high' && p.price > last.price) || (p.type === 'low' && p.price < last.price)) {
            filtered[filtered.length - 1] = p;
          }
        }
        // 不同类型但振幅不够 → 忽略当前（噪声）
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

  // MACD analysis (权重16)
  const lastMACD = indicators.macd[indicators.macd.length - 1];
  if (lastMACD) {
    totalScore += 16;
    if (lastMACD.dif > lastMACD.dea && lastMACD.histogram > 0) {
      bullScore += 12;
      details.push('MACD: 金叉状态，多头动能增强');
    } else if (lastMACD.dif < lastMACD.dea && lastMACD.histogram < 0) {
      bullScore += 4;
      details.push('MACD: 死叉状态，空头占优');
    } else {
      bullScore += 8;
      details.push('MACD: 信号不明确，观望为主');
    }
  }

  // KDJ analysis (权重16)
  const lastKDJ = indicators.kdj[indicators.kdj.length - 1];
  if (lastKDJ) {
    totalScore += 16;
    if (lastKDJ.j < 20) {
      bullScore += 14;
      details.push('KDJ: J值超卖区，存在反弹机会');
    } else if (lastKDJ.j > 80) {
      bullScore += 4;
      details.push('KDJ: J值超买区，注意回调风险');
    } else {
      bullScore += 8;
      details.push('KDJ: 中性区间');
    }
  }

  // RSI analysis (权重16) - 增加NaN/undefined防护
  const lastRSI = indicators.rsi[indicators.rsi.length - 1];
  if (lastRSI && !isNaN(lastRSI.rsi) && isFinite(lastRSI.rsi)) {
    totalScore += 16;
    if (lastRSI.rsi < 30) {
      bullScore += 13;
      details.push('RSI: 超卖区域，关注反弹信号');
    } else if (lastRSI.rsi > 70) {
      bullScore += 3;
      details.push('RSI: 超买区域，谨慎追高');
    } else {
      bullScore += 8;
      details.push(`RSI: ${lastRSI.rsi.toFixed(1)}，处于中性区间`);
    }
  } else {
    // RSI为NaN/undefined时给中性分
    totalScore += 16;
    bullScore += 8;
    details.push('RSI: 数据异常，中性评估');
  }

  // BOLL analysis (权重16)
  const lastBOLL = indicators.boll[indicators.boll.length - 1];
  const lastClose = data[data.length - 1]?.close || 0;
  if (lastBOLL && lastClose) {
    totalScore += 16;
    if (lastClose < lastBOLL.lower) {
      bullScore += 12;
      details.push('BOLL: 价格跌破下轨，超卖状态');
    } else if (lastClose > lastBOLL.upper) {
      bullScore += 4;
      details.push('BOLL: 价格突破上轨，注意回调');
    } else {
      bullScore += 8;
      details.push('BOLL: 价格在通道内运行');
    }
  }

  // Chanlun analysis (权重18)
  if (chanlun.buySignals.length > 0) {
    totalScore += 18;
    bullScore += 14;
    details.push(`缠论: 发现${chanlun.buySignals.length}个买点信号`);
  }
  if (chanlun.sellSignals.length > 0) {
    totalScore += 18;
    bullScore += 4;
    details.push(`缠论: 发现${chanlun.sellSignals.length}个卖点信号`);
  }
  if (chanlun.buySignals.length === 0 && chanlun.sellSignals.length === 0) {
    totalScore += 18;
    bullScore += 9;
    details.push('缠论: 暂无明确买卖点');
  }

  // Wave analysis (权重18) - 新增波浪维度
  totalScore += 18;
  const waveScore = calculateWaveScore(data, wave);
  bullScore += waveScore.score;
  if (waveScore.detail) {
    details.push(waveScore.detail);
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

// 波浪维度评分计算
function calculateWaveScore(data: KLineData[], wave: WaveResult): { score: number; detail: string } {
  if (!wave.waves || wave.waves.length === 0) {
    return { score: 9, detail: '波浪: 未检测到明确波浪模式' };
  }

  const impulseWaves = wave.waves.filter(w => w.type === 'impulse');
  const correctiveWaves = wave.waves.filter(w => w.type === 'corrective');
  const lastClose = data[data.length - 1]?.close || 0;

  // 判断是否上升推动浪
  if (impulseWaves.length >= 3) {
    const firstWave = impulseWaves[0];
    const lastWave = impulseWaves[impulseWaves.length - 1];
    const isUpward = data[lastWave.end]?.close > data[firstWave.start]?.close;

    // 判断当前处于第几浪
    const currentWavePosition = determineCurrentWavePosition(data, impulseWaves, lastClose);

    if (isUpward) {
      // 上升推动浪
      if (currentWavePosition === '3' || currentWavePosition === '5') {
        return { score: 18, detail: '波浪: 上升推动浪第' + currentWavePosition + '浪，强势看多' };
      } else if (currentWavePosition === '4') {
        return { score: 12, detail: '波浪: 上升推动浪第4浪回调中，中性偏多' };
      } else if (currentWavePosition === '2') {
        return { score: 12, detail: '波浪: 上升推动浪第2浪回调中，蓄势待发' };
      } else {
        return { score: 14, detail: '波浪: 上升推动浪结构中，偏多' };
      }
    } else {
      // 下降推动浪
      if (currentWavePosition === '3' || currentWavePosition === '5') {
        return { score: 3, detail: '波浪: 下降推动浪第' + currentWavePosition + '浪，强势看空' };
      } else if (currentWavePosition === '4') {
        return { score: 8, detail: '波浪: 下降推动浪第4浪反弹中，中性偏空' };
      } else {
        return { score: 6, detail: '波浪: 下降推动浪结构中，偏空' };
      }
    }
  }

  // 调整浪 A-B-C
  if (correctiveWaves.length >= 2) {
    const lastCorrective = correctiveWaves[correctiveWaves.length - 1];
    if (lastCorrective.label === 'C') {
      return { score: 14, detail: '波浪: A-B-C调整浪C浪末端，调整将结束偏多' };
    }
    return { score: 10, detail: '波浪: 调整浪结构中，观望为主' };
  }

  return { score: 9, detail: '波浪: 波浪模式不明确' };
}

// 判断当前处于推动浪的第几浪
function determineCurrentWavePosition(data: KLineData[], impulseWaves: WaveResult['waves'], currentPrice: number): string {
  if (impulseWaves.length === 0) return '';

  // 获取各浪的关键价格点
  const wavePoints: Array<{ label: string; endPrice: number; endIndex: number }> = [];
  for (const w of impulseWaves) {
    const endData = data[w.end];
    if (endData) {
      wavePoints.push({ label: w.label, endPrice: endData.close, endIndex: w.end });
    }
  }

  // 找到最后一个已完成的浪
  const lastCompletedWave = impulseWaves[impulseWaves.length - 1];
  const lastDataIdx = data.length - 1;

  // 如果当前价格已经超过最后一浪的终点，可能处于延伸浪
  if (lastDataIdx > lastCompletedWave.end) {
    const lastPrice = data[lastCompletedWave.end]?.close || 0;
    if (currentPrice > lastPrice) {
      return lastCompletedWave.label; // 延续当前浪
    }
  }

  // 根据当前价格所在区间判断
  for (let i = wavePoints.length - 1; i >= 0; i--) {
    const wp = wavePoints[i];
    if (lastDataIdx >= wp.endIndex) {
      return wp.label;
    }
  }

  return wavePoints[0]?.label || '';
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

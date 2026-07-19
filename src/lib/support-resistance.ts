import type { KLineData } from '@/lib/types';

export interface SupportResistance {
  price: number;
  type: 'support' | 'resistance';
  strength: '强' | '中' | '弱';
  sources: string[];
}

/**
 * 计算支撑位和压力位
 * 基于多种技术指标：均线、布林带、斐波那契、近期高低点
 */
export function calculateSupportResistance(
  klineData: KLineData[],
  currentPrice: number,
  indicators?: {
    ma?: Record<number, number[]>;
    boll?: { upper: number[]; middle: number[]; lower: number[] };
  }
): SupportResistance[] {
  if (!klineData || klineData.length < 20) {
    return [];
  }

  const levels: SupportResistance[] = [];
  const recentData = klineData.slice(-20);
  const lastIdx = klineData.length - 1;

  // 1. 近期高低点
  const recentHigh = Math.max(...recentData.map(d => d.high));
  const recentLow = Math.min(...recentData.map(d => d.low));

  // 2. 均线支撑/压力
  if (indicators?.ma) {
    const maValues = [5, 10, 20, 60].filter(p => indicators.ma![p]);
    
    maValues.forEach(period => {
      const maValue = indicators.ma![period][lastIdx];
      if (maValue && Math.abs(maValue - currentPrice) / currentPrice < 0.05) {
        const type = maValue < currentPrice ? 'support' : 'resistance';
        const existing = levels.find(l => Math.abs(l.price - maValue) / maValue < 0.005);
        if (existing) {
          existing.sources.push(`MA${period}`);
          if (existing.sources.length >= 3) existing.strength = '强';
          else if (existing.sources.length >= 2) existing.strength = '中';
        } else {
          levels.push({
            price: maValue,
            type,
            strength: '弱',
            sources: [`MA${period}`],
          });
        }
      }
    });
  }

  // 3. 布林带支撑/压力
  if (indicators?.boll) {
    const upper = indicators.boll.upper[lastIdx];
    const lower = indicators.boll.lower[lastIdx];
    
    if (upper && Math.abs(upper - currentPrice) / currentPrice < 0.05) {
      const existing = levels.find(l => Math.abs(l.price - upper) / upper < 0.005);
      if (existing) {
        existing.sources.push('BOLL上轨');
        if (existing.sources.length >= 3) existing.strength = '强';
        else if (existing.sources.length >= 2) existing.strength = '中';
      } else {
        levels.push({
          price: upper,
          type: 'resistance',
          strength: '弱',
          sources: ['BOLL上轨'],
        });
      }
    }
    
    if (lower && Math.abs(lower - currentPrice) / currentPrice < 0.05) {
      const existing = levels.find(l => Math.abs(l.price - lower) / lower < 0.005);
      if (existing) {
        existing.sources.push('BOLL下轨');
        if (existing.sources.length >= 3) existing.strength = '强';
        else if (existing.sources.length >= 2) existing.strength = '中';
      } else {
        levels.push({
          price: lower,
          type: 'support',
          strength: '弱',
          sources: ['BOLL下轨'],
        });
      }
    }
  }

  // 4. 斐波那契回撤位
  const range = recentHigh - recentLow;
  if (range > 0) {
    const fibLevels = [
      { ratio: 0.382, name: 'Fib 0.382' },
      { ratio: 0.5, name: 'Fib 0.5' },
      { ratio: 0.618, name: 'Fib 0.618' },
    ];
    
    fibLevels.forEach(({ ratio, name }) => {
      const fibPrice = recentHigh - range * ratio;
      if (Math.abs(fibPrice - currentPrice) / currentPrice < 0.05) {
        const type = fibPrice < currentPrice ? 'support' : 'resistance';
        const existing = levels.find(l => Math.abs(l.price - fibPrice) / fibPrice < 0.005);
        if (existing) {
          existing.sources.push(name);
          if (existing.sources.length >= 3) existing.strength = '强';
          else if (existing.sources.length >= 2) existing.strength = '中';
        } else {
          levels.push({
            price: fibPrice,
            type,
            strength: '弱',
            sources: [name],
          });
        }
      }
    });
  }

  // 5. 近期高低点（如果没有其他指标重合）
  if (recentHigh > currentPrice * 1.01) {
    const existing = levels.find(l => Math.abs(l.price - recentHigh) / recentHigh < 0.005);
    if (!existing) {
      levels.push({
        price: recentHigh,
        type: 'resistance',
        strength: '中',
        sources: ['近期高点'],
      });
    }
  }
  
  if (recentLow < currentPrice * 0.99) {
    const existing = levels.find(l => Math.abs(l.price - recentLow) / recentLow < 0.005);
    if (!existing) {
      levels.push({
        price: recentLow,
        type: 'support',
        strength: '中',
        sources: ['近期低点'],
      });
    }
  }

  // 按价格排序，压力位从高到低，支撑位从低到高
  const resistances = levels
    .filter(l => l.type === 'resistance' && l.price > currentPrice)
    .sort((a, b) => a.price - b.price)
    .slice(0, 3);
    
  const supports = levels
    .filter(l => l.type === 'support' && l.price < currentPrice)
    .sort((a, b) => b.price - a.price)
    .slice(0, 3);

  return [...supports, ...resistances];
}

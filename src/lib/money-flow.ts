// 资金流向数据获取与解析
import type { KLineData } from './types';

// 资金流向数据类型
export interface MoneyFlowItem {
  date: string;
  mainNetInflow: number;      // 主力净流入（元）
  smallNetInflow: number;     // 小单净流入
  mediumNetInflow: number;    // 中单净流入
  largeNetInflow: number;     // 大单净流入
  superLargeNetInflow: number; // 超大单净流入
}

export interface MoneyFlowData {
  code: string;
  name: string;
  flows: MoneyFlowItem[];
  todayMainInflow: number;    // 今日主力净流入
  fiveDayMainInflow: number;  // 5日主力净流入
  tenDayMainInflow: number;   // 10日主力净流入
  twentyDayMainInflow: number; // 20日主力净流入
  rating: '强力吸筹' | '温和吸筹' | '资金平衡' | '温和流出' | '主力出逃';
  ratingDesc: string;
}

// 从东方财富API解析资金流向数据
export function parseMoneyFlowResponse(rawData: unknown): MoneyFlowItem[] {
  const flows: MoneyFlowItem[] = [];

  if (!rawData || typeof rawData !== 'object') return flows;

  const data = rawData as Record<string, unknown>;
  const dataObj = data?.data as Record<string, unknown> | undefined;
  const klines = dataObj?.klines as string[] | undefined;
  if (!Array.isArray(klines)) return flows;

  for (const line of klines) {
    const parts = line.split(',');
    if (parts.length < 6) continue;

    flows.push({
      date: parts[0],
      mainNetInflow: parseFloat(parts[1]) || 0,
      smallNetInflow: parseFloat(parts[2]) || 0,
      mediumNetInflow: parseFloat(parts[3]) || 0,
      largeNetInflow: parseFloat(parts[4]) || 0,
      superLargeNetInflow: parseFloat(parts[5]) || 0,
    });
  }

  return flows;
}

// 计算资金流向评级
export function calculateMoneyFlowRating(flows: MoneyFlowItem[]): {
  rating: MoneyFlowData['rating'];
  ratingDesc: string;
  todayMainInflow: number;
  fiveDayMainInflow: number;
  tenDayMainInflow: number;
  twentyDayMainInflow: number;
} {
  if (flows.length === 0) {
    return {
      rating: '资金平衡',
      ratingDesc: '暂无资金流向数据',
      todayMainInflow: 0,
      fiveDayMainInflow: 0,
      tenDayMainInflow: 0,
      twentyDayMainInflow: 0,
    };
  }

  const todayMainInflow = flows[flows.length - 1]?.mainNetInflow || 0;
  const fiveDayMainInflow = flows.slice(-5).reduce((sum, f) => sum + f.mainNetInflow, 0);
  const tenDayMainInflow = flows.slice(-10).reduce((sum, f) => sum + f.mainNetInflow, 0);
  const twentyDayMainInflow = flows.slice(-20).reduce((sum, f) => sum + f.mainNetInflow, 0);

  // 连续净流入天数
  let consecutiveInflowDays = 0;
  for (let i = flows.length - 1; i >= 0; i--) {
    if (flows[i].mainNetInflow > 0) {
      consecutiveInflowDays++;
    } else {
      break;
    }
  }

  // 连续净流出天数
  let consecutiveOutflowDays = 0;
  for (let i = flows.length - 1; i >= 0; i--) {
    if (flows[i].mainNetInflow < 0) {
      consecutiveOutflowDays++;
    } else {
      break;
    }
  }

  let rating: MoneyFlowData['rating'];
  let ratingDesc: string;

  if (consecutiveInflowDays >= 3) {
    rating = '强力吸筹';
    ratingDesc = `主力连续${consecutiveInflowDays}日净流入，累计${(fiveDayMainInflow / 10000).toFixed(0)}万元`;
  } else if (fiveDayMainInflow > 0 && todayMainInflow > 0) {
    rating = '温和吸筹';
    ratingDesc = '5日主力净流入为正，资金温和流入';
  } else if (Math.abs(fiveDayMainInflow) < Math.abs(todayMainInflow) * 2) {
    rating = '资金平衡';
    ratingDesc = '近期主力资金进出平衡';
  } else if (consecutiveOutflowDays >= 3) {
    rating = '主力出逃';
    ratingDesc = `主力连续${consecutiveOutflowDays}日净流出，累计${(Math.abs(fiveDayMainInflow) / 10000).toFixed(0)}万元`;
  } else {
    rating = '温和流出';
    ratingDesc = '5日主力净流入为负，资金温和流出';
  }

  return { rating, ratingDesc, todayMainInflow, fiveDayMainInflow, tenDayMainInflow, twentyDayMainInflow };
}

// 格式化金额显示
export function formatMoneyFlow(amount: number): string {
  const absAmount = Math.abs(amount);
  const sign = amount > 0 ? '+' : '';

  if (absAmount >= 100000000) {
    return `${sign}${(amount / 100000000).toFixed(2)}亿`;
  } else if (absAmount >= 10000) {
    return `${sign}${(amount / 10000).toFixed(0)}万`;
  } else {
    return `${sign}${amount.toFixed(0)}元`;
  }
}

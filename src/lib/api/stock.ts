import type { StockInfo, StockQuote, KLineData, KLinePeriod, MarketSentiment } from '@/lib/types';

// East Money API base URLs
const EASTMONEY_SEARCH_URL = 'https://searchapi.eastmoney.com/api/suggest/get';
const EASTMONEY_KLINE_URL = 'https://push2his.eastmoney.com/api/qt/stock/kline/get';
const EASTMONEY_QUOTE_URL = 'https://push2.eastmoney.com/api/qt/stock/get';
const EASTMONEY_MARKET_URL = 'https://push2.eastmoney.com/api/qt/clist/get';

// Market code mapping
function getMarketCode(code: string): string {
  if (code.startsWith('6') || code.startsWith('9')) return '1'; // Shanghai
  if (code.startsWith('0') || code.startsWith('2') || code.startsWith('3')) return '0'; // Shenzhen
  if (code.startsWith('4') || code.startsWith('8')) return '0'; // Beijing
  return '1';
}

function getSecId(code: string): string {
  return `${getMarketCode(code)}.${code}`;
}

// Search stocks
export async function searchStocks(keyword: string): Promise<StockInfo[]> {
  try {
    const params = new URLSearchParams({
      input: keyword,
      type: '14',
      token: 'D43BF722C8E33BDC906FB84D85E326E8',
      count: '20',
    });

    const res = await fetch(`${EASTMONEY_SEARCH_URL}?${params.toString()}`);
    const data = await res.json();

    if (!data.QuotationCodeTable?.Data) return [];

    return data.QuotationCodeTable.Data
      .filter((item: Record<string, string>) => {
        const type = item.MktNum;
        return type === '0' || type === '1' || type === '0';
      })
      .map((item: Record<string, string>) => ({
        code: item.Code,
        name: item.Name,
        market: item.MktNum === '1' ? 'sh' : item.MktNum === '0' ? 'sz' : 'bj',
        type: item.SecurityTypeName === 'ETF' ? 'etf' as const : 'stock' as const,
      }));
  } catch {
    return [];
  }
}

// Get real-time quote
export async function getQuote(code: string): Promise<StockQuote | null> {
  try {
    const secid = getSecId(code);
    const params = new URLSearchParams({
      secid,
      fields: 'f43,f44,f45,f46,f47,f48,f57,f58,f60,f169,f170,f171',
      ut: 'fa5fd1943c7b386f172d6893dbbd1',
    });

    const res = await fetch(`${EASTMONEY_QUOTE_URL}?${params.toString()}`);
    const data = await res.json();

    if (!data.data) return null;

    const d = data.data;
    const price = d.f43 / 100;
    const preClose = d.f60 / 100;
    const change = d.f169 / 100;
    const changePercent = d.f170 / 100;

    return {
      code: d.f57,
      name: d.f58,
      price,
      change,
      changePercent,
      open: d.f46 / 100,
      high: d.f44 / 100,
      low: d.f45 / 100,
      preClose,
      volume: d.f47,
      amount: d.f48,
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}

// Get K-line data
export async function getKLineData(
  code: string,
  period: KLinePeriod = 'daily',
  limit: number = 250
): Promise<KLineData[]> {
  try {
    const secid = getSecId(code);

    const periodMap: Record<KLinePeriod, string> = {
      daily: '101',
      weekly: '102',
      monthly: '103',
      '60min': '60',
      '30min': '30',
      '15min': '15',
      '5min': '5',
    };

    const params = new URLSearchParams({
      secid,
      fields1: 'f1,f2,f3,f4,f5,f6',
      fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
      klt: periodMap[period],
      fqt: '1',
      lmt: String(limit),
      end: '20500101',
      ut: 'fa5fd1943c7b386f172d6893dbbd1',
    });

    const res = await fetch(`${EASTMONEY_KLINE_URL}?${params.toString()}`);
    const data = await res.json();

    if (!data.data?.klines) return [];

    return data.data.klines.map((line: string) => {
      const parts = line.split(',');
      return {
        date: parts[0],
        open: parseFloat(parts[1]),
        close: parseFloat(parts[2]),
        high: parseFloat(parts[3]),
        low: parseFloat(parts[4]),
        volume: parseInt(parts[5]),
        amount: parseFloat(parts[6]),
      };
    });
  } catch {
    return [];
  }
}

// Get market sentiment data
export async function getMarketSentiment(): Promise<MarketSentiment | null> {
  try {
    // Get market overview - up/down counts
    const params = new URLSearchParams({
      pn: '1',
      pz: '1',
      po: '1',
      np: '1',
      fltt: '2',
      invt: '2',
      fid: 'f3',
      fs: 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048',
      fields: 'f2,f3,f4,f12,f14',
      ut: 'fa5fd1943c7b386f172d6893dbbd1',
    });

    const res = await fetch(`${EASTMONEY_MARKET_URL}?${params.toString()}`);
    const data = await res.json();

    if (!data.data) return null;

    const total = data.data.total || 5000;
    const diff = data.data.diff || [];

    // Calculate up/down/flat from sample
    let upCount = 0;
    let downCount = 0;
    let limitUpCount = 0;
    let limitDownCount = 0;

    for (const item of diff) {
      const changePercent = item.f3;
      if (changePercent > 0) upCount++;
      else if (changePercent < 0) downCount++;
      else downCount++;

      if (changePercent >= 9.9) limitUpCount++;
      if (changePercent <= -9.9) limitDownCount++;
    }

    // Extrapolate to full market
    const sampleSize = diff.length || 1;
    const ratio = total / sampleSize;
    upCount = Math.round(upCount * ratio);
    downCount = Math.round(downCount * ratio);
    const flatCount = total - upCount - downCount;

    // Heat score calculation
    const heatScore = Math.min(100, Math.round((upCount / total) * 100 * 1.5));

    return {
      upCount,
      downCount,
      flatCount: Math.max(0, flatCount),
      limitUpCount,
      limitDownCount,
      totalVolume: 0,
      avgVolume5d: 0,
      volumeRatio: 1,
      heatScore,
      sectorFlows: [
        { name: '电子', flow: Math.random() * 10 - 5 },
        { name: '计算机', flow: Math.random() * 10 - 5 },
        { name: '医药生物', flow: Math.random() * 10 - 5 },
        { name: '电力设备', flow: Math.random() * 10 - 5 },
        { name: '银行', flow: Math.random() * 10 - 5 },
      ],
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}

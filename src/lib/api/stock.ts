import type { StockInfo, StockQuote, KLineData, KLinePeriod, MarketSentiment } from '@/lib/types';
import { getQuote as mootdxGetQuote, getQuoteWithFallback, isMootdxAvailable, getIndexQuote, type MootdxQuoteData } from '@/lib/mootdx-client';

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

// Get real-time quote - mootdx primary, East Money fallback
export async function getQuote(code: string): Promise<StockQuote | null> {
  // Try mootdx first
  if (isMootdxAvailable()) {
    try {
      const mootdxQuote = await mootdxGetQuote(code);
      if (mootdxQuote) {
        const quote = convertMootdxQuote(mootdxQuote, code);
        if (quote) {
          return quote;
        }
      }
    } catch (error) {
      console.warn('[mootdx] getQuote failed, falling back to East Money:', error);
    }
  }

  // Fallback to East Money
  return getQuoteFromEastMoney(code);
}

// Convert mootdx quote to StockQuote format
function convertMootdxQuote(mootdxQuote: MootdxQuoteData, code: string): StockQuote | null {
  const price = mootdxQuote.price;
  const prevClose = mootdxQuote.preClose;
  if (!price || !prevClose) return null;

  const change = price - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    code,
    name: mootdxQuote.name || code,
    price,
    change,
    changePercent,
    volume: mootdxQuote.volume,
    high: mootdxQuote.high,
    low: mootdxQuote.low,
    open: mootdxQuote.open,
    preClose: prevClose,
    amount: mootdxQuote.amount,
    timestamp: Date.now(),
  };
}

// East Money quote (fallback)
async function getQuoteFromEastMoney(code: string): Promise<StockQuote | null> {
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

// Market index type
export interface MarketIndex {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

// Get market indices (上证/深证/创业板/科创50/恒生) - mootdx primary, East Money fallback
export async function getMarketIndices(): Promise<MarketIndex[]> {
  const indices = [
    { code: '1.000001', name: '上证指数' },
    { code: '0.399001', name: '深证成指' },
    { code: '0.399006', name: '创业板指' },
    { code: '1.000688', name: '科创50' },
    { code: '100.HSI', name: '恒生指数' },
  ];

  // Try mootdx first for index quotes
  if (isMootdxAvailable()) {
    try {
      const results: MarketIndex[] = [];
      for (const idx of indices) {
        const mootdxQuote = await getIndexQuote(idx.code);
        if (mootdxQuote) {
          results.push({
            code: idx.code,
            name: mootdxQuote.name || idx.name,
            price: mootdxQuote.price,
            change: mootdxQuote.price - mootdxQuote.preClose,
            changePercent: mootdxQuote.preClose > 0 
              ? ((mootdxQuote.price - mootdxQuote.preClose) / mootdxQuote.preClose) * 100 
              : 0,
          });
        }
      }
      if (results.length > 0) {
        return results;
      }
    } catch (error) {
      console.warn('[mootdx] getIndexQuote failed, falling back to East Money:', error);
    }
  }

  // Fallback to East Money
  return getMarketIndicesFromEastMoney(indices);
}

// East Money market indices (fallback)
async function getMarketIndicesFromEastMoney(indices: { code: string; name: string }[]): Promise<MarketIndex[]> {
  try {
    const secids = indices.map(i => i.code).join(',');
    const url = `${EASTMONEY_QUOTE_URL}?fltt=2&invt=2&fields=f2,f3,f4,f12,f14&secids=${secids}`;
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/',
      },
      next: { revalidate: 30 },
    });
    const json = await res.json();

    if (!json.data?.diff) return [];

    return json.data.diff.map((item: Record<string, unknown>, index: number) => ({
      code: String(item.f12 || indices[index].code),
      name: String(item.f14 || indices[index].name),
      price: Number(item.f2) || 0,
      change: Number(item.f4) || 0,
      changePercent: Number(item.f3) || 0,
    }));
  } catch {
    return [];
  }
}

// Sector types
export interface SectorInfo {
  name: string;
  code: string;
  changePercent: number;
  turnover: number;
  leadingStock: string;
  leadingStockChange: number;
}

// Get sector list from East Money
export async function getSectorList(): Promise<SectorInfo[]> {
  try {
    const url = 'https://push2.eastmoney.com/api/qt/clist/get';
    const params = new URLSearchParams({
      pn: '1',
      pz: '100',
      po: '1',
      np: '1',
      ut: 'bd1d9ddb04089700cf9c27f6f7426281',
      fltt: '2',
      invt: '2',
      fid: 'f3',
      fs: 'm:90+t:2',
      fields: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f26,f22,f33,f11,f62,f128,f136,f115,f152,f124,f107,f104,f105,f140,f141,f207,f208,f209,f222',
    });

    const response = await fetch(`${url}?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://quote.eastmoney.com/',
      },
    });
    const data = await response.json();

    if (!data?.data?.diff) return [];

    return data.data.diff.map((item: Record<string, unknown>) => ({
      name: item.f14 as string,
      code: item.f12 as string,
      changePercent: item.f3 as number,
      turnover: item.f8 as number,
      leadingStock: item.f128 as string || '',
      leadingStockChange: item.f136 as number || 0,
    }));
  } catch {
    return [];
  }
}

// Get sector stocks (constituents)
export async function getSectorStocks(sectorName: string): Promise<StockQuote[]> {
  try {
    const url = 'https://push2.eastmoney.com/api/qt/clist/get';
    const params = new URLSearchParams({
      pn: '1',
      pz: '50',
      po: '1',
      np: '1',
      ut: 'bd1d9ddb04089700cf9c27f6f7426281',
      fltt: '2',
      invt: '2',
      fid: 'f3',
      fs: `b:${sectorName}`,
      fields: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f26,f22,f33,f11,f62,f128,f136,f115,f152',
    });

    const response = await fetch(`${url}?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://quote.eastmoney.com/',
      },
    });
    const data = await response.json();

    if (!data?.data?.diff) return [];

    return data.data.diff.map((item: Record<string, unknown>) => ({
      code: item.f12 as string,
      name: item.f14 as string,
      price: item.f2 as number,
      change: item.f4 as number,
      changePercent: item.f3 as number,
      open: item.f17 as number,
      high: item.f15 as number,
      low: item.f16 as number,
      preClose: item.f18 as number,
      volume: item.f5 as number,
      amount: item.f6 as number,
      timestamp: Date.now(),
    }));
  } catch {
    return [];
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

// Paginated K-line data fetching for large datasets
export async function fetchKLineDataPaginated(
  code: string,
  period: KLinePeriod = 'daily',
  startDate?: string,
  endDate?: string,
  onProgress?: (progress: number) => void
): Promise<KLineData[]> {
  const BATCH_SIZE = 800;
  const allData: KLineData[] = [];
  
  // Estimate total bars needed based on period
  const periodDaysMap: Record<KLinePeriod, number> = {
    '5min': 48, // 48 5-min bars per day
    '15min': 16,
    '30min': 8,
    '60min': 4,
    'daily': 1,
    'weekly': 0.2,
    'monthly': 0.05,
  };
  
  let totalBars = 1000; // default
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    totalBars = Math.ceil(daysDiff * periodDaysMap[period]);
  }
  
  const totalBatches = Math.ceil(totalBars / BATCH_SIZE);
  let fetchedBars = 0;
  
  for (let batch = 0; batch < totalBatches; batch++) {
    const limit = Math.min(BATCH_SIZE, totalBars - fetchedBars);
    if (limit <= 0) break;
    
    const batchData = await getKLineData(code, period, limit);
    if (batchData.length === 0) break;
    
    // Merge data, avoiding duplicates
    for (const bar of batchData) {
      if (!allData.find(d => d.date === bar.date)) {
        allData.push(bar);
      }
    }
    
    fetchedBars += batchData.length;
    onProgress?.(Math.min(100, Math.round((fetchedBars / totalBars) * 100)));
    
    // If we got fewer bars than requested, we've reached the end
    if (batchData.length < limit) break;
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Sort by date
  allData.sort((a, b) => a.date.localeCompare(b.date));
  
  // Filter by date range if provided
  let result = allData;
  if (startDate) {
    result = result.filter(d => d.date >= startDate);
  }
  if (endDate) {
    result = result.filter(d => d.date <= endDate);
  }
  
  return result;
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

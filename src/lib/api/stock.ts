import type { StockInfo, StockQuote, KLineData, KLinePeriod, MarketSentiment } from '@/lib/types';
import { getKLineFromTushare } from '@/lib/tushare-client';

// 年 K 聚合函数：将月 K 数据按年份聚合
function aggregateYearlyKline(monthlyData: KLineData[]): KLineData[] {
  const yearMap = new Map<string, KLineData>();

  monthlyData.forEach((item) => {
    // 日期格式：YYYY-MM 或 YYYYMM
    const year = item.date.substring(0, 4);
    if (!year) return;

    const existing = yearMap.get(year);
    if (!existing) {
      yearMap.set(year, {
        date: `${year}-12-31`,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
        amount: item.amount,
      });
    } else {
      // 更新最高价、最低价、收盘价、成交量
      existing.high = Math.max(existing.high, item.high);
      existing.low = Math.min(existing.low, item.low);
      existing.close = item.close;
      existing.volume += item.volume;
      existing.amount += item.amount;
    }
  });

  // 按年份排序
  return Array.from(yearMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// Search stocks - 本地 stock_list 表优先（Tushare 全量同步）
export async function searchStocks(keyword: string): Promise<StockInfo[]> {
  const trimmed = keyword.trim();
  if (!trimmed) return [];

  // 本地数据库搜索（stock_list 表由 Tushare stock_basic 同步）
  try {
    const { queryRaw } = await import('@/lib/db');
    const { rows } = await queryRaw<{
      code: string;
      name: string;
      market: string;
    }>(
      `SELECT code, name, market
       FROM stock_list
       WHERE code LIKE $1 || '%' OR name ILIKE '%' || $1 || '%'
       ORDER BY
         CASE WHEN code LIKE $1 || '%' THEN 0 ELSE 1 END,
         code
       LIMIT 20`,
      [trimmed]
    );

    if (rows.length > 0) {
      return rows.map((r) => ({
        code: r.code,
        name: r.name,
        market: (r.market === 'sh' || r.market === 'bj' ? r.market : 'sz') as StockInfo['market'],
        type: 'stock' as const,
      }));
    }
  } catch (error) {
    console.warn('[search] local stock_list search failed:', error);
  }

  return [];
}

// Get real-time quote - 李富贵推送优先（配置的自选股），Tushare 日线降级
export async function getQuote(code: string): Promise<StockQuote | null> {
  // 1. 李富贵推送（realtime_market_params.watchlist_data 中配置的个股）
  try {
    const pushed = await getQuoteFromPush(code);
    if (pushed) return pushed;
  } catch (error) {
    console.warn('[quote] 李富贵推送查询失败:', error);
  }

  // 2. Tushare 日线降级（最近两个交易日，用昨收和最新收盘计算涨跌）
  try {
    const klines = await getKLineFromTushare(code, 'daily', 2);
    if (klines.length > 0) {
      const latest = klines[klines.length - 1];
      const prevClose = klines.length >= 2 ? klines[klines.length - 2].close : latest.open;
      const change = latest.close - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

      return {
        code,
        name: code,
        price: latest.close,
        change,
        changePercent,
        open: latest.open,
        high: latest.high,
        low: latest.low,
        preClose: prevClose,
        volume: latest.volume,
        amount: latest.amount,
        timestamp: Date.now(),
      };
    }
  } catch (error) {
    console.warn('[quote] Tushare 日线降级失败:', error);
  }

  return null;
}

// 从李富贵推送数据中获取个股行情
async function getQuoteFromPush(code: string): Promise<StockQuote | null> {
  const { queryRaw } = await import('@/lib/db');
  const { rows } = await queryRaw<{ watchlist_data: unknown }>(
    `SELECT watchlist_data FROM realtime_market_params ORDER BY timestamp DESC LIMIT 1`
  );
  if (rows.length === 0) return null;

  let data = rows[0].watchlist_data;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return null; }
  }
  if (!data || typeof data !== 'object') return null;

  const record = data as { stock?: Array<{ code: string; name: string; price?: number; change_pct?: number }> };
  const stocks = Array.isArray(record.stock) ? record.stock : [];
  const cleanCode = code.replace(/[^0-9]/g, '');
  const item = stocks.find((s) => s.code.replace(/[^0-9]/g, '') === cleanCode);
  if (!item || typeof item.price !== 'number') return null;

  const changePct = typeof item.change_pct === 'number' ? item.change_pct : 0;
  const preClose = changePct !== -100 ? item.price / (1 + changePct / 100) : item.price;
  const change = item.price - preClose;

  return {
    code: cleanCode,
    name: item.name || cleanCode,
    price: item.price,
    change,
    changePercent: changePct,
    open: item.price, // 推送不含 OHLC，用最新价近似
    high: item.price,
    low: item.price,
    preClose,
    volume: 0,
    amount: 0,
    timestamp: Date.now(),
  };
}

// Market index type
export interface MarketIndex {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

// Get market indices (上证/深证/创业板) - 李富贵推送优先，Tushare 指数日线降级
export async function getMarketIndices(): Promise<MarketIndex[]> {
  // 1. 李富贵推送（realtime_market_params 最新一行）
  try {
    const pushed = await getIndicesFromPush();
    if (pushed.length > 0) return pushed;
  } catch (error) {
    console.warn('[indices] 李富贵推送查询失败:', error);
  }

  // 2. Tushare 指数日线降级
  try {
    const { callTushare } = await import('@/lib/tushare-client');
    const indexDefs = [
      { tsCode: '000001.SH', code: '1.000001', name: '上证指数' },
      { tsCode: '399001.SZ', code: '0.399001', name: '深证成指' },
      { tsCode: '399006.SZ', code: '0.399006', name: '创业板指' },
    ];
    const results: MarketIndex[] = [];
    for (const idx of indexDefs) {
      const rows = await callTushare(
        'index_daily',
        { ts_code: idx.tsCode, limit: '2' },
        'close,pre_close,pct_chg'
      );
      if (rows.length > 0) {
        const latest = rows[0]; // index_daily 返回降序
        const close = Number(latest.close) || 0;
        const preClose = Number(latest.pre_close) || 0;
        results.push({
          code: idx.code,
          name: idx.name,
          price: close,
          change: close - preClose,
          changePercent: Number(latest.pct_chg) || 0,
        });
      }
    }
    if (results.length > 0) return results;
  } catch (error) {
    console.warn('[indices] Tushare 指数降级失败:', error);
  }

  return [];
}

// 从李富贵推送数据中获取大盘指数
async function getIndicesFromPush(): Promise<MarketIndex[]> {
  const { queryRaw } = await import('@/lib/db');
  const { rows } = await queryRaw<{
    sh_price: number | string | null;
    sh_change_pct: number | string | null;
    sz_price: number | string | null;
    sz_change_pct: number | string | null;
    cyb_price: number | string | null;
    cyb_change_pct: number | string | null;
  }>(
    `SELECT sh_price, sh_change_pct, sz_price, sz_change_pct, cyb_price, cyb_change_pct
     FROM realtime_market_params ORDER BY timestamp DESC LIMIT 1`
  );
  if (rows.length === 0) return [];

  const row = rows[0];
  const toNum = (v: number | string | null): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const results: MarketIndex[] = [];
  const defs = [
    { price: toNum(row.sh_price), pct: Number(row.sh_change_pct) || 0, code: '1.000001', name: '上证指数' },
    { price: toNum(row.sz_price), pct: Number(row.sz_change_pct) || 0, code: '0.399001', name: '深证成指' },
    { price: toNum(row.cyb_price), pct: Number(row.cyb_change_pct) || 0, code: '0.399006', name: '创业板指' },
  ];
  for (const d of defs) {
    if (d.price !== null) {
      const preClose = d.pct !== -100 ? d.price / (1 + d.pct / 100) : d.price;
      results.push({
        code: d.code,
        name: d.name,
        price: d.price,
        change: d.price - preClose,
        changePercent: d.pct,
      });
    }
  }
  return results;
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
// @deprecated 东方财富是板块功能唯一数据源（限流风险），待 Tushare 板块接口替代

// Get sector stocks (constituents)
// @deprecated 东方财富是板块功能唯一数据源（限流风险），待 Tushare 板块接口替代

// Get K-line data - Tushare 主数据源（前复权，日/周/月）
export async function getKLineData(
  code: string,
  period: KLinePeriod = 'daily',
  limit: number = 250
): Promise<KLineData[]> {
  // 分钟级 K 线：Tushare 2000 积分不支持（stk_mins 需 5000 积分），已废弃
  if (period === 'minute' || period === '5min' || period === '15min' || period === '30min' || period === '60min') {
    return [];
  }

  try {
    // 年 K：拉月 K 后按年聚合
    if (period === 'yearly') {
      const monthly = await getKLineFromTushare(code, 'monthly', Math.max(limit * 12, 120));
      return aggregateYearlyKline(monthly);
    }

    const tsPeriod = period === 'weekly' ? 'weekly' : period === 'monthly' ? 'monthly' : 'daily';
    return await getKLineFromTushare(code, tsPeriod, limit);
  } catch (error) {
    console.warn('[kline] Tushare 获取失败:', error);
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
    'minute': 240, // 240 minutes per day
    '5min': 48, // 48 5-min bars per day
    '15min': 16,
    '30min': 8,
    '60min': 4,
    'daily': 1,
    'weekly': 0.2,
    'monthly': 0.05,
    'yearly': 0.003, // ~1 bar per year
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

// Get market sentiment data - 李富贵推送（realtime_market_params 市场广度字段）

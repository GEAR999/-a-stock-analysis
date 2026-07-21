import { NextRequest, NextResponse } from 'next/server';
import { searchStocks, getQuote, getKLineData, getMarketSentiment, getSectorList, getSectorStocks, getMarketIndices } from '@/lib/api/stock';
import { calculateStockSentiment } from '@/lib/analysis';
import { calculateSectorSentiment } from '@/services/sentiment/sector-sentiment';
import { fetchComprehensiveSentiment } from '@/services/sentiment/sentiment-panel';
import { crossValidateQuote, crossValidateKline } from '@/lib/data-validator-xref';
import { recordRequest, checkRecovery } from '@/lib/monitor';
import type { KLinePeriod, StockQuote } from '@/lib/types';

// 缓存：板块数据5分钟，个股数据1分钟
const cache = new Map<string, { data: unknown; timestamp: number }>();
const SECTOR_CACHE_TTL = 5 * 60 * 1000; // 5分钟
const STOCK_CACHE_TTL = 60 * 1000; // 1分钟

function getFromCache<T>(key: string, ttl: number): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data as T;
  }
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, timestamp: Date.now() });
}

// 计算板块情绪（基于板块内个股数据）- 本地版本，返回简化结构
function calculateSectorSentimentLocal(sectorName: string, stocks: Array<{ code: string; name: string; changePercent: number; volume: number; turnoverRate: number }>) {
  const upCount = stocks.filter(s => s.changePercent > 0).length;
  const downCount = stocks.filter(s => s.changePercent < 0).length;
  const totalStocks = stocks.length;
  
  // 板块涨跌比 (25%)
  const upRatio = totalStocks > 0 ? upCount / totalStocks : 0.5;
  const upRatioScore = Math.min(100, upRatio * 100);
  
  // 平均涨幅（龙头强度）(20%)
  const avgChange = stocks.reduce((sum, s) => sum + s.changePercent, 0) / (totalStocks || 1);
  const top3AvgGain = stocks.sort((a, b) => b.changePercent - a.changePercent).slice(0, 3).reduce((sum, s) => sum + s.changePercent, 0) / 3;
  const leaderScore = Math.min(100, Math.max(0, (top3AvgGain + 5) * 10));
  
  // 平均换手率 (15%)
  const avgTurnover = stocks.reduce((sum, s) => sum + (s.turnoverRate || 0), 0) / (totalStocks || 1);
  const turnoverScore = Math.min(100, avgTurnover * 10);
  
  // 资金流向（模拟）(25%)
  const netInflow = stocks.reduce((sum, s) => sum + (s.changePercent > 0 ? s.volume : -s.volume) * 0.1, 0);
  const flowScore = Math.min(100, Math.max(0, 50 + netInflow / 1000000));
  
  // 持续性（模拟）(15%)
  const consecutiveScore = avgChange > 0 ? 60 : 40;
  
  // 综合评分
  const totalScore = upRatioScore * 0.25 + flowScore * 0.25 + leaderScore * 0.20 + turnoverScore * 0.15 + consecutiveScore * 0.15;
  
  const level = totalScore > 80 ? '爆热' : totalScore > 60 ? '热门' : totalScore > 40 ? '温和' : '冷门';
  
  return {
    name: sectorName,
    score: Math.round(totalScore),
    level,
    upCount,
    downCount,
    totalStocks,
    avgChange: avgChange.toFixed(2),
    top3AvgGain: top3AvgGain.toFixed(2),
    avgTurnover: avgTurnover.toFixed(2),
    details: [
      {
        name: '板块涨跌比',
        score: Math.round(upRatioScore),
        weight: 25,
        value: `${upCount}/${totalStocks} (${(upRatio * 100).toFixed(1)}%)`,
        description: '板块内上涨家数占比，反映板块整体强弱',
        calculation: `上涨${upCount}家 / 总计${totalStocks}家 = ${(upRatio * 100).toFixed(1)}%`,
        impact: upRatio > 0.6 ? '板块强势，多数个股上涨' : upRatio > 0.4 ? '板块分化，涨跌互现' : '板块弱势，多数个股下跌',
      },
      {
        name: '主力资金流向',
        score: Math.round(flowScore),
        weight: 25,
        value: `${netInflow > 0 ? '净流入' : '净流出'} ${Math.abs(netInflow / 10000).toFixed(1)}万`,
        description: '板块内资金净流入/流出情况',
        calculation: `基于个股涨跌幅和成交量估算`,
        impact: netInflow > 0 ? '资金流入，看多信号' : '资金流出，看空信号',
      },
      {
        name: '龙头股强度',
        score: Math.round(leaderScore),
        weight: 20,
        value: `Top3均涨 ${top3AvgGain.toFixed(2)}%`,
        description: '板块内领涨股的平均涨幅',
        calculation: `涨幅前3的股票平均涨幅: ${top3AvgGain.toFixed(2)}%`,
        impact: top3AvgGain > 3 ? '龙头强势，带动效应明显' : top3AvgGain > 0 ? '龙头温和上涨' : '龙头走弱',
      },
      {
        name: '板块换手率',
        score: Math.round(turnoverScore),
        weight: 15,
        value: `平均 ${avgTurnover.toFixed(2)}%`,
        description: '板块内个股平均换手率，反映活跃度',
        calculation: `所有个股换手率平均值: ${avgTurnover.toFixed(2)}%`,
        impact: avgTurnover > 5 ? '交投活跃' : avgTurnover > 2 ? '交投正常' : '交投清淡',
      },
      {
        name: '板块持续性',
        score: consecutiveScore,
        weight: 15,
        value: avgChange > 0 ? '上涨趋势' : '下跌趋势',
        description: '板块近期走势的持续性',
        calculation: `基于板块平均涨幅 ${avgChange.toFixed(2)}% 判断`,
        impact: avgChange > 1 ? '持续走强' : avgChange > 0 ? '温和上涨' : '走势偏弱',
      },
    ],
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const code = searchParams.get('code');
  const period = (searchParams.get('period') || 'daily') as KLinePeriod;
  const keyword = searchParams.get('keyword');
  const sector = searchParams.get('sector');
  const limit = parseInt(searchParams.get('limit') || '250');

  // 检查是否有数据源已恢复
  await checkRecovery();

  try {
    switch (action) {
      case 'search': {
        if (!keyword) return NextResponse.json({ error: 'Missing keyword' }, { status: 400 });
        const results = await searchStocks(keyword);
        return NextResponse.json({ success: true, data: results });
      }
      case 'quote': {
        if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });
        const startTime = Date.now();
        const quote = await getQuote(code);
        if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
        
        // 交叉验证（非阻塞）
        const { data: verifiedData, validation } = await crossValidateQuote(quote);
        const responseData = verifiedData || quote;
        
        // 记录请求统计
        recordRequest(!!responseData, Date.now() - startTime, validation.overridden);
        
        return NextResponse.json({
          success: true,
          data: responseData,
          verified: validation.verified,
          validationSource: validation.source,
          validationDiff: validation.diffPercent,
        });
      }
      case 'kline': {
        if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });
        const klineData = await getKLineData(code, period, limit);
        
        // 交叉验证K线数据
        if (klineData && klineData.length > 0) {
          const { data: validatedKline, validation: klineValidation } = await crossValidateKline(
            code,
            klineData,
            period
          );
          
          return NextResponse.json({
            success: true,
            data: validatedKline,
            verified: klineValidation.verified,
            validationSource: klineValidation.source,
            overridden: klineValidation.overridden,
            fullSwitch: klineValidation.fullSwitch,
          });
        }
        
        return NextResponse.json({ success: true, data: klineData });
      }
      case 'sentiment': {
        const sentiment = await getMarketSentiment();
        if (!sentiment) return NextResponse.json({ error: 'Sentiment data unavailable' }, { status: 500 });
        return NextResponse.json({ success: true, data: sentiment });
      }
      case 'market_indices': {
        const indices = await getMarketIndices();
        return NextResponse.json({ success: true, data: indices });
      }
      case 'sector_list': {
        // 获取板块列表
        const cachedList = getFromCache<string[]>('sector_list', SECTOR_CACHE_TTL);
        if (cachedList) {
          return NextResponse.json({ success: true, data: cachedList });
        }
        const sectorList = await getSectorList();
        setCache('sector_list', sectorList);
        return NextResponse.json({ success: true, data: sectorList });
      }
      case 'sector_sentiment': {
        if (!sector) return NextResponse.json({ error: 'Missing sector name' }, { status: 400 });
        
        // 检查缓存
        const cacheKey = `sector_${sector}`;
        const cached = getFromCache<ReturnType<typeof calculateSectorSentiment>>(cacheKey, SECTOR_CACHE_TTL);
        if (cached) {
          return NextResponse.json({ success: true, data: cached });
        }
        
        // 获取板块成分股
        const stocks = await getSectorStocks(sector);
        if (!stocks || stocks.length === 0) {
          return NextResponse.json({ error: 'Sector not found or no stocks' }, { status: 404 });
        }
        
        // 计算板块情绪 - 从股票列表计算SectorData
        const upCount = stocks.filter(s => s.changePercent > 0).length;
        const totalStocks = stocks.length;
        const topStocks = [...stocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3);
        const top3AvgGain = topStocks.reduce((sum, s) => sum + s.changePercent, 0) / 3;
        const avgChange = stocks.reduce((sum, s) => sum + s.changePercent, 0) / (totalStocks || 1);
        
        // 计算真实的换手率（从股票数据中获取，如果没有则显示暂无数据）
        const avgTurnover = stocks.reduce((sum, s) => {
          const stock = s as StockQuote & { turnoverRate?: number };
          return sum + (stock.turnoverRate || 0);
        }, 0) / (totalStocks || 1);
        // 连涨天数需要历史数据，这里基于当前平均涨幅估算
        const consecutiveUpDays = avgChange > 0 ? Math.min(5, Math.round(avgChange)) : 0;
        
        const sectorData = {
          upCount,
          totalStocks,
          netInflow: stocks.reduce((sum, s) => sum + (s.volume || 0) * (s.changePercent > 0 ? 1 : -1), 0) * 1000,
          marketCap: stocks.reduce((sum, s) => sum + (s.volume || 0) * 10000, 0),
          turnoverRate: avgTurnover,
          top3AvgGain,
          consecutiveUpDays,
        };
        
        const sentiment = calculateSectorSentiment(sectorData);
        setCache(cacheKey, sentiment);
        return NextResponse.json({ success: true, data: sentiment });
      }
      case 'stock_sentiment': {
        if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });
        
        // 检查缓存
        const cacheKey = `stock_${code}`;
        const cached = getFromCache<ReturnType<typeof calculateStockSentiment>>(cacheKey, STOCK_CACHE_TTL);
        if (cached) {
          return NextResponse.json({ success: true, data: cached });
        }
        
        const [quote, klineData] = await Promise.all([
          getQuote(code),
          getKLineData(code, 'daily', 60),
        ]);
        if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
        const stockSentiment = calculateStockSentiment(klineData, quote);
        setCache(cacheKey, stockSentiment);
        return NextResponse.json({ success: true, data: stockSentiment });
      }
      case 'comprehensive_sentiment': {
        const comprehensive = fetchComprehensiveSentiment(sector || undefined, code || undefined);
        return NextResponse.json({ success: true, data: comprehensive });
      }
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { searchStocks, getQuote } from '@/lib/api/stock';
import type { KLinePeriod } from '@/lib/types';

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

  try {
    switch (action) {
      case 'search': {
        if (!keyword) return NextResponse.json({ error: 'Missing keyword' }, { status: 400 });
        const results = await searchStocks(keyword);
        return NextResponse.json({ success: true, data: results });
      }
      case 'quote': {
        if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });
        const quote = await getQuote(code);
        if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
        
        return NextResponse.json({
          success: true,
          data: quote,
        });
      }
      case 'minute': {
        // 分时图已废弃：mootdx 数据源已下线，Tushare 2000 积分不支持分钟数据
        return NextResponse.json(
          { error: '分时图功能已下线（分钟级数据源不可用）' },
          { status: 410 }
        );
      }
            case 'kline': {
        if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });
        
        // 使用统一数据源管理器（自动降级 + 请求队列）
        const { fetchKLineData, ERROR_MESSAGES } = await import('@/lib/data-source');
        const result = await fetchKLineData(code, period as any, {
          limit,
          config: {
            // 实时数据（日 K<=5 条或分钟线）：mootdx → 东方财富 → 缓存
            // 历史数据：Tushare → 缓存 → 东方财富
            priority: undefined, // 让 data-source.ts 自动判断
          }
        });
        
        // 记录错误日志
        if (!result.success) {
          console.error('[DataSource] Kline fetch failed:', {
            code,
            period,
            limit,
            error: result.error,
            source: result.source,
            timestamp: new Date().toISOString(),
          });
        }
        
        // 返回结果
        if (result.success && result.data.length > 0) {
          return NextResponse.json({
            success: true,
            data: result.data,
            source: result.source,
          });
        }
        
        // 返回错误信息（面向用户）
        const errorInfo = result.error ? ERROR_MESSAGES[result.error] : null;
        return NextResponse.json({ 
          success: false,
          data: result.data,
          source: result.source,
          error: result.error,
          errorMessage: errorInfo?.message || '数据加载失败',
          suggestion: errorInfo?.suggestion || '请稍后重试',
        });
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

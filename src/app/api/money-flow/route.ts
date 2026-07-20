import { NextRequest, NextResponse } from 'next/server';

// 缓存5分钟
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getFromCache<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, timestamp: Date.now() });
}

// 获取股票代码对应的secid
function getSecId(code: string): string {
  if (code.startsWith('6')) return `1.${code}`;
  return `0.${code}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ success: false, error: '缺少股票代码参数' }, { status: 400 });
  }

  const cacheKey = `money_flow:${code}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    return NextResponse.json({ success: true, data: cached, fromCache: true });
  }

  try {
    const secid = getSecId(code);
    const url = `https://push2.eastmoney.com/api/qt/stock/fflow/kline/get?secid=${secid}&klt=101&lmt=30&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://data.eastmoney.com/',
      },
      next: { revalidate: 300 },
    });

    const json = await res.json();
    setCache(cacheKey, json);
    return NextResponse.json({ success: true, data: json });
  } catch (error) {
    console.error('[API] 资金流向请求失败:', error);
    return NextResponse.json({ success: false, error: '资金流向数据获取失败' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';

// 缓存30分钟（财务数据变化不频繁）
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000;

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ success: false, error: '缺少股票代码参数' }, { status: 400 });
  }

  const cacheKey = `financial:${code}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    return NextResponse.json({ success: true, data: cached, fromCache: true });
  }

  try {
    // 东方财富财务指标API
    const url = `https://datacenter.eastmoney.com/securities/api/data/get`;
    const params = new URLSearchParams({
      type: 'RPT_F10_FINANCE_MAINFINADATA',
      sty: 'ALL',
      filter: `(SECURITY_CODE="${code}")`,
      p: '1',
      ps: '1',
      sr: '-1',
      st: 'REPORT_DATE',
    });

    const res = await fetch(`${url}?${params.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://emweb.securities.eastmoney.com/',
      },
      next: { revalidate: 1800 },
    });

    const json = await res.json();
    setCache(cacheKey, json);
    return NextResponse.json({ success: true, data: json });
  } catch (error) {
    console.error('[API] 财务数据请求失败:', error);
    return NextResponse.json({ success: false, error: '财务数据获取失败' }, { status: 500 });
  }
}

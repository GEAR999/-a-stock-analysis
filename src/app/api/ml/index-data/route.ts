import { NextRequest, NextResponse } from 'next/server';
import { getIndexKLineData } from '@/lib/tushare-client';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const start = req.nextUrl.searchParams.get('start') || '19900101';
  const end = req.nextUrl.searchParams.get('end') || '20260801';

  if (!code) {
    return NextResponse.json({ error: '缺少 code 参数' }, { status: 400 });
  }

  try {
    const data = await getIndexKLineData(code, start, end);
    return NextResponse.json({ success: true, data, count: data.length });
  } catch (err: any) {
    console.error('[ML/IndexData] 获取指数数据失败:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
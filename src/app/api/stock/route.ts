import { NextRequest, NextResponse } from 'next/server';
import { searchStocks, getQuote, getKLineData, getMarketSentiment } from '@/lib/api/stock';
import { calculateStockSentiment } from '@/lib/analysis';
import type { KLinePeriod } from '@/lib/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const code = searchParams.get('code');
  const period = (searchParams.get('period') || 'daily') as KLinePeriod;
  const keyword = searchParams.get('keyword');
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
        return NextResponse.json({ success: true, data: quote });
      }
      case 'kline': {
        if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });
        const klineData = await getKLineData(code, period, limit);
        return NextResponse.json({ success: true, data: klineData });
      }
      case 'sentiment': {
        const sentiment = await getMarketSentiment();
        if (!sentiment) return NextResponse.json({ error: 'Sentiment data unavailable' }, { status: 500 });
        return NextResponse.json({ success: true, data: sentiment });
      }
      case 'stock_sentiment': {
        if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });
        const [quote, klineData] = await Promise.all([
          getQuote(code),
          getKLineData(code, 'daily', 60),
        ]);
        if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
        const stockSentiment = calculateStockSentiment(klineData, quote);
        return NextResponse.json({ success: true, data: stockSentiment });
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

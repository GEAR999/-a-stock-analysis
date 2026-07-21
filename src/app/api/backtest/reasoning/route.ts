import { NextRequest, NextResponse } from 'next/server';

/**
 * AI买卖依据生成 API
 * 接收K线数据快照和技术指标，调用DeepSeek生成交易理由
 */

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, strategy, direction, tradeDate, stockCode, stockName, klineData, indicators } = body;

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: 'AI服务未配置' },
        { status: 500 }
      );
    }

    // 构建prompt（如果前端没传，则从数据构建）
    let userPrompt = prompt;
    if (!userPrompt) {
      // 从数据构建prompt
      const { buildReasoningPrompt } = await import('@/lib/backtest-reasoning');
      userPrompt = buildReasoningPrompt({
        strategy,
        direction,
        tradeDate,
        tradePrice: klineData?.[klineData.length - 1]?.close || 0,
        stockCode,
        stockName,
        klineData: klineData || [],
        indicators: indicators || {},
      });
    }

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一位专业的A股技术分析师，擅长解读K线形态和技术指标。请基于真实数据分析交易信号的依据，绝不编造数据。回答简洁专业，200字以内。',
          },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('DeepSeek API error:', errText);
      return NextResponse.json(
        { ok: false, error: 'AI服务请求失败' },
        { status: 502 }
      );
    }

    const data = await response.json();
    const reasoning = data.choices?.[0]?.message?.content || '依据生成失败';

    return NextResponse.json({
      ok: true,
      data: {
        reasoning,
        strategy,
        direction,
        tradeDate,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('POST /api/backtest/reasoning error:', error);
    return NextResponse.json(
      { ok: false, error: 'AI依据生成失败' },
      { status: 500 }
    );
  }
}

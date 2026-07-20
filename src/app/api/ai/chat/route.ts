import { NextRequest, NextResponse } from 'next/server';

/**
 * DeepSeek AI Chat API Proxy
 * 
 * 前端请求 → 本API → DeepSeek API
 * API Key 仅存在于服务端环境变量中
 */

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// 系统提示词
const SYSTEM_PROMPT = `你是一个专业的A股市场分析师AI助手，名叫"智析助手"。你具备以下能力：

1. **技术分析**：K线形态、均线系统、MACD/KDJ/RSI/布林带等指标解读
2. **缠论分析**：笔、线段、中枢、买卖点判断
3. **波浪理论**：当前浪形判断和趋势预判
4. **量化策略**：回测结果解读、策略优化建议
5. **风险管理**：仓位控制、止盈止损建议

回答要求：
- 简洁专业，不说废话
- 给出明确观点，不模棱两可
- 风险提示放在最后
- 使用中文回答
- 适当使用Markdown格式增强可读性`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, context } = body;

    // 验证 API Key
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI服务未配置，请联系管理员设置 DEEPSEEK_API_KEY' },
        { status: 500 }
      );
    }

    // 构建系统消息（包含上下文）
    let systemContent = SYSTEM_PROMPT;
    
    if (context) {
      systemContent += '\n\n---\n当前用户上下文数据：\n';
      
      if (context.stock) {
        systemContent += `\n【当前股票】${context.stock.name}(${context.stock.code})\n`;
        if (context.stock.price) systemContent += `当前价格: ${context.stock.price}\n`;
        if (context.stock.change) systemContent += `涨跌幅: ${context.stock.change}%\n`;
      }
      
      if (context.signals && context.signals.length > 0) {
        systemContent += `\n【技术信号】\n`;
        context.signals.forEach((s: string) => {
          systemContent += `- ${s}\n`;
        });
      }
      
      if (context.indicators) {
        systemContent += `\n【技术指标】\n`;
        if (context.indicators.macd) systemContent += `MACD: ${JSON.stringify(context.indicators.macd)}\n`;
        if (context.indicators.kdj) systemContent += `KDJ: ${JSON.stringify(context.indicators.kdj)}\n`;
        if (context.indicators.rsi) systemContent += `RSI: ${context.indicators.rsi}\n`;
      }
      
      if (context.chanlun) {
        systemContent += `\n【缠论分析】${context.chanlun}\n`;
      }
      
      if (context.wave) {
        systemContent += `\n【波浪理论】${context.wave}\n`;
      }
      
      if (context.position) {
        systemContent += `\n【持仓信息】\n`;
        systemContent += `持仓股票: ${context.position.stockCount}只\n`;
        systemContent += `总市值: ${context.position.totalValue}\n`;
        systemContent += `总盈亏: ${context.position.totalProfit}(${context.position.totalProfitPercent}%)\n`;
      }
      
      if (context.market) {
        systemContent += `\n【大盘数据】\n`;
        if (context.market.shanghai) systemContent += `上证指数: ${context.market.shanghai}\n`;
        if (context.market.shenzhen) systemContent += `深证成指: ${context.market.shenzhen}\n`;
        if (context.market.chinext) systemContent += `创业板指: ${context.market.chinext}\n`;
      }
      
      if (context.backtest) {
        systemContent += `\n【回测结果】${context.backtest}\n`;
      }
    }

    // 构建消息列表
    const chatMessages = [
      { role: 'system', content: systemContent },
      ...messages
    ];

    // 调用 DeepSeek API
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: chatMessages,
        stream: true,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DeepSeek API Error]', response.status, errorText);
      
      // 根据错误类型返回不同提示
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'AI服务认证失败，请检查 API Key 配置' },
          { status: 500 }
        );
      }
      if (response.status === 429) {
        return NextResponse.json(
          { error: 'AI服务请求过于频繁，请稍后再试' },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { error: `AI服务暂时不可用 (${response.status})` },
        { status: 500 }
      );
    }

    // 流式转发响应
    const reader = response.body?.getReader();
    if (!reader) {
      return NextResponse.json(
        { error: 'AI服务响应异常' },
        { status: 500 }
      );
    }

    // 创建 ReadableStream 用于流式响应
    const stream = new ReadableStream({
      async start(controller) {
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === 'data: [DONE]') continue;
              if (!trimmed.startsWith('data: ')) continue;

              try {
                const json = JSON.parse(trimmed.slice(6));
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
              } catch {
                // 忽略解析错误
              }
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('[Stream Error]', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('[AI Chat Error]', error);
    return NextResponse.json(
      { error: 'AI服务内部错误' },
      { status: 500 }
    );
  }
}

// 非流式接口（用于简单请求）
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    message: 'AI Chat API is running',
    features: ['stream', 'context-injection']
  });
}

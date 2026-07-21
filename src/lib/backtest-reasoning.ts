// AI买卖依据生成器 - 基于真实K线数据生成交易理由
import type { StrategyType } from '@/lib/backtest-engine';

// K线数据快照
export interface KLineSnapshot {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// 技术指标快照
export interface IndicatorSnapshot {
  macd?: { dif: number; dea: number; histogram: number };
  kdj?: { k: number; d: number; j: number };
  rsi?: number;
  boll?: { upper: number; middle: number; lower: number };
  ma?: Record<number, number>;
}

// 交易依据请求
export interface ReasoningRequest {
  strategy: StrategyType;
  direction: 'buy' | 'sell';
  tradeDate: string;
  tradePrice: number;
  stockCode: string;
  stockName: string;
  // 交易时刻前后10日K线数据
  klineData: KLineSnapshot[];
  // 技术指标值
  indicators: IndicatorSnapshot;
}

// 交易依据响应
export interface ReasoningResult {
  strategy: StrategyType;
  direction: 'buy' | 'sell';
  tradeDate: string;
  reasoning: string;
  generatedAt: string;
}

// 策略名称映射
const STRATEGY_NAMES: Record<StrategyType, string> = {
  macd_golden_cross: 'MACD金叉',
  macd_death_cross: 'MACD死叉',
  kdj_oversold: 'KDJ超卖金叉',
  kdj_overbought: 'KDJ超买死叉',
  rsi_oversold: 'RSI超卖',
  rsi_overbought: 'RSI超买',
  boll_lower_touch: '布林下轨支撑',
  boll_upper_touch: '布林上轨压力',
  ma_golden_cross: '均线金叉(5/20)',
  ma_death_cross: '均线死叉(5/20)',
  chanlun_buy: '缠论买点',
  chanlun_sell: '缠论卖点',
  wave_buy: '波浪起点买入',
  wave_sell: '波浪终点卖出',
  tech_resonance_buy: '指标共振买入',
  tech_resonance_sell: '指标共振卖出',
};

// 构建Prompt
export function buildReasoningPrompt(req: ReasoningRequest): string {
  const strategyName = STRATEGY_NAMES[req.strategy] || req.strategy;
  const directionText = req.direction === 'buy' ? '买入' : '卖出';

  // 格式化K线数据表
  const klineTable = req.klineData
    .map(k => `${k.date} | ${k.open.toFixed(2)} | ${k.close.toFixed(2)} | ${k.high.toFixed(2)} | ${k.low.toFixed(2)} | ${Math.round(k.volume)}`)
    .join('\n');

  // 格式化技术指标
  const indicatorLines: string[] = [];
  if (req.indicators.macd) {
    indicatorLines.push(`MACD(12,26,9): DIF=${req.indicators.macd.dif.toFixed(4)}, DEA=${req.indicators.macd.dea.toFixed(4)}, MACD柱=${req.indicators.macd.histogram.toFixed(4)}`);
  }
  if (req.indicators.kdj) {
    indicatorLines.push(`KDJ(9,3,3): K=${req.indicators.kdj.k.toFixed(2)}, D=${req.indicators.kdj.d.toFixed(2)}, J=${req.indicators.kdj.j.toFixed(2)}`);
  }
  if (req.indicators.rsi !== undefined) {
    indicatorLines.push(`RSI(14): ${req.indicators.rsi.toFixed(2)}`);
  }
  if (req.indicators.boll) {
    indicatorLines.push(`BOLL(20,2): 上轨=${req.indicators.boll.upper.toFixed(2)}, 中轨=${req.indicators.boll.middle.toFixed(2)}, 下轨=${req.indicators.boll.lower.toFixed(2)}`);
  }
  if (req.indicators.ma) {
    const maStr = Object.entries(req.indicators.ma)
      .map(([p, v]) => `MA${p}=${v.toFixed(2)}`)
      .join(', ');
    indicatorLines.push(maStr);
  }

  const indicatorsText = indicatorLines.length > 0 ? indicatorLines.join('\n') : '该指标数据暂缺';

  return `你是一位专业的A股技术分析师。请基于以下真实数据，分析为什么在${req.tradeDate}触发了"${strategyName}"${directionText}信号。

股票：${req.stockName}(${req.stockCode})
策略：${strategyName}
方向：${directionText}
交易价格：${req.tradePrice.toFixed(2)}

K线数据（近${req.klineData.length}日）：
日期 | 开盘 | 收盘 | 最高 | 最低 | 成交量
${klineTable}

技术指标（交易当日）：
${indicatorsText}

请分析：
1. 具体K线走势形态（如底部反转、突破形态等）
2. 技术指标的状态和变化趋势
3. 为什么此处触发该策略信号
4. 该信号的可信度评估

要求：
- 必须基于上述真实数据分析，不得编造数据
- 如果某项数据缺失，明确说明"该指标数据暂缺"
- 分析简洁专业，200字以内
- 使用中文回答`;
}

// 调用AI生成依据（通过API Route代理）
export async function generateTradeReasoning(req: ReasoningRequest): Promise<string> {
  try {
    const response = await fetch('/api/backtest/reasoning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as Record<string, string>).error || 'AI依据生成失败');
    }

    const json = await response.json();
    if (json.ok || json.success) {
      return json.data?.reasoning || '依据生成失败';
    }
    return json.error || '依据生成失败';
  } catch (error) {
    console.error('generateTradeReasoning error:', error);
    return 'AI依据生成服务暂不可用';
  }
}

// 批量生成交易依据（异步，不阻塞主流程）
export async function batchGenerateReasoning(
  requests: ReasoningRequest[],
  onProgress?: (current: number, total: number) => void
): Promise<ReasoningResult[]> {
  const results: ReasoningResult[] = [];
  
  for (let i = 0; i < requests.length; i++) {
    try {
      const reasoning = await generateTradeReasoning(requests[i]);
      results.push({
        strategy: requests[i].strategy,
        direction: requests[i].direction,
        tradeDate: requests[i].tradeDate,
        reasoning,
        generatedAt: new Date().toISOString(),
      });
    } catch {
      results.push({
        strategy: requests[i].strategy,
        direction: requests[i].direction,
        tradeDate: requests[i].tradeDate,
        reasoning: '依据生成失败',
        generatedAt: new Date().toISOString(),
      });
    }
    onProgress?.(i + 1, requests.length);
  }

  return results;
}

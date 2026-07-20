'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface AnalysisTooltipData {
  name: string;
  conclusion: string;
  basis: string;
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
  currentValue?: string;
}

interface AnalysisTooltipProps {
  data: AnalysisTooltipData;
  children: React.ReactNode;
}

const confidenceLabels = {
  high: { text: '高', color: '#4ade80' },
  medium: { text: '中', color: '#fbbf24' },
  low: { text: '低', color: '#f87171' },
};

export function AnalysisTooltip({ data, children }: AnalysisTooltipProps) {
  const confidence = confidenceLabels[data.confidence];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dashed border-[var(--text-secondary)]/50 hover:border-[var(--text-primary)] transition-colors">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          align="start"
          className="max-w-[360px] bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-xl p-0"
        >
          <div className="p-3 space-y-2">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">{data.name}</span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{
                  color: confidence.color,
                  backgroundColor: `${confidence.color}20`,
                }}
              >
                可信度: {confidence.text}
              </span>
            </div>

            {/* Conclusion */}
            <div>
              <div className="text-[10px] text-[var(--text-secondary)] mb-0.5">当前结论</div>
              <div className="text-xs text-[var(--text-primary)] leading-relaxed">{data.conclusion}</div>
            </div>

            {/* Current Value */}
            {data.currentValue && (
              <div>
                <div className="text-[10px] text-[var(--text-secondary)] mb-0.5">当前值</div>
                <div className="text-xs text-[var(--accent-green)] font-mono-num">{data.currentValue}</div>
              </div>
            )}

            {/* Basis */}
            <div>
              <div className="text-[10px] text-[var(--text-secondary)] mb-0.5">分析依据</div>
              <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{data.basis}</div>
            </div>

            {/* Explanation */}
            <div className="pt-1 border-t border-[var(--border-default)]">
              <div className="text-[10px] text-[var(--text-secondary)] mb-0.5">简单解释</div>
              <div className="text-[11px] text-[var(--text-primary)]/80 leading-relaxed italic">
                {data.explanation}
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Helper to generate tooltip data for different analysis types
export function getChanlunTooltip(type: 'stroke' | 'center' | 'buyPoint' | 'sellPoint', data?: Record<string, string | number>): AnalysisTooltipData {
  const tooltips: Record<string, AnalysisTooltipData> = {
    stroke: {
      name: '缠论笔',
      conclusion: data?.direction === 'up' ? '上升笔：从低点向高点的连接' : '下降笔：从高点向低点的连接',
      basis: `连接了${data?.start || 'A'}到${data?.end || 'B'}两个分型，符合缠论笔的定义（至少5根K线）`,
      confidence: 'high',
      explanation: '笔是缠论分析的基础单位，用于识别价格运动的基本方向。上升笔表示多头力量占优，下降笔表示空头力量占优。',
      currentValue: data?.price ? `${data.price}` : undefined,
    },
    center: {
      name: '缠论中枢',
      conclusion: `价格震荡区间：${data?.low || 'X'} - ${data?.high || 'Y'}`,
      basis: `由至少3笔重叠区域构成，中枢区间为[${data?.low || 'X'}, ${data?.high || 'Y'}]`,
      confidence: 'medium',
      explanation: '中枢是价格反复震荡的区域，是多空力量博弈的核心地带。突破中枢意味着趋势可能延续，回拉中枢则是加仓机会。',
      currentValue: data?.level ? `中枢价位: ${data.level}` : undefined,
    },
    buyPoint: {
      name: '缠论买点',
      conclusion: data?.type === '1' ? '一买：趋势背驰后的反转买点' : data?.type === '2' ? '二买：回拉不进中枢的确认买点' : '三买：突破中枢后回踩的加仓买点',
      basis: data?.type === '1' ? '价格创新低但MACD未创新低，形成底背驰' : data?.type === '2' ? '一买后回拉不跌破前低，确认底部' : '价格突破中枢后回踩不进入中枢',
      confidence: data?.type === '1' ? 'medium' : 'high',
      explanation: '缠论三类买点是不同阶段的买入时机。一买是抄底（风险高），二买是确认（较安全），三买是追涨（最安全但价格已高）。',
      currentValue: data?.price ? `买点价位: ${data.price}` : undefined,
    },
    sellPoint: {
      name: '缠论卖点',
      conclusion: data?.type === '1' ? '一卖：趋势背驰后的反转卖点' : data?.type === '2' ? '二卖：回拉不进中枢的确认卖点' : '三卖：跌破中枢后反弹的减仓卖点',
      basis: data?.type === '1' ? '价格创新高但MACD未创新高，形成顶背驰' : data?.type === '2' ? '一卖后回拉不突破前高，确认顶部' : '价格跌破中枢后反弹不进入中枢',
      confidence: data?.type === '1' ? 'medium' : 'high',
      explanation: '缠论三类卖点是不同阶段的卖出时机。一卖是逃顶（风险高），二卖是确认（较安全），三卖是止损（必须执行）。',
      currentValue: data?.price ? `卖点价位: ${data.price}` : undefined,
    },
  };
  return tooltips[type];
}

export function getWaveTooltip(waveLabel: string, data?: Record<string, string | number>): AnalysisTooltipData {
  const isImpulse = /^[1-5]$/.test(waveLabel);
  const waveNames: Record<string, string> = {
    '1': '第1浪 - 启动浪',
    '2': '第2浪 - 回调浪',
    '3': '第3浪 - 主升浪',
    '4': '第4浪 - 整理浪',
    '5': '第5浪 - 末升浪',
    'A': 'A浪 - 初始下跌',
    'B': 'B浪 - 反弹浪',
    'C': 'C浪 - 主跌浪',
  };

  return {
    name: `波浪理论 - ${waveNames[waveLabel] || waveLabel}`,
    conclusion: isImpulse
      ? `推动浪第${waveLabel}浪，价格从${data?.from || 'X'}运动到${data?.to || 'Y'}`
      : `调整浪${waveLabel}浪，价格从${data?.from || 'X'}运动到${data?.to || 'Y'}`,
    basis: `基于艾略特波浪理论，识别出完整的${isImpulse ? '5浪推动' : '3浪调整'}结构`,
    confidence: waveLabel === '3' ? 'high' : 'medium',
    explanation: isImpulse
      ? `第${waveLabel}浪是上升推动浪的一部分。${waveLabel === '3' ? '第3浪通常是最强最长的主升浪' : waveLabel === '1' ? '第1浪是趋势启动，往往不被多数人识别' : waveLabel === '5' ? '第5浪是上升末端，注意见顶风险' : '推动浪中的回调浪，幅度通常有限'}`
      : `${waveLabel}浪是调整结构的一部分。${waveLabel === 'A' ? 'A浪开始下跌，多数人还以为是回调' : waveLabel === 'B' ? 'B浪是反弹陷阱，不要误认为是反转' : 'C浪是主跌浪，杀伤力最大'}`,
    currentValue: data?.change ? `涨跌幅: ${data.change}` : undefined,
  };
}

export function getIndicatorTooltip(indicator: string, data?: Record<string, string | number | undefined>): AnalysisTooltipData {
  const numVal = (v: string | number | undefined): number => {
    if (v === undefined || v === null) return NaN;
    return typeof v === 'number' ? v : parseFloat(v);
  };

  const indicators: Record<string, AnalysisTooltipData> = {
    MACD: {
      name: 'MACD指标',
      conclusion: data?.signal === 'golden_cross' ? '金叉信号：DIF上穿DEA，看多' : data?.signal === 'death_cross' ? '死叉信号：DIF下穿DEA，看空' : numVal(data?.histogram) > 0 ? '红柱状态：多头力量占优' : '绿柱状态：空头力量占优',
      basis: `DIF=${data?.dif || 'X'}, DEA=${data?.dea || 'Y'}, 柱状=${data?.histogram || 'Z'}`,
      confidence: 'medium',
      explanation: 'MACD是趋势跟踪指标，金叉看多、死叉看空。零轴上方为多头市场，零轴下方为空头市场。柱状图反映多空力量对比。',
      currentValue: `DIF: ${data?.dif || '-'}, DEA: ${data?.dea || '-'}`,
    },
    KDJ: {
      name: 'KDJ随机指标',
      conclusion: numVal(data?.k) > 80 ? '超买区域：K值>80，短期可能回调' : numVal(data?.k) < 20 ? '超卖区域：K值<20，短期可能反弹' : '中性区域：K值在20-80之间',
      basis: `K=${data?.k || 'X'}, D=${data?.d || 'Y'}, J=${data?.j || 'Z'}`,
      confidence: 'medium',
      explanation: 'KDJ是摆动指标，反映短期超买超卖状态。K>80超买注意回调，K<20超卖注意反弹。J值最敏感，常作为先行指标。',
      currentValue: `K: ${data?.k || '-'}, D: ${data?.d || '-'}, J: ${data?.j || '-'}`,
    },
    RSI: {
      name: 'RSI相对强弱指标',
      conclusion: numVal(data?.rsi) > 70 ? '超买状态：RSI>70，短期可能见顶' : numVal(data?.rsi) < 30 ? '超卖状态：RSI<30，短期可能见底' : '正常状态：RSI在30-70之间',
      basis: `RSI(14)=${data?.rsi || 'X'}，基于14日内涨跌比率计算`,
      confidence: 'medium',
      explanation: 'RSI衡量买卖双方力量对比。>70超买可能回调，<30超卖可能反弹。极端值(>80或<20)信号更强。',
      currentValue: `RSI: ${data?.rsi || '-'}`,
    },
    BOLL: {
      name: '布林带(BOLL)',
      conclusion: data?.position === 'upper' ? '触及上轨：可能遇阻回调或突破加速' : data?.position === 'lower' ? '触及下轨：可能获支撑反弹或破位下跌' : data?.position === 'middle' ? '中轨附近：方向选择中' : '通道内运行',
      basis: `上轨=${data?.upper || 'X'}, 中轨=${data?.middle || 'Y'}, 下轨=${data?.lower || 'Z'}`,
      confidence: 'medium',
      explanation: '布林带由三条线组成：中轨是20日均线，上下轨是标准差通道。价格触及上轨可能超买，触及下轨可能超卖。带宽收窄预示变盘。',
      currentValue: `当前价: ${data?.price || '-'}`,
    },
    MA: {
      name: '均线系统',
      conclusion: data?.arrangement === 'bullish' ? '多头排列：短期均线在上，长期在下，趋势向上' : data?.arrangement === 'bearish' ? '空头排列：短期均线在下，长期在上，趋势向下' : '均线缠绕：方向不明，震荡整理',
      basis: `MA5=${data?.ma5 || '-'}, MA10=${data?.ma10 || '-'}, MA20=${data?.ma20 || '-'}, MA60=${data?.ma60 || '-'}`,
      confidence: 'high',
      explanation: '均线系统反映不同周期的平均成本。多头排列(短上长下)表示趋势向上，空头排列(短下长上)表示趋势向下。均线金叉死叉是重要信号。',
      currentValue: `价格vs MA20: ${data?.vsMa20 || '-'}`,
    },
  };
  return indicators[indicator] || {
    name: indicator,
    conclusion: '指标分析中',
    basis: '基于技术指标计算',
    confidence: 'medium',
    explanation: '技术指标辅助判断市场状态',
  };
}

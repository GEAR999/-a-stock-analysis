'use client';

import { useMemo } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { Switch } from '@/components/ui/switch';
import { AnalysisTooltip, AnalysisTooltipData, getIndicatorTooltip } from './AnalysisTooltip';
import { getAllIndicators } from '@/lib/analysis';

export function AnalysisPanel() {
  const { analysisSettings, setAnalysisSettings, klineData } = useAppState();

  // Get current indicator values for tooltips
  const indicatorData = useMemo(() => {
    if (klineData.length < 20) return null;
    return getAllIndicators(klineData);
  }, [klineData]);

  const lastIdx = klineData.length - 1;

  // Build tooltip data for each indicator
  const getTooltipData = (key: string): AnalysisTooltipData | null => {
    if (!indicatorData || lastIdx < 0) return null;

    switch (key) {
      case 'macd': {
        const macdVal = indicatorData.macd[lastIdx];
        return getIndicatorTooltip('MACD', {
          dif: macdVal?.dif.toFixed(3),
          dea: macdVal?.dea.toFixed(3),
          histogram: macdVal?.histogram.toFixed(3),
          signal: (macdVal?.histogram ?? 0) > 0 ? 'positive' : 'negative',
        });
      }
      case 'kdj': {
        const kdjVal = indicatorData.kdj[lastIdx];
        return getIndicatorTooltip('KDJ', {
          k: kdjVal?.k.toFixed(1),
          d: kdjVal?.d.toFixed(1),
          j: kdjVal?.j.toFixed(1),
        });
      }
      case 'rsi': {
        const rsiVal = indicatorData.rsi[lastIdx];
        return getIndicatorTooltip('RSI', {
          rsi: rsiVal?.rsi.toFixed(1),
        });
      }
      case 'boll': {
        const bollVal = indicatorData.boll[lastIdx];
        const price = klineData[lastIdx]?.close;
        let position = 'middle';
        if (bollVal && price) {
          if (price > bollVal.upper) position = 'upper';
          else if (price < bollVal.lower) position = 'lower';
        }
        return getIndicatorTooltip('BOLL', {
          upper: bollVal?.upper.toFixed(2),
          middle: bollVal?.middle.toFixed(2),
          lower: bollVal?.lower.toFixed(2),
          price: price?.toFixed(2),
          position,
        });
      }
      case 'ma': {
        const ma5 = indicatorData.ma[5]?.[lastIdx];
        const ma10 = indicatorData.ma[10]?.[lastIdx];
        const ma20 = indicatorData.ma[20]?.[lastIdx];
        const ma60 = indicatorData.ma[60]?.[lastIdx];
        const price = klineData[lastIdx]?.close;
        let arrangement = 'mixed';
        if (ma5 && ma10 && ma20) {
          if (ma5 > ma10 && ma10 > ma20) arrangement = 'bullish';
          else if (ma5 < ma10 && ma10 < ma20) arrangement = 'bearish';
        }
        return getIndicatorTooltip('MA', {
          ma5: ma5?.toFixed(2),
          ma10: ma10?.toFixed(2),
          ma20: ma20?.toFixed(2),
          ma60: ma60?.toFixed(2),
          arrangement,
          vsMa20: price && ma20 ? ((price - ma20) / ma20 * 100).toFixed(2) + '%' : '-',
        });
      }
      default:
        return null;
    }
  };

  const items = [
    { key: 'chanlun' as const, label: '缠论分析', desc: '笔/线段/中枢/买卖点', tooltip: {
      name: '缠论分析',
      conclusion: '通过笔、线段、中枢识别市场结构',
      basis: '基于分型理论，自动识别顶分型和底分型，构建笔和线段，寻找中枢区间',
      confidence: 'high' as const,
      explanation: '缠论是一套完整的市场分析理论，通过几何形态识别市场的趋势和震荡结构。核心概念包括：笔（最小单位）、线段（笔的组合）、中枢（震荡区间）。',
    }},
    { key: 'wave' as const, label: '波浪理论', desc: '推动浪/调整浪', tooltip: {
      name: '波浪理论',
      conclusion: '识别5浪推动和3浪调整结构',
      basis: '基于艾略特波浪理论，通过枢轴点检测识别浪型结构',
      confidence: 'medium' as const,
      explanation: '波浪理论认为市场走势呈波浪形态，由5浪推动（上升）和3浪调整（下跌）组成。第3浪通常最强，第5浪末端需警惕反转。',
    }},
    { key: 'macd' as const, label: 'MACD', desc: 'DIF/DEA/柱状图' },
    { key: 'kdj' as const, label: 'KDJ', desc: '随机指标' },
    { key: 'rsi' as const, label: 'RSI', desc: '相对强弱指标' },
    { key: 'boll' as const, label: 'BOLL', desc: '布林带' },
    { key: 'ma' as const, label: '均线系统', desc: 'MA5/10/20/60/120/250' },
  ];

  return (
    <div className="border-b border-[#1e293b]">
      <div className="px-3 py-2 text-xs font-medium text-[#94a3b8] uppercase tracking-wider">
        分析引擎
      </div>
      <div className="px-3 pb-2 space-y-1">
        {items.map(item => {
          const tooltipData = item.tooltip || getTooltipData(item.key);
          const content = (
            <div className="flex items-center justify-between py-1">
              <div>
                <div className="text-xs text-[#e2e8f0]">{item.label}</div>
                <div className="text-[10px] text-[#94a3b8]">{item.desc}</div>
              </div>
              <Switch
                checked={analysisSettings[item.key]}
                onCheckedChange={(checked) => setAnalysisSettings({ [item.key]: checked })}
              />
            </div>
          );

          if (tooltipData) {
            return (
              <AnalysisTooltip key={item.key} data={tooltipData}>
                {content}
              </AnalysisTooltip>
            );
          }

          return <div key={item.key}>{content}</div>;
        })}
      </div>
    </div>
  );
}

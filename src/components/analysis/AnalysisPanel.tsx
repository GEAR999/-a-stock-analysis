'use client';

import { useAppState } from '@/hooks/useAppState';
import { Switch } from '@/components/ui/switch';

export function AnalysisPanel() {
  const { analysisSettings, setAnalysisSettings } = useAppState();

  const items = [
    { key: 'chanlun' as const, label: '缠论分析', desc: '笔/线段/中枢/买卖点' },
    { key: 'wave' as const, label: '波浪理论', desc: '推动浪/调整浪' },
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
        {items.map(item => (
          <div key={item.key} className="flex items-center justify-between py-1">
            <div>
              <div className="text-xs text-[#e2e8f0]">{item.label}</div>
              <div className="text-[10px] text-[#94a3b8]">{item.desc}</div>
            </div>
            <Switch
              checked={analysisSettings[item.key]}
              onCheckedChange={(checked) => setAnalysisSettings({ [item.key]: checked })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

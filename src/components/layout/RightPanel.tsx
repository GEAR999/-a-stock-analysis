'use client';

import { useState } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel';
import { ChanlunCard } from '@/components/analysis/ChanlunCard';
import { WaveCard } from '@/components/analysis/WaveCard';
import { TechnicalCard } from '@/components/analysis/TechnicalCard';
import { ComprehensiveAnalysis } from '@/components/analysis/ComprehensiveAnalysis';
import { AdvicePanel } from '@/components/analysis/AdvicePanel';
import { MacroEconomyPanel } from '@/components/macro/MacroEconomyPanel';
import { IndustryMappingPanel } from '@/components/industry/IndustryMappingPanel';

export function RightPanel() {
  const { analysisSettings, selectedStock } = useAppState();
  const [macroEnabled, setMacroEnabled] = useState(true);

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto p-3">
      {/* 1. 分析理论开关 */}
      <AnalysisPanel />

      {/* 2. 缠论分析卡片 */}
      <ChanlunCard visible={analysisSettings.chanlun} />

      {/* 3. 波浪理论分析卡片 */}
      <WaveCard visible={analysisSettings.wave} />

      {/* 4. 技术指标分析卡片 */}
      <TechnicalCard visible={analysisSettings.technical} />

      {/* 5. 综合分析卡片（始终显示） */}
      <ComprehensiveAnalysis settings={analysisSettings} />

      {/* 6. 宏观经济分析 */}
      <div className="border border-gray-800 rounded overflow-hidden">
        <div className="px-3 py-2 bg-[#111827] flex items-center justify-between">
          <span className="text-xs text-gray-300">宏观经济分析</span>
          <button
            onClick={() => setMacroEnabled(!macroEnabled)}
            className={`w-8 h-4 rounded-full transition-colors ${
              macroEnabled ? 'bg-amber-500' : 'bg-gray-600'
            }`}
          >
            <span
              className={`block w-3 h-3 rounded-full bg-white transition-transform ${
                macroEnabled ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        <MacroEconomyPanel enabled={macroEnabled} />
      </div>

      {/* 7. 产业链映射 */}
      <IndustryMappingPanel stockCode={selectedStock?.code} />

      {/* 8. 综合建议 */}
      <AdvicePanel />
    </div>
  );
}

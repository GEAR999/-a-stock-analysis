'use client';

import { useAppState } from '@/hooks/useAppState';
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel';
import { ChanlunCard } from '@/components/analysis/ChanlunCard';
import { WaveCard } from '@/components/analysis/WaveCard';
import { TechnicalCard } from '@/components/analysis/TechnicalCard';
import { ComprehensiveAnalysis } from '@/components/analysis/ComprehensiveAnalysis';
import { AdvicePanel } from '@/components/analysis/AdvicePanel';

export function RightPanel() {
  const { analysisSettings } = useAppState();

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

      {/* 6. 综合建议 */}
      <AdvicePanel />
    </div>
  );
}

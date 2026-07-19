'use client';

import { AnalysisPanel } from '@/components/analysis/AnalysisPanel';
import { AdvicePanel } from '@/components/analysis/AdvicePanel';
import { TrendOutlook } from '@/components/analysis/TrendOutlook';

export function RightPanel() {
  return (
    <div className="w-[300px] shrink-0 bg-[#0d1117] border-l border-[#1e293b] flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* Analysis Engine */}
        <AnalysisPanel />

        {/* Trend Outlook */}
        <TrendOutlook />

        {/* Advice */}
        <div className="border-t border-[#1e293b]">
          <div className="px-3 py-2 text-xs font-medium text-[#94a3b8] uppercase tracking-wider border-b border-[#1e293b]">
            综合建议
          </div>
          <AdvicePanel />
        </div>
      </div>
    </div>
  );
}

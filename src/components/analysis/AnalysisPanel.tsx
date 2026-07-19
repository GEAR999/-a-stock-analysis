'use client';

import { useAppState } from '@/hooks/useAppState';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

export function AnalysisPanel() {
  const { analysisSettings, setAnalysisSettings } = useAppState();

  return (
    <div className="rounded border border-border bg-[#111827] p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-300">分析理论开关</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3.5 h-3.5 text-gray-500 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[250px] bg-[#0f0f1a] border-border">
              <p className="text-xs text-gray-300">开启后会在下方显示该理论的独立分析卡片，包含走势研判、多路径推演和操作建议</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={analysisSettings.chanlun}
            onChange={(e) => setAnalysisSettings({ ...analysisSettings, chanlun: e.target.checked })}
            className="w-3.5 h-3.5 rounded border-gray-600 bg-[#0f0f1a] text-purple-500 focus:ring-purple-500/20"
          />
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          <span className="text-xs text-gray-400 group-hover:text-gray-300">缠论分析</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={analysisSettings.wave}
            onChange={(e) => setAnalysisSettings({ ...analysisSettings, wave: e.target.checked })}
            className="w-3.5 h-3.5 rounded border-gray-600 bg-[#0f0f1a] text-blue-500 focus:ring-blue-500/20"
          />
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-xs text-gray-400 group-hover:text-gray-300">波浪理论</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={analysisSettings.technical}
            onChange={(e) => setAnalysisSettings({ ...analysisSettings, technical: e.target.checked })}
            className="w-3.5 h-3.5 rounded border-gray-600 bg-[#0f0f1a] text-emerald-500 focus:ring-emerald-500/20"
          />
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-gray-400 group-hover:text-gray-300">技术指标</span>
        </label>
      </div>
    </div>
  );
}

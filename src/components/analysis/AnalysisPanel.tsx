'use client';

import { useState } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Settings, Plus } from 'lucide-react';
import CustomStrategyPanel from '@/components/strategy/CustomStrategyPanel';
import { getAllCustomStrategies } from '@/components/backtest/strategy-storage';

export function AnalysisPanel() {
  const { analysisSettings, setAnalysisSettings } = useAppState();
  const [showCustomStrategy, setShowCustomStrategy] = useState(false);
  const customStrategies = getAllCustomStrategies();

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
        {/* 波浪灵敏度 */}
        {analysisSettings.wave && (
          <div className="ml-5 pl-2 border-l border-blue-500/20">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[10px] text-gray-500">灵敏度</span>
            </div>
            <div className="flex gap-1">
              {([['high', '高'], ['medium', '中'], ['low', '低']] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setAnalysisSettings({ ...analysisSettings, waveSensitivity: value })}
                  className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                    analysisSettings.waveSensitivity === value
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'text-gray-500 hover:text-gray-400 border border-transparent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
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
        
        {/* 自定义策略 */}
        <div className="pt-2 mt-2 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs text-gray-400">自定义策略</span>
              {customStrategies.length > 0 && (
                <span className="text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  {customStrategies.length}个
                </span>
              )}
            </div>
            <button
              onClick={() => setShowCustomStrategy(!showCustomStrategy)}
              className="flex items-center gap-1 text-[10px] text-amber-500 hover:text-amber-400 transition-colors"
            >
              <Settings className="w-3 h-3" />
              {showCustomStrategy ? '收起' : '管理'}
            </button>
          </div>
          
          {showCustomStrategy && (
            <div className="mt-2">
              <CustomStrategyPanel />
            </div>
          )}
          
          {!showCustomStrategy && customStrategies.length === 0 && (
            <button
              onClick={() => setShowCustomStrategy(true)}
              className="mt-2 w-full flex items-center justify-center gap-1 text-[10px] text-gray-500 hover:text-amber-500 border border-dashed border-gray-800 hover:border-amber-500/30 rounded py-1.5 transition-colors"
            >
              <Plus className="w-3 h-3" />
              创建自定义策略
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

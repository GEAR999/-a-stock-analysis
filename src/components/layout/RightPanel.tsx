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
import { SentimentPanel } from '@/components/sentiment/SentimentPanel';

// 手风琴面板组件
function AccordionSection({ 
  title, 
  icon, 
  defaultOpen = false, 
  summary,
  children 
}: { 
  title: string;
  icon?: string;
  defaultOpen?: boolean;
  summary?: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-800 rounded overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-[#111827] flex items-center justify-between hover:bg-[#1a2332] transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon && <span>{icon}</span>}
          <span className="text-xs text-gray-300 font-medium">{title}</span>
          {summary && !isOpen && (
            <span className="text-xs text-gray-500 truncate max-w-[120px]">{summary}</span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="bg-[#0a0e17] max-h-[60vh] overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );
}

export function RightPanel() {
  const { analysisSettings, selectedStock } = useAppState();
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'summary' | 'chanlun' | 'wave' | 'technical'>('summary');

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 固定顶部：当前股票信息 */}
      <div className="px-3 py-2 bg-[#111827] border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-white">
              {selectedStock?.name || '请选择股票'}
            </div>
            <div className="text-xs text-gray-500">{selectedStock?.code}</div>
          </div>
        </div>
      </div>

      {/* 可滚动内容区域 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* 1. 分析引擎 - 手风琴模式 */}
        <AccordionSection 
          title="分析引擎" 
          icon="📊"
          defaultOpen={true}
          summary={activeAnalysisTab === 'summary' ? '综合分析' : 
                   activeAnalysisTab === 'chanlun' ? '缠论' :
                   activeAnalysisTab === 'wave' ? '波浪' : '技术指标'}
        >
          <div className="p-2">
            {/* Tab切换 */}
            <div className="flex gap-1 mb-2">
              <button
                onClick={() => setActiveAnalysisTab('summary')}
                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                  activeAnalysisTab === 'summary' 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                综合
              </button>
              <button
                onClick={() => setActiveAnalysisTab('chanlun')}
                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                  activeAnalysisTab === 'chanlun' 
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                缠论
              </button>
              <button
                onClick={() => setActiveAnalysisTab('wave')}
                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                  activeAnalysisTab === 'wave' 
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                波浪
              </button>
              <button
                onClick={() => setActiveAnalysisTab('technical')}
                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                  activeAnalysisTab === 'technical' 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                技术
              </button>
            </div>

            {/* 根据Tab显示内容 */}
            {activeAnalysisTab === 'summary' && (
              <ComprehensiveAnalysis settings={analysisSettings} />
            )}
            {activeAnalysisTab === 'chanlun' && (
              <div>
                <AnalysisPanel />
                <ChanlunCard visible={true} />
              </div>
            )}
            {activeAnalysisTab === 'wave' && (
              <div>
                <AnalysisPanel />
                <WaveCard visible={true} />
              </div>
            )}
            {activeAnalysisTab === 'technical' && (
              <div>
                <AnalysisPanel />
                <TechnicalCard visible={true} />
              </div>
            )}
          </div>
        </AccordionSection>

        {/* 2. 宏观经济 - 手风琴模式 */}
        <AccordionSection 
          title="宏观经济" 
          icon="🌍"
          summary="中性"
        >
          <MacroEconomyPanel enabled={true} />
        </AccordionSection>

        {/* 3. 产业链映射 - 手风琴模式 */}
        <AccordionSection 
          title="产业链映射" 
          icon="🔗"
          summary={selectedStock ? '查看关联标的' : ''}
        >
          <IndustryMappingPanel stockCode={selectedStock?.code} />
        </AccordionSection>

        {/* 4. 情绪分析 - 手风琴模式 */}
        <AccordionSection 
          title="情绪分析" 
          icon="📈"
          defaultOpen={true}
          summary="大盘/板块/个股"
        >
          <SentimentPanel />
        </AccordionSection>

        {/* 5. 综合建议 - 手风琴模式 */}
        <AccordionSection 
          title="综合建议" 
          icon="💡"
        >
          <AdvicePanel />
        </AccordionSection>
      </div>
    </div>
  );
}

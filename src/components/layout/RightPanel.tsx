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
import { SentimentSummary } from '@/components/sentiment/SentimentSummary';
import OverseasMapping from '@/components/analysis/OverseasMapping';
import { BacktestPanel } from '@/components/backtest/BacktestPanel';
import { SignalSummaryBar } from '@/components/analysis/SignalSummaryBar';
import { AIInterpretation } from '@/components/analysis/AIInterpretation';

// 手风琴面板组件
function AccordionSection({ 
  title, 
  icon, 
  defaultOpen = false, 
  summary,
  action,
  children 
}: { 
  title: string;
  icon?: string;
  defaultOpen?: boolean;
  summary?: string;
  action?: React.ReactNode;
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
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {action}
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
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
  const { analysisSettings, selectedStock, klineData } = useAppState();
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'summary' | 'chanlun' | 'wave' | 'technical'>('summary');
  const [isRefreshingAnalysis, setIsRefreshingAnalysis] = useState(false);
  const [isRefreshingPositions, setIsRefreshingPositions] = useState(false);
  const [externalAddStock, setExternalAddStock] = useState<{ code: string; name: string } | null>(null);

  // 一键加入回测跟踪
  const handleAddToBacktest = () => {
    if (selectedStock) {
      setExternalAddStock({ code: selectedStock.code, name: selectedStock.name });
      setTimeout(() => setExternalAddStock(null), 100);
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#0a0e17]">
      {/* 固定顶部：当前股票信息 */}
      <div className="px-3 py-2 bg-[#111827] border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-white">
              {selectedStock?.name || '请选择股票'}
            </div>
            <div className="text-xs text-gray-500">{selectedStock?.code}</div>
          </div>
          <button
            onClick={handleAddToBacktest}
            disabled={!selectedStock}
            className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="将当前股票加入回测跟踪列表"
          >
            + 加入回测
          </button>
        </div>
      </div>

      {/* 信号总览 */}
      <SignalSummaryBar />

      {/* 可滚动内容区域 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* 未选股票时显示引导提示 */}
        {!selectedStock && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-4 opacity-50">📈</div>
            <p className="text-gray-400 text-sm mb-2">请搜索或选择一只股票开始分析</p>
            <p className="text-gray-500 text-xs">在左侧搜索框输入股票代码或名称</p>
          </div>
        )}

        {/* 1. 分析引擎 - 手风琴模式 */}
        {selectedStock && (
        <AccordionSection 
          title="分析引擎" 
          icon="📊"
          defaultOpen={true}
          summary={activeAnalysisTab === 'summary' ? '综合分析' : 
                   activeAnalysisTab === 'chanlun' ? '缠论' :
                   activeAnalysisTab === 'wave' ? '波浪' : '技术指标'}
          action={
            <button
              onClick={() => {
                // Force re-render by triggering a state change
                setIsRefreshingAnalysis(true);
                setTimeout(() => setIsRefreshingAnalysis(false), 500);
              }}
              disabled={isRefreshingAnalysis}
              className="p-1 text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
              title="重新分析"
            >
              {isRefreshingAnalysis ? '⏳' : '🔄'}
            </button>
          }
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
        )}

        {/* 1.5 AI大白话解读 */}
        {selectedStock && klineData.length > 0 && (
        <AIInterpretation klineData={klineData} />
        )}

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

        {/* 3.5 海外映射 - 手风琴模式 */}
        <AccordionSection 
          title="海外映射" 
          icon="🌐"
          summary={selectedStock ? '联动分析' : ''}
        >
          <OverseasMapping stockCode={selectedStock?.code || ''} stockName={selectedStock?.name || ''} />
        </AccordionSection>

        {/* 4. 情绪分析 - 摘要模式 */}
        <AccordionSection 
          title="情绪分析" 
          icon="📈"
          defaultOpen={true}
          summary="大盘/板块/个股"
        >
          <SentimentSummary stockCode={selectedStock?.code} stockName={selectedStock?.name} />
        </AccordionSection>

        {/* 5. 综合建议 - 手风琴模式 */}
        {selectedStock && (
        <AccordionSection 
          title="综合建议" 
          icon="💡"
        >
          <AdvicePanel />
        </AccordionSection>
        )}

        {/* 6. 模拟回测 - 手风琴模式 */}
        <AccordionSection 
          title="模拟回测" 
          icon="💰"
          summary="多账户管理"
        >
          <BacktestPanel externalAddStock={externalAddStock} />
        </AccordionSection>
      </div>
    </div>
  );
}

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel';
import { ChanlunCard } from '@/components/analysis/ChanlunCard';
import { WaveCard } from '@/components/analysis/WaveCard';
import { TechnicalCard } from '@/components/analysis/TechnicalCard';
import { ComprehensiveAnalysis } from '@/components/analysis/ComprehensiveAnalysis';
import { MacroEconomyPanel } from '@/components/macro/MacroEconomyPanel';

import { IndustryMappingPanel } from '@/components/industry/IndustryMappingPanel';
import OverseasMapping from '@/components/analysis/OverseasMapping';
import { BacktestPanel } from '@/components/backtest/BacktestPanel';
import { HistoryBacktestPanel } from '@/components/backtest/HistoryBacktestPanel';
import { StrategyLibrary } from '@/components/strategy/StrategyLibrary';
import { SignalSummaryBar } from '@/components/analysis/SignalSummaryBar';
import { AIInterpretation } from '@/components/analysis/AIInterpretation';
import { StockComparison } from '@/components/analysis/StockComparison';
import { HistoricalSignalsPanel } from '@/components/analysis/HistoricalSignalsPanel';
import MultiFactorPanel from '@/components/multifactor/MultiFactorPanel';
import { ProbabilityPanel } from '@/components/probability/ProbabilityPanel';

// 市场参考 Tab（宏观/产业链/海外，聚合成一个手风琴，默认收起）
type MarketRefTab = 'macro' | 'industry' | 'overseas';

function MarketReferenceTabs({ stockCode, stockName }: { stockCode?: string; stockName?: string }) {
  const [tab, setTab] = useState<MarketRefTab>('macro');
  const tabs: { key: MarketRefTab; label: string }[] = [
    { key: 'macro', label: '宏观' },
    { key: 'industry', label: '产业链' },
    { key: 'overseas', label: '海外' },
  ];
  return (
    <div>
      <div className="flex gap-1 px-2 pt-2 pb-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              tab === t.key
                ? 'bg-blue-500/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30'
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-1">
        {tab === 'macro' && <MacroEconomyPanel enabled={true} />}
        {tab === 'industry' && <IndustryMappingPanel stockCode={stockCode} />}
        {tab === 'overseas' && <OverseasMapping stockCode={stockCode || ''} stockName={stockName || ''} />}
      </div>
    </div>
  );
}

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
    <div className="border border-[var(--border-default)] rounded overflow-hidden">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-[var(--bg-panel)] flex items-center justify-between hover:bg-[var(--bg-primary)] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {icon && <span>{icon}</span>}
          <span className="text-xs text-[var(--text-primary)] font-medium">{title}</span>
          {summary && !isOpen && (
            <span className="text-xs text-[var(--text-secondary)] truncate max-w-[120px]">{summary}</span>
          )}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {action}
          <svg
            className={`w-4 h-4 text-[var(--text-secondary)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {isOpen && (
        <div className="bg-[var(--bg-primary)] max-h-[60vh] overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );
}

export function RightPanel() {
  const { analysisSettings, selectedStock, klineData } = useAppState();
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'summary' | 'chanlun' | 'wave' | 'technical' | 'multifactor'>('summary');
  const [isRefreshingAnalysis, setIsRefreshingAnalysis] = useState(false);
  const [isRefreshingPositions, setIsRefreshingPositions] = useState(false);
  const [externalAddStock, setExternalAddStock] = useState<{ code: string; name: string } | null>(null);

  // 收集三个分析卡片的结论
  const [chanlunConclusion, setChanlunConclusion] = useState<{ name: string; direction: '上升' | '下降' | '震荡'; confidence: '高' | '中' | '低'; advice: string } | null>(null);
  const [waveConclusion, setWaveConclusion] = useState<{ name: string; direction: '上升' | '下降' | '震荡'; confidence: '高' | '中' | '低'; advice: string } | null>(null);
  const [technicalConclusion, setTechnicalConclusion] = useState<{ name: string; direction: '上升' | '下降' | '震荡'; confidence: '高' | '中' | '低'; advice: string } | null>(null);

  const conclusions = useMemo(() => {
    const result: { name: string; direction: '上升' | '下降' | '震荡'; confidence: '高' | '中' | '低'; advice: string; color: string }[] = [];
    if (chanlunConclusion) result.push({ ...chanlunConclusion, color: 'purple' });
    if (waveConclusion) result.push({ ...waveConclusion, color: 'blue' });
    if (technicalConclusion) result.push({ ...technicalConclusion, color: 'emerald' });
    return result;
  }, [chanlunConclusion, waveConclusion, technicalConclusion]);

  // 一键加入回测跟踪
  const handleAddToBacktest = () => {
    if (selectedStock) {
      setExternalAddStock({ code: selectedStock.code, name: selectedStock.name });
      setTimeout(() => setExternalAddStock(null), 100);
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[var(--bg-primary)]">
      {/* 固定顶部：当前股票信息 */}
      <div className="px-3 py-2 bg-[var(--bg-panel)] border-b border-[var(--border-default)] flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">
              {selectedStock?.name || '请选择股票'}
            </div>
            <div className="text-xs text-[var(--text-secondary)]">{selectedStock?.code}</div>
          </div>
          <button
            onClick={handleAddToBacktest}
            disabled={!selectedStock}
            className="px-2 py-1 text-xs bg-blue-500/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30 rounded hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            <p className="text-[var(--text-secondary)] text-sm mb-2">请搜索或选择一只股票开始分析</p>
            <p className="text-[var(--text-secondary)] text-xs">在左侧搜索框输入股票代码或名称</p>
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
                   activeAnalysisTab === 'wave' ? '波浪' :
                   activeAnalysisTab === 'multifactor' ? '多因子' : '技术指标'}
          action={
            <button
              onClick={() => {
                // Force re-render by triggering a state change
                setIsRefreshingAnalysis(true);
                setTimeout(() => setIsRefreshingAnalysis(false), 500);
              }}
              disabled={isRefreshingAnalysis}
              className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors"
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
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                }`}
              >
                综合
              </button>
              <button
                onClick={() => setActiveAnalysisTab('chanlun')}
                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                  activeAnalysisTab === 'chanlun' 
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                }`}
              >
                缠论
              </button>
              <button
                onClick={() => setActiveAnalysisTab('wave')}
                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                  activeAnalysisTab === 'wave' 
                    ? 'bg-blue-500/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30' 
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                }`}
              >
                波浪
              </button>
              <button
                onClick={() => setActiveAnalysisTab('technical')}
                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                  activeAnalysisTab === 'technical' 
                    ? 'bg-green-500/20 text-[var(--accent-green)] border border-green-500/30' 
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                }`}
              >
                技术
              </button>
              <button
                onClick={() => setActiveAnalysisTab('multifactor')}
                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                  activeAnalysisTab === 'multifactor' 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                }`}
              >
                多因子
              </button>
            </div>

            {/* 根据Tab显示内容 */}
            {activeAnalysisTab === 'summary' && (
              <ComprehensiveAnalysis settings={analysisSettings} conclusions={conclusions} klineData={klineData} />
            )}
            {activeAnalysisTab === 'chanlun' && (
              <div>
                <AnalysisPanel />
                <ChanlunCard visible={true} klineData={klineData} onConclusion={setChanlunConclusion} />
              </div>
            )}
            {activeAnalysisTab === 'wave' && (
              <div>
                <AnalysisPanel />
                <WaveCard visible={true} klineData={klineData} onConclusion={setWaveConclusion} />
              </div>
            )}
            {activeAnalysisTab === 'technical' && (
              <div>
                <AnalysisPanel />
                <TechnicalCard visible={true} klineData={klineData} onConclusion={setTechnicalConclusion} />
              </div>
            )}
            {activeAnalysisTab === 'multifactor' && selectedStock && (
              <MultiFactorPanel code={selectedStock.code} />
            )}
          </div>
        </AccordionSection>
        )}

        {/* 1.5 AI大白话解读 */}
        {selectedStock && klineData.length > 0 && (
        <AIInterpretation 
          klineData={klineData} 
          chanlunEnabled={analysisSettings.chanlun}
          waveEnabled={analysisSettings.wave}
          technicalEnabled={analysisSettings.technical}
        />
        )}

        {/* 1.6 概率统计 */}
        {selectedStock && klineData.length > 0 && (
        <AccordionSection
          title="概率统计"
          icon="🎲"
          summary="模式分布/因子评估/条件概率"
        >
          <ProbabilityPanel klineData={klineData} />
        </AccordionSection>
        )}

        {/* 2. 市场参考（宏观/实时行情/产业链/海外 聚合，默认收起） */}
        <AccordionSection
          title="市场参考"
          icon="🌐"
          summary="宏观/行情/产业链/海外"
        >
          <MarketReferenceTabs stockCode={selectedStock?.code} stockName={selectedStock?.name} />
        </AccordionSection>

        {/* 5. 模拟回测 - 手风琴模式 */}
        <AccordionSection 
          title="模拟回测" 
          icon="💰"
          summary="多账户管理"
        >
          <BacktestPanel />
        </AccordionSection>

        {/* 6.5 历史回测 - 独立回测面板 */}
        <AccordionSection 
          title="历史回测" 
          icon="📊"
          summary="策略回测+AI依据"
        >
          <HistoryBacktestPanel />
        </AccordionSection>

        {/* 6.6 策略库 */}
        <AccordionSection 
          title="策略库" 
          icon="📚"
          summary="管理+AI生成策略"
        >
          <StrategyLibrary />
        </AccordionSection>

        {/* 7. 多股对比 - 手风琴模式 */}
        <AccordionSection 
          title="多股对比" 
          icon="📊"
          summary="归一化对比"
        >
          <StockComparison />
        </AccordionSection>

        {/* 8. 历史信号 - 手风琴模式 */}
        <AccordionSection 
          title="历史信号" 
          icon="🕐"
          summary="回看与准确率"
        >
          <HistoricalSignalsPanel />
        </AccordionSection>
      </div>
    </div>
  );
}

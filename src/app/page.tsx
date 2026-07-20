'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { AppProvider } from '@/hooks/useAppState';
import { Sidebar } from '@/components/layout/Sidebar';
import { RightPanel } from '@/components/layout/RightPanel';
import { KLineChart } from '@/components/chart/KLineChart';
import { QuoteHeader } from '@/components/chart/QuoteHeader';
import { AIAssistant } from '@/components/ai/AIAssistant';
import { BacktestPanel } from '@/components/backtest/BacktestPanel';
import { LearningCenter } from '@/components/learning/LearningCenter';
import { AuthGate } from '@/components/AuthGate';
import ThemeSwitcher from '@/components/ui/ThemeSwitcher';
import CommandPalette from '@/components/ui/CommandPalette';
import { AutoRefreshIndicator } from '@/components/chart/AutoRefreshIndicator';

type MainTab = 'analysis' | 'backtest' | 'learning';

export default function Home() {
  const [mainTab, setMainTab] = useState<MainTab>('analysis');
  const [rightPanelWidth, setRightPanelWidth] = useState(420);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // 拖拽调整右侧面板宽度
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = rightPanelWidth;
  }, [rightPanelWidth]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = startXRef.current - e.clientX;
      const newWidth = Math.max(320, Math.min(600, startWidthRef.current + diff));
      setRightPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // 响应式：屏幕小于1280px时自动收起右侧面板
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1280 && !rightPanelCollapsed) {
        setRightPanelCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [rightPanelCollapsed]);

  // 监听学习中心导航事件
  useEffect(() => {
    const handleNavigateLearning = () => {
      setMainTab('learning');
    };
    window.addEventListener('navigate-learning', handleNavigateLearning);
    return () => window.removeEventListener('navigate-learning', handleNavigateLearning);
  }, []);

  return (
    <AuthGate>
    <AppProvider>
      <CommandPalette />
      <div
        ref={containerRef}
        className={`flex h-screen w-screen overflow-hidden bg-[#0a0e17] text-[#e2e8f0] ${isDragging ? 'cursor-col-resize select-none' : ''}`}
      >
        {/* Left Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tab切换 */}
          <div className="flex items-center border-b border-gray-800 bg-[#111827]">
            <button
              onClick={() => setMainTab('analysis')}
              className={`px-4 py-2 text-xs transition-colors ${
                mainTab === 'analysis'
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/5'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              行情分析
            </button>
            <button
              onClick={() => setMainTab('backtest')}
              className={`px-4 py-2 text-xs transition-colors ${
                mainTab === 'backtest'
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/5'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              模拟回测
            </button>
            <button
              onClick={() => setMainTab('learning')}
              className={`px-4 py-2 text-xs transition-colors ${
                mainTab === 'learning'
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/5'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              📚 学习中心
            </button>
            <div className="ml-auto flex items-center gap-2 pr-3">
              {/* 右侧面板收起/展开按钮 */}
              <button
                onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
                className="p-1.5 rounded hover:bg-[#1e293b] transition-colors text-[#94a3b8] hover:text-[#e2e8f0]"
                title={rightPanelCollapsed ? '展开分析面板' : '收起分析面板'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {rightPanelCollapsed ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {mainTab === 'analysis' ? (
            <>
              <QuoteHeader />
              <KLineChart />
            </>
          ) : mainTab === 'backtest' ? (
            <div className="flex-1 overflow-hidden">
              <BacktestPanel />
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              <LearningCenter />
            </div>
          )}
        </div>

        {/* Resizable Divider */}
        {!rightPanelCollapsed && mainTab === 'analysis' && (
          <div
            onMouseDown={handleMouseDown}
            className={`w-1 bg-[#1e293b] cursor-col-resize hover:bg-[#3b82f6] transition-colors ${
              isDragging ? 'bg-[#3b82f6]' : ''
            }`}
          />
        )}

        {/* Right Panel - Collapsible */}
        {!rightPanelCollapsed && mainTab === 'analysis' && (
          <div style={{ width: rightPanelWidth }} className="shrink-0 h-full overflow-hidden">
            <RightPanel />
          </div>
        )}

        {/* AI Assistant */}
        <AIAssistant />

        {/* Auto Refresh Indicator */}
        <AutoRefreshIndicator onRefresh={() => window.dispatchEvent(new Event('auto-refresh'))} />
      </div>
    </AppProvider>
    </AuthGate>
  );
}

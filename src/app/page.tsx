'use client';

import { useState } from 'react';
import { AppProvider } from '@/hooks/useAppState';
import { Sidebar } from '@/components/layout/Sidebar';
import { RightPanel } from '@/components/layout/RightPanel';
import { KLineChart } from '@/components/chart/KLineChart';
import { QuoteHeader } from '@/components/chart/QuoteHeader';
import { AIAssistant } from '@/components/ai/AIAssistant';
import { BacktestPanel } from '@/components/backtest/BacktestPanel';

type MainTab = 'analysis' | 'backtest';

export default function Home() {
  const [mainTab, setMainTab] = useState<MainTab>('analysis');

  return (
    <AppProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-[#0a0e17] text-[#e2e8f0]">
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
          </div>

          {mainTab === 'analysis' ? (
            <>
              <QuoteHeader />
              <KLineChart />
            </>
          ) : (
            <div className="flex-1 overflow-hidden">
              <BacktestPanel />
            </div>
          )}
        </div>

        {/* Right Panel */}
        <RightPanel />

        {/* AI Assistant */}
        <AIAssistant />
      </div>
    </AppProvider>
  );
}

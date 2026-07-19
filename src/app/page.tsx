'use client';

import { AppProvider } from '@/hooks/useAppState';
import { Sidebar } from '@/components/layout/Sidebar';
import { RightPanel } from '@/components/layout/RightPanel';
import { KLineChart } from '@/components/chart/KLineChart';
import { QuoteHeader } from '@/components/chart/QuoteHeader';
import { AIAssistant } from '@/components/ai/AIAssistant';

export default function Home() {
  return (
    <AppProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-[#0a0e17] text-[#e2e8f0]">
        {/* Left Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <QuoteHeader />
          <KLineChart />
        </div>

        {/* Right Panel */}
        <RightPanel />

        {/* AI Assistant */}
        <AIAssistant />
      </div>
    </AppProvider>
  );
}

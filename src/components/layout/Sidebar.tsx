'use client';

import { StockSearch } from '@/components/sidebar/StockSearch';
import { WatchList } from '@/components/sidebar/WatchList';
import { SentimentPanel } from '@/components/sentiment/SentimentPanel';
import { useAppState } from '@/hooks/useAppState';
import { Switch } from '@/components/ui/switch';

export function Sidebar() {
  const { isMonitoring, setIsMonitoring, watchlist } = useAppState();

  return (
    <div className="w-[250px] shrink-0 bg-[#0d1117] border-r border-[#1e293b] flex flex-col h-full overflow-hidden">
      {/* Logo */}
      <div className="px-3 py-3 border-b border-[#1e293b]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#3b82f6] flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <span className="text-sm font-bold text-[#e2e8f0]">A股智能分析</span>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-[#1e293b]">
        <StockSearch />
      </div>

      {/* Monitor switch */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e293b]">
        <span className="text-xs text-[#94a3b8]">实时监控</span>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isMonitoring ? 'bg-[#22c55e] animate-pulse' : 'bg-[#94a3b8]'}`} />
          <Switch checked={isMonitoring} onCheckedChange={setIsMonitoring} />
        </div>
      </div>

      {/* Watchlist */}
      <div className="flex flex-col flex-1 min-h-0">
        <div className="px-3 py-2 text-xs font-medium text-[#94a3b8] uppercase tracking-wider border-b border-[#1e293b]">
          自选股 ({watchlist.length})
        </div>
        <WatchList />
      </div>

      {/* Sentiment */}
      <div className="border-t border-[#1e293b] max-h-[400px] overflow-y-auto">
        <SentimentPanel stockCode="600519" stockName="贵州茅台" sectorName="白酒" />
      </div>
    </div>
  );
}

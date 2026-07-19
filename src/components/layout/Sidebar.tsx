'use client';

import { useState } from 'react';
import { StockSearch } from '@/components/sidebar/StockSearch';
import { WatchList } from '@/components/sidebar/WatchList';
import { SentimentPanel } from '@/components/sentiment/SentimentPanel';
import { useAppState } from '@/hooks/useAppState';
import { Switch } from '@/components/ui/switch';
import ThemeSwitcher from '@/components/ui/ThemeSwitcher';

type SidebarView = 'stocks' | 'dashboard';

// 预设分组
const STOCK_GROUPS: Record<string, { label: string; color: string; codes: string[] }> = {
  ai: { label: 'AI算力', color: '#a855f7', codes: ['688256', '300308', '002230', '603019'] },
  new_energy: { label: '新能源', color: '#22c55e', codes: ['300750', '002594', '601012'] },
  consumer: { label: '消费', color: '#f59e0b', codes: ['600519', '000858', '002714'] },
  semiconductor: { label: '半导体', color: '#3b82f6', codes: ['688981', '002371', '603501'] },
};

export function Sidebar() {
  const { isMonitoring, setIsMonitoring, watchlist, selectedStock, currentQuote } = useAppState();
  const [view, setView] = useState<SidebarView>('stocks');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['ai']));

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  // 获取分组中的自选股
  const getGroupStocks = (codes: string[]) => {
    return watchlist.filter(s => codes.includes(s.code));
  };

  // 未分组的自选股
  const groupedCodes = new Set(Object.values(STOCK_GROUPS).flatMap(g => g.codes));
  const ungroupedStocks = watchlist.filter(s => !groupedCodes.has(s.code));

  return (
    <div className="w-[260px] shrink-0 bg-[#0d1117] border-r border-[#1e293b] flex flex-col h-full overflow-hidden">
      {/* Logo + Dashboard Entry */}
      <div className="px-3 py-3 border-b border-[#1e293b]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#3b82f6] flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-sm font-bold text-[#e2e8f0]">A股智能分析</span>
          </div>
          <ThemeSwitcher />
        </div>
        {/* View Tabs */}
        <div className="flex mt-2 bg-[#1e293b] rounded p-0.5">
          <button
            onClick={() => setView('stocks')}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              view === 'stocks' ? 'bg-[#3b82f6] text-white' : 'text-[#94a3b8] hover:text-[#e2e8f0]'
            }`}
          >
            自选股
          </button>
          <button
            onClick={() => setView('dashboard')}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              view === 'dashboard' ? 'bg-[#3b82f6] text-white' : 'text-[#94a3b8] hover:text-[#e2e8f0]'
            }`}
          >
            仪表盘
          </button>
        </div>
      </div>

      {/* Search - always on top */}
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

      {/* Content */}
      {view === 'stocks' ? (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Grouped Watchlist */}
          <div className="flex-1 overflow-y-auto">
            {Object.entries(STOCK_GROUPS).map(([key, group]) => {
              const groupStocks = getGroupStocks(group.codes);
              if (groupStocks.length === 0) return null;
              const isExpanded = expandedGroups.has(key);
              return (
                <div key={key} className="border-b border-[#1e293b]">
                  <button
                    onClick={() => toggleGroup(key)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#1e293b]/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                      <span className="text-xs font-medium text-[#e2e8f0]">{group.label}</span>
                      <span className="text-xs text-[#94a3b8]">({groupStocks.length})</span>
                    </div>
                    <svg
                      className={`w-3 h-3 text-[#94a3b8] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isExpanded && (
                    <div>
                      {groupStocks.map(stock => (
                        <WatchListItem key={stock.code} stock={stock} groupColor={group.color} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Ungrouped stocks */}
            {ungroupedStocks.length > 0 && (
              <div className="border-b border-[#1e293b]">
                <div className="px-3 py-2">
                  <span className="text-xs font-medium text-[#94a3b8]">其他 ({ungroupedStocks.length})</span>
                </div>
                {ungroupedStocks.map(stock => (
                  <WatchListItem key={stock.code} stock={stock} />
                ))}
              </div>
            )}
            {/* Empty state */}
            {watchlist.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-[#94a3b8]">
                搜索股票并添加到自选
              </div>
            )}
          </div>
        </div>
      ) : (
        <DashboardView />
      )}

      {/* Sentiment */}
      <div className="border-t border-[#1e293b] max-h-[300px] overflow-y-auto">
        <SentimentPanel stockCode={selectedStock?.code || '600519'} stockName={selectedStock?.name || '贵州茅台'} sectorName="白酒" />
      </div>
    </div>
  );
}

// 自选股列表项
function WatchListItem({ stock, groupColor }: { stock: { code: string; name: string; market: 'sh' | 'sz' | 'bj' }; groupColor?: string }) {
  const { setSelectedStock, selectedStock, currentQuote } = useAppState();
  const isSelected = selectedStock?.code === stock.code;

  return (
    <div
      onClick={() => setSelectedStock({ code: stock.code, name: stock.name, market: stock.market, type: 'stock' })}
      className={`
        flex items-center justify-between px-3 py-2 pl-6 cursor-pointer transition-all
        ${isSelected ? 'bg-[#1e293b] border-l-2 border-l-[#3b82f6]' : 'hover:bg-[#1e293b]/50 border-l-2 border-l-transparent'}
      `}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          {groupColor && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: groupColor }} />}
          <span className="text-sm text-[#e2e8f0] truncate">{stock.name}</span>
        </div>
        <span className="text-xs text-[#94a3b8] font-mono-num">{stock.code}</span>
      </div>
      {currentQuote && selectedStock?.code === stock.code && (
        <span className={`text-xs font-mono-num ${
          currentQuote.changePercent > 0 ? 'text-[#ef4444]' :
          currentQuote.changePercent < 0 ? 'text-[#22c55e]' : 'text-[#94a3b8]'
        }`}>
          {currentQuote.changePercent > 0 ? '+' : ''}{currentQuote.changePercent.toFixed(2)}%
        </span>
      )}
    </div>
  );
}

// 仪表盘视图
function DashboardView() {
  const { selectedStock, currentQuote } = useAppState();

  // 模拟持仓数据
  const mockPositions = [
    { code: '300308', name: '中际旭创', shares: 200, avgCost: 128.5, currentPrice: 135.2, pnl: 1340 },
    { code: '688256', name: '寒武纪', shares: 100, avgCost: 215.0, currentPrice: 208.5, pnl: -650 },
    { code: '600519', name: '贵州茅台', shares: 50, avgCost: 1680.0, currentPrice: 1725.0, pnl: 2250 },
  ];

  const totalPnl = mockPositions.reduce((sum, p) => sum + p.pnl, 0);
  const totalValue = mockPositions.reduce((sum, p) => sum + p.shares * p.currentPrice, 0);

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {/* 总资产卡片 */}
      <div className="bg-[#111827] rounded p-3 border border-[#1e293b]">
        <div className="text-xs text-[#94a3b8] mb-1">持仓总览</div>
        <div className="text-lg font-bold text-[#e2e8f0] font-mono-num">
          ¥{totalValue.toLocaleString()}
        </div>
        <div className={`text-sm font-mono-num ${totalPnl >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
          {totalPnl >= 0 ? '+' : ''}¥{totalPnl.toLocaleString()}
        </div>
      </div>

      {/* 今日盈亏 */}
      <div className="bg-[#111827] rounded p-3 border border-[#1e293b]">
        <div className="text-xs text-[#94a3b8] mb-1">今日盈亏</div>
        <div className="text-lg font-bold text-[#ef4444] font-mono-num">+¥2,840</div>
        <div className="text-xs text-[#94a3b8]">较昨日 +0.85%</div>
      </div>

      {/* 风险预警 */}
      <div className="bg-[#111827] rounded p-3 border border-[#1e293b]">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-[#f59e0b] animate-pulse" />
          <span className="text-xs font-medium text-[#e2e8f0]">风险预警</span>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-[#f59e0b]">• 寒武纪连续3日下跌，注意止损</div>
          <div className="text-xs text-[#94a3b8]">• 大盘情绪偏谨慎，建议控制仓位</div>
        </div>
      </div>

      {/* 重点关注 */}
      <div className="bg-[#111827] rounded p-3 border border-[#1e293b]">
        <div className="text-xs font-medium text-[#e2e8f0] mb-2">重点关注</div>
        <div className="space-y-2">
          {mockPositions.map(p => (
            <div key={p.code} className="flex items-center justify-between">
              <div>
                <div className="text-xs text-[#e2e8f0]">{p.name}</div>
                <div className="text-xs text-[#94a3b8] font-mono-num">{p.code}</div>
              </div>
              <div className="text-right">
                <div className={`text-xs font-mono-num ${p.pnl >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                  {p.pnl >= 0 ? '+' : ''}¥{p.pnl}
                </div>
                <div className="text-xs text-[#94a3b8] font-mono-num">
                  {((p.currentPrice - p.avgCost) / p.avgCost * 100).toFixed(2)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 当前股票信息 */}
      {selectedStock && currentQuote && (
        <div className="bg-[#111827] rounded p-3 border border-[#3b82f6]/30">
          <div className="text-xs text-[#94a3b8] mb-1">当前查看</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[#e2e8f0]">{selectedStock.name}</div>
              <div className="text-xs text-[#94a3b8] font-mono-num">{selectedStock.code}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-[#e2e8f0] font-mono-num">{currentQuote.price.toFixed(2)}</div>
              <div className={`text-xs font-mono-num ${currentQuote.changePercent >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                {currentQuote.changePercent >= 0 ? '+' : ''}{currentQuote.changePercent.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

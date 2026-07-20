'use client';

import { useState, useEffect } from 'react';
import { StockSearch } from '@/components/sidebar/StockSearch';
import { useAppState } from '@/hooks/useAppState';
import { Switch } from '@/components/ui/switch';
import ThemeSwitcher from '@/components/ui/ThemeSwitcher';
import { getAllAccounts, calculateMetrics } from '@/components/backtest/storage';
import type { Account } from '@/components/backtest/types';

type SidebarView = 'stocks' | 'dashboard' | 'learning';

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
  const [collapsed, setCollapsed] = useState(false);

  // 从 localStorage 读取折叠状态
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  // 保存折叠状态到 localStorage
  const toggleCollapse = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', String(newState));
  };

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
    <div className={`${collapsed ? 'w-16' : 'w-[260px]'} shrink-0 bg-[var(--bg-primary)] border-r border-[var(--border-default)] flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out relative group`}>
      {/* Collapse Button */}
      <button
        onClick={toggleCollapse}
        className="absolute top-2 right-1 z-10 w-6 h-6 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
        title={collapsed ? '展开侧边栏' : '折叠侧边栏'}
      >
        <svg className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      </button>

      {/* Logo + Theme Switcher */}
      <div className="px-3 py-3 border-b border-[var(--border-default)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[var(--accent-blue)] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            {!collapsed && <span className="text-sm font-bold text-[var(--text-primary)] whitespace-nowrap">A股智能分析</span>}
          </div>
          {!collapsed && <ThemeSwitcher />}
        </div>
        {/* View Tabs - only show when expanded */}
        {!collapsed && (
          <div className="flex mt-2 bg-[var(--bg-card)] rounded p-0.5">
            <button
              onClick={() => setView('stocks')}
              className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                view === 'stocks' ? 'bg-[var(--accent-blue)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              自选股
            </button>
            <button
              onClick={() => setView('dashboard')}
              className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                view === 'dashboard' ? 'bg-[var(--accent-blue)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              仪表盘
            </button>
            <button
              onClick={() => setView('learning')}
              className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                view === 'learning' ? 'bg-[var(--accent-blue)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              学习
            </button>
          </div>
        )}
      </div>

      {/* Collapsed state: show icons only */}
      {collapsed ? (
        <div className="flex flex-col items-center py-4 gap-4">
          <button
            onClick={() => setView('stocks')}
            className={`w-10 h-10 rounded flex items-center justify-center transition-colors ${
              view === 'stocks' ? 'bg-[var(--accent-blue)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]'
            }`}
            title="自选股"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
          <button
            onClick={() => setView('dashboard')}
            className={`w-10 h-10 rounded flex items-center justify-center transition-colors ${
              view === 'dashboard' ? 'bg-[var(--accent-blue)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]'
            }`}
            title="仪表盘"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
          <button
            onClick={() => setView('learning')}
            className={`w-10 h-10 rounded flex items-center justify-center transition-colors ${
              view === 'learning' ? 'bg-[var(--accent-blue)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]'
            }`}
            title="学习中心"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.668 18.477 18.082 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </button>
          <div className="w-8 h-px bg-[var(--bg-card)] my-2" />
          <div className={`w-10 h-10 rounded flex items-center justify-center ${isMonitoring ? 'text-[#22c55e]' : 'text-[var(--text-secondary)]'}`} title={isMonitoring ? '监控中' : '监控关闭'}>
            <div className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-[#22c55e] animate-pulse' : 'bg-[#94a3b8]'}`} />
          </div>
        </div>
      ) : (
        <>
          {/* Search - always on top */}
          <div className="px-3 py-2 border-b border-[var(--border-default)]">
            <StockSearch />
          </div>

          {/* Monitor switch */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-default)]">
            <span className="text-xs text-[var(--text-secondary)]">实时监控</span>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isMonitoring ? 'bg-[#22c55e] animate-pulse' : 'bg-[#94a3b8]'}`} />
              <Switch checked={isMonitoring} onCheckedChange={setIsMonitoring} />
            </div>
          </div>

          {/* Content */}
          {view === 'stocks' ? (
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
              {/* Grouped Watchlist */}
              {Object.entries(STOCK_GROUPS).map(([key, group]) => {
                const groupStocks = getGroupStocks(group.codes);
                if (groupStocks.length === 0) return null;
                const isExpanded = expandedGroups.has(key);
                return (
                  <div key={key} className="border-b border-[var(--border-default)]">
                    <button
                      onClick={() => toggleGroup(key)}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-[var(--bg-card)]/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                        <span className="text-xs font-medium text-[var(--text-primary)]">{group.label}</span>
                        <span className="text-xs text-[var(--text-secondary)]">({groupStocks.length})</span>
                      </div>
                      <svg
                        className={`w-3 h-3 text-[var(--text-secondary)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
                <div className="border-b border-[var(--border-default)]">
                  <div className="px-3 py-2">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">其他 ({ungroupedStocks.length})</span>
                  </div>
                  {ungroupedStocks.map(stock => (
                    <WatchListItem key={stock.code} stock={stock} />
                  ))}
                </div>
              )}
              {/* Empty state */}
              {watchlist.length === 0 && (
                <div className="px-3 py-4 text-center text-xs text-[var(--text-secondary)]">
                  搜索股票并添加到自选
                </div>
              )}
            </div>
          ) : view === 'dashboard' ? (
            <DashboardView />
          ) : (
            <LearningEntry />
          )}
        </>
      )}
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
        ${isSelected ? 'bg-[var(--bg-card)] border-l-2 border-l-[#3b82f6]' : 'hover:bg-[var(--bg-card)]/50 border-l-2 border-l-transparent'}
      `}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          {groupColor && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: groupColor }} />}
          <span className="text-sm text-[var(--text-primary)] truncate">{stock.name}</span>
        </div>
        <span className="text-xs text-[var(--text-secondary)] font-mono-num">{stock.code}</span>
      </div>
      {currentQuote && selectedStock?.code === stock.code && (
        <span className={`text-xs font-mono-num ${
          currentQuote.changePercent > 0 ? 'text-[#ef4444]' :
          currentQuote.changePercent < 0 ? 'text-[#22c55e]' : 'text-[var(--text-secondary)]'
        }`}>
          {currentQuote.changePercent > 0 ? '+' : ''}{currentQuote.changePercent.toFixed(2)}%
        </span>
      )}
    </div>
  );
}

// 学习入口
function LearningEntry() {
  const { setSelectedStock } = useAppState();
  
  const learningModules = [
    { id: 'chanlun', icon: '📐', title: '缠论基础', desc: '分型、笔、线段、中枢、买卖点' },
    { id: 'wave', icon: '🌊', title: '波浪理论', desc: '8浪循环、铁律、各浪特征' },
    { id: 'indicator', icon: '📊', title: '技术指标', desc: 'MACD、KDJ、RSI、BOLL、MA' },
    { id: 'pattern', icon: '🕯️', title: 'K线形态', desc: '单K线、双K线、三K线组合' },
    { id: 'position', icon: '💼', title: '仓位管理', desc: '建仓、止损、止盈策略' },
    { id: 'cases', icon: '📚', title: '经典案例', desc: '实战案例分析' },
    { id: 'compare', icon: '🔄', title: '多理论对比', desc: '同一走势多视角分析' },
    { id: 'review', icon: '🔍', title: '实战复盘', desc: '交易复盘与总结' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="text-xs text-[var(--text-secondary)] mb-3">选择学习模块</div>
      <div className="space-y-2">
        {learningModules.map(mod => (
          <button
            key={mod.id}
            onClick={() => {
              // Navigate to learning center in main area
              window.dispatchEvent(new CustomEvent('navigate-learning', { detail: mod.id }));
            }}
            className="w-full flex items-center gap-3 p-3 bg-[var(--bg-panel)] rounded border border-[var(--border-default)] hover:border-[var(--accent-blue)]/50 transition-colors text-left"
          >
            <span className="text-xl">{mod.icon}</span>
            <div>
              <div className="text-sm text-[var(--text-primary)]">{mod.title}</div>
              <div className="text-xs text-[var(--text-secondary)]">{mod.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// 仪表盘视图 - 使用真实回测账户数据
function DashboardView() {
  const { selectedStock, currentQuote } = useAppState();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // 加载账户列表
  useState(() => {
    const allAccounts = getAllAccounts();
    setAccounts(allAccounts);
    if (allAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(allAccounts[0].id);
    }
  });

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const metrics = selectedAccount ? calculateMetrics(selectedAccount) : null;
  const positions = selectedAccount?.positions || [];
  const marketValue = positions.reduce((sum, p) => sum + (p.marketValue || 0), 0);
  const totalPnl = positions.reduce((sum, p) => sum + (p.pnl || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {/* 账户选择 */}
      <div className="bg-[var(--bg-panel)] rounded p-3 border border-[var(--border-default)]">
        <div className="text-xs text-[var(--text-secondary)] mb-2">选择账户</div>
        {accounts.length === 0 ? (
          <div className="text-xs text-[var(--text-secondary)]">暂无账户，请在回测面板创建</div>
        ) : (
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full bg-[var(--bg-card)] border border-[#374151] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* 持仓总览 */}
      {selectedAccount && metrics && (
        <>
          <div className="bg-[var(--bg-panel)] rounded p-3 border border-[var(--border-default)]">
            <div className="text-xs text-[var(--text-secondary)] mb-1">持仓市值</div>
            <div className="text-lg font-bold text-[var(--text-primary)] font-mono-num">
              ¥{marketValue.toLocaleString()}
            </div>
            <div className={`text-sm font-mono-num ${totalPnl >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
              {totalPnl >= 0 ? '+' : ''}¥{totalPnl.toLocaleString()}
            </div>
          </div>

          {/* 账户统计 */}
          <div className="bg-[var(--bg-panel)] rounded p-3 border border-[var(--border-default)]">
            <div className="text-xs text-[var(--text-secondary)] mb-2">账户统计</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-[var(--text-secondary)]">累计收益</div>
                <div className={`text-sm font-mono-num ${metrics.totalReturn >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                  {metrics.totalReturn >= 0 ? '+' : ''}{metrics.totalReturn.toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-secondary)]">可用资金</div>
                <div className="text-sm font-mono-num text-[var(--text-primary)]">
                  ¥{selectedAccount.currentCapital.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-secondary)]">最大回撤</div>
                <div className="text-sm font-mono-num text-[#f59e0b]">
                  {metrics.maxDrawdown.toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-secondary)]">胜率</div>
                <div className="text-sm font-mono-num text-[var(--text-primary)]">
                  {metrics.winRate.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 持仓列表 */}
      {positions.length > 0 && (
        <div className="bg-[var(--bg-panel)] rounded p-3 border border-[var(--border-default)]">
          <div className="text-xs font-medium text-[var(--text-primary)] mb-2">当前持仓 ({positions.length})</div>
          <div className="space-y-2">
            {positions.map(p => (
              <div key={p.stockCode} className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-[var(--text-primary)]">{p.stockName}</div>
                  <div className="text-xs text-[var(--text-secondary)] font-mono-num">{p.stockCode}</div>
                </div>
                <div className="text-right">
                  <div className={`text-xs font-mono-num ${p.pnl >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                    {p.pnl >= 0 ? '+' : ''}¥{p.pnl.toFixed(0)}
                  </div>
                  <div className={`text-xs font-mono-num ${p.pnlPercent >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                    {p.pnlPercent >= 0 ? '+' : ''}{p.pnlPercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 无持仓提示 */}
      {selectedAccount && positions.length === 0 && (
        <div className="bg-[var(--bg-panel)] rounded p-3 border border-[var(--border-default)]">
          <div className="text-xs text-[var(--text-secondary)] text-center">暂无持仓</div>
        </div>
      )}

      {/* 风险预警 */}
      {selectedAccount && (
        <div className="bg-[var(--bg-panel)] rounded p-3 border border-[var(--border-default)]">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${marketValue / (selectedAccount.initialCapital || 1) > 0.7 ? 'bg-[#ef4444]' : 'bg-[#22c55e]'} animate-pulse`} />
            <span className="text-xs font-medium text-[var(--text-primary)]">风险状态</span>
          </div>
          <div className="space-y-1">
            {marketValue / (selectedAccount.initialCapital || 1) > 0.7 && (
              <div className="text-xs text-[#ef4444]">• 仓位过重，建议降低仓位</div>
            )}
            {totalPnl < 0 && Math.abs(totalPnl) / (selectedAccount.initialCapital || 1) > 0.05 && (
              <div className="text-xs text-[#f59e0b]">• 亏损超过5%，注意止损</div>
            )}
            {positions.length === 0 && (
              <div className="text-xs text-[var(--text-secondary)]">• 空仓状态</div>
            )}
          </div>
        </div>
      )}

      {/* 当前股票信息 */}
      {selectedStock && currentQuote && (
        <div className="bg-[var(--bg-panel)] rounded p-3 border border-[var(--accent-blue)]/30">
          <div className="text-xs text-[var(--text-secondary)] mb-1">当前查看</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">{selectedStock.name}</div>
              <div className="text-xs text-[var(--text-secondary)] font-mono-num">{selectedStock.code}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-[var(--text-primary)] font-mono-num">{currentQuote.price.toFixed(2)}</div>
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

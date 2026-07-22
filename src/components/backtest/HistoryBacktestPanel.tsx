'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Search, Settings, Play, Download, Loader2, X, TrendingUp, TrendingDown,
  BarChart3, Save, Trash2, FolderOpen, ChevronDown, ChevronRight, Eye,
  Calendar, DollarSign, Tag, MessageSquare,
} from 'lucide-react';
import {
  runBacktestEnhanced,
  type StrategyType,
  type BacktestConfig,
  type EnhancedBacktestTrade,
  type EnhancedBacktestResult,
  getStrategyLabel,
} from '@/lib/backtest-engine';
import type { KLineData } from '@/lib/types';
import { fetchKLineData as fetchKLineFromSource } from '@/lib/data-source';
import {
  saveSession,
  getAllSessions,
  deleteSession,
  updateSession,
  type BacktestSession,
  type BacktestTradeRecord,
  type BacktestDailyRecord,
  type BacktestPositionSnapshot,
  type BacktestMetrics,
} from './backtest-session-storage';
import { BacktestChart } from './BacktestChart';

// ============ 常量 ============

interface StockInfo {
  code: string;
  name: string;
  klineData: KLineData[];
}

interface KLineFetchResult {
  success: boolean;
  data?: KLineData[];
  error?: string;
}

const STRATEGY_OPTIONS: Array<{ value: StrategyType; label: string; group: string }> = [
  { value: "macd_golden_cross", label: "MACD金叉", group: "技术指标" },
  { value: "macd_death_cross", label: "MACD死叉", group: "技术指标" },
  { value: "kdj_oversold", label: "KDJ超卖", group: "技术指标" },
  { value: "kdj_overbought", label: "KDJ超买", group: "技术指标" },
  { value: "rsi_oversold", label: "RSI超卖", group: "技术指标" },
  { value: "rsi_overbought", label: "RSI超买", group: "技术指标" },
  { value: "boll_lower_touch", label: "触及布林下轨", group: "技术指标" },
  { value: "boll_upper_touch", label: "触及布林上轨", group: "技术指标" },
  { value: "ma_golden_cross", label: "均线金叉", group: "技术指标" },
  { value: "ma_death_cross", label: "均线死叉", group: "技术指标" },
  { value: "chanlun_buy", label: "缠论买点", group: "分析引擎" },
  { value: "chanlun_sell", label: "缠论卖点", group: "分析引擎" },
  { value: "wave_buy", label: "波浪起点", group: "分析引擎" },
  { value: "wave_sell", label: "波浪终点", group: "分析引擎" },
  { value: "tech_resonance_buy", label: "多指标共振买", group: "分析引擎" },
  { value: "tech_resonance_sell", label: "多指标共振卖", group: "分析引擎" },
];

const TIME_RANGES = [
  { days: 60, label: "3个月" },
  { days: 120, label: "半年" },
  { days: 252, label: "1年" },
  { days: 504, label: "2年" },
  { days: 0, label: "全部" },
];

type DetailTab = 'metrics' | 'equity' | 'positions' | 'trades';

// ============ 主组件 ============

export function HistoryBacktestPanel() {
  // 视图模式：config(配置) / result(结果) / sessions(历史记录)
  const [viewMode, setViewMode] = useState<'config' | 'result' | 'sessions'>('config');

  // 股票输入
  const [stockInput, setStockInput] = useState("");
  const [stockList, setStockList] = useState<StockInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // 回测配置
  const [strategies, setStrategies] = useState<StrategyType[]>(["macd_golden_cross", "macd_death_cross"]);
  const [timeRange, setTimeRange] = useState(252);
  const [initialCapital, setInitialCapital] = useState(1000000);

  // 回测状态
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, stockCode: '', stockName: '' });

  // 回测结果
  const [currentSession, setCurrentSession] = useState<BacktestSession | null>(null);
  const [activeStockIdx, setActiveStockIdx] = useState(0);
  const [detailTab, setDetailTab] = useState<DetailTab>('metrics');
  const [selectedTrade, setSelectedTrade] = useState<BacktestTradeRecord | null>(null);
  const [showKlineForStock, setShowKlineForStock] = useState<string | null>(null);

  // 历史记录
  const [savedSessions, setSavedSessions] = useState<BacktestSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // 用户标注
  const [editingNoteTradeId, setEditingNoteTradeId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  // K线拉取范围选项：'full' 完整K线 / 'range' 仅回测时间范围内
  const [klineFetchMode, setKlineFetchMode] = useState<'full' | 'range'>('range');

  // ============ 数据获取 ============

  const searchAndAddStock = useCallback(async (code: string) => {
    try {
      const res = await fetch(`/api/stock?action=search&keyword=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        const stock = data.data[0];
        return { code: stock.code, name: stock.name || stock.code };
      }
      return null;
    } catch { return null; }
  }, []);

  const fetchKLineData = useCallback(async (code: string, dateRange?: { start: string; end: string }): Promise<KLineFetchResult> => {
    // 如果指定了日期范围且模式为 'range'，拉取更多数据然后过滤
    const limit = dateRange ? 2000 : 1000;
    const result = await fetchKLineFromSource(code, "daily", { limit });
    if (result.success && result.data.length > 0) {
      let data = result.data;
      // 按日期范围过滤
      if (dateRange && klineFetchMode === 'range') {
        const startDate = dateRange.start;
        const endDate = dateRange.end;
        data = data.filter(d => d.date >= startDate && d.date <= endDate);
      }
      return { success: true, data };
    }
    return { success: false, error: result.error || "无K线数据" };
  }, [klineFetchMode]);

  // ============ 股票操作 ============

  const handleAddStock = useCallback(async () => {
    if (!stockInput.trim()) return;
    setIsSearching(true);
    setSearchError("");

    const codes = stockInput.split(/[,，\s]+/).map(s => s.trim()).filter(s => s.length > 0);
    if (codes.length === 0) {
      setSearchError("请输入有效的股票代码");
      setIsSearching(false);
      return;
    }

    const newStocks: StockInfo[] = [];
    const errors: string[] = [];

    for (const code of codes) {
      if (stockList.some(s => s.code === code)) { errors.push(`${code} 已存在`); continue; }
      const stockInfo = await searchAndAddStock(code);
      if (!stockInfo) { errors.push(`${code} 未找到`); continue; }
      const klineResult = await fetchKLineData(stockInfo.code);
      if (!klineResult.success || !klineResult.data?.length) {
        errors.push(`${stockInfo.name}: ${klineResult.error || '无数据'}`);
        continue;
      }
      newStocks.push({ code: stockInfo.code, name: stockInfo.name, klineData: klineResult.data });
    }

    if (newStocks.length > 0) setStockList(prev => [...prev, ...newStocks]);
    if (errors.length > 0) setSearchError(errors.join("；"));
    setStockInput("");
    setIsSearching(false);
  }, [stockInput, stockList, searchAndAddStock, fetchKLineData]);

  const removeStock = (code: string) => setStockList(prev => prev.filter(s => s.code !== code));

  // ============ 策略操作 ============

  const toggleStrategy = (s: StrategyType) => {
    setStrategies(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const toggleAllStrategies = () => {
    setStrategies(prev => prev.length === STRATEGY_OPTIONS.length ? [] : STRATEGY_OPTIONS.map(s => s.value));
  };

  // ============ 执行回测 ============

  const handleRunBacktest = useCallback(async () => {
    if (stockList.length === 0 || strategies.length === 0) return;

    setIsRunning(true);
    setProgress({ current: 0, total: stockList.length, stockCode: stockList[0].code, stockName: stockList[0].name });

    const results: BacktestSession['results'] = [];
    const allEquityRecords: Map<string, BacktestDailyRecord> = new Map();

    for (let i = 0; i < stockList.length; i++) {
      const stock = stockList[i];
      setProgress({ current: i + 1, total: stockList.length, stockCode: stock.code, stockName: stock.name });

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          try {
            const filteredKline = timeRange > 0 ? stock.klineData.slice(-timeRange) : stock.klineData;
            const config: BacktestConfig = {
              strategies, initialCapital, commission: 0.0003, slippage: 0.001, positionSize: 0.95,
            };
            const result = runBacktestEnhanced(filteredKline, config);

            // 转换交易记录
            const trades: BacktestTradeRecord[] = result.trades.map((t, idx) => ({
              id: `trade_${stock.code}_${idx}_${t.date}`,
              date: t.date,
              stockCode: stock.code,
              stockName: stock.name,
              direction: t.type,
              price: t.price,
              quantity: t.shares,
              amount: t.amount,
              commission: t.commission,
              strategy: t.strategy,
              reasoning: {
                strategyLabel: getStrategyLabel(t.strategy),
                indicatorSnapshot: t.indicatorSnapshot,
                ohlcvSnapshot: t.ohlcvSnapshot,
                description: t.reasoningDescription,
              },
            }));

            // 最终持仓
            const lastRecord = result.dailyRecords[result.dailyRecords.length - 1];
            const finalPosition: BacktestPositionSnapshot | null = lastRecord && lastRecord.position > 0
              ? {
                  stockCode: stock.code, stockName: stock.name,
                  quantity: lastRecord.position, avgCost: trades.filter(t => t.direction === 'buy').reduce((s, t) => s + t.price * t.quantity, 0) / Math.max(1, trades.filter(t => t.direction === 'buy').reduce((s, t) => s + t.quantity, 0)),
                  currentPrice: filteredKline[filteredKline.length - 1]?.close || 0,
                  entryDate: trades.find(t => t.direction === 'buy')?.date || '',
                  unrealizedPnl: (filteredKline[filteredKline.length - 1]?.close || 0) * lastRecord.position - (trades.filter(t => t.direction === 'buy').reduce((s, t) => s + t.price * t.quantity, 0) - trades.filter(t => t.direction === 'sell').reduce((s, t) => s + t.price * t.quantity, 0)),
                  unrealizedPnlPercent: 0,
                }
              : null;

            if (finalPosition) {
              const costBasis = trades.filter(t => t.direction === 'buy').reduce((s, t) => s + t.price * t.quantity, 0) - trades.filter(t => t.direction === 'sell').reduce((s, t) => s + t.price * t.quantity, 0);
              const currentVal = finalPosition.currentPrice * finalPosition.quantity;
              finalPosition.unrealizedPnl = currentVal - costBasis;
              finalPosition.unrealizedPnlPercent = costBasis > 0 ? (currentVal - costBasis) / costBasis : 0;
            }

            results.push({
              stockCode: stock.code, stockName: stock.name,
              trades, dailyRecords: result.dailyRecords,
              metrics: result.metrics as BacktestMetrics,
              finalPosition,
            });

            // 合并资金曲线
            for (const rec of result.dailyRecords) {
              const existing = allEquityRecords.get(rec.date);
              if (existing) {
                existing.capital += rec.capital;
                existing.positionValue += rec.positionValue;
                existing.totalValue += rec.totalValue;
                existing.benchmark += rec.benchmark;
              } else {
                allEquityRecords.set(rec.date, { ...rec });
              }
            }
          } catch (err) {
            console.error(`Backtest error for ${stock.code}:`, err);
          }
          resolve();
        }, 50);
      });
    }

    // 汇总指标
    const totalInvested = initialCapital * stockList.length;
    const totalFinal = Array.from(allEquityRecords.values()).pop()?.totalValue || totalInvested;
    const summaryMetrics: BacktestMetrics = {
      totalReturn: (totalFinal - totalInvested) / totalInvested,
      annualizedReturn: results.length > 0 ? results.reduce((s, r) => s + r.metrics.annualizedReturn, 0) / results.length : 0,
      maxDrawdown: Math.max(...results.map(r => r.metrics.maxDrawdown), 0),
      sharpeRatio: results.length > 0 ? results.reduce((s, r) => s + r.metrics.sharpeRatio, 0) / results.length : 0,
      winRate: results.reduce((s, r) => s + r.metrics.totalTrades, 0) > 0
        ? results.reduce((s, r) => s + r.metrics.winningTrades, 0) / results.reduce((s, r) => s + r.metrics.totalTrades, 0)
        : 0,
      profitLossRatio: results.length > 0 ? results.reduce((s, r) => s + r.metrics.profitLossRatio, 0) / results.length : 0,
      totalTrades: results.reduce((s, r) => s + r.metrics.totalTrades, 0),
      winningTrades: results.reduce((s, r) => s + r.metrics.winningTrades, 0),
      losingTrades: results.reduce((s, r) => s + r.metrics.losingTrades, 0),
    };

    const equityCurve = Array.from(allEquityRecords.values()).sort((a, b) => a.date.localeCompare(b.date));

    const session: BacktestSession = {
      id: '', name: '', createdAt: 0,
      config: {
        stocks: stockList.map(s => ({ code: s.code, name: s.name })),
        dateRange: {
          start: equityCurve[0]?.date || '',
          end: equityCurve[equityCurve.length - 1]?.date || '',
        },
        strategies, initialCapital, commission: 0.0003, slippage: 0.001, positionSize: 0.95,
      },
      status: 'completed',
      results,
      summaryMetrics,
      equityCurve,
    };

    setCurrentSession(session);
    setActiveStockIdx(0);
    setDetailTab('metrics');
    setSelectedTrade(null);
    setShowKlineForStock(null);
    setIsRunning(false);
    setViewMode('result');
  }, [stockList, strategies, timeRange, initialCapital]);

  // ============ 保存/加载会话 ============

  const handleSaveSession = useCallback(async () => {
    if (!currentSession) return;
    const name = prompt('为这次回测命名：', `${currentSession.config.stocks.map(s => s.name).join('/')} ${currentSession.config.dateRange.start}~${currentSession.config.dateRange.end}`);
    if (!name) return;
    const saved = await saveSession({ ...currentSession, name });
    setCurrentSession(saved);
    alert('保存成功！');
  }, [currentSession]);

  const loadSavedSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    const sessions = await getAllSessions();
    setSavedSessions(sessions);
    setIsLoadingSessions(false);
  }, []);

  const handleLoadSession = useCallback(async (session: BacktestSession) => {
    setCurrentSession(session);
    setActiveStockIdx(0);
    setDetailTab('metrics');
    setSelectedTrade(null);
    setShowKlineForStock(null);
    setViewMode('result');

    // 异步拉取所有股票的K线数据
    const configStocks = session.config.stocks;
    if (configStocks.length > 0) {
      setIsLoadingSessions(true);
      const loadedStocks: StockInfo[] = [];
      const dateRange = session.config.dateRange;
      for (const stock of configStocks) {
        const klineResult = await fetchKLineData(stock.code, dateRange);
        loadedStocks.push({
          code: stock.code,
          name: stock.name,
          klineData: (klineResult.success ? klineResult.data : null) ?? [],
        });
      }
      setStockList(loadedStocks);
      setIsLoadingSessions(false);
    }
  }, [fetchKLineData]);

  const handleDeleteSession = useCallback(async (id: string) => {
    if (!confirm('确定删除这条回测记录？')) return;
    await deleteSession(id);
    setSavedSessions(prev => prev.filter(s => s.id !== id));
  }, []);

  // ============ 用户标注 ============

  const handleSaveNote = useCallback(async (tradeId: string) => {
    if (!currentSession) return;
    // 找到对应的交易并添加标注
    for (const result of currentSession.results) {
      const trade = result.trades.find(t => t.id === tradeId);
      if (trade) {
        trade.userNote = noteText;
        break;
      }
    }
    await updateSession(currentSession);
    setCurrentSession({ ...currentSession });
    setEditingNoteTradeId(null);
    setNoteText('');
  }, [currentSession, noteText]);

  // ============ 导出CSV ============

  const exportCSV = useCallback(() => {
    if (!currentSession) return;
    const allTrades = currentSession.results.flatMap(r => r.trades);
    const headers = ["日期", "股票", "方向", "价格", "数量", "金额", "手续费", "策略", "依据"];
    const rows = allTrades.map(t => [
      t.date, t.stockName, t.direction === 'buy' ? '买入' : '卖出',
      t.price.toFixed(2), t.quantity, t.amount.toFixed(2), t.commission.toFixed(2),
      t.reasoning?.strategyLabel || t.strategy,
      t.reasoning?.description || '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `回测结果_${currentSession.name || new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentSession]);

  // ============ 格式化 ============

  const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;
  const fmtMoney = (v: number) => `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const activeResult = currentSession?.results[activeStockIdx] || null;


  // ============ 渲染 ============

  return (
    <div className="flex flex-col h-full">
      {/* 顶部导航 */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--border-default)] bg-[var(--bg-panel)]">
        <button
          onClick={() => setViewMode('config')}
          className={`px-3 py-1 text-xs rounded transition-colors ${viewMode === 'config' ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
        >
          新建回测
        </button>
        <button
          onClick={() => { setViewMode('sessions'); loadSavedSessions(); }}
          className={`px-3 py-1 text-xs rounded transition-colors ${viewMode === 'sessions' ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
        >
          <span className="flex items-center gap-1"><FolderOpen className="w-3 h-3" />历史记录</span>
        </button>
        {currentSession && viewMode === 'result' && (
          <button
            onClick={() => setViewMode('result')}
            className="px-3 py-1 text-xs rounded bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]"
          >
            回测结果
          </button>
        )}
      </div>

      {/* ============ 配置视图 ============ */}
      {viewMode === 'config' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 股票输入 */}
          <div className="bg-[var(--bg-card)]/30 rounded-lg p-3 space-y-3">
            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
              <Search className="w-3 h-3" /> 股票池
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={stockInput}
                onChange={(e) => { setStockInput(e.target.value); setSearchError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddStock(); }}
                placeholder="输入股票代码，如 000001, 600519"
                className="flex-1 px-3 py-1.5 text-xs bg-[var(--bg-primary)]/50 border border-[var(--border-default)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]/50"
              />
              <button onClick={handleAddStock} disabled={isSearching || !stockInput.trim()}
                className="px-3 py-1.5 text-xs bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] rounded hover:bg-[var(--accent-blue)]/30 transition-colors disabled:opacity-50 flex items-center gap-1">
                {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                添加
              </button>
            </div>
            {searchError && <div className="text-[10px] text-[var(--accent-red)]">{searchError}</div>}
            {stockList.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {stockList.map(s => (
                  <div key={s.code} className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-primary)]/50 rounded text-[10px] border border-[var(--border-default)]/50">
                    <span className="text-[var(--text-primary)]">{s.name}</span>
                    <span className="text-[var(--text-muted)] font-mono">{s.code}</span>
                    <span className="text-[var(--text-muted)]">({s.klineData.length}K)</span>
                    <button onClick={() => removeStock(s.code)} className="ml-0.5 text-[var(--text-muted)] hover:text-[var(--accent-red)]">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 策略选择 */}
          <div className="bg-[var(--bg-card)]/30 rounded-lg p-3 space-y-3">
            <div className="text-xs text-[var(--text-secondary)] flex items-center justify-between">
              <span className="flex items-center gap-1"><Settings className="w-3 h-3" /> 策略选择</span>
              <button onClick={toggleAllStrategies} className="text-[10px] text-[var(--accent-blue)] hover:underline">
                {strategies.length === STRATEGY_OPTIONS.length ? "取消全选" : "全选"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {STRATEGY_OPTIONS.filter(o => o.group !== "分析引擎").map(opt => (
                <button key={opt.value} onClick={() => toggleStrategy(opt.value)}
                  className={`px-2 py-1 text-[10px] rounded transition-colors ${strategies.includes(opt.value) ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30' : 'bg-[var(--bg-primary)]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-purple-400 font-medium">分析引擎:</span>
              {STRATEGY_OPTIONS.filter(o => o.group === "分析引擎").map(opt => (
                <button key={opt.value} onClick={() => toggleStrategy(opt.value)}
                  className={`px-2 py-1 text-[10px] rounded transition-colors ${strategies.includes(opt.value) ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-[var(--bg-primary)]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 参数配置 */}
          <div className="bg-[var(--bg-card)]/30 rounded-lg p-3 space-y-3">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <div className="text-[10px] text-[var(--text-secondary)] mb-1">回测周期</div>
                <div className="flex gap-1 flex-wrap">
                  {TIME_RANGES.map(tr => (
                    <button key={tr.days} onClick={() => setTimeRange(tr.days)}
                      className={`px-2 py-1 text-[10px] rounded transition-colors ${timeRange === tr.days ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30' : 'bg-[var(--bg-primary)]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'}`}>
                      {tr.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-36">
                <div className="text-[10px] text-[var(--text-secondary)] mb-1">初始资金</div>
                <input type="number" value={initialCapital} onChange={(e) => setInitialCapital(Number(e.target.value))}
                  className="w-full px-2 py-1 text-xs bg-[var(--bg-primary)]/50 border border-[var(--border-default)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]/50" />
              </div>
            </div>
            <div className="flex gap-4 items-center">
              <div className="text-[10px] text-[var(--text-secondary)]">K线数据范围</div>
              <div className="flex gap-1">
                <button onClick={() => setKlineFetchMode('range')}
                  className={`px-2 py-1 text-[10px] rounded transition-colors ${klineFetchMode === 'range' ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30' : 'bg-[var(--bg-primary)]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'}`}>
                  仅回测范围
                </button>
                <button onClick={() => setKlineFetchMode('full')}
                  className={`px-2 py-1 text-[10px] rounded transition-colors ${klineFetchMode === 'full' ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30' : 'bg-[var(--bg-primary)]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'}`}>
                  完整K线
                </button>
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">
                {klineFetchMode === 'range' ? '仅加载回测时间段内的K线，加载更快' : '加载完整K线数据，可查看更多历史走势'}
              </div>
            </div>
          </div>

          {/* 进度 */}
          {isRunning && (
            <div className="bg-[var(--bg-card)]/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[var(--text-secondary)]">
                  正在回测: {progress.stockCode} {progress.stockName} [{progress.current}/{progress.total}]
                </span>
                <span className="text-[var(--accent-blue)] font-mono">{Math.round((progress.current / progress.total) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-[var(--bg-primary)]/50 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[var(--accent-blue)] transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }} />
              </div>
            </div>
          )}

          {/* 运行按钮 */}
          <button onClick={handleRunBacktest} disabled={isRunning || strategies.length === 0 || stockList.length === 0}
            className={`w-full py-2.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 ${isRunning ? 'bg-[var(--bg-card)] text-[var(--text-secondary)] cursor-not-allowed' : stockList.length === 0 || strategies.length === 0 ? 'bg-[var(--bg-card)] text-[var(--text-muted)] cursor-not-allowed' : 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/30 border border-[var(--accent-blue)]/30'}`}>
            {isRunning ? (<><div className="w-3 h-3 border-2 border-[var(--text-muted)] border-t-transparent rounded-full animate-spin" />回测中...</>) : (<><Play className="w-3 h-3" />开始回测 ({stockList.length}只股票)</>)}
          </button>

          {/* 空状态 */}
          {stockList.length === 0 && !isRunning && (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--text-secondary)]">
              <Search className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs">输入股票代码开始策略回测</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">支持多只股票同时回测，用逗号分隔</p>
            </div>
          )}
        </div>
      )}

      {/* ============ 历史记录视图 ============ */}
      {viewMode === 'sessions' && (
        <div className="flex-1 overflow-y-auto p-4">
          {isLoadingSessions ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--accent-blue)]" />
            </div>
          ) : savedSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--text-secondary)]">
              <FolderOpen className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs">暂无保存的回测记录</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">完成回测后点击"保存"即可在此查看</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-[var(--text-secondary)] mb-3">共 {savedSessions.length} 条记录</div>
              {savedSessions.map(session => (
                <div key={session.id} className="bg-[var(--bg-card)]/30 rounded-lg p-3 border border-[var(--border-default)]/50 hover:border-[var(--accent-blue)]/30 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-[var(--text-primary)] font-medium">{session.name}</div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono ${session.summaryMetrics.totalReturn >= 0 ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]'}`}>
                        {fmtPct(session.summaryMetrics.totalReturn)}
                      </span>
                      <button onClick={() => handleLoadSession(session)} className="p-1 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10 rounded" title="查看">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteSession(session.id)} className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-red)] hover:bg-[var(--accent-red)]/10 rounded" title="删除">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{session.config.dateRange.start} ~ {session.config.dateRange.end}</span>
                    <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{fmtMoney(session.config.initialCapital)}</span>
                    <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{session.config.stocks.map(s => s.name).join(', ')}</span>
                    <span>{session.results.reduce((s, r) => s + r.trades.length, 0)}笔交易</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ 结果视图 ============ */}
      {viewMode === 'result' && currentSession && activeResult && (
        <div className="flex-1 overflow-y-auto">
          {/* 结果头部 */}
          <div className="px-4 py-2 border-b border-[var(--border-default)] bg-[var(--bg-card)]/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* 股票切换 */}
                {currentSession.results.length > 1 && (
                  <div className="flex gap-1">
                    {currentSession.results.map((r, idx) => (
                      <button key={r.stockCode} onClick={() => { setActiveStockIdx(idx); setSelectedTrade(null); setShowKlineForStock(null); }}
                        className={`px-2 py-0.5 text-[10px] rounded transition-colors ${idx === activeStockIdx ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                        {r.stockName}
                      </button>
                    ))}
                  </div>
                )}
                <span className="text-xs text-[var(--text-primary)] font-medium">
                  {activeResult.stockName} ({activeResult.stockCode})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleSaveSession} className="flex items-center gap-1 px-2 py-1 text-[10px] text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10 rounded transition-colors">
                  <Save className="w-3 h-3" /> 保存
                </button>
                <button onClick={exportCSV} className="flex items-center gap-1 px-2 py-1 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]/50 rounded transition-colors">
                  <Download className="w-3 h-3" /> 导出
                </button>
              </div>
            </div>
          </div>

          {/* 详情Tab */}
          <div className="flex gap-0 border-b border-[var(--border-default)]">
            {([['metrics', '绩效概览'], ['equity', '资金曲线'], ['positions', '股票'], ['trades', '交易记录']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setDetailTab(key)}
                className={`px-4 py-1.5 text-xs transition-colors ${detailTab === key ? 'text-[var(--accent-blue)] border-b-2 border-[var(--accent-blue)] bg-[var(--accent-blue)]/5' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Tab内容 */}
          <div className="p-4">
            {/* 绩效概览 */}
            {detailTab === 'metrics' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {([
                    ['总收益率', fmtPct(activeResult.metrics.totalReturn), activeResult.metrics.totalReturn >= 0],
                    ['年化收益', fmtPct(activeResult.metrics.annualizedReturn), activeResult.metrics.annualizedReturn >= 0],
                    ['最大回撤', fmtPct(activeResult.metrics.maxDrawdown), false],
                    ['夏普比率', activeResult.metrics.sharpeRatio.toFixed(2), activeResult.metrics.sharpeRatio > 1],
                    ['胜率', fmtPct(activeResult.metrics.winRate), activeResult.metrics.winRate >= 0.5],
                    ['盈亏比', activeResult.metrics.profitLossRatio.toFixed(2), activeResult.metrics.profitLossRatio > 1],
                  ] as const).map(([label, value, isGood]) => (
                    <div key={label} className="bg-[var(--bg-card)]/30 rounded-lg p-3">
                      <div className="text-[10px] text-[var(--text-secondary)] mb-1">{label}</div>
                      <div className={`text-sm font-mono font-medium ${typeof isGood === 'boolean' ? (isGood ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]') : 'text-[var(--text-primary)]'}`}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
                {/* 交易统计 */}
                <div className="bg-[var(--bg-card)]/30 rounded-lg p-3">
                  <div className="text-xs text-[var(--text-secondary)] mb-2">交易统计</div>
                  <div className="flex gap-6 text-xs">
                    <span>总交易: <span className="text-[var(--text-primary)] font-mono">{activeResult.metrics.totalTrades}笔</span></span>
                    <span>盈利: <span className="text-[var(--accent-red)] font-mono">{activeResult.metrics.winningTrades}笔</span></span>
                    <span>亏损: <span className="text-[var(--accent-green)] font-mono">{activeResult.metrics.losingTrades}笔</span></span>
                  </div>
                </div>
                {/* 多股票对比 */}
                {currentSession.results.length > 1 && (
                  <div className="bg-[var(--bg-card)]/30 rounded-lg p-3">
                    <div className="text-xs text-[var(--text-secondary)] mb-2">策略对比</div>
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="border-b border-[var(--border-default)]/50">
                          <th className="text-left py-1 text-[var(--text-secondary)]">股票</th>
                          <th className="text-right py-1 text-[var(--text-secondary)]">总收益</th>
                          <th className="text-right py-1 text-[var(--text-secondary)]">年化</th>
                          <th className="text-right py-1 text-[var(--text-secondary)]">最大回撤</th>
                          <th className="text-right py-1 text-[var(--text-secondary)]">夏普</th>
                          <th className="text-right py-1 text-[var(--text-secondary)]">胜率</th>
                          <th className="text-right py-1 text-[var(--text-secondary)]">交易数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentSession.results.map(r => (
                          <tr key={r.stockCode} className="border-b border-[var(--border-default)]/30">
                            <td className="py-1.5 text-[var(--text-primary)]">{r.stockName}</td>
                            <td className={`text-right py-1.5 ${r.metrics.totalReturn >= 0 ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]'}`}>{fmtPct(r.metrics.totalReturn)}</td>
                            <td className={`text-right py-1.5 ${r.metrics.annualizedReturn >= 0 ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]'}`}>{fmtPct(r.metrics.annualizedReturn)}</td>
                            <td className="text-right py-1.5 text-[var(--accent-green)]">{fmtPct(r.metrics.maxDrawdown)}</td>
                            <td className="text-right py-1.5 text-[var(--text-primary)]">{r.metrics.sharpeRatio.toFixed(2)}</td>
                            <td className={`text-right py-1.5 ${r.metrics.winRate >= 0.5 ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]'}`}>{fmtPct(r.metrics.winRate)}</td>
                            <td className="text-right py-1.5 text-[var(--text-primary)]">{r.metrics.totalTrades}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 资金曲线 */}
            {detailTab === 'equity' && (
              <div className="space-y-4">
                <div className="bg-[var(--bg-card)]/30 rounded-lg p-3">
                  <div className="text-xs text-[var(--text-secondary)] mb-2 flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" /> 资金曲线（{activeResult.stockName}）
                  </div>
                  <svg viewBox="0 0 400 120" className="w-full h-32">
                    {/* 基准线 */}
                    <path
                      d={activeResult.dailyRecords.map((r, i) => {
                        const x = (i / Math.max(1, activeResult.dailyRecords.length - 1)) * 400;
                        const y = 120 - ((r.benchmark / initialCapital) * 60);
                        return `${i === 0 ? 'M' : 'L'} ${x} ${Math.max(0, Math.min(120, y))}`;
                      }).join(' ')}
                      fill="none" stroke="#4b5563" strokeWidth="1" strokeDasharray="3,3"
                    />
                    {/* 资金曲线 */}
                    <path
                      d={activeResult.dailyRecords.map((r, i) => {
                        const x = (i / Math.max(1, activeResult.dailyRecords.length - 1)) * 400;
                        const y = 120 - ((r.totalValue / initialCapital) * 60);
                        return `${i === 0 ? 'M' : 'L'} ${x} ${Math.max(0, Math.min(120, y))}`;
                      }).join(' ')}
                      fill="none" stroke="#3b82f6" strokeWidth="1.5"
                    />
                  </svg>
                  <div className="flex justify-between text-[9px] text-[var(--text-muted)] mt-1">
                    <span>{activeResult.dailyRecords[0]?.date}</span>
                    <span className="text-[var(--accent-blue)]">-- 策略</span>
                    <span className="text-[var(--text-muted)]">- - 基准</span>
                    <span>{activeResult.dailyRecords[activeResult.dailyRecords.length - 1]?.date}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 股票列表（所有交易过的股票） */}
            {detailTab === 'positions' && (
              <div className="space-y-3">
                {currentSession.results.map(result => {
                  const hasPosition = result.finalPosition && result.finalPosition.quantity > 0;
                  const stockKline = stockList.find(s => s.code === result.stockCode)?.klineData;
                  const hasKlineData = stockKline && stockKline.length > 0;
                  return (
                    <div key={result.stockCode} className="bg-[var(--bg-card)]/30 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-[var(--text-primary)] font-medium">
                            {result.stockName} ({result.stockCode})
                          </div>
                          {hasPosition ? (
                            <span className="px-1.5 py-0.5 text-[9px] bg-[var(--accent-red)]/10 text-[var(--accent-red)] rounded">持仓中</span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-[9px] bg-[var(--text-muted)]/20 text-[var(--text-muted)] rounded">已清仓</span>
                          )}
                          <span className="text-[9px] text-[var(--text-muted)]">交易 {result.metrics.totalTrades} 次</span>
                        </div>
                        <button
                          onClick={() => setShowKlineForStock(showKlineForStock === result.stockCode ? null : result.stockCode)}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10 rounded"
                        >
                          <Eye className="w-3 h-3" /> {showKlineForStock === result.stockCode ? '收起K线' : '查看K线'}
                        </button>
                      </div>
                      {hasPosition && (
                        <div className="grid grid-cols-4 gap-3 text-[10px] mb-2">
                          <div>
                            <span className="text-[var(--text-secondary)]">持仓数量</span>
                            <div className="text-[var(--text-primary)] font-mono">{result.finalPosition!.quantity}股</div>
                          </div>
                          <div>
                            <span className="text-[var(--text-secondary)]">成本价</span>
                            <div className="text-[var(--text-primary)] font-mono">{result.finalPosition!.avgCost.toFixed(2)}</div>
                          </div>
                          <div>
                            <span className="text-[var(--text-secondary)]">现价</span>
                            <div className="text-[var(--text-primary)] font-mono">{result.finalPosition!.currentPrice.toFixed(2)}</div>
                          </div>
                          <div>
                            <span className="text-[var(--text-secondary)]">浮动盈亏</span>
                            <div className={`font-mono ${result.finalPosition!.unrealizedPnl >= 0 ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]'}`}>
                              {result.finalPosition!.unrealizedPnl >= 0 ? '+' : ''}{result.finalPosition!.unrealizedPnl.toFixed(0)} ({fmtPct(result.finalPosition!.unrealizedPnlPercent)})
                            </div>
                          </div>
                        </div>
                      )}
                      {/* K线图 */}
                      {showKlineForStock === result.stockCode && hasKlineData && (
                        <div className="mt-3 border-t border-[var(--border-default)]/50 pt-3">
                          <BacktestChart
                            klineData={stockKline}
                            trades={result.trades.map(t => ({ date: t.date, type: t.direction, price: t.price, shares: t.quantity, amount: t.amount, commission: t.commission, strategy: t.strategy }))}
                            onTradeClick={(idx) => {
                              const trade = result.trades[idx];
                              if (trade) setSelectedTrade(trade);
                            }}
                          />
                        </div>
                      )}
                      {showKlineForStock === result.stockCode && !hasKlineData && (
                        <div className="mt-3 text-center text-xs text-[var(--text-muted)] py-4">K线数据加载中...</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 交易记录 */}
            {detailTab === 'trades' && (
              <div className="space-y-2">
                <div className="text-[10px] text-[var(--text-secondary)] mb-2">共 {activeResult.trades.length} 笔交易</div>
                <div className="space-y-1">
                  {activeResult.trades.map((trade) => (
                    <div key={trade.id}>
                      <div
                        className="flex items-center justify-between text-[10px] py-2 px-2 rounded hover:bg-[var(--bg-card)]/50 cursor-pointer transition-colors border-b border-[var(--border-default)]/30"
                        onClick={() => setSelectedTrade(selectedTrade?.id === trade.id ? null : trade)}
                      >
                        <div className="flex items-center gap-2">
                          {trade.direction === 'buy' ? (
                            <TrendingUp className="w-3 h-3 text-[var(--accent-red)]" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-[var(--accent-green)]" />
                          )}
                          <span className="text-[var(--text-secondary)] w-16">{trade.date}</span>
                          <span className={trade.direction === 'buy' ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]'}>
                            {trade.direction === 'buy' ? '买入' : '卖出'}
                          </span>
                          <span className="text-[var(--text-muted)]">{trade.reasoning?.strategyLabel}</span>
                          {trade.userNote && <span title={trade.userNote}><MessageSquare className="w-3 h-3 text-[var(--accent-blue)]" /></span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[var(--text-primary)] font-mono">{trade.price.toFixed(2)}</span>
                          <span className="text-[var(--text-secondary)]">{trade.quantity}股</span>
                          <span className="text-[var(--text-muted)] font-mono">{fmtMoney(trade.amount)}</span>
                          <ChevronDown className={`w-3 h-3 text-[var(--text-muted)] transition-transform ${selectedTrade?.id === trade.id ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      {/* 展开的详情 */}
                      {selectedTrade?.id === trade.id && (
                        <div className="mx-2 mb-2 p-3 bg-[var(--bg-primary)]/50 rounded-lg border border-[var(--border-default)]/50 space-y-3">
                          {/* 买卖依据 */}
                          {trade.reasoning && (
                            <div>
                              <div className="text-[10px] text-[var(--accent-blue)] font-medium mb-1.5 flex items-center gap-1">
                                <Tag className="w-3 h-3" /> 买卖依据
                              </div>
                              <div className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                                {trade.reasoning.description}
                              </div>
                            </div>
                          )}
                          {/* 指标快照 */}
                          {trade.reasoning?.indicatorSnapshot && (
                            <div>
                              <div className="text-[10px] text-[var(--text-secondary)] font-medium mb-1">当时指标值</div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                                {trade.reasoning.indicatorSnapshot.macd && (
                                  <div className="flex gap-2">
                                    <span className="text-[var(--text-muted)]">MACD:</span>
                                    <span className="font-mono text-[var(--text-primary)]">
                                      DIF={trade.reasoning.indicatorSnapshot.macd.dif.toFixed(3)} DEA={trade.reasoning.indicatorSnapshot.macd.dea.toFixed(3)}
                                    </span>
                                  </div>
                                )}
                                {trade.reasoning.indicatorSnapshot.kdj && (
                                  <div className="flex gap-2">
                                    <span className="text-[var(--text-muted)]">KDJ:</span>
                                    <span className="font-mono text-[var(--text-primary)]">
                                      K={trade.reasoning.indicatorSnapshot.kdj.k.toFixed(1)} D={trade.reasoning.indicatorSnapshot.kdj.d.toFixed(1)} J={trade.reasoning.indicatorSnapshot.kdj.j.toFixed(1)}
                                    </span>
                                  </div>
                                )}
                                {trade.reasoning.indicatorSnapshot.rsi !== undefined && (
                                  <div className="flex gap-2">
                                    <span className="text-[var(--text-muted)]">RSI:</span>
                                    <span className="font-mono text-[var(--text-primary)]">{trade.reasoning.indicatorSnapshot.rsi.toFixed(1)}</span>
                                  </div>
                                )}
                                {trade.reasoning.indicatorSnapshot.boll && (
                                  <div className="flex gap-2">
                                    <span className="text-[var(--text-muted)]">BOLL:</span>
                                    <span className="font-mono text-[var(--text-primary)]">
                                      上{trade.reasoning.indicatorSnapshot.boll.upper.toFixed(2)} 中{trade.reasoning.indicatorSnapshot.boll.middle.toFixed(2)} 下{trade.reasoning.indicatorSnapshot.boll.lower.toFixed(2)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          {/* OHLCV快照 */}
                          {trade.reasoning?.ohlcvSnapshot && (
                            <div>
                              <div className="text-[10px] text-[var(--text-secondary)] font-medium mb-1">当日K线</div>
                              <div className="flex gap-3 text-[10px] font-mono text-[var(--text-primary)]">
                                <span>开 {trade.reasoning.ohlcvSnapshot.open.toFixed(2)}</span>
                                <span>高 {trade.reasoning.ohlcvSnapshot.high.toFixed(2)}</span>
                                <span>低 {trade.reasoning.ohlcvSnapshot.low.toFixed(2)}</span>
                                <span>收 {trade.reasoning.ohlcvSnapshot.close.toFixed(2)}</span>
                                <span>量 {(trade.reasoning.ohlcvSnapshot.volume / 10000).toFixed(0)}万</span>
                              </div>
                            </div>
                          )}
                          {/* 用户标注 */}
                          <div>
                            {editingNoteTradeId === trade.id ? (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={noteText}
                                  onChange={(e) => setNoteText(e.target.value)}
                                  placeholder="添加标注..."
                                  className="flex-1 px-2 py-1 text-[10px] bg-[var(--bg-card)]/50 border border-[var(--border-default)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]/50"
                                  autoFocus
                                />
                                <button onClick={() => handleSaveNote(trade.id)} className="px-2 py-1 text-[10px] text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10 rounded">保存</button>
                                <button onClick={() => { setEditingNoteTradeId(null); setNoteText(''); }} className="px-2 py-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">取消</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                {trade.userNote && <span className="text-[10px] text-[var(--text-secondary)]">{trade.userNote}</span>}
                                <button
                                  onClick={() => { setEditingNoteTradeId(trade.id); setNoteText(trade.userNote || ''); }}
                                  className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent-blue)] flex items-center gap-1"
                                >
                                  <MessageSquare className="w-3 h-3" /> {trade.userNote ? '编辑标注' : '添加标注'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

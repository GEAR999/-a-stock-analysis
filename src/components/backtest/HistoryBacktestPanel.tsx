"use client";

import { useState, useCallback } from "react";
import { Play, Square, Download, Settings, TrendingUp, TrendingDown, BarChart3, Search, X, Loader2 } from "lucide-react";
import { runBacktest, type BacktestConfig, type BacktestResult, type StrategyType } from "@/lib/backtest-engine";
import type { KLineData } from "@/lib/types";
import { fetchKLineData as fetchFromDataSource, type DataSourceResult } from "@/lib/data-source";

const STRATEGY_OPTIONS: { value: StrategyType; label: string; group: string }[] = [
  { value: "macd_golden_cross", label: "MACD金叉", group: "MACD" },
  { value: "macd_death_cross", label: "MACD死叉", group: "MACD" },
  { value: "kdj_oversold", label: "KDJ超卖金叉", group: "KDJ" },
  { value: "kdj_overbought", label: "KDJ超买死叉", group: "KDJ" },
  { value: "rsi_oversold", label: "RSI超卖", group: "RSI" },
  { value: "rsi_overbought", label: "RSI超买", group: "RSI" },
  { value: "boll_lower_touch", label: "布林下轨支撑", group: "BOLL" },
  { value: "boll_upper_touch", label: "布林上轨压力", group: "BOLL" },
  { value: "ma_golden_cross", label: "均线金叉(5/20)", group: "MA" },
  { value: "ma_death_cross", label: "均线死叉(5/20)", group: "MA" },
  // 分析引擎策略
  { value: "chanlun_buy", label: "缠论买点", group: "分析引擎" },
  { value: "chanlun_sell", label: "缠论卖点", group: "分析引擎" },
  { value: "wave_buy", label: "波浪起点买入", group: "分析引擎" },
  { value: "wave_sell", label: "波浪终点卖出", group: "分析引擎" },
  { value: "tech_resonance_buy", label: "指标共振买入", group: "分析引擎" },
  { value: "tech_resonance_sell", label: "指标共振卖出", group: "分析引擎" },
];

const TIME_RANGES = [
  { label: "近1月", days: 20 },
  { label: "近3月", days: 60 },
  { label: "近6月", days: 120 },
  { label: "近1年", days: 240 },
  { label: "近2年", days: 480 },
  { label: "全部", days: 0 },
];

interface StockInfo {
  code: string;
  name: string;
  klineData: KLineData[];
}

interface BacktestResultItem {
  stockCode: string;
  stockName: string;
  result: BacktestResult;
}

// K线数据获取结果
interface KLineFetchResult {
  success: boolean;
  data?: KLineData[];
  error?: string;
}

export function HistoryBacktestPanel() {
  // 股票输入相关
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
  const [progress, setProgress] = useState({
    currentIndex: 0,
    total: 0,
    currentStockCode: "",
    currentStockName: "",
    isComplete: false,
  });
  const [results, setResults] = useState<BacktestResultItem[]>([]);
  const [activeResultIndex, setActiveResultIndex] = useState(0);

  // 搜索并添加股票
  const searchAndAddStock = useCallback(async (code: string) => {
    try {
      const res = await fetch(`/api/stock?action=search&keyword=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        const stock = data.data[0];
        return { code: stock.code, name: stock.name || stock.code };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // 获取K线数据（使用统一数据源管理器：Tushare → 东方财富 → 缓存）
  const fetchKLineData = useCallback(async (code: string): Promise<KLineFetchResult> => {
    const result: DataSourceResult = await fetchFromDataSource(code, "daily", { limit: 1000 });
    
    if (result.success && result.data.length > 0) {
      return { success: true, data: result.data };
    }
    
    // 返回具体错误信息
    return { 
      success: false, 
      error: result.error || "数据源返回空数据，该股票暂无K线数据" 
    };
  }, []);

  // 处理添加股票
  const handleAddStock = useCallback(async () => {
    if (!stockInput.trim()) return;

    setIsSearching(true);
    setSearchError("");

    // 解析输入的股票代码（支持逗号、空格、中文逗号分隔）
    const codes = stockInput
      .split(/[,，\s]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (codes.length === 0) {
      setSearchError("请输入有效的股票代码");
      setIsSearching(false);
      return;
    }

    const newStocks: StockInfo[] = [];
    const errors: string[] = [];

    for (const code of codes) {
      // 检查是否已存在
      if (stockList.some(s => s.code === code)) {
        errors.push(`${code} 已在列表中`);
        continue;
      }

      // 搜索股票信息
      const stockInfo = await searchAndAddStock(code);
      if (!stockInfo) {
        errors.push(`${code} 未找到`);
        continue;
      }

      // 获取K线数据（使用标准化后的股票代码）
      const klineResult = await fetchKLineData(stockInfo.code);
      if (!klineResult.success || !klineResult.data || klineResult.data.length === 0) {
        errors.push(`${stockInfo.name || stockInfo.code}: ${klineResult.error || '无K线数据'}`);
        continue;
      }

      newStocks.push({
        code: stockInfo.code,
        name: stockInfo.name,
        klineData: klineResult.data,
      });
    }

    if (newStocks.length > 0) {
      setStockList(prev => [...prev, ...newStocks]);
      setStockInput("");
    }

    if (errors.length > 0) {
      setSearchError(errors.join("；"));
    }

    setIsSearching(false);
  }, [stockInput, stockList, searchAndAddStock, fetchKLineData]);

  // 移除股票
  const removeStock = (code: string) => {
    setStockList(prev => prev.filter(s => s.code !== code));
    // 如果移除的是当前选中的结果，重置activeResultIndex
    if (results.some(r => r.stockCode === code)) {
      setActiveResultIndex(0);
    }
  };

  // 清空所有股票
  const clearAllStocks = () => {
    setStockList([]);
    setResults([]);
    setActiveResultIndex(0);
  };

  // 策略切换
  const toggleStrategy = (strategy: StrategyType) => {
    setStrategies(prev =>
      prev.includes(strategy)
        ? prev.filter(s => s !== strategy)
        : [...prev, strategy]
    );
  };

  // 全选/取消全选
  const toggleAllStrategies = () => {
    if (strategies.length === STRATEGY_OPTIONS.length) {
      setStrategies([]);
    } else {
      setStrategies(STRATEGY_OPTIONS.map(s => s.value));
    }
  };

  // 执行回测
  const handleRunBacktest = useCallback(async () => {
    if (stockList.length === 0 || strategies.length === 0) return;

    setIsRunning(true);
    setResults([]);
    setProgress({
      currentIndex: 0,
      total: stockList.length,
      currentStockCode: stockList[0].code,
      currentStockName: stockList[0].name,
      isComplete: false,
    });

    const newResults: BacktestResultItem[] = [];

    for (let i = 0; i < stockList.length; i++) {
      const stock = stockList[i];
      setProgress({
        currentIndex: i + 1,
        total: stockList.length,
        currentStockCode: stock.code,
        currentStockName: stock.name,
        isComplete: false,
      });

      // 使用 setTimeout 避免阻塞UI
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          try {
            const filteredKline = timeRange > 0
              ? stock.klineData.slice(-timeRange)
              : stock.klineData;

            const config: BacktestConfig = {
              strategies,
              initialCapital,
              commission: 0.0003,
              slippage: 0.001,
              positionSize: 0.95,
              onProgress: () => {},
            };

            const backtestResult = runBacktest(filteredKline, config);
            newResults.push({
              stockCode: stock.code,
              stockName: stock.name,
              result: backtestResult,
            });
          } catch (err) {
            console.error(`Backtest error for ${stock.code}:`, err);
          }
          resolve();
        }, 50);
      });
    }

    setResults(newResults);
    setActiveResultIndex(0);
    setIsRunning(false);
    setProgress({
      currentIndex: stockList.length,
      total: stockList.length,
      currentStockCode: "",
      currentStockName: "",
      isComplete: true,
    });

    // 3秒后自动隐藏完成提示
    setTimeout(() => {
      setProgress(prev => ({ ...prev, isComplete: false }));
    }, 3000);
  }, [stockList, strategies, timeRange, initialCapital]);

  // 导出CSV
  const exportCSV = (resultItem: BacktestResultItem) => {
    const { result } = resultItem;
    const headers = ["日期", "方向", "价格", "数量", "金额", "手续费", "策略"];
    const rows = result.trades.map(t => [
      t.date,
      t.type === "buy" ? "买入" : "卖出",
      t.price.toFixed(2),
      t.shares,
      t.amount.toFixed(2),
      t.commission.toFixed(2),
      STRATEGY_OPTIONS.find(s => s.value === t.strategy)?.label || t.strategy,
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `回测结果_${resultItem.stockCode}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatPercent = (v: number) => `${(v * 100).toFixed(2)}%`;
  const formatMoney = (v: number) => `¥${(v / 10000).toFixed(1)}万`;

  const activeResult = results[activeResultIndex] || null;

  return (
    <div className="flex flex-col h-full">
      {/* 股票输入区域 */}
      <div className="p-3 border-b border-[var(--border-default)] space-y-3">
        {/* 股票输入框 */}
        <div>
          <div className="text-xs text-[var(--text-secondary)] mb-1.5 flex items-center gap-1">
            <Search className="w-3 h-3" />
            输入股票代码（多只用逗号分隔，如 000001,600519）
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={stockInput}
                onChange={(e) => {
                  setStockInput(e.target.value);
                  setSearchError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddStock();
                  }
                }}
                placeholder="输入股票代码，如 000001, 600519"
                className="w-full px-3 py-1.5 text-xs bg-[var(--bg-card)]/50 border border-[var(--border-default)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]/50"
              />
            </div>
            <button
              onClick={handleAddStock}
              disabled={isSearching || !stockInput.trim()}
              className="px-3 py-1.5 text-xs bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] rounded hover:bg-[var(--accent-blue)]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {isSearching ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Search className="w-3 h-3" />
              )}
              添加
            </button>
          </div>
          {searchError && (
            <div className="mt-1 text-[10px] text-[var(--accent-red)]">{searchError}</div>
          )}
        </div>

        {/* 已添加的股票列表 */}
        {stockList.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-[var(--text-secondary)]">
                已添加 {stockList.length} 只股票
              </span>
              <button
                onClick={clearAllStocks}
                className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent-red)] transition-colors"
              >
                清空全部
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {stockList.map(stock => (
                <div
                  key={stock.code}
                  className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-card)]/50 rounded text-[10px] border border-[var(--border-default)]/50"
                >
                  <span className="text-[var(--text-primary)]">{stock.name}</span>
                  <span className="text-[var(--text-muted)] font-mono">{stock.code}</span>
                  <span className="text-[var(--text-muted)]">({stock.klineData.length}根K线)</span>
                  <button
                    onClick={() => removeStock(stock.code)}
                    className="ml-0.5 text-[var(--text-muted)] hover:text-[var(--accent-red)] transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 配置区域 */}
      <div className="p-3 border-b border-[var(--border-default)] space-y-3">
        {/* 策略选择 */}
        <div>
          <div className="text-xs text-[var(--text-secondary)] mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Settings className="w-3 h-3" />
              选择策略（可多选）
            </div>
            <button
              onClick={toggleAllStrategies}
              className="text-[10px] text-[var(--accent-blue)] hover:underline"
            >
              {strategies.length === STRATEGY_OPTIONS.length ? "取消全选" : "全选"}
            </button>
          </div>
          {/* 基础策略 */}
          <div className="flex flex-wrap gap-1 mb-1">
            {STRATEGY_OPTIONS.filter(o => o.group !== "分析引擎").map(opt => (
              <button
                key={opt.value}
                onClick={() => toggleStrategy(opt.value)}
                className={`px-2 py-1 text-[10px] rounded transition-colors ${
                  strategies.includes(opt.value)
                    ? "bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30"
                    : "bg-[var(--bg-card)]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* 分析引擎策略 */}
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[10px] text-purple-400 font-medium">分析引擎:</span>
            <div className="flex flex-wrap gap-1">
              {STRATEGY_OPTIONS.filter(o => o.group === "分析引擎").map(opt => (
                <button
                  key={opt.value}
                  onClick={() => toggleStrategy(opt.value)}
                  className={`px-2 py-1 text-[10px] rounded transition-colors ${
                    strategies.includes(opt.value)
                      ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                      : "bg-[var(--bg-card)]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 回测周期和初始资金 */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <div className="text-[10px] text-[var(--text-secondary)] mb-1">回测周期</div>
            <div className="flex gap-1 flex-wrap">
              {TIME_RANGES.map(tr => (
                <button
                  key={tr.days}
                  onClick={() => setTimeRange(tr.days)}
                  className={`px-2 py-1 text-[10px] rounded transition-colors ${
                    timeRange === tr.days
                      ? "bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30"
                      : "bg-[var(--bg-card)]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent"
                  }`}
                >
                  {tr.label}
                </button>
              ))}
            </div>
          </div>
          <div className="w-32">
            <div className="text-[10px] text-[var(--text-secondary)] mb-1">初始资金</div>
            <input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(Number(e.target.value))}
              className="w-full px-2 py-1 text-xs bg-[var(--bg-card)]/50 border border-[var(--border-default)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]/50"
            />
          </div>
        </div>

        {/* 回测进度指示器 */}
        {(isRunning || progress.isComplete) && (
          <div className="bg-[var(--bg-card)]/30 rounded p-2 space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[var(--text-secondary)]">
                {progress.isComplete ? (
                  <span className="text-[var(--accent-green)]">✓ 回测完成</span>
                ) : (
                  <span>正在回测: {progress.currentStockCode} {progress.currentStockName} [{progress.currentIndex}/{progress.total}]</span>
                )}
              </span>
              {!progress.isComplete && (
                <span className="text-[var(--accent-blue)] font-mono">
                  {Math.round((progress.currentIndex / progress.total) * 100)}%
                </span>
              )}
            </div>
            <div className="h-1.5 bg-[var(--bg-primary)]/50 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  progress.isComplete
                    ? "bg-[var(--accent-green)]"
                    : "bg-[var(--accent-blue)]"
                }`}
                style={{
                  width: `${progress.total > 0 ? (progress.currentIndex / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* 运行按钮 */}
        <button
          onClick={handleRunBacktest}
          disabled={isRunning || strategies.length === 0 || stockList.length === 0}
          className={`w-full py-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-2 ${
            isRunning
              ? "bg-[var(--bg-card)] text-[var(--text-secondary)] cursor-not-allowed"
              : stockList.length === 0 || strategies.length === 0
                ? "bg-[var(--bg-card)] text-[var(--text-muted)] cursor-not-allowed"
                : "bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/30 border border-[var(--accent-blue)]/30"
          }`}
        >
          {isRunning ? (
            <>
              <div className="w-3 h-3 border-2 border-[var(--text-muted)] border-t-transparent rounded-full animate-spin" />
              回测中...
            </>
          ) : (
            <>
              <Play className="w-3 h-3" />
              开始回测{stockList.length > 0 ? ` (${stockList.length}只股票)` : ""}
            </>
          )}
        </button>
      </div>

      {/* 结果区域 */}
      {results.length > 0 && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* 多股票结果切换 */}
          {results.length > 1 && (
            <div className="flex gap-1 flex-wrap">
              {results.map((r, idx) => (
                <button
                  key={r.stockCode}
                  onClick={() => setActiveResultIndex(idx)}
                  className={`px-2 py-1 text-[10px] rounded transition-colors ${
                    idx === activeResultIndex
                      ? "bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30"
                      : "bg-[var(--bg-card)]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent"
                  }`}
                >
                  {r.stockName} ({r.stockCode})
                </button>
              ))}
            </div>
          )}

          {activeResult && (
            <>
              {/* 股票名称 */}
              <div className="text-xs text-[var(--text-primary)] font-medium">
                {activeResult.stockName} ({activeResult.stockCode}) 回测结果
              </div>

              {/* 关键指标 */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[var(--bg-card)]/30 rounded p-2">
                  <div className="text-[10px] text-[var(--text-secondary)]">总收益率</div>
                  <div className={`text-sm font-mono font-medium ${activeResult.result.metrics.totalReturn >= 0 ? "text-[var(--accent-red)]" : "text-[var(--accent-green)]"}`}>
                    {formatPercent(activeResult.result.metrics.totalReturn)}
                  </div>
                </div>
                <div className="bg-[var(--bg-card)]/30 rounded p-2">
                  <div className="text-[10px] text-[var(--text-secondary)]">年化收益</div>
                  <div className={`text-sm font-mono font-medium ${activeResult.result.metrics.annualizedReturn >= 0 ? "text-[var(--accent-red)]" : "text-[var(--accent-green)]"}`}>
                    {formatPercent(activeResult.result.metrics.annualizedReturn)}
                  </div>
                </div>
                <div className="bg-[var(--bg-card)]/30 rounded p-2">
                  <div className="text-[10px] text-[var(--text-secondary)]">最大回撤</div>
                  <div className="text-sm font-mono font-medium text-[var(--accent-green)]">
                    {formatPercent(activeResult.result.metrics.maxDrawdown)}
                  </div>
                </div>
                <div className="bg-[var(--bg-card)]/30 rounded p-2">
                  <div className="text-[10px] text-[var(--text-secondary)]">夏普比率</div>
                  <div className="text-sm font-mono font-medium text-[var(--text-primary)]">
                    {activeResult.result.metrics.sharpeRatio.toFixed(2)}
                  </div>
                </div>
                <div className="bg-[var(--bg-card)]/30 rounded p-2">
                  <div className="text-[10px] text-[var(--text-secondary)]">胜率</div>
                  <div className={`text-sm font-mono font-medium ${activeResult.result.metrics.winRate >= 0.5 ? "text-[var(--accent-red)]" : "text-[var(--accent-green)]"}`}>
                    {formatPercent(activeResult.result.metrics.winRate)}
                  </div>
                </div>
                <div className="bg-[var(--bg-card)]/30 rounded p-2">
                  <div className="text-[10px] text-[var(--text-secondary)]">盈亏比</div>
                  <div className="text-sm font-mono font-medium text-[var(--text-primary)]">
                    {activeResult.result.metrics.profitLossRatio.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* 多股票对比表 */}
              {results.length > 1 && (
                <div className="bg-[var(--bg-card)]/30 rounded p-2">
                  <div className="text-xs text-[var(--text-secondary)] mb-2">策略对比</div>
                  <div className="overflow-x-auto">
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
                        {results.map((r) => (
                          <tr key={r.stockCode} className="border-b border-[var(--border-default)]/30">
                            <td className="py-1 text-[var(--text-primary)]">{r.stockName}</td>
                            <td className={`text-right py-1 ${r.result.metrics.totalReturn >= 0 ? "text-[var(--accent-red)]" : "text-[var(--accent-green)]"}`}>
                              {formatPercent(r.result.metrics.totalReturn)}
                            </td>
                            <td className={`text-right py-1 ${r.result.metrics.annualizedReturn >= 0 ? "text-[var(--accent-red)]" : "text-[var(--accent-green)]"}`}>
                              {formatPercent(r.result.metrics.annualizedReturn)}
                            </td>
                            <td className="text-right py-1 text-[var(--accent-green)]">
                              {formatPercent(r.result.metrics.maxDrawdown)}
                            </td>
                            <td className="text-right py-1 text-[var(--text-primary)]">
                              {r.result.metrics.sharpeRatio.toFixed(2)}
                            </td>
                            <td className={`text-right py-1 ${r.result.metrics.winRate >= 0.5 ? "text-[var(--accent-red)]" : "text-[var(--accent-green)]"}`}>
                              {formatPercent(r.result.metrics.winRate)}
                            </td>
                            <td className="text-right py-1 text-[var(--text-primary)]">
                              {r.result.metrics.totalTrades}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 交易统计 */}
              <div className="bg-[var(--bg-card)]/30 rounded p-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[var(--text-secondary)]">交易统计</span>
                  <button
                    onClick={() => exportCSV(activeResult)}
                    className="text-[10px] text-[var(--accent-blue)] hover:text-blue-300 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    导出CSV
                  </button>
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="text-[var(--text-secondary)]">
                    总交易: <span className="text-[var(--text-primary)]">{activeResult.result.metrics.totalTrades}笔</span>
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    盈利: <span className="text-[var(--accent-red)]">{activeResult.result.metrics.winningTrades}笔</span>
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    亏损: <span className="text-[var(--accent-green)]">{activeResult.result.metrics.losingTrades}笔</span>
                  </span>
                </div>
              </div>

              {/* 资金曲线简易图 */}
              {activeResult.result.dailyRecords.length > 0 && (
                <div className="bg-[var(--bg-card)]/30 rounded p-2">
                  <div className="text-xs text-[var(--text-secondary)] mb-2 flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" />
                    资金曲线
                  </div>
                  <svg viewBox="0 0 300 80" className="w-full h-20">
                    {/* 基准线 */}
                    <path
                      d={activeResult.result.dailyRecords.map((r, i) => {
                        const x = (i / (activeResult.result.dailyRecords.length - 1)) * 300;
                        const y = 80 - ((r.benchmark / initialCapital) * 40);
                        return `${i === 0 ? "M" : "L"} ${x} ${Math.max(0, Math.min(80, y))}`;
                      }).join(" ")}
                      fill="none"
                      stroke="#4b5563"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                    />
                    {/* 资金曲线 */}
                    <path
                      d={activeResult.result.dailyRecords.map((r, i) => {
                        const x = (i / (activeResult.result.dailyRecords.length - 1)) * 300;
                        const y = 80 - ((r.totalValue / initialCapital) * 40);
                        return `${i === 0 ? "M" : "L"} ${x} ${Math.max(0, Math.min(80, y))}`;
                      }).join(" ")}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="1.5"
                    />
                  </svg>
                  <div className="flex justify-between text-[9px] text-[var(--text-secondary)] mt-1">
                    <span>{activeResult.result.dailyRecords[0]?.date}</span>
                    <span className="text-[var(--accent-blue)]">● 策略</span>
                    <span className="text-[var(--text-secondary)]">- - 基准</span>
                    <span>{activeResult.result.dailyRecords[activeResult.result.dailyRecords.length - 1]?.date}</span>
                  </div>
                </div>
              )}

              {/* 交易记录 */}
              <div className="bg-[var(--bg-card)]/30 rounded p-2">
                <div className="text-xs text-[var(--text-secondary)] mb-2">交易记录（最近10笔）</div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {activeResult.result.trades.slice(-10).reverse().map((trade, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px] py-1 border-b border-[var(--border-default)]/50 last:border-0">
                      <div className="flex items-center gap-2">
                        {trade.type === "buy" ? (
                          <TrendingUp className="w-3 h-3 text-[var(--accent-red)]" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-[var(--accent-green)]" />
                        )}
                        <span className="text-[var(--text-secondary)]">{trade.date}</span>
                        <span className={trade.type === "buy" ? "text-[var(--accent-red)]" : "text-[var(--accent-green)]"}>
                          {trade.type === "buy" ? "买入" : "卖出"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--text-primary)] font-mono">{trade.price.toFixed(2)}</span>
                        <span className="text-[var(--text-secondary)]">{trade.shares}股</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 无股票时的提示 */}
      {stockList.length === 0 && !isRunning && (
        <div className="flex-1 flex flex-col items-center justify-center py-8 text-[var(--text-secondary)]">
          <Search className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-xs">输入股票代码开始回测</p>
          <p className="text-[10px] text-[var(--text-muted)] mt-1">支持多只股票同时回测，用逗号分隔</p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useRef, useCallback } from "react";
import { Play, Square, Download, Settings, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { useAppState } from "@/hooks/useAppState";
import { runBacktest, type BacktestConfig, type BacktestResult, type StrategyType } from "@/lib/backtest-engine";

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
];

const TIME_RANGES = [
  { label: "近3月", days: 63 },
  { label: "近6月", days: 126 },
  { label: "近1年", days: 252 },
  { label: "近3年", days: 756 },
  { label: "全部", days: 0 },
];

export function HistoryBacktestPanel() {
  const { selectedStock, klineData } = useAppState();
  const [strategies, setStrategies] = useState<StrategyType[]>(["macd_golden_cross", "macd_death_cross"]);
  const [timeRange, setTimeRange] = useState(252);
  const [initialCapital, setInitialCapital] = useState(1000000);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const toggleStrategy = (strategy: StrategyType) => {
    setStrategies(prev => 
      prev.includes(strategy) 
        ? prev.filter(s => s !== strategy)
        : [...prev, strategy]
    );
  };

  const runBacktestHandler = useCallback(async () => {
    if (!klineData.length || strategies.length === 0) return;
    
    setIsRunning(true);
    setResult(null);

    // 使用 setTimeout 避免阻塞UI
    setTimeout(() => {
      try {
        const filteredKline = timeRange > 0 
          ? klineData.slice(-timeRange)
          : klineData;

        const config: BacktestConfig = {
          strategies,
          initialCapital,
          commission: 0.0003,
          slippage: 0.001,
          positionSize: 0.95,
        };

        const backtestResult = runBacktest(filteredKline, config);
        setResult(backtestResult);
      } catch (err) {
        console.error("Backtest error:", err);
      } finally {
        setIsRunning(false);
      }
    }, 100);
  }, [klineData, strategies, timeRange, initialCapital]);

  const exportCSV = () => {
    if (!result) return;
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
    a.download = `回测结果_${selectedStock?.code || "stock"}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatPercent = (v: number) => `${(v * 100).toFixed(2)}%`;
  const formatMoney = (v: number) => `¥${(v / 10000).toFixed(1)}万`;

  if (!selectedStock) {
    return (
      <div className="p-4 text-center text-xs text-gray-500">
        请先选择股票进行回测
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 配置区域 */}
      <div className="p-3 border-b border-gray-800 space-y-3">
        {/* 策略选择 */}
        <div>
          <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
            <Settings className="w-3 h-3" />
            选择策略（可多选）
          </div>
          <div className="flex flex-wrap gap-1">
            {STRATEGY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => toggleStrategy(opt.value)}
                className={`px-2 py-1 text-[10px] rounded transition-colors ${
                  strategies.includes(opt.value)
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "bg-gray-800/50 text-gray-500 hover:text-gray-300 border border-transparent"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 时间范围和初始资金 */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <div className="text-[10px] text-gray-500 mb-1">时间范围</div>
            <div className="flex gap-1">
              {TIME_RANGES.map(tr => (
                <button
                  key={tr.days}
                  onClick={() => setTimeRange(tr.days)}
                  className={`px-2 py-1 text-[10px] rounded transition-colors ${
                    timeRange === tr.days
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-gray-800/50 text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {tr.label}
                </button>
              ))}
            </div>
          </div>
          <div className="w-32">
            <div className="text-[10px] text-gray-500 mb-1">初始资金</div>
            <input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(Number(e.target.value))}
              className="w-full px-2 py-1 text-xs bg-gray-800/50 border border-gray-700 rounded text-gray-200 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>

        {/* 运行按钮 */}
        <button
          onClick={runBacktestHandler}
          disabled={isRunning || strategies.length === 0 || klineData.length === 0}
          className={`w-full py-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-2 ${
            isRunning
              ? "bg-gray-700 text-gray-400 cursor-not-allowed"
              : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30"
          }`}
        >
          {isRunning ? (
            <>
              <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              回测中...
            </>
          ) : (
            <>
              <Play className="w-3 h-3" />
              开始回测
            </>
          )}
        </button>
      </div>

      {/* 结果区域 */}
      {result && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* 关键指标 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-800/30 rounded p-2">
              <div className="text-[10px] text-gray-500">总收益率</div>
              <div className={`text-sm font-mono font-medium ${result.metrics.totalReturn >= 0 ? "text-red-400" : "text-green-400"}`}>
                {formatPercent(result.metrics.totalReturn)}
              </div>
            </div>
            <div className="bg-gray-800/30 rounded p-2">
              <div className="text-[10px] text-gray-500">年化收益</div>
              <div className={`text-sm font-mono font-medium ${result.metrics.annualizedReturn >= 0 ? "text-red-400" : "text-green-400"}`}>
                {formatPercent(result.metrics.annualizedReturn)}
              </div>
            </div>
            <div className="bg-gray-800/30 rounded p-2">
              <div className="text-[10px] text-gray-500">最大回撤</div>
              <div className="text-sm font-mono font-medium text-green-400">
                {formatPercent(result.metrics.maxDrawdown)}
              </div>
            </div>
            <div className="bg-gray-800/30 rounded p-2">
              <div className="text-[10px] text-gray-500">夏普比率</div>
              <div className="text-sm font-mono font-medium text-gray-200">
                {result.metrics.sharpeRatio.toFixed(2)}
              </div>
            </div>
            <div className="bg-gray-800/30 rounded p-2">
              <div className="text-[10px] text-gray-500">胜率</div>
              <div className={`text-sm font-mono font-medium ${result.metrics.winRate >= 0.5 ? "text-red-400" : "text-green-400"}`}>
                {formatPercent(result.metrics.winRate)}
              </div>
            </div>
            <div className="bg-gray-800/30 rounded p-2">
              <div className="text-[10px] text-gray-500">盈亏比</div>
              <div className="text-sm font-mono font-medium text-gray-200">
                {result.metrics.profitLossRatio.toFixed(2)}
              </div>
            </div>
          </div>

          {/* 交易统计 */}
          <div className="bg-gray-800/30 rounded p-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">交易统计</span>
              <button
                onClick={exportCSV}
                className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                导出CSV
              </button>
            </div>
            <div className="flex gap-4 text-xs">
              <span className="text-gray-400">
                总交易: <span className="text-gray-200">{result.metrics.totalTrades}笔</span>
              </span>
              <span className="text-gray-400">
                盈利: <span className="text-red-400">{result.metrics.winningTrades}笔</span>
              </span>
              <span className="text-gray-400">
                亏损: <span className="text-green-400">{result.metrics.losingTrades}笔</span>
              </span>
            </div>
          </div>

          {/* 资金曲线简易图 */}
          {result.dailyRecords.length > 0 && (
            <div className="bg-gray-800/30 rounded p-2">
              <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                <BarChart3 className="w-3 h-3" />
                资金曲线
              </div>
              <svg viewBox="0 0 300 80" className="w-full h-20">
                {/* 基准线 */}
                <path
                  d={result.dailyRecords.map((r, i) => {
                    const x = (i / (result.dailyRecords.length - 1)) * 300;
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
                  d={result.dailyRecords.map((r, i) => {
                    const x = (i / (result.dailyRecords.length - 1)) * 300;
                    const y = 80 - ((r.totalValue / initialCapital) * 40);
                    return `${i === 0 ? "M" : "L"} ${x} ${Math.max(0, Math.min(80, y))}`;
                  }).join(" ")}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="1.5"
                />
              </svg>
              <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                <span>{result.dailyRecords[0]?.date}</span>
                <span className="text-blue-400">● 策略</span>
                <span className="text-gray-500">- - 基准</span>
                <span>{result.dailyRecords[result.dailyRecords.length - 1]?.date}</span>
              </div>
            </div>
          )}

          {/* 交易记录 */}
          <div className="bg-gray-800/30 rounded p-2">
            <div className="text-xs text-gray-400 mb-2">交易记录（最近10笔）</div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {result.trades.slice(-10).reverse().map((trade, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] py-1 border-b border-gray-800/50 last:border-0">
                  <div className="flex items-center gap-2">
                    {trade.type === "buy" ? (
                      <TrendingUp className="w-3 h-3 text-red-400" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-green-400" />
                    )}
                    <span className="text-gray-500">{trade.date}</span>
                    <span className={trade.type === "buy" ? "text-red-400" : "text-green-400"}>
                      {trade.type === "buy" ? "买入" : "卖出"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300 font-mono">{trade.price.toFixed(2)}</span>
                    <span className="text-gray-500">{trade.shares}股</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

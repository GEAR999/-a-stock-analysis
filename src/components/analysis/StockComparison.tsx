"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, BarChart3, TrendingUp } from "lucide-react";
import { useAppState } from "@/hooks/useAppState";
import { fetchWithRetry } from "@/lib/api-client";
import type { KLineData } from "@/lib/types";

interface ComparisonStock {
  code: string;
  name: string;
  market: "sh" | "sz" | "bj";
  klineData: KLineData[];
  normalizedData: number[];
  score: number;
}

interface SearchSuggestion {
  code: string;
  name: string;
  market: string;
}

export function StockComparison() {
  const { selectedStock } = useAppState();
  const [stocks, setStocks] = useState<ComparisonStock[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<NodeJS.Timeout | null>(null);

  // 初始化：添加当前选中的股票
  useEffect(() => {
    if (selectedStock && stocks.length === 0) {
      loadStockData(selectedStock.code, selectedStock.name, selectedStock.market);
    }
  }, [selectedStock]);

  // 搜索股票
  useEffect(() => {
    if (!searchQuery) {
      setSuggestions([]);
      return;
    }

    if (searchRef.current) clearTimeout(searchRef.current);

    searchRef.current = setTimeout(async () => {
      try {
        const res = await fetchWithRetry(`/api/stock?action=search&keyword=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (data.success) {
          setSuggestions(data.data.filter((s: SearchSuggestion) => !stocks.find(st => st.code === s.code)).slice(0, 8));
        }
      } catch {
        setSuggestions([]);
      }
    }, 300);

    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [searchQuery, stocks]);

  // 加载股票K线数据
  const loadStockData = async (code: string, name: string, market: string) => {
    setIsLoading(true);
    try {
      const res = await fetchWithRetry(`/api/stock?action=kline&code=${market}${code}&period=daily&limit=120`);
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        const klineData: KLineData[] = data.data;
        // 归一化：以第一个数据点为基准100
        const basePrice = klineData[0].close;
        const normalizedData = klineData.map(d => (d.close / basePrice) * 100);
        
        // 计算综合评分（简单基于涨幅）
        const score = ((klineData[klineData.length - 1].close / basePrice) - 1) * 100;

        const newStock: ComparisonStock = {
          code,
          name,
          market: market as "sh" | "sz" | "bj",
          klineData,
          normalizedData,
          score,
        };

        setStocks(prev => {
          if (prev.find(s => s.code === code)) return prev;
          if (prev.length >= 3) return prev; // 最多3只
          return [...prev, newStock];
        });
      }
    } catch (err) {
      console.error("Failed to load stock data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const removeStock = (code: string) => {
    setStocks(prev => prev.filter(s => s.code !== code));
  };

  const addStock = (suggestion: SearchSuggestion) => {
    if (stocks.length >= 3) return;
    loadStockData(suggestion.code, suggestion.name, suggestion.market);
    setShowAddDialog(false);
    setSearchQuery("");
    setSuggestions([]);
  };

  // 获取所有日期标签（取第一只股票的日期）
  const dateLabels = stocks[0]?.klineData.map(d => d.date) || [];

  // 计算图表参数
  const maxPoints = Math.min(...stocks.map(s => s.normalizedData.length));
  const allValues = stocks.flatMap(s => s.normalizedData.slice(0, maxPoints));
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal || 1;

  const chartWidth = 600;
  const chartHeight = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const getX = (i: number) => padding.left + (i / (maxPoints - 1)) * plotWidth;
  const getY = (val: number) => padding.top + plotHeight - ((val - minVal) / range) * plotHeight;

  const colors = ["#3b82f6", "#ef4444", "#22c55e"];

  // 排序后的股票（按评分）
  const rankedStocks = [...stocks].sort((a, b) => b.score - a.score);

  return (
    <div className="bg-[#111827] rounded border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-200 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          多股对比分析
        </h3>
        {stocks.length < 3 && (
          <button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
          >
            <Plus className="w-3 h-3" />
            添加对比
          </button>
        )}
      </div>

      {/* 添加股票对话框 */}
      {showAddDialog && (
        <div className="mb-4 p-3 bg-gray-800/50 rounded border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="输入股票代码或名称..."
              className="flex-1 px-3 py-1.5 text-xs bg-gray-900 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
              autoFocus
            />
            <button
              onClick={() => { setShowAddDialog(false); setSearchQuery(""); setSuggestions([]); }}
              className="p-1.5 text-gray-400 hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {suggestions.map(s => (
                <button
                  key={s.code}
                  onClick={() => addStock(s)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-700/50 rounded transition-colors"
                >
                  <span className="text-gray-200">{s.name}</span>
                  <span className="text-gray-500 font-mono">{s.code}</span>
                  <span className="text-gray-600 ml-auto">{s.market === "sh" ? "沪" : "深"}</span>
                </button>
              ))}
            </div>
          )}
          {isLoading && <div className="text-xs text-gray-500 text-center py-2">加载中...</div>}
        </div>
      )}

      {/* 已选股票标签 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {stocks.map((stock, i) => (
          <div
            key={stock.code}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
            style={{ backgroundColor: `${colors[i]}20`, borderColor: `${colors[i]}40`, borderWidth: 1 }}
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i] }} />
            <span className="text-gray-200">{stock.name}</span>
            <span className={`font-mono ${stock.score >= 0 ? "text-red-400" : "text-green-400"}`}>
              {stock.score >= 0 ? "+" : ""}{stock.score.toFixed(1)}%
            </span>
            <button
              onClick={() => removeStock(stock.code)}
              className="ml-1 text-gray-500 hover:text-gray-200"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* 归一化价格曲线对比图 */}
      {stocks.length > 0 && maxPoints > 1 && (
        <div className="mb-4">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto">
            {/* 网格线 */}
            {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
              const y = padding.top + plotHeight * (1 - ratio);
              const val = minVal + range * ratio;
              return (
                <g key={ratio}>
                  <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="#1e293b" strokeWidth={0.5} />
                  <text x={padding.left - 5} y={y + 3} textAnchor="end" fill="#64748b" fontSize={8}>{val.toFixed(0)}</text>
                </g>
              );
            })}

            {/* 基准线100 */}
            {minVal <= 100 && maxVal >= 100 && (
              <line
                x1={padding.left}
                y1={getY(100)}
                x2={chartWidth - padding.right}
                y2={getY(100)}
                stroke="#64748b"
                strokeWidth={0.5}
                strokeDasharray="4 2"
              />
            )}

            {/* 各股票曲线 */}
            {stocks.map((stock, si) => {
              const points = stock.normalizedData.slice(0, maxPoints).map((val, i) => `${getX(i)},${getY(val)}`).join(" ");
              return (
                <polyline
                  key={stock.code}
                  points={points}
                  fill="none"
                  stroke={colors[si]}
                  strokeWidth={1.5}
                  opacity={0.8}
                />
              );
            })}

            {/* X轴日期标签 */}
            {dateLabels.filter((_, i) => i % Math.ceil(maxPoints / 6) === 0).map((date, i) => {
              const idx = dateLabels.indexOf(date);
              return (
                <text key={i} x={getX(idx)} y={chartHeight - 5} textAnchor="middle" fill="#64748b" fontSize={7}>
                  {date.slice(5)}
                </text>
              );
            })}
          </svg>
          <div className="text-center text-[10px] text-gray-500 mt-1">归一化价格对比（基准=100）</div>
        </div>
      )}

      {/* 综合评分排名 */}
      {stocks.length > 1 && (
        <div>
          <h4 className="text-xs font-medium text-gray-400 mb-2">综合评分排名</h4>
          <div className="space-y-2">
            {rankedStocks.map((stock, i) => (
              <div key={stock.code} className="flex items-center gap-3">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  i === 0 ? "bg-amber-500/20 text-amber-400" :
                  i === 1 ? "bg-gray-400/20 text-gray-400" :
                  "bg-orange-500/20 text-orange-400"
                }`}>
                  {i + 1}
                </span>
                <span className="text-xs text-gray-200 flex-1">{stock.name}</span>
                <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(5, 50 + stock.score))}%`,
                      backgroundColor: stock.score >= 0 ? "#ef4444" : "#22c55e",
                    }}
                  />
                </div>
                <span className={`text-xs font-mono w-14 text-right ${stock.score >= 0 ? "text-red-400" : "text-green-400"}`}>
                  {stock.score >= 0 ? "+" : ""}{stock.score.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stocks.length === 0 && (
        <div className="text-center py-8 text-xs text-gray-500">
          请选择股票开始对比分析
        </div>
      )}
    </div>
  );
}

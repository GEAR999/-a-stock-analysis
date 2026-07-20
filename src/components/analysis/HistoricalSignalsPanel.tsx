"use client";

import { useState, useEffect } from "react";
import { Clock, TrendingUp, TrendingDown, Minus, Trash2, BarChart3 } from "lucide-react";
import { useAppState } from "@/hooks/useAppState";
import { getSignalsByStock, deleteSignalSnapshot, calculateAccuracy, type SignalSnapshot } from "@/lib/signal-storage";

export function HistoricalSignalsPanel() {
  const { selectedStock, klineData } = useAppState();
  const [signals, setSignals] = useState<SignalSnapshot[]>([]);
  const [accuracy, setAccuracy] = useState<{ total: number; correct: number; accuracy: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedStock) return;
    loadSignals();
  }, [selectedStock?.code]);

  const loadSignals = async () => {
    if (!selectedStock) return;
    setIsLoading(true);
    try {
      const data = await getSignalsByStock(selectedStock.code, 50);
      setSignals(data);

      // 计算准确率
      if (klineData.length > 30) {
        const acc = await calculateAccuracy(
          selectedStock.code,
          klineData.map(k => ({ date: k.date, close: k.close }))
        );
        setAccuracy(acc);
      }
    } catch (err) {
      console.error("Failed to load signals:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteSignalSnapshot(id);
    setSignals(prev => prev.filter(s => s.id !== id));
  };

  const getSignalIcon = (type: string) => {
    switch (type) {
      case "buy": return <TrendingUp className="w-3 h-3 text-red-400" />;
      case "sell": return <TrendingDown className="w-3 h-3 text-green-400" />;
      default: return <Minus className="w-3 h-3 text-gray-400" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 30) return "text-red-400";
    if (score >= 10) return "text-red-300";
    if (score <= -30) return "text-green-400";
    if (score <= -10) return "text-green-300";
    return "text-gray-400";
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (!selectedStock) {
    return (
      <div className="p-4 text-center text-xs text-gray-500">
        请先选择股票查看历史信号
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 统计信息 */}
      <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs text-gray-400">
            {selectedStock.name} 历史信号 ({signals.length})
          </span>
        </div>
        {accuracy && accuracy.total > 0 && (
          <div className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3 text-gray-500" />
            <span className="text-[10px] text-gray-500">
              准确率: <span className={accuracy.accuracy >= 50 ? "text-red-400" : "text-green-400"}>
                {accuracy.accuracy.toFixed(0)}%
              </span>
              <span className="text-gray-600"> ({accuracy.correct}/{accuracy.total})</span>
            </span>
          </div>
        )}
      </div>

      {/* 信号列表 */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-xs text-gray-500">加载中...</div>
        ) : signals.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-500">
            <Clock className="w-6 h-6 mx-auto mb-2 text-gray-600" />
            暂无历史信号记录
            <p className="text-[10px] text-gray-600 mt-1">分析引擎运行后会自动保存信号</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {signals.map(signal => (
              <div key={signal.id} className="px-3 py-2 hover:bg-gray-800/30 transition-colors group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 font-mono">{signal.date}</span>
                    <span className={`text-xs font-mono font-medium ${getScoreColor(signal.score)}`}>
                      {signal.score >= 0 ? "+" : ""}{signal.score}
                    </span>
                  </div>
                  <button
                    onClick={() => signal.id && handleDelete(signal.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-600 hover:text-red-400 transition-all"
                    title="删除"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                
                {/* 信号标签 */}
                <div className="flex flex-wrap gap-1 mb-1">
                  {signal.signals.slice(0, 5).map((sig, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] rounded ${
                        sig.type === "buy" ? "bg-red-500/10 text-red-400" :
                        sig.type === "sell" ? "bg-green-500/10 text-green-400" :
                        "bg-gray-500/10 text-gray-400"
                      }`}
                    >
                      {getSignalIcon(sig.type)}
                      {sig.source}
                    </span>
                  ))}
                  {signal.signals.length > 5 && (
                    <span className="text-[9px] text-gray-600">+{signal.signals.length - 5}</span>
                  )}
                </div>

                {/* 结论 */}
                <p className="text-[10px] text-gray-500 line-clamp-2">{signal.conclusion}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

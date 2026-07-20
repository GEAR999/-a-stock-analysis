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
      case "buy": return <TrendingUp className="w-3 h-3 text-[var(--accent-red)]" />;
      case "sell": return <TrendingDown className="w-3 h-3 text-[var(--accent-green)]" />;
      default: return <Minus className="w-3 h-3 text-[var(--text-secondary)]" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 30) return "text-[var(--accent-red)]";
    if (score >= 10) return "text-red-300";
    if (score <= -30) return "text-[var(--accent-green)]";
    if (score <= -10) return "text-green-300";
    return "text-[var(--text-secondary)]";
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (!selectedStock) {
    return (
      <div className="p-4 text-center text-xs text-[var(--text-secondary)]">
        请先选择股票查看历史信号
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 统计信息 */}
      <div className="px-3 py-2 border-b border-[var(--border-default)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          <span className="text-xs text-[var(--text-secondary)]">
            {selectedStock.name} 历史信号 ({signals.length})
          </span>
        </div>
        {accuracy && accuracy.total > 0 && (
          <div className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3 text-[var(--text-secondary)]" />
            <span className="text-[10px] text-[var(--text-secondary)]">
              准确率: <span className={accuracy.accuracy >= 50 ? "text-[var(--accent-red)]" : "text-[var(--accent-green)]"}>
                {accuracy.accuracy.toFixed(0)}%
              </span>
              <span className="text-[var(--text-muted)]"> ({accuracy.correct}/{accuracy.total})</span>
            </span>
          </div>
        )}
      </div>

      {/* 信号列表 */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-xs text-[var(--text-secondary)]">加载中...</div>
        ) : signals.length === 0 ? (
          <div className="p-4 text-center text-xs text-[var(--text-secondary)]">
            <Clock className="w-6 h-6 mx-auto mb-2 text-[var(--text-muted)]" />
            暂无历史信号记录
            <p className="text-[10px] text-[var(--text-muted)] mt-1">分析引擎运行后会自动保存信号</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {signals.map(signal => (
              <div key={signal.id} className="px-3 py-2 hover:bg-[var(--bg-card)]/30 transition-colors group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--text-secondary)] font-mono">{signal.date}</span>
                    <span className={`text-xs font-mono font-medium ${getScoreColor(signal.score)}`}>
                      {signal.score >= 0 ? "+" : ""}{signal.score}
                    </span>
                  </div>
                  <button
                    onClick={() => signal.id && handleDelete(signal.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--text-muted)] hover:text-[var(--accent-red)] transition-all"
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
                        sig.type === "buy" ? "bg-red-500/10 text-[var(--accent-red)]" :
                        sig.type === "sell" ? "bg-green-500/10 text-[var(--accent-green)]" :
                        "bg-[var(--text-secondary)]/10 text-[var(--text-secondary)]"
                      }`}
                    >
                      {getSignalIcon(sig.type)}
                      {sig.source}
                    </span>
                  ))}
                  {signal.signals.length > 5 && (
                    <span className="text-[9px] text-[var(--text-muted)]">+{signal.signals.length - 5}</span>
                  )}
                </div>

                {/* 结论 */}
                <p className="text-[10px] text-[var(--text-secondary)] line-clamp-2">{signal.conclusion}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

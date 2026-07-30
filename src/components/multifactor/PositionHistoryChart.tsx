"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface PositionLogItem {
  id: string;
  code: string;
  strategyId: string | null;
  totalScore: number;
  basePosition: number;
  sentimentScore: number;
  correctionFactor: number;
  finalPosition: number;
  positionLabel: string | null;
  timestamp: string;
}

interface PositionHistoryChartProps {
  code: string;
  /** 变化时重新拉取（如每次多因子分析完成后） */
  refreshKey?: string | number;
}

/** 仓位区间颜色 */
function getPositionColor(p: number): string {
  if (p >= 80) return "#ef4444"; // 重仓 红
  if (p >= 50) return "#f59e0b"; // 中等 橙
  if (p >= 20) return "#3b82f6"; // 轻仓 蓝
  return "#6b7280"; // 极低/空仓 灰
}

export default function PositionHistoryChart({ code, refreshKey }: PositionHistoryChartProps) {
  const [logs, setLogs] = useState<PositionLogItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/multifactor/position-log?code=${encodeURIComponent(code)}&limit=60`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setLogs(json.data);
      }
    } catch {
      // 拉取失败保持旧数据
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs, refreshKey]);

  if (logs.length === 0 && !loading) return null;

  // SVG 布局
  const width = 400;
  const height = 110;
  const padding = { top: 8, right: 8, bottom: 16, left: 28 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const n = logs.length;
  const xAt = (i: number) => padding.left + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
  const yAt = (p: number) => padding.top + chartH - (Math.min(100, Math.max(0, p)) / 100) * chartH;

  const linePath = logs
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(d.finalPosition).toFixed(1)}`)
    .join(" ");

  const latest = logs[logs.length - 1];
  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <Card className="bg-[#111827] border-[#1e2a40]">
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-xs text-gray-400 flex items-center justify-between">
          <span>仓位历史（近 {n} 次计算）</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-gray-500" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2">
        {n > 0 && (
          <svg width={width} height={height} className="w-full h-auto">
            {/* 仓位区间参考线 */}
            {[20, 50, 80].map((ref) => (
              <g key={ref}>
                <line
                  x1={padding.left} y1={yAt(ref)} x2={padding.left + chartW} y2={yAt(ref)}
                  stroke="#2a3550" strokeWidth="0.5" strokeDasharray="3,3"
                />
                <text x={padding.left - 3} y={yAt(ref) + 2.5} textAnchor="end" className="fill-gray-600 text-[7px]">
                  {ref}%
                </text>
              </g>
            ))}

            {/* 折线 */}
            {n > 1 && (
              <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="1.2" opacity="0.8" />
            )}

            {/* 数据点 */}
            {logs.map((d, i) => (
              <circle
                key={d.id}
                cx={xAt(i)} cy={yAt(d.finalPosition)} r={i === n - 1 ? 3 : 1.8}
                fill={getPositionColor(d.finalPosition)}
              />
            ))}

            {/* X 轴时间标签（首尾） */}
            <text x={padding.left} y={height - 4} textAnchor="start" className="fill-gray-600 text-[7px]">
              {formatTime(logs[0].timestamp)}
            </text>
            <text x={padding.left + chartW} y={height - 4} textAnchor="end" className="fill-gray-600 text-[7px]">
              {formatTime(latest.timestamp)}
            </text>
          </svg>
        )}

        {/* 最新一条记录摘要 */}
        {latest && (
          <div className="flex items-center justify-between text-[10px] text-gray-500 bg-[#0d1420] rounded px-2 py-1.5">
            <span>
              最新: <span className="text-gray-300 font-mono">{formatTime(latest.timestamp)}</span>
            </span>
            <span>
              评分 <span className="text-gray-300 font-mono">{latest.totalScore.toFixed(1)}</span>
            </span>
            <span>
              情绪 <span className="text-gray-300 font-mono">{latest.sentimentScore.toFixed(1)}</span>
            </span>
            <span style={{ color: getPositionColor(latest.finalPosition) }} className="font-mono font-medium">
              {latest.finalPosition.toFixed(0)}% {latest.positionLabel || ""}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

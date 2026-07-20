"use client";

import { useState, useMemo, useEffect } from "react";
import type { Account } from "../backtest/types";
import { callEmbeddedAI, type AIEmbedResponse } from "@/lib/ai-embed";
import {
  calculateSignalQuality,
  calculateProfitAttribution,
  calculateStrategyCorrelation,
  calculateTimeDistribution,
  calculateConsecutiveLossesByStrategy,
  calculateOverallRating,
} from "../backtest/storage";
import { AIAnalysis } from "../ai/AIAnalysis";

type TabKey = "signal" | "profit" | "time" | "loss" | "correlation" | "rating" | "ai";

const TABS: { key: TabKey; label: string }[] = [
  { key: "signal", label: "信号质量" },
  { key: "profit", label: "收益归因" },
  { key: "time", label: "时间分布" },
  { key: "loss", label: "连续亏损" },
  { key: "correlation", label: "策略相关性" },
  { key: "rating", label: "综合评级" },
  { key: "ai", label: "🤖 AI优化" },
];

const STRATEGY_COLORS: Record<string, string> = {
  chanlun: "#a855f7",
  wave: "#3b82f6",
  technical: "#22c55e",
  composite: "#f59e0b",
  manual: "#94a3b8",
};

const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五"];

export default function StrategyValidationReport({ account }: { account: Account }) {
  const [activeTab, setActiveTab] = useState<TabKey>("signal");

  const data = useMemo(() => {
    const signalQuality = calculateSignalQuality(account);
    const profitAttribution = calculateProfitAttribution(account);
    const correlations = calculateStrategyCorrelation(account);
    const timeDistribution = calculateTimeDistribution(account);
    const consecutiveLosses = calculateConsecutiveLossesByStrategy(account);
    const rating = calculateOverallRating(signalQuality, profitAttribution, consecutiveLosses, correlations);
    return { signalQuality, profitAttribution, correlations, timeDistribution, consecutiveLosses, rating };
  }, [account]);

  if (account.trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[var(--text-secondary)]">
        <svg className="w-12 h-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-sm">暂无数据，请完成至少一笔交易</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Tab Header */}
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border-default)] pb-px">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-xs rounded-t whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? "bg-[var(--bg-card)] text-[var(--text-primary)] border-b-2 border-[var(--accent-blue)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[200px]">
        {activeTab === "signal" && <SignalQualityTab data={data.signalQuality} />}
        {activeTab === "profit" && <ProfitAttributionTab data={data.profitAttribution} />}
        {activeTab === "time" && <TimeDistributionTab data={data.timeDistribution} />}
        {activeTab === "loss" && <ConsecutiveLossTab data={data.consecutiveLosses} />}
        {activeTab === "correlation" && <CorrelationTab data={data.correlations} strategies={data.signalQuality.map(s => ({ key: s.strategyKey, name: s.strategyName }))} />}
        {activeTab === "rating" && <RatingTab data={data.rating} />}
        {activeTab === "ai" && <AIOptimizationTab data={data} />}
      </div>
    </div>
  );
}

// ==================== Tab 1: 信号质量 ====================
function SignalQualityTab({ data }: { data: ReturnType<typeof calculateSignalQuality> }) {
  if (data.length === 0) {
    return <div className="text-center text-[var(--text-secondary)] text-sm py-8">暂无信号数据</div>;
  }

  const maxHitRate = Math.max(...data.map(d => d.hitRate), 1);

  return (
    <div className="space-y-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[var(--text-muted)] border-b border-[var(--border-default)]">
            <th className="text-left py-1.5 px-2">策略</th>
            <th className="text-right py-1.5 px-2">信号数</th>
            <th className="text-right py-1.5 px-2">命中</th>
            <th className="text-right py-1.5 px-2">未命中</th>
            <th className="text-right py-1.5 px-2">命中率</th>
            <th className="text-right py-1.5 px-2">误报率</th>
          </tr>
        </thead>
        <tbody>
          {data.map(item => (
            <tr key={item.strategyKey} className="border-b border-[var(--border-default)]/50 hover:bg-[var(--bg-hover)]">
              <td className="py-1.5 px-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STRATEGY_COLORS[item.strategyKey] || "#94a3b8" }} />
                {item.strategyName}
              </td>
              <td className="text-right py-1.5 px-2 font-mono-num">{item.totalSignals}</td>
              <td className="text-right py-1.5 px-2 font-mono-num text-[var(--accent-green)]">{item.hitCount}</td>
              <td className="text-right py-1.5 px-2 font-mono-num text-[var(--accent-red)]">{item.missCount}</td>
              <td className="text-right py-1.5 px-2">
                <span className={item.hitRate >= 60 ? "text-[var(--accent-green)]" : item.hitRate >= 40 ? "text-[var(--accent-yellow)]" : "text-[var(--accent-red)]"}>
                  {item.hitRate}%
                </span>
              </td>
              <td className="text-right py-1.5 px-2 font-mono-num text-[var(--text-secondary)]">{item.falsePositiveRate}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Bar chart */}
      <div className="space-y-1.5 pt-2">
        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">命中率对比</div>
        {data.map(item => (
          <div key={item.strategyKey} className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--text-secondary)] w-14 truncate">{item.strategyName}</span>
            <div className="flex-1 h-4 bg-[var(--bg-card)] rounded overflow-hidden">
              <div
                className="h-full rounded transition-all"
                style={{
                  width: `${(item.hitRate / Math.max(maxHitRate, 1)) * 100}%`,
                  backgroundColor: STRATEGY_COLORS[item.strategyKey] || "#94a3b8",
                  opacity: 0.8,
                }}
              />
            </div>
            <span className="text-[10px] font-mono-num text-[var(--text-secondary)] w-10 text-right">{item.hitRate}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== Tab 2: 收益归因 ====================
function ProfitAttributionTab({ data }: { data: ReturnType<typeof calculateProfitAttribution> }) {
  if (data.length === 0) {
    return <div className="text-center text-[var(--text-secondary)] text-sm py-8">暂无收益数据</div>;
  }

  const totalProfit = data.reduce((sum, d) => sum + d.totalProfit, 0);

  return (
    <div className="space-y-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[var(--text-muted)] border-b border-[var(--border-default)]">
            <th className="text-left py-1.5 px-2">策略</th>
            <th className="text-right py-1.5 px-2">总盈亏</th>
            <th className="text-right py-1.5 px-2">交易次数</th>
            <th className="text-right py-1.5 px-2">平均盈亏</th>
            <th className="text-right py-1.5 px-2">胜率</th>
            <th className="text-right py-1.5 px-2">占比</th>
          </tr>
        </thead>
        <tbody>
          {data.map(item => (
            <tr key={item.strategyKey} className="border-b border-[var(--border-default)]/50 hover:bg-[var(--bg-hover)]">
              <td className="py-1.5 px-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STRATEGY_COLORS[item.strategyKey] || "#94a3b8" }} />
                {item.strategyName}
              </td>
              <td className={`text-right py-1.5 px-2 font-mono-num ${item.totalProfit >= 0 ? "text-[var(--accent-red)]" : "text-[var(--accent-green)]"}`}>
                {item.totalProfit >= 0 ? "+" : ""}{item.totalProfit.toLocaleString()}
              </td>
              <td className="text-right py-1.5 px-2 font-mono-num">{item.tradeCount}</td>
              <td className={`text-right py-1.5 px-2 font-mono-num ${item.avgProfit >= 0 ? "text-[var(--accent-red)]" : "text-[var(--accent-green)]"}`}>
                {item.avgProfit >= 0 ? "+" : ""}{item.avgProfit.toLocaleString()}
              </td>
              <td className="text-right py-1.5 px-2 font-mono-num">{item.winRate}%</td>
              <td className="text-right py-1.5 px-2 font-mono-num text-[var(--text-secondary)]">{item.profitPercent}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-[var(--border-default)] font-medium">
            <td className="py-1.5 px-2">合计</td>
            <td className={`text-right py-1.5 px-2 font-mono-num ${totalProfit >= 0 ? "text-[var(--accent-red)]" : "text-[var(--accent-green)]"}`}>
              {totalProfit >= 0 ? "+" : ""}{totalProfit.toLocaleString()}
            </td>
            <td className="text-right py-1.5 px-2 font-mono-num">{data.reduce((s, d) => s + d.tradeCount, 0)}</td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>

      {/* Pie chart (simplified as horizontal bar) */}
      <div className="pt-2">
        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">收益贡献占比</div>
        <div className="flex h-5 rounded overflow-hidden bg-[var(--bg-card)]">
          {data.filter(d => Math.abs(d.totalProfit) > 0).map(item => (
            <div
              key={item.strategyKey}
              className="h-full transition-all relative group"
              style={{
                width: `${Math.max(item.profitPercent, 2)}%`,
                backgroundColor: STRATEGY_COLORS[item.strategyKey] || "#94a3b8",
                opacity: 0.8,
              }}
              title={`${item.strategyName}: ${item.profitPercent}%`}
            >
              <div className="absolute inset-0 flex items-center justify-center text-[9px] text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                {item.profitPercent}%
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mt-1.5">
          {data.map(item => (
            <div key={item.strategyKey} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: STRATEGY_COLORS[item.strategyKey] || "#94a3b8" }} />
              <span className="text-[10px] text-[var(--text-secondary)]">{item.strategyName}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== Tab 3: 时间分布 ====================
function TimeDistributionTab({ data }: { data: ReturnType<typeof calculateTimeDistribution> }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const hours = [9, 10, 11, 12, 13, 14, 15];

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">信号时间热力图</div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr>
              <th className="text-left py-1 px-1 text-[var(--text-muted)] w-8"></th>
              {hours.map(h => (
                <th key={h} className="text-center py-1 px-0.5 text-[var(--text-muted)]">{h}:00</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4].map(day => (
              <tr key={day}>
                <td className="py-0.5 px-1 text-[var(--text-muted)]">{DAY_NAMES[day]}</td>
                {hours.map(hour => {
                  const cell = data.find(d => d.day === day && d.hour === hour);
                  const count = cell?.count ?? 0;
                  const intensity = count / maxCount;
                  const profit = cell?.profit ?? 0;
                  return (
                    <td key={hour} className="py-0.5 px-0.5">
                      <div
                        className="w-full aspect-square rounded-sm flex items-center justify-center relative group cursor-default"
                        style={{
                          backgroundColor: count > 0
                            ? `rgba(59, 130, 246, ${Math.max(0.1, intensity)})`
                            : "var(--bg-card)",
                        }}
                        title={`${DAY_NAMES[day]} ${hour}:00 - ${count}笔交易, 盈亏: ${profit >= 0 ? "+" : ""}${profit}`}
                      >
                        {count > 0 && (
                          <span className="text-[8px] text-white/80 font-mono-num">{count}</span>
                        )}
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                          <div className="bg-[var(--bg-panel)] border border-[var(--border-default)] rounded px-2 py-1 text-[10px] whitespace-nowrap shadow-lg">
                            <div className="text-[var(--text-primary)]">{DAY_NAMES[day]} {hour}:00</div>
                            <div className="text-[var(--text-secondary)]">交易: {count}笔</div>
                            <div className={profit >= 0 ? "text-[var(--accent-red)]" : "text-[var(--accent-green)]"}>
                              盈亏: {profit >= 0 ? "+" : ""}{profit.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <span className="text-[9px] text-[var(--text-muted)]">少</span>
        <div className="flex gap-0.5">
          {[0.1, 0.3, 0.5, 0.7, 1.0].map(v => (
            <div key={v} className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(59, 130, 246, ${v})` }} />
          ))}
        </div>
        <span className="text-[9px] text-[var(--text-muted)]">多</span>
      </div>
    </div>
  );
}

// ==================== Tab 4: 连续亏损 ====================
function ConsecutiveLossTab({ data }: { data: ReturnType<typeof calculateConsecutiveLossesByStrategy> }) {
  if (data.length === 0) {
    return <div className="text-center text-[var(--text-secondary)] text-sm py-8">暂无数据</div>;
  }

  return (
    <div className="space-y-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[var(--text-muted)] border-b border-[var(--border-default)]">
            <th className="text-left py-1.5 px-2">策略</th>
            <th className="text-right py-1.5 px-2">最大连续亏损</th>
            <th className="text-right py-1.5 px-2">当前连续亏损</th>
            <th className="text-right py-1.5 px-2">亏损段数</th>
            <th className="text-left py-1.5 px-2">状态</th>
          </tr>
        </thead>
        <tbody>
          {data.map(item => (
            <tr key={item.strategyKey} className="border-b border-[var(--border-default)]/50 hover:bg-[var(--bg-hover)]">
              <td className="py-1.5 px-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STRATEGY_COLORS[item.strategyKey] || "#94a3b8" }} />
                {item.strategyName}
              </td>
              <td className="text-right py-1.5 px-2 font-mono-num">
                <span className={item.maxConsecutive > 5 ? "text-[var(--accent-red)] font-bold" : ""}>
                  {item.maxConsecutive}
                </span>
              </td>
              <td className="text-right py-1.5 px-2 font-mono-num">
                <span className={item.currentConsecutive > 3 ? "text-[var(--accent-red)]" : ""}>
                  {item.currentConsecutive}
                </span>
              </td>
              <td className="text-right py-1.5 px-2 font-mono-num text-[var(--text-secondary)]">{item.totalLossStreaks}</td>
              <td className="py-1.5 px-2">
                {item.currentConsecutive > 5 ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--accent-red)]/10 text-[var(--accent-red)] text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-red)] animate-pulse" />
                    高风险
                  </span>
                ) : item.currentConsecutive > 2 ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--accent-yellow)]/10 text-[var(--accent-yellow)] text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-yellow)]" />
                    注意
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--accent-green)]/10 text-[var(--accent-green)] text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)]" />
                    正常
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Visual bar */}
      <div className="space-y-1.5 pt-2">
        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">最大连续亏损对比</div>
        {data.map(item => (
          <div key={item.strategyKey} className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--text-secondary)] w-14 truncate">{item.strategyName}</span>
            <div className="flex-1 flex gap-0.5">
              {Array.from({ length: Math.min(item.maxConsecutive, 20) }).map((_, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-sm"
                  style={{
                    backgroundColor: i >= item.maxConsecutive - item.currentConsecutive
                      ? "var(--accent-red)"
                      : "var(--accent-red)",
                    opacity: 0.3 + (i / Math.max(item.maxConsecutive, 1)) * 0.7,
                  }}
                />
              ))}
              {item.maxConsecutive === 0 && (
                <span className="text-[10px] text-[var(--text-muted)]">无连续亏损</span>
              )}
            </div>
            <span className="text-[10px] font-mono-num text-[var(--text-secondary)] w-6 text-right">{item.maxConsecutive}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== Tab 5: 策略相关性 ====================
function CorrelationTab({ data, strategies }: {
  data: ReturnType<typeof calculateStrategyCorrelation>;
  strategies: { key: string; name: string }[];
}) {
  if (data.length === 0) {
    return (
      <div className="text-center text-[var(--text-secondary)] text-sm py-8">
        需要至少2个策略的数据才能计算相关性
      </div>
    );
  }

  const strategyNames = strategies.map(s => s.name);
  const strategyKeys = strategies.map(s => s.key);

  // Build matrix
  const getCorrelation = (key1: string, key2: string) => {
    if (key1 === key2) return { correlation: 1, overlapRate: 100 };
    const found = data.find(d =>
      (d.strategy1 === key1 && d.strategy2 === key2) ||
      (d.strategy1 === key2 && d.strategy2 === key1)
    );
    return found || { correlation: 0, overlapRate: 0 };
  };

  return (
    <div className="space-y-3">
      <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">信号重合率矩阵</div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr>
              <th className="text-left py-1 px-1 text-[var(--text-muted)]"></th>
              {strategyNames.map(name => (
                <th key={name} className="text-center py-1 px-1 text-[var(--text-muted)] max-w-[60px] truncate">{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {strategyKeys.map((key1, i) => (
              <tr key={key1}>
                <td className="py-1 px-1 text-[var(--text-muted)]">{strategyNames[i]}</td>
                {strategyKeys.map((key2, j) => {
                  const corr = getCorrelation(key1, key2);
                  const isHigh = i !== j && corr.overlapRate > 70;
                  return (
                    <td key={key2} className="py-1 px-1 text-center">
                      <div
                        className="w-full aspect-square rounded-sm flex items-center justify-center"
                        style={{
                          backgroundColor: i === j
                            ? "var(--accent-blue)"
                            : `rgba(239, 68, 68, ${corr.overlapRate / 100 * 0.6})`,
                          opacity: i === j ? 0.3 : 1,
                        }}
                      >
                        <span className={`font-mono-num ${isHigh ? "text-white font-bold" : "text-[var(--text-primary)]"}`}>
                          {i === j ? "-" : `${corr.overlapRate}%`}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Warnings */}
      {data.filter(d => d.overlapRate > 70).length > 0 && (
        <div className="space-y-1 pt-2">
          {data.filter(d => d.overlapRate > 70).map(d => (
            <div key={`${d.strategy1}-${d.strategy2}`} className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--accent-yellow)]/10 text-[10px] text-[var(--accent-yellow)]">
              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>
                {STRATEGY_COLORS[d.strategy1] ? strategies.find(s => s.key === d.strategy1)?.name : d.strategy1}
                {" 与 "}
                {STRATEGY_COLORS[d.strategy2] ? strategies.find(s => s.key === d.strategy2)?.name : d.strategy2}
                {" 信号重合率 "}{d.overlapRate}%，高度冗余，建议保留其一
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== Tab 6: 综合评级 ====================
function RatingTab({ data }: { data: ReturnType<typeof calculateOverallRating> }) {
  const gradeColors: Record<string, string> = {
    A: "text-[var(--accent-green)]",
    B: "text-[var(--accent-blue)]",
    C: "text-[var(--accent-yellow)]",
    D: "text-[var(--accent-red)]",
  };

  const dimensions = [
    { label: "信号命中率", score: data.signalScore, weight: "30%" },
    { label: "收益贡献", score: data.profitScore, weight: "30%" },
    { label: "风险控制", score: data.riskScore, weight: "20%" },
    { label: "策略多样性", score: data.diversityScore, weight: "20%" },
  ];

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <div className="flex items-center gap-4 p-3 rounded bg-[var(--bg-card)] border border-[var(--border-default)]">
        <div className="text-center">
          <div className={`text-3xl font-bold ${gradeColors[data.grade]}`}>{data.grade}</div>
          <div className="text-[10px] text-[var(--text-muted)] mt-0.5">综合评级</div>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[var(--text-secondary)]">综合得分</span>
            <span className="text-sm font-mono-num font-bold text-[var(--text-primary)]">{data.score}</span>
          </div>
          <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${data.score}%`,
                backgroundColor: data.score >= 85 ? "var(--accent-green)" : data.score >= 70 ? "var(--accent-blue)" : data.score >= 50 ? "var(--accent-yellow)" : "var(--accent-red)",
              }}
            />
          </div>
          <div className="flex justify-between mt-0.5 text-[9px] text-[var(--text-muted)]">
            <span>D (&lt;50)</span>
            <span>C (50-69)</span>
            <span>B (70-84)</span>
            <span>A (85+)</span>
          </div>
        </div>
      </div>

      {/* Dimension Scores */}
      <div className="space-y-2">
        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">维度得分</div>
        {dimensions.map(dim => (
          <div key={dim.label} className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--text-secondary)] w-16">{dim.label}</span>
            <span className="text-[9px] text-[var(--text-muted)] w-6">{dim.weight}</span>
            <div className="flex-1 h-3 bg-[var(--bg-card)] rounded overflow-hidden">
              <div
                className="h-full rounded transition-all"
                style={{
                  width: `${dim.score}%`,
                  backgroundColor: dim.score >= 70 ? "var(--accent-green)" : dim.score >= 40 ? "var(--accent-yellow)" : "var(--accent-red)",
                  opacity: 0.7,
                }}
              />
            </div>
            <span className="text-[10px] font-mono-num text-[var(--text-secondary)] w-8 text-right">{dim.score}</span>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      <div className="space-y-1.5">
        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">改进建议</div>
        {data.suggestions.map((suggestion, i) => (
          <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded bg-[var(--bg-card)] text-[11px] text-[var(--text-secondary)]">
            <svg className="w-3 h-3 shrink-0 mt-0.5 text-[var(--accent-blue)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {suggestion}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== Tab 7: AI优化建议 ====================
interface StrategyReportData {
  signalQuality: Array<{
    strategyName: string;
    hitRate: number;
    falsePositiveRate: number;
    totalSignals: number;
  }>;
  profitAttribution: Array<{
    strategyName: string;
    totalProfit: number;
    winRate: number;
    tradeCount: number;
  }>;
  consecutiveLosses: Array<{
    strategyName: string;
    maxConsecutive: number;
    currentConsecutive: number;
  }>;
  rating: {
    grade: string;
    score: number;
  };
}

function AIOptimizationTab({ data }: { data: StrategyReportData }) {
  const [aiResponse, setAiResponse] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAIAdvice = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const context = {
          signalQuality: data.signalQuality.map(s => ({
            strategy: s.strategyName,
            hitRate: s.hitRate,
            falsePositiveRate: s.falsePositiveRate,
            totalSignals: s.totalSignals,
          })),
          profitAttribution: data.profitAttribution.map(p => ({
            strategy: p.strategyName,
            totalProfit: p.totalProfit,
            winRate: p.winRate,
            tradeCount: p.tradeCount,
          })),
          consecutiveLosses: data.consecutiveLosses.map(c => ({
            strategy: c.strategyName,
            maxConsecutive: c.maxConsecutive,
            currentConsecutive: c.currentConsecutive,
          })),
          rating: data.rating,
        };

        const response = await callEmbeddedAI({
          prompt: "请分析这个策略验证报告，给出优化建议。要求：1) 指出哪些策略表现差及原因；2) 参数调整建议；3) 策略组合优化方向。请给出3-5条具体建议，每条带优先级标签（高/中/低）。",
          context,
        });
        setAiResponse(response.content || "AI分析暂不可用");
      } catch (err) {
        setError(err instanceof Error ? err.message : "AI分析失败");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAIAdvice();
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-4 bg-[var(--bg-card)] rounded animate-pulse w-3/4" />
        <div className="h-4 bg-[var(--bg-card)] rounded animate-pulse w-1/2" />
        <div className="h-4 bg-[var(--bg-card)] rounded animate-pulse w-2/3" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4 text-[var(--text-secondary)] text-sm">
        <span className="text-[var(--accent-yellow)]">⚠️</span> {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border-default)]">
        <span className="text-sm">🤖</span>
        <span className="text-xs text-[var(--text-secondary)]">AI优化建议</span>
      </div>
      <div className="px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border-default)]">
        <div className="text-xs text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
          {aiResponse || "暂无建议"}
        </div>
      </div>
    </div>
  );
}

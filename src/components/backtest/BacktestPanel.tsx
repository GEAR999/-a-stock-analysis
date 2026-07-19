"use client";

import { useState, useEffect } from "react";
import type { Trade, Position, Account, StrategyMetrics, EquityPoint, PositionAdvice } from "./types";

// 模拟数据生成
function generateMockData() {
  const trades: Trade[] = [
    { id: "1", timestamp: Date.now() - 86400000 * 5, stockCode: "600519", stockName: "贵州茅台", direction: "buy", price: 1180, quantity: 100, amount: 118000, reason: "缠论二买信号" },
    { id: "2", timestamp: Date.now() - 86400000 * 3, stockCode: "000858", stockName: "五粮液", direction: "buy", price: 145, quantity: 500, amount: 72500, reason: "波浪理论第3浪启动" },
    { id: "3", timestamp: Date.now() - 86400000 * 2, stockCode: "600519", stockName: "贵州茅台", direction: "sell", price: 1250, quantity: 100, amount: 125000, reason: "技术指标超买", pnl: 7000 },
    { id: "4", timestamp: Date.now() - 86400000, stockCode: "300750", stockName: "宁德时代", direction: "buy", price: 198, quantity: 300, amount: 59400, reason: "板块热度高" },
  ];

  const positions: Position[] = [
    { stockCode: "000858", stockName: "五粮液", quantity: 500, avgCost: 145, currentPrice: 152.5, marketValue: 76250, pnl: 3750, pnlPercent: 5.17, positionPercent: 7.6 },
    { stockCode: "300750", stockName: "宁德时代", quantity: 300, avgCost: 198, currentPrice: 205.8, marketValue: 61740, pnl: 2340, pnlPercent: 3.94, positionPercent: 6.2 },
  ];

  const account: Account = {
    initialCapital: 1000000,
    totalAssets: 1038990,
    availableCash: 862750,
    marketValue: 137990,
    totalPnl: 38990,
    totalPnlPercent: 3.9,
    positionPercent: 13.4,
  };

  const metrics: StrategyMetrics = {
    totalReturn: 3.9,
    annualReturn: 28.5,
    maxDrawdown: 2.1,
    sharpeRatio: 1.85,
    winRate: 66.7,
    profitLossRatio: 2.1,
    totalTrades: 4,
    profitableTrades: 2,
    losingTrades: 0,
  };

  // 生成资金曲线
  const equityCurve: EquityPoint[] = [];
  const now = Date.now();
  for (let i = 30; i >= 0; i--) {
    const base = 1000000;
    const growth = (30 - i) * 1300 + Math.sin(i * 0.3) * 5000;
    equityCurve.push({
      timestamp: now - i * 86400000,
      totalAssets: base + growth,
      cash: base + growth - 100000 * Math.sin(i * 0.2),
      marketValue: 100000 * Math.sin(i * 0.2) + 38000,
    });
  }

  const positionAdvices: PositionAdvice[] = [
    { stockCode: "000858", stockName: "五粮液", currentPosition: 7.6, suggestedPosition: 15, action: "加仓", riskLevel: "中", reason: "波浪理论看涨，技术指标共振" },
    { stockCode: "300750", stockName: "宁德时代", currentPosition: 6.2, suggestedPosition: 10, action: "加仓", riskLevel: "中", reason: "板块热度高，资金流入" },
    { stockCode: "600519", stockName: "贵州茅台", currentPosition: 0, suggestedPosition: 0, action: "持有", riskLevel: "低", reason: "已获利了结，等待新信号" },
  ];

  return { trades, positions, account, metrics, equityCurve, positionAdvices };
}

export function BacktestPanel() {
  const [activeTab, setActiveTab] = useState<"trades" | "positions" | "equity" | "metrics" | "advice">("metrics");
  const [data, setData] = useState(generateMockData());

  const tabs = [
    { id: "metrics" as const, label: "策略指标" },
    { id: "equity" as const, label: "资金曲线" },
    { id: "positions" as const, label: "持仓" },
    { id: "trades" as const, label: "交易记录" },
    { id: "advice" as const, label: "仓位建议" },
  ];

  return (
    <div className="h-full flex flex-col bg-[#0a0e17]">
      {/* 账户概览 */}
      <div className="p-3 border-b border-gray-800 bg-[#111827]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-200">模拟账户</h3>
          <span className="text-[10px] text-gray-500">初始资金: ¥1,000,000</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <div className="text-[10px] text-gray-500">总资产</div>
            <div className="text-sm font-mono font-bold text-green-400">
              ¥{data.account.totalAssets.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500">可用资金</div>
            <div className="text-sm font-mono text-gray-300">
              ¥{data.account.availableCash.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500">总盈亏</div>
            <div className={`text-sm font-mono font-bold ${data.account.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
              {data.account.totalPnl >= 0 ? "+" : ""}¥{data.account.totalPnl.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500">仓位</div>
            <div className="text-sm font-mono text-yellow-400">
              {data.account.positionPercent}%
            </div>
          </div>
        </div>
      </div>

      {/* Tab切换 */}
      <div className="flex border-b border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2 text-xs transition-colors ${
              activeTab === tab.id
                ? "text-blue-400 border-b-2 border-blue-400 bg-blue-400/5"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* 策略指标 */}
        {activeTab === "metrics" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="累计收益率" value={`${data.metrics.totalReturn}%`} color={data.metrics.totalReturn >= 0 ? "green" : "red"} />
              <MetricCard label="年化收益率" value={`${data.metrics.annualReturn}%`} color={data.metrics.annualReturn >= 0 ? "green" : "red"} />
              <MetricCard label="最大回撤" value={`${data.metrics.maxDrawdown}%`} color="red" />
              <MetricCard label="夏普比率" value={data.metrics.sharpeRatio.toFixed(2)} color="blue" />
              <MetricCard label="胜率" value={`${data.metrics.winRate}%`} color={data.metrics.winRate >= 50 ? "green" : "yellow"} />
              <MetricCard label="盈亏比" value={data.metrics.profitLossRatio.toFixed(1)} color="blue" />
            </div>
            <div className="bg-[#1a1a2e] rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-2">交易统计</div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">总交易次数</span>
                <span className="text-gray-200 font-mono">{data.metrics.totalTrades}</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-gray-500">盈利交易</span>
                <span className="text-green-400 font-mono">{data.metrics.profitableTrades}</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-gray-500">亏损交易</span>
                <span className="text-red-400 font-mono">{data.metrics.losingTrades}</span>
              </div>
            </div>
          </div>
        )}

        {/* 资金曲线 */}
        {activeTab === "equity" && (
          <div className="space-y-3">
            <div className="bg-[#1a1a2e] rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-2">资金走势（近30天）</div>
              <div className="h-40 relative">
                <svg className="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* 填充区域 */}
                  <path
                    d={`M 0 100 ${data.equityCurve.map((p, i) => {
                      const x = (i / (data.equityCurve.length - 1)) * 300;
                      const y = 100 - ((p.totalAssets - 990000) / 60000) * 100;
                      return `L ${x} ${y}`;
                    }).join(" ")} L 300 100 Z`}
                    fill="url(#equityGradient)"
                  />
                  {/* 线条 */}
                  <path
                    d={`M 0 ${100 - ((data.equityCurve[0].totalAssets - 990000) / 60000) * 100} ${data.equityCurve.map((p, i) => {
                      const x = (i / (data.equityCurve.length - 1)) * 300;
                      const y = 100 - ((p.totalAssets - 990000) / 60000) * 100;
                      return `L ${x} ${y}`;
                    }).join(" ")}`}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#1a1a2e] rounded p-2 text-center">
                <div className="text-[10px] text-gray-500">起始</div>
                <div className="text-xs font-mono text-gray-300">¥1,000,000</div>
              </div>
              <div className="bg-[#1a1a2e] rounded p-2 text-center">
                <div className="text-[10px] text-gray-500">最高</div>
                <div className="text-xs font-mono text-green-400">
                  ¥{Math.max(...data.equityCurve.map(p => p.totalAssets)).toLocaleString()}
                </div>
              </div>
              <div className="bg-[#1a1a2e] rounded p-2 text-center">
                <div className="text-[10px] text-gray-500">当前</div>
                <div className="text-xs font-mono text-green-400">
                  ¥{data.account.totalAssets.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 持仓 */}
        {activeTab === "positions" && (
          <div className="space-y-2">
            {data.positions.length === 0 ? (
              <div className="text-center text-gray-500 text-xs py-8">暂无持仓</div>
            ) : (
              data.positions.map((pos) => (
                <div key={pos.stockCode} className="bg-[#1a1a2e] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm text-gray-200">{pos.stockName}</span>
                      <span className="text-[10px] text-gray-500 ml-2">{pos.stockCode}</span>
                    </div>
                    <span className={`text-sm font-mono font-bold ${pos.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {pos.pnl >= 0 ? "+" : ""}{pos.pnlPercent.toFixed(2)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[10px]">
                    <div>
                      <span className="text-gray-500">持仓</span>
                      <div className="text-gray-300 font-mono">{pos.quantity}股</div>
                    </div>
                    <div>
                      <span className="text-gray-500">成本</span>
                      <div className="text-gray-300 font-mono">¥{pos.avgCost.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">现价</span>
                      <div className="text-gray-300 font-mono">¥{pos.currentPrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">盈亏</span>
                      <div className={`font-mono ${pos.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {pos.pnl >= 0 ? "+" : ""}¥{pos.pnl.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 bg-[#0f0f1a] rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full"
                        style={{ width: `${pos.positionPercent}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500">仓位 {pos.positionPercent}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 交易记录 */}
        {activeTab === "trades" && (
          <div className="space-y-2">
            {data.trades.map((trade) => (
              <div key={trade.id} className="bg-[#1a1a2e] rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      trade.direction === "buy" ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"
                    }`}>
                      {trade.direction === "buy" ? "买入" : "卖出"}
                    </span>
                    <span className="text-sm text-gray-200">{trade.stockName}</span>
                  </div>
                  {trade.pnl !== undefined && (
                    <span className={`text-xs font-mono ${trade.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {trade.pnl >= 0 ? "+" : ""}¥{trade.pnl.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-500">
                  <span>{new Date(trade.timestamp).toLocaleDateString()}</span>
                  <span>¥{trade.price.toFixed(2)} × {trade.quantity}股</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-1 break-words">
                  {trade.reason}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 仓位建议 */}
        {activeTab === "advice" && (
          <div className="space-y-2">
            <div className="bg-[#1a1a2e] rounded-lg p-3 mb-3">
              <div className="text-xs text-gray-400 mb-2">仓位管理规则</div>
              <div className="text-[10px] text-gray-500 space-y-1">
                <div>• 单只股票仓位不超过 30%</div>
                <div>• 总仓位不超过 80%</div>
                <div>• 高风险标的仓位不超过 10%</div>
              </div>
            </div>
            {data.positionAdvices.map((advice) => (
              <div key={advice.stockCode} className="bg-[#1a1a2e] rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm text-gray-200">{advice.stockName}</span>
                    <span className="text-[10px] text-gray-500 ml-2">{advice.stockCode}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${
                    advice.action === "加仓" || advice.action === "建仓"
                      ? "bg-red-500/20 text-red-400"
                      : advice.action === "减仓" || advice.action === "清仓"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-gray-500/20 text-gray-400"
                  }`}>
                    {advice.action}
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1">
                    <div className="text-[10px] text-gray-500 mb-1">当前仓位</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-[#0f0f1a] rounded-full h-2">
                        <div
                          className="bg-gray-500 h-2 rounded-full"
                          style={{ width: `${Math.min(advice.currentPosition, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-gray-400">{advice.currentPosition}%</span>
                    </div>
                  </div>
                  <div className="text-gray-600">→</div>
                  <div className="flex-1">
                    <div className="text-[10px] text-gray-500 mb-1">建议仓位</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-[#0f0f1a] rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${Math.min(advice.suggestedPosition, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-blue-400">{advice.suggestedPosition}%</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    advice.riskLevel === "低" ? "bg-green-500/20 text-green-400" :
                    advice.riskLevel === "中" ? "bg-yellow-500/20 text-yellow-400" :
                    advice.riskLevel === "高" ? "bg-orange-500/20 text-orange-400" :
                    "bg-red-500/20 text-red-400"
                  }`}>
                    风险: {advice.riskLevel}
                  </span>
                  <span className="text-[10px] text-gray-400 break-words max-w-[60%] text-right">{advice.reason}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorClass = {
    green: "text-green-400",
    red: "text-red-400",
    blue: "text-blue-400",
    yellow: "text-yellow-400",
  }[color] || "text-gray-300";

  return (
    <div className="bg-[#1a1a2e] rounded-lg p-3">
      <div className="text-[10px] text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-mono font-bold ${colorClass}`}>{value}</div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import type { Account } from "./types";

interface EquityCurveChartProps {
  account: Account;
}

interface DataPoint {
  date: string;
  timestamp: number;
  totalAssets: number;
  cash: number;
  marketValue: number;
  benchmarkReturn: number;
}

export default function EquityCurveChart({ account }: EquityCurveChartProps) {
  const data = useMemo(() => {
    if (account.trades.length === 0) return [];

    // Sort trades by timestamp
    const sortedTrades = [...account.trades].sort((a, b) => a.timestamp - b.timestamp);
    const firstTrade = sortedTrades[0];
    const lastTrade = sortedTrades[sortedTrades.length - 1];

    // Generate data points from first trade to now
    const points: DataPoint[] = [];
    const startDate = new Date(firstTrade.timestamp);
    const endDate = new Date(Math.max(lastTrade.timestamp, Date.now()));
    
    // Calculate daily data points
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const numPoints = Math.min(days + 1, 60); // Max 60 points
    
    let currentCash = account.initialCapital;
    let currentPositions: Record<string, { qty: number; avgCost: number }> = {};
    let tradeIndex = 0;

    // Simulate benchmark (CSI 300) returns
    const benchmarkStart = 4000; // Starting index value
    let benchmarkValue = benchmarkStart;

    for (let i = 0; i < numPoints; i++) {
      const timestamp = startDate.getTime() + (i * (endDate.getTime() - startDate.getTime()) / (numPoints - 1));
      const date = new Date(timestamp).toISOString().slice(0, 10);

      // Process trades up to this point
      while (tradeIndex < sortedTrades.length && sortedTrades[tradeIndex].timestamp <= timestamp) {
        const trade = sortedTrades[tradeIndex];
        if (trade.direction === "buy") {
          currentCash -= trade.amount;
          const pos = currentPositions[trade.stockCode] || { qty: 0, avgCost: 0 };
          const newQty = pos.qty + trade.quantity;
          const newAvgCost = newQty > 0 ? (pos.avgCost * pos.qty + trade.amount) / newQty : 0;
          currentPositions[trade.stockCode] = { qty: newQty, avgCost: newAvgCost };
        } else {
          currentCash += trade.amount;
          const pos = currentPositions[trade.stockCode];
          if (pos) {
            pos.qty -= trade.quantity;
            if (pos.qty <= 0) delete currentPositions[trade.stockCode];
          }
        }
        tradeIndex++;
      }

      // Calculate market value with simulated price changes
      let marketValue = 0;
      for (const [code, pos] of Object.entries(currentPositions)) {
        // Simulate price movement based on trade history
        const trades = sortedTrades.filter(t => t.stockCode === code && t.timestamp <= timestamp);
        const lastPrice = trades.length > 0 ? trades[trades.length - 1].price : pos.avgCost;
        // Add some simulated volatility
        const dayOffset = i * 0.1;
        const simulatedPrice = lastPrice * (1 + Math.sin(dayOffset + code.charCodeAt(0)) * 0.02);
        marketValue += pos.qty * simulatedPrice;
      }

      // Simulate benchmark movement
      benchmarkValue *= (1 + Math.sin(i * 0.15) * 0.005 + 0.001);
      const benchmarkReturn = ((benchmarkValue - benchmarkStart) / benchmarkStart) * 100;

      points.push({
        date,
        timestamp,
        totalAssets: currentCash + marketValue,
        cash: currentCash,
        marketValue,
        benchmarkReturn,
      });
    }

    return points;
  }, [account]);

  if (data.length === 0) {
    return <div className="text-center py-8 text-[var(--text-secondary)] text-[10px]">暂无数据</div>;
  }

  // Calculate chart dimensions
  const width = 320;
  const height = 150;
  const padding = { top: 10, right: 10, bottom: 20, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const assets = data.map(d => d.totalAssets);
  const minAssets = Math.min(...assets, account.initialCapital);
  const maxAssets = Math.max(...assets, account.initialCapital);
  const assetRange = maxAssets - minAssets || 1;

  const strategyReturns = data.map(d => ((d.totalAssets - account.initialCapital) / account.initialCapital) * 100);
  const minReturn = Math.min(...strategyReturns, 0);
  const maxReturn = Math.max(...strategyReturns, 0);
  const returnRange = maxReturn - minReturn || 1;

  // Generate path for strategy curve
  const strategyPath = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartWidth;
    const returnPct = ((d.totalAssets - account.initialCapital) / account.initialCapital) * 100;
    const y = padding.top + chartHeight - ((returnPct - minReturn) / returnRange) * chartHeight;
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");

  // Generate path for benchmark curve
  const benchmarkPath = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - ((d.benchmarkReturn - minReturn) / returnRange) * chartHeight;
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");

  // Generate area fill for strategy
  const areaPath = strategyPath + 
    ` L ${padding.left + chartWidth} ${padding.top + chartHeight}` +
    ` L ${padding.left} ${padding.top + chartHeight} Z`;

  // Zero line position
  const zeroY = padding.top + chartHeight - ((0 - minReturn) / returnRange) * chartHeight;

  // Trade markers
  const tradeMarkers = account.trades.map(trade => {
    const tradeDate = new Date(trade.timestamp).toISOString().slice(0, 10);
    const pointIndex = data.findIndex(d => d.date >= tradeDate);
    if (pointIndex < 0) return null;
    
    const x = padding.left + (pointIndex / (data.length - 1)) * chartWidth;
    const returnPct = ((data[pointIndex].totalAssets - account.initialCapital) / account.initialCapital) * 100;
    const y = padding.top + chartHeight - ((returnPct - minReturn) / returnRange) * chartHeight;
    
    return {
      x,
      y,
      type: trade.direction,
      isProfit: (trade.pnl || 0) >= 0,
      date: tradeDate,
    };
  }).filter(Boolean);

  // Y-axis labels
  const yLabels = [
    { value: maxReturn, y: padding.top },
    { value: 0, y: zeroY },
    { value: minReturn, y: padding.top + chartHeight },
  ];

  return (
    <div className="relative">
      <svg width={width} height={height} className="w-full h-auto">
        {/* Grid lines */}
        <line x1={padding.left} y1={zeroY} x2={padding.left + chartWidth} y2={zeroY} 
          stroke="#374151" strokeWidth="0.5" strokeDasharray="2,2" />
        
        {/* Y-axis labels */}
        {yLabels.map((label, i) => (
          <text key={i} x={padding.left - 5} y={label.y + 3} 
            textAnchor="end" className="fill-gray-500 text-[8px]">
            {label.value.toFixed(1)}%
          </text>
        ))}

        {/* X-axis labels */}
        {data.filter((_, i) => i % Math.ceil(data.length / 4) === 0).map((d, i) => {
          const x = padding.left + (data.indexOf(d) / (data.length - 1)) * chartWidth;
          return (
            <text key={i} x={x} y={height - 5} 
              textAnchor="middle" className="fill-gray-500 text-[8px]">
              {d.date.slice(5)}
            </text>
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill="url(#equityGradient)" opacity="0.3" />
        
        {/* Benchmark line */}
        <path d={benchmarkPath} fill="none" stroke="#6b7280" strokeWidth="1" strokeDasharray="3,3" />
        
        {/* Strategy line */}
        <path d={strategyPath} fill="none" stroke="#3b82f6" strokeWidth="1.5" />

        {/* Trade markers */}
        {tradeMarkers.map((marker, i) => marker && (
          <g key={i}>
            <circle
              cx={marker.x}
              cy={marker.y}
              r="3"
              fill={marker.type === "buy" ? "#22c55e" : "#ef4444"}
              opacity={marker.isProfit ? 1 : 0.6}
              stroke={marker.isProfit ? "#22c55e" : "#ef4444"}
              strokeWidth={marker.isProfit ? "0" : "1"}
              strokeOpacity="0.3"
            />
          </g>
        ))}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

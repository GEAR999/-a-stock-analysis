/**
 * PerformanceAnalysis - 复盘分析组件
 * 分析交易成功率、收益率、最大回撤等指标
 */
'use client';

import React, { useMemo } from 'react';
import type { QuantLiveTrade } from './QuantLiveChart';

interface PerformanceAnalysisProps {
  trades: QuantLiveTrade[];
  initialCapital: number;
  currentCapital?: number;
}

interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturn: number;
  totalReturnRate: number;
  avgProfit: number;
  avgLoss: number;
  profitLossRatio: number;
  maxProfit: number;
  maxLoss: number;
  maxDrawdown: number;
  sharpeRatio: number;
  avgHoldingDays: number;
}

export default function PerformanceAnalysis({ 
  trades, 
  initialCapital,
  currentCapital 
}: PerformanceAnalysisProps) {
  // 计算绩效指标
  const metrics: PerformanceMetrics = useMemo(() => {
    const buyTrades = trades.filter(t => t.type === 'buy');
    const sellTrades = trades.filter(t => t.type === 'sell');
    
    // 配对交易（买入 - 卖出）
    const pairs: Array<{ buy: QuantLiveTrade; sell: QuantLiveTrade; profit: number; profitRate: number; holdingDays: number }> = [];
    
    for (const sell of sellTrades) {
      // 找到最近的未配对买入
      const buy = buyTrades.find(b => 
        new Date(b.date) < new Date(sell.date) && 
        !pairs.some(p => p.buy.id === b.id)
      );
      
      if (buy) {
        const profit = sell.amount - buy.amount;
        const profitRate = (profit / buy.amount) * 100;
        const holdingDays = Math.ceil(
          (new Date(sell.date).getTime() - new Date(buy.date).getTime()) / (1000 * 60 * 60 * 24)
        );
        pairs.push({ buy, sell, profit, profitRate, holdingDays });
      }
    }
    
    const winningTrades = pairs.filter(p => p.profit > 0);
    const losingTrades = pairs.filter(p => p.profit <= 0);
    
    const totalReturn = currentCapital ? currentCapital - initialCapital : 0;
    const totalReturnRate = initialCapital > 0 ? (totalReturn / initialCapital) * 100 : 0;
    
    const avgProfit = winningTrades.length > 0 
      ? winningTrades.reduce((sum, p) => sum + p.profit, 0) / winningTrades.length 
      : 0;
    
    const avgLoss = losingTrades.length > 0 
      ? Math.abs(losingTrades.reduce((sum, p) => sum + p.profit, 0) / losingTrades.length) 
      : 0;
    
    const profitLossRatio = avgLoss > 0 ? avgProfit / avgLoss : 0;
    
    const maxProfit = pairs.length > 0 ? Math.max(...pairs.map(p => p.profit)) : 0;
    const maxLoss = pairs.length > 0 ? Math.min(...pairs.map(p => p.profit)) : 0;
    
    // 最大回撤（简化计算）
    let peak = initialCapital;
    let maxDrawdown = 0;
    let capital = initialCapital;
    
    for (const pair of pairs.sort((a, b) => new Date(a.sell.date).getTime() - new Date(b.sell.date).getTime())) {
      capital += pair.profit;
      if (capital > peak) peak = capital;
      const drawdown = (peak - capital) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    // 夏普比率（简化计算，假设无风险利率 3%）
    const riskFreeRate = 0.03;
    const returns = pairs.map(p => p.profitRate / 100);
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const stdDev = returns.length > 1 
      ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1))
      : 0;
    const sharpeRatio = stdDev > 0 ? (avgReturn - riskFreeRate) / stdDev : 0;
    
    const avgHoldingDays = pairs.length > 0 
      ? pairs.reduce((sum, p) => sum + p.holdingDays, 0) / pairs.length 
      : 0;
    
    return {
      totalTrades: pairs.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: pairs.length > 0 ? (winningTrades.length / pairs.length) * 100 : 0,
      totalReturn,
      totalReturnRate,
      avgProfit,
      avgLoss,
      profitLossRatio,
      maxProfit,
      maxLoss,
      maxDrawdown: maxDrawdown * 100,
      sharpeRatio,
      avgHoldingDays,
    };
  }, [trades, initialCapital, currentCapital]);

  // 获取指标颜色
  const getColor = (value: number, invert = false) => {
    if (invert) return value >= 0 ? 'text-green-400' : 'text-red-400';
    return value >= 0 ? 'text-red-400' : 'text-green-400';
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-200">绩效分析</h3>
        <span className="text-[10px] text-slate-500">
          共 {metrics.totalTrades} 笔完整交易
        </span>
      </div>

      {/* 核心指标 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-800/50 border border-slate-700 rounded p-3">
          <div className="text-[10px] text-slate-500 mb-1">总收益率</div>
          <div className={`text-lg font-bold font-mono ${getColor(metrics.totalReturnRate)}`}>
            {metrics.totalReturnRate >= 0 ? '+' : ''}{metrics.totalReturnRate.toFixed(2)}%
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded p-3">
          <div className="text-[10px] text-slate-500 mb-1">胜率</div>
          <div className={`text-lg font-bold font-mono ${metrics.winRate >= 50 ? 'text-red-400' : 'text-green-400'}`}>
            {metrics.winRate.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-600">
            {metrics.winningTrades}胜 {metrics.losingTrades}负
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded p-3">
          <div className="text-[10px] text-slate-500 mb-1">盈亏比</div>
          <div className={`text-lg font-bold font-mono ${metrics.profitLossRatio >= 1 ? 'text-red-400' : 'text-green-400'}`}>
            {metrics.profitLossRatio.toFixed(2)}
          </div>
        </div>
      </div>

      {/* 详细指标 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-800/30 border border-slate-800 rounded p-2">
          <div className="text-[10px] text-slate-500 mb-1">平均盈利</div>
          <div className="text-sm font-bold text-red-400 font-mono">
            ¥{metrics.avgProfit.toFixed(0)}
          </div>
        </div>
        <div className="bg-slate-800/30 border border-slate-800 rounded p-2">
          <div className="text-[10px] text-slate-500 mb-1">平均亏损</div>
          <div className="text-sm font-bold text-green-400 font-mono">
            ¥{metrics.avgLoss.toFixed(0)}
          </div>
        </div>
        <div className="bg-slate-800/30 border border-slate-800 rounded p-2">
          <div className="text-[10px] text-slate-500 mb-1">最大盈利</div>
          <div className="text-sm font-bold text-red-400 font-mono">
            ¥{metrics.maxProfit.toFixed(0)}
          </div>
        </div>
        <div className="bg-slate-800/30 border border-slate-800 rounded p-2">
          <div className="text-[10px] text-slate-500 mb-1">最大亏损</div>
          <div className="text-sm font-bold text-green-400 font-mono">
            ¥{Math.abs(metrics.maxLoss).toFixed(0)}
          </div>
        </div>
        <div className="bg-slate-800/30 border border-slate-800 rounded p-2">
          <div className="text-[10px] text-slate-500 mb-1">最大回撤</div>
          <div className="text-sm font-bold text-green-400 font-mono">
            {metrics.maxDrawdown.toFixed(1)}%
          </div>
        </div>
        <div className="bg-slate-800/30 border border-slate-800 rounded p-2">
          <div className="text-[10px] text-slate-500 mb-1">夏普比率</div>
          <div className={`text-sm font-bold font-mono ${metrics.sharpeRatio >= 1 ? 'text-red-400' : 'text-slate-400'}`}>
            {metrics.sharpeRatio.toFixed(2)}
          </div>
        </div>
      </div>

      {/* 交易统计 */}
      <div className="bg-slate-800/30 border border-slate-800 rounded p-3">
        <div className="text-[10px] text-slate-500 mb-2">交易统计</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">平均持仓天数</span>
            <span className="text-slate-300 font-mono">{metrics.avgHoldingDays.toFixed(1)}天</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">总盈亏</span>
            <span className={`font-mono ${getColor(metrics.totalReturn)}`}>
              {metrics.totalReturn >= 0 ? '+' : ''}¥{metrics.totalReturn.toFixed(0)}
            </span>
          </div>
        </div>
      </div>

      {/* 评估建议 */}
      <div className="bg-slate-800/30 border border-slate-800 rounded p-3">
        <div className="text-[10px] text-slate-500 mb-2">策略评估</div>
        <div className="text-xs text-slate-400 space-y-1">
          {metrics.winRate >= 50 && metrics.profitLossRatio >= 1 && (
            <div className="text-green-400">✓ 策略表现优秀，胜率和盈亏比均达标</div>
          )}
          {metrics.winRate < 50 && (
            <div className="text-yellow-400">⚠ 胜率偏低，建议优化买入信号</div>
          )}
          {metrics.profitLossRatio < 1 && (
            <div className="text-yellow-400">⚠ 盈亏比偏低，建议优化卖出策略</div>
          )}
          {metrics.maxDrawdown > 20 && (
            <div className="text-red-400">⚠ 最大回撤超过 20%，注意风险控制</div>
          )}
          {metrics.sharpeRatio < 1 && (
            <div className="text-slate-500">ℹ 夏普比率偏低，风险调整后收益一般</div>
          )}
          {metrics.totalTrades < 5 && (
            <div className="text-slate-500">ℹ 交易样本不足，建议积累更多数据</div>
          )}
        </div>
      </div>
    </div>
  );
}

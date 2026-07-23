/**
 * TradeHistory - 交易记录查看和导出
 * 支持筛选、排序、CSV 导出
 */
'use client';

import React, { useState, useMemo } from 'react';
import type { QuantLiveTrade } from './QuantLiveChart';

interface TradeHistoryProps {
  trades: QuantLiveTrade[];
  stockCode?: string;
  stockName?: string;
}

export default function TradeHistory({ trades, stockCode, stockName }: TradeHistoryProps) {
  const [filterType, setFilterType] = useState<'all' | 'buy' | 'sell'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'price' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 筛选和排序
  const filteredTrades = useMemo(() => {
    let result = [...trades];
    
    // 筛选
    if (filterType !== 'all') {
      result = result.filter(t => t.type === filterType);
    }
    
    // 排序
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortBy === 'price') {
        comparison = a.price - b.price;
      } else if (sortBy === 'amount') {
        comparison = a.amount - b.amount;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [trades, filterType, sortBy, sortOrder]);

  // 统计数据
  const stats = useMemo(() => {
    const buyTrades = trades.filter(t => t.type === 'buy');
    const sellTrades = trades.filter(t => t.type === 'sell');
    const totalBuyAmount = buyTrades.reduce((sum, t) => sum + t.amount, 0);
    const totalSellAmount = sellTrades.reduce((sum, t) => sum + t.amount, 0);
    const profit = totalSellAmount - totalBuyAmount;
    const profitRate = totalBuyAmount > 0 ? (profit / totalBuyAmount) * 100 : 0;
    
    return {
      totalTrades: trades.length,
      buyCount: buyTrades.length,
      sellCount: sellTrades.length,
      totalBuyAmount,
      totalSellAmount,
      profit,
      profitRate,
    };
  }, [trades]);

  // 导出 CSV
  const exportCSV = () => {
    const headers = ['日期', '类型', '价格', '数量', '金额', '策略', '依据'];
    const rows = filteredTrades.map(t => [
      t.date,
      t.type === 'buy' ? '买入' : '卖出',
      t.price.toFixed(2),
      t.shares.toString(),
      t.amount.toFixed(2),
      t.strategy || '',
      (t.reasons || []).join('、'),
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `交易记录_${stockCode || 'export'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-slate-800/50 border border-slate-700 rounded p-3">
          <div className="text-[10px] text-slate-500 mb-1">总交易次数</div>
          <div className="text-lg font-bold text-slate-200 font-mono">{stats.totalTrades}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded p-3">
          <div className="text-[10px] text-slate-500 mb-1">买入/卖出</div>
          <div className="text-lg font-bold text-slate-200 font-mono">
            <span className="text-red-400">{stats.buyCount}</span>
            <span className="text-slate-600 mx-1">/</span>
            <span className="text-green-400">{stats.sellCount}</span>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded p-3">
          <div className="text-[10px] text-slate-500 mb-1">总买入金额</div>
          <div className="text-lg font-bold text-red-400 font-mono">
            ¥{stats.totalBuyAmount.toFixed(0)}
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded p-3">
          <div className="text-[10px] text-slate-500 mb-1">盈亏</div>
          <div className={`text-lg font-bold font-mono ${stats.profit >= 0 ? 'text-red-400' : 'text-green-400'}`}>
            {stats.profit >= 0 ? '+' : ''}¥{stats.profit.toFixed(0)}
            <span className="text-xs ml-1">({stats.profitRate.toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center gap-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-slate-500">筛选：</span>
          <button
            onClick={() => setFilterType('all')}
            className={`px-2 py-1 rounded ${filterType === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
          >
            全部
          </button>
          <button
            onClick={() => setFilterType('buy')}
            className={`px-2 py-1 rounded ${filterType === 'buy' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
          >
            买入
          </button>
          <button
            onClick={() => setFilterType('sell')}
            className={`px-2 py-1 rounded ${filterType === 'sell' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
          >
            卖出
          </button>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <span className="text-slate-500">排序：</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'price' | 'amount')}
            className="bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700 text-xs"
          >
            <option value="date">日期</option>
            <option value="price">价格</option>
            <option value="amount">金额</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-2 py-1 bg-slate-800 text-slate-400 rounded border border-slate-700"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        <button
          onClick={exportCSV}
          disabled={filteredTrades.length === 0}
          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          导出 CSV
        </button>
      </div>

      {/* 交易列表 */}
      <div className="flex flex-col gap-1 max-h-96 overflow-y-auto">
        {filteredTrades.length === 0 ? (
          <div className="text-center text-slate-500 text-xs py-8">
            暂无交易记录
          </div>
        ) : (
          filteredTrades.map((trade, idx) => (
            <div
              key={trade.id || idx}
              className="flex items-center gap-3 px-3 py-2 bg-slate-800/30 border border-slate-800 rounded hover:bg-slate-800/50 transition-colors"
            >
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                trade.type === 'buy' 
                  ? 'bg-red-500/20 text-red-400' 
                  : 'bg-green-500/20 text-green-400'
              }`}>
                {trade.type === 'buy' ? '买入' : '卖出'}
              </span>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-300 font-mono">{trade.date}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-400">{trade.shares}股</span>
                </div>
                {trade.strategy && (
                  <div className="text-[10px] text-slate-500 truncate">
                    {trade.strategy}
                  </div>
                )}
              </div>

              <div className="text-right">
                <div className="text-xs font-mono text-slate-300">
                  ¥{trade.price.toFixed(2)}
                </div>
                <div className={`text-[10px] font-mono ${
                  trade.type === 'buy' ? 'text-red-400' : 'text-green-400'
                }`}>
                  ¥{trade.amount.toFixed(2)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 底部信息 */}
      {filteredTrades.length > 0 && (
        <div className="text-[10px] text-slate-600 text-center">
          显示 {filteredTrades.length} 条记录
        </div>
      )}
    </div>
  );
}

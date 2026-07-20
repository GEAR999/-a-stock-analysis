import { useState } from 'react';
import { History, Download, Filter } from 'lucide-react';
import type { Account } from './types';
import { formatMoney, formatPrice, formatDateTime } from './utils';

interface TradeHistoryPanelProps {
  account: Account;
}

export function TradeHistoryPanel({ account }: TradeHistoryPanelProps) {
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const filteredTrades = account.trades
    .filter((t) => filter === 'all' || t.direction === filter)
    .sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  const handleExportCSV = () => {
    const headers = ['日期', '股票代码', '股票名称', '方向', '价格', '数量', '金额', '盈亏'];
    const rows = filteredTrades.map((t) => [
      formatDateTime(t.timestamp),
      t.stockCode,
      t.stockName || '',
      t.direction === 'buy' ? '买入' : '卖出',
      formatPrice(t.price),
      t.quantity.toString(),
      formatMoney(t.price * t.quantity),
      t.pnl ? formatMoney(t.pnl) : '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${account.name}_交易记录_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[#111827] rounded border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-gray-200">交易记录</span>
          <span className="text-xs text-gray-500">({filteredTrades.length}条)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Filter className="w-3 h-3 text-gray-500" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'buy' | 'sell')}
              className="text-xs bg-gray-800/50 border border-gray-700 rounded px-2 py-1 text-gray-200"
            >
              <option value="all">全部</option>
              <option value="buy">买入</option>
              <option value="sell">卖出</option>
            </select>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            <Download className="w-3 h-3" />
            <span>导出</span>
          </button>
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#111827]">
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 px-2 text-gray-500 font-normal">日期</th>
              <th className="text-left py-2 px-2 text-gray-500 font-normal">股票</th>
              <th className="text-left py-2 px-2 text-gray-500 font-normal">方向</th>
              <th className="text-right py-2 px-2 text-gray-500 font-normal">价格</th>
              <th className="text-right py-2 px-2 text-gray-500 font-normal">数量</th>
              <th className="text-right py-2 px-2 text-gray-500 font-normal">盈亏</th>
            </tr>
          </thead>
          <tbody>
            {filteredTrades.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-4 text-gray-500">暂无交易记录</td>
              </tr>
            ) : (
              filteredTrades.map((trade) => (
                <tr key={trade.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 px-2 text-gray-400">{formatDateTime(trade.timestamp)}</td>
                  <td className="py-2 px-2 text-gray-200">{trade.stockName || trade.stockCode}</td>
                  <td className="py-2 px-2">
                    <span className={trade.direction === 'buy' ? 'text-red-400' : 'text-green-400'}>
                      {trade.direction === 'buy' ? '买入' : '卖出'}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right text-gray-200 font-mono">{formatPrice(trade.price)}</td>
                  <td className="py-2 px-2 text-right text-gray-200">{trade.quantity}</td>
                  <td className={`py-2 px-2 text-right font-mono ${trade.pnl && trade.pnl >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {trade.pnl ? formatMoney(trade.pnl) : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

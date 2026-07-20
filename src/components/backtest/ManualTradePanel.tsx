import { useState } from 'react';
import { ShoppingCart, TrendingUp, TrendingDown } from 'lucide-react';
import type { Account } from './types';
import { executeBuy, executeSell, canBuyStock } from './storage';
import { formatMoney, formatPrice } from './utils';

interface ManualTradePanelProps {
  account: Account;
  stockCode: string;
  stockName: string;
  currentPrice: number;
  onUpdate: (updated: Account) => void;
  onToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export function ManualTradePanel({ account, stockCode, stockName, currentPrice, onUpdate, onToast }: ManualTradePanelProps) {
  const [buyQty, setBuyQty] = useState(100);
  const [sellQty, setSellQty] = useState(100);
  const [buyPrice, setBuyPrice] = useState(currentPrice);
  const [sellPrice, setSellPrice] = useState(currentPrice);

  const position = account.positions.find((p) => p.stockCode === stockCode);
  const buyCost = buyPrice * buyQty;
  const canBuyResult = canBuyStock(account, stockCode, buyCost);

  const handleBuy = () => {
    if (buyCost > account.currentCapital) {
      onToast('error', '资金不足');
      return;
    }
    const updatedAccount = executeBuy(account, stockCode, stockName, buyPrice, buyCost, 'manual');
    if (updatedAccount !== account) {
      onUpdate(updatedAccount);
      onToast('success', `买入成功：${stockName} ${buyQty}股 @ ${formatPrice(buyPrice)}`);
    } else {
      onToast('error', '买入失败：资金不足或数量无效');
    }
  };

  const handleSell = () => {
    if (!position) {
      onToast('error', '没有持仓，无法卖出');
      return;
    }
    const updatedAccount = executeSell(account, stockCode, sellPrice, Math.min(sellQty, position.quantity), 'manual');
    if (updatedAccount !== account) {
      onUpdate(updatedAccount);
      onToast('success', `卖出成功：${stockName} ${sellQty}股 @ ${formatPrice(sellPrice)}`);
    } else {
      onToast('error', '卖出失败：持仓不足');
    }
  };

  return (
    <div className="bg-[#111827] rounded border border-gray-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShoppingCart className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-gray-200">手动交易</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {/* 买入 */}
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-xs text-red-400">
            <TrendingUp className="w-3 h-3" />
            <span>买入</span>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={buyPrice}
              onChange={(e) => setBuyPrice(Number(e.target.value))}
              className="flex-1 px-2 py-1 text-xs bg-gray-800/50 border border-gray-700 rounded text-gray-200"
              placeholder="价格"
            />
            <input
              type="number"
              value={buyQty}
              onChange={(e) => setBuyQty(Number(e.target.value))}
              className="w-20 px-2 py-1 text-xs bg-gray-800/50 border border-gray-700 rounded text-gray-200"
              placeholder="数量"
            />
          </div>
          <div className="text-[10px] text-gray-500">
            需要：{formatMoney(buyPrice * buyQty)}
          </div>
          <button
            onClick={handleBuy}
            disabled={!canBuyResult.can}
            className="w-full px-3 py-1.5 text-xs font-medium rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            买入 {stockName}
          </button>
        </div>
        {/* 卖出 */}
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-xs text-green-400">
            <TrendingDown className="w-3 h-3" />
            <span>卖出</span>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={sellPrice}
              onChange={(e) => setSellPrice(Number(e.target.value))}
              className="flex-1 px-2 py-1 text-xs bg-gray-800/50 border border-gray-700 rounded text-gray-200"
              placeholder="价格"
            />
            <input
              type="number"
              value={sellQty}
              onChange={(e) => setSellQty(Number(e.target.value))}
              className="w-20 px-2 py-1 text-xs bg-gray-800/50 border border-gray-700 rounded text-gray-200"
              placeholder="数量"
            />
          </div>
          <div className="text-[10px] text-gray-500">
            持仓：{position ? `${position.quantity}股` : '0股'}
          </div>
          <button
            onClick={handleSell}
            disabled={!position || position.quantity === 0}
            className="w-full px-3 py-1.5 text-xs font-medium rounded bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            卖出 {stockName}
          </button>
        </div>
      </div>
    </div>
  );
}

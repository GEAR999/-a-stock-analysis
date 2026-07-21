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
    if (!isFinite(buyPrice) || buyPrice <= 0 || !isFinite(buyQty) || buyQty <= 0) {
      onToast('error', '请输入有效的价格和数量');
      return;
    }
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
    if (!isFinite(sellPrice) || sellPrice <= 0 || !isFinite(sellQty) || sellQty <= 0) {
      onToast('error', '请输入有效的价格和数量');
      return;
    }
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
    <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-default)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShoppingCart className="w-4 h-4 text-[var(--accent-blue)]" />
        <span className="text-sm font-medium text-[var(--text-primary)]">手动交易</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {/* 买入 */}
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-xs text-[var(--accent-red)]">
            <TrendingUp className="w-3 h-3" />
            <span>买入</span>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={buyPrice}
              onChange={(e) => setBuyPrice(Number(e.target.value))}
              className="flex-1 px-2 py-1 text-xs bg-[var(--bg-card)]/50 border border-[var(--border-default)] rounded text-[var(--text-primary)]"
              placeholder="价格"
            />
            <input
              type="number"
              value={buyQty}
              onChange={(e) => setBuyQty(Number(e.target.value))}
              className="w-20 px-2 py-1 text-xs bg-[var(--bg-card)]/50 border border-[var(--border-default)] rounded text-[var(--text-primary)]"
              placeholder="数量"
            />
          </div>
          <div className="text-[10px] text-[var(--text-secondary)]">
            需要：{formatMoney(buyPrice * buyQty)}
          </div>
          <button
            onClick={handleBuy}
            disabled={!canBuyResult.can}
            className="w-full px-3 py-1.5 text-xs font-medium rounded bg-red-500/20 text-[var(--accent-red)] border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            买入 {stockName}
          </button>
        </div>
        {/* 卖出 */}
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-xs text-[var(--accent-green)]">
            <TrendingDown className="w-3 h-3" />
            <span>卖出</span>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={sellPrice}
              onChange={(e) => setSellPrice(Number(e.target.value))}
              className="flex-1 px-2 py-1 text-xs bg-[var(--bg-card)]/50 border border-[var(--border-default)] rounded text-[var(--text-primary)]"
              placeholder="价格"
            />
            <input
              type="number"
              value={sellQty}
              onChange={(e) => setSellQty(Number(e.target.value))}
              className="w-20 px-2 py-1 text-xs bg-[var(--bg-card)]/50 border border-[var(--border-default)] rounded text-[var(--text-primary)]"
              placeholder="数量"
            />
          </div>
          <div className="text-[10px] text-[var(--text-secondary)]">
            持仓：{position ? `${position.quantity}股` : '0股'}
          </div>
          <button
            onClick={handleSell}
            disabled={!position || position.quantity === 0}
            className="w-full px-3 py-1.5 text-xs font-medium rounded bg-green-500/20 text-[var(--accent-green)] border border-green-500/30 hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            卖出 {stockName}
          </button>
        </div>
      </div>
    </div>
  );
}

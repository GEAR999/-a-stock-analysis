import { useState } from 'react';
import { Wallet, Plus, Activity } from 'lucide-react';
import { useAppState } from '@/hooks/useAppState';
import { useAccountManager } from './hooks/useAccountManager';
import { AccountOverview } from './AccountOverview';
import { ManualTradePanel } from './ManualTradePanel';
import { TradeHistoryPanel } from './TradeHistoryPanel';
import type { Account } from './types';

type ToastType = 'success' | 'error' | 'warning' | 'info';

export function BacktestPanel() {
  const { selectedStock, currentQuote } = useAppState();
  const { accounts, activeAccountId, account: currentAccount, handleCreateAccount: createAccount, switchAccount, updateAccount } = useAccountManager();
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountCapital, setNewAccountCapital] = useState(1000000);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);

  const showToast = (type: ToastType, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreateAccount = () => {
    if (!newAccountName.trim()) {
      showToast('error', '请输入账户名称');
      return;
    }
    const acc = createAccount(newAccountName, newAccountCapital, 'manual');
    if (acc) {
      setShowNewAccount(false);
      setNewAccountName('');
      setNewAccountCapital(1000000);
      showToast('success', `账户 ${newAccountName} 创建成功`);
    }
  };

  const handleUpdateAccount = (updated: Account | null) => {
    if (updated) {
      updateAccount(updated);
    } else {
      window.location.reload();
    }
  };

  if (!currentAccount && !showNewAccount) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)]">
        <Wallet className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm mb-3">暂无模拟交易账户</p>
        <button
          onClick={() => setShowNewAccount(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-blue-500/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30 hover:bg-blue-500/30 transition-colors"
        >
          <Plus className="w-3 h-3" />
          创建账户
        </button>
      </div>
    );
  }

  if (!currentAccount && showNewAccount) {
    return (
      <div className="flex flex-col h-full bg-[var(--bg-primary)] p-4">
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">创建模拟交易账户</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">账户名称</label>
            <input
              type="text"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="请输入账户名称"
              className="w-full px-3 py-1.5 text-xs bg-[var(--bg-card)] border border-[var(--border-default)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">初始资金</label>
            <input
              type="number"
              value={newAccountCapital}
              onChange={(e) => setNewAccountCapital(Number(e.target.value))}
              className="w-full px-3 py-1.5 text-xs bg-[var(--bg-card)] border border-[var(--border-default)] rounded text-[var(--text-primary)]"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCreateAccount}
              className="flex-1 px-3 py-1.5 text-xs font-medium rounded bg-blue-500/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30 hover:bg-blue-500/30 transition-colors"
            >
              创建
            </button>
            <button
              onClick={() => setShowNewAccount(false)}
              className="flex-1 px-3 py-1.5 text-xs font-medium rounded bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentAccount) return null;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] overflow-y-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded text-xs font-medium shadow-lg ${
          toast.type === 'success' ? 'bg-green-500/20 text-[var(--accent-green)] border border-green-500/30' :
          toast.type === 'error' ? 'bg-red-500/20 text-[var(--accent-red)] border border-red-500/30' :
          toast.type === 'warning' ? 'bg-yellow-500/20 text-[var(--accent-yellow)] border border-yellow-500/30' :
          'bg-blue-500/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30'
        }`}>
          {toast.message}
        </div>
      )}

      {/* 账户选择器 */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-default)] bg-[var(--bg-panel)]">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[var(--accent-blue)]" />
          <select
            value={activeAccountId || ''}
            onChange={(e) => switchAccount(e.target.value)}
            className="text-xs bg-[var(--bg-card)]/50 border border-[var(--border-default)] rounded px-2 py-1 text-[var(--text-primary)]"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => { setShowNewAccount(!showNewAccount); }}
          className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <Plus className="w-3 h-3" />
          新建
        </button>
      </div>

      {/* 新建账户表单 */}
      {showNewAccount && (
        <div className="p-3 border-b border-[var(--border-default)] bg-[var(--bg-panel)] space-y-2">
          <input
            type="text"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            placeholder="账户名称"
            className="w-full px-2 py-1 text-xs bg-[var(--bg-card)]/50 border border-[var(--border-default)] rounded text-[var(--text-primary)] placeholder-gray-500"
          />
          <input
            type="number"
            value={newAccountCapital}
            onChange={(e) => setNewAccountCapital(Number(e.target.value))}
            placeholder="初始资金"
            className="w-full px-2 py-1 text-xs bg-[var(--bg-card)]/50 border border-[var(--border-default)] rounded text-[var(--text-primary)] placeholder-gray-500"
          />
          <button
            onClick={handleCreateAccount}
            className="w-full px-3 py-1.5 text-xs font-medium rounded bg-blue-500/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30 hover:bg-blue-500/30 transition-colors"
          >
            创建账户
          </button>
        </div>
      )}

      {/* 主内容区 */}
      <div className="flex-1 p-3 space-y-3">
        {/* 账户概览 */}
        <AccountOverview account={currentAccount} />

        {/* 手动交易面板 */}
        {selectedStock && (
          <ManualTradePanel
            account={currentAccount}
            stockCode={selectedStock.code}
            stockName={selectedStock.name}
            currentPrice={currentQuote?.price || 0}
            onUpdate={handleUpdateAccount}
            onToast={showToast}
          />
        )}

        {/* 交易记录 */}
        <TradeHistoryPanel account={currentAccount} />

        {/* 无股票选择提示 */}
        {!selectedStock && (
          <div className="flex flex-col items-center justify-center py-8 text-[var(--text-secondary)]">
            <Activity className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs">请先选择一只股票开始交易</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Wallet, Plus, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { useAppState } from '@/hooks/useAppState';
import { useAccountManager } from './hooks/useAccountManager';
import { AccountOverview } from './AccountOverview';
import { ManualTradePanel } from './ManualTradePanel';
import { QuantAutoTradePanel } from './QuantAutoTradePanel';
import { TradeHistoryPanel } from './TradeHistoryPanel';
import { type Account } from './types';

type ToastType = 'success' | 'error' | 'warning' | 'info';

export function BacktestPanel() {
  const { selectedStock, currentQuote } = useAppState();
  const { accounts, activeAccountId, account: currentAccount, handleCreateAccount: createAccount, switchAccount, updateAccount } = useAccountManager();
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountCapital, setNewAccountCapital] = useState(1000000);
  const [newAccountType, setNewAccountType] = useState<'manual' | 'quant'>('manual');
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
    const acc = createAccount(newAccountName, newAccountCapital, newAccountType);
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
      // Account was deleted, refresh list
      window.location.reload();
    }
  };

  if (!currentAccount) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <Wallet className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm mb-3">暂无回测账户</p>
        <button
          onClick={() => setShowNewAccount(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
        >
          <Plus className="w-3 h-3" />
          创建账户
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0e17] overflow-y-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded text-xs font-medium shadow-lg ${
          toast.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
          toast.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
          toast.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
          'bg-blue-500/20 text-blue-400 border border-blue-500/30'
        }`}>
          {toast.message}
        </div>
      )}

      {/* 账户选择器 */}
      <div className="flex items-center justify-between p-3 border-b border-gray-800 bg-[#111827]">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-blue-400" />
          <select
            value={activeAccountId || ''}
            onChange={(e) => switchAccount(e.target.value)}
            className="text-xs bg-gray-800/50 border border-gray-700 rounded px-2 py-1 text-gray-200"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowNewAccount(!showNewAccount)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          <Plus className="w-3 h-3" />
          新建
        </button>
      </div>

      {/* 新建账户表单 */}
      {showNewAccount && (
        <div className="p-3 border-b border-gray-800 bg-[#111827] space-y-2">
          <input
            type="text"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            placeholder="账户名称"
            className="w-full px-2 py-1 text-xs bg-gray-800/50 border border-gray-700 rounded text-gray-200 placeholder-gray-500"
          />
          <input
            type="number"
            value={newAccountCapital}
            onChange={(e) => setNewAccountCapital(Number(e.target.value))}
            placeholder="初始资金"
            className="w-full px-2 py-1 text-xs bg-gray-800/50 border border-gray-700 rounded text-gray-200 placeholder-gray-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setNewAccountType('manual')}
              className={`flex-1 px-2 py-1 text-xs rounded border transition-colors ${
                newAccountType === 'manual'
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:bg-gray-700/50'
              }`}
            >
              手动交易
            </button>
            <button
              onClick={() => setNewAccountType('quant')}
              className={`flex-1 px-2 py-1 text-xs rounded border transition-colors ${
                newAccountType === 'quant'
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:bg-gray-700/50'
              }`}
            >
              量化自动
            </button>
          </div>
          <button
            onClick={handleCreateAccount}
            className="w-full px-3 py-1.5 text-xs font-medium rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
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
        {selectedStock && currentAccount.type === 'manual' && (
          <ManualTradePanel
            account={currentAccount}
            stockCode={selectedStock.code}
            stockName={selectedStock.name}
            currentPrice={currentQuote?.price || 0}
            onUpdate={handleUpdateAccount}
            onToast={showToast}
          />
        )}

        {/* 量化自动交易面板 */}
        {selectedStock && currentAccount.type === 'quant' && (
          <QuantAutoTradePanel
            account={currentAccount}
            stockCode={selectedStock.code}
            stockName={selectedStock.name}
            onUpdate={handleUpdateAccount}
            onToast={showToast}
          />
        )}

        {/* 交易记录 */}
        <TradeHistoryPanel account={currentAccount} />

        {/* 无股票选择提示 */}
        {!selectedStock && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <Activity className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs">请先选择一只股票开始交易</p>
          </div>
        )}
      </div>
    </div>
  );
}

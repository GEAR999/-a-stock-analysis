import { useState, useMemo } from 'react';
import { Wallet, Plus, Activity, Settings, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useAppState } from '@/hooks/useAppState';
import { useAccountManager } from './hooks/useAccountManager';
import { AccountOverview } from './AccountOverview';
import { ManualTradePanel } from './ManualTradePanel';
import { QuantAutoTradePanel } from './QuantAutoTradePanel';
import { TradeHistoryPanel } from './TradeHistoryPanel';
import { getAllAvailableStrategies, calculateWeightsByConfidence } from './strategy-storage';
import type { BuiltinStrategy } from './strategy-storage';
import type { Account, QuantStrategy, StrategySource, CustomStrategy } from './types';

type ToastType = 'success' | 'error' | 'warning' | 'info';

// 统一策略视图类型
interface StrategyView {
  id: string;
  name: string;
  description: string;
  theories: string[];
  confidence: number;
  source: 'builtin' | 'custom';
}

const theoryLabels: Record<string, string> = {
  chanlun: '缠论',
  wave: '波浪',
  technical: '技术指标',
  composite: '综合',
};

function formatTheories(theories: string[]): string {
  return theories.map(t => theoryLabels[t] || t).join(' + ');
}

export function BacktestPanel() {
  const { selectedStock, currentQuote } = useAppState();
  const { accounts, activeAccountId, account: currentAccount, handleCreateAccount: createAccount, switchAccount, updateAccount } = useAccountManager();
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountCapital, setNewAccountCapital] = useState(1000000);
  const [newAccountType, setNewAccountType] = useState<'manual' | 'quant'>('manual');
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);

  // 策略选择状态 - 统一为 StrategyView 类型
  const allStrategies: StrategyView[] = useMemo(() => {
    const raw = getAllAvailableStrategies();
    return raw.map((s): StrategyView => {
      if ('confidence' in s && 'source' in s) {
        // BuiltinStrategy
        const bs = s as BuiltinStrategy;
        return { id: bs.id, name: bs.name, description: bs.description, theories: bs.theories, confidence: bs.confidence, source: 'builtin' };
      }
      // CustomStrategy 来自 types.ts，没有 confidence 和 source
      return { id: s.id, name: s.name, description: ('description' in s ? (s as CustomStrategy).description : '') || '', theories: s.theories, confidence: 60, source: 'custom' };
    });
  }, []);
  const [selectedStrategyIds, setSelectedStrategyIds] = useState<string[]>(['builtin_comprehensive']);
  const [tradeThreshold, setTradeThreshold] = useState(60);
  const [showStrategyPicker, setShowStrategyPicker] = useState(false);

  // 修改策略状态
  const [showChangeStrategy, setShowChangeStrategy] = useState(false);

  const showToast = (type: ToastType, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleStrategy = (id: string) => {
    setSelectedStrategyIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const buildStrategy = (): QuantStrategy | undefined => {
    if (newAccountType !== 'quant' || selectedStrategyIds.length === 0) return undefined;

    const selected = allStrategies.filter(s => selectedStrategyIds.includes(s.id));
    if (selected.length === 0) return undefined;

    // 合并所有选中策略的 theories
    const allTheories = [...new Set(selected.flatMap(s => s.theories))] as StrategySource[];

    // 多策略时按置信度分配权重
    const weights = calculateWeightsByConfidence(
      selected.map(s => ({ id: s.id, confidence: s.confidence }))
    );

    const name = selected.length === 1
      ? selected[0].name
      : `组合策略(${selected.map(s => s.name.replace('策略', '')).join('+')})`;

    return {
      name,
      theories: allTheories.length > 0 ? allTheories : ['composite'],
      stopLossPercent: 8,
      takeProfitPercent: 15,
      maxPositionPercent: 30,
      autoTrade: false,
    };
  };

  const handleCreateAccount = () => {
    if (!newAccountName.trim()) {
      showToast('error', '请输入账户名称');
      return;
    }
    const strategy = buildStrategy();
    const acc = createAccount(newAccountName, newAccountCapital, newAccountType, strategy);
    if (acc) {
      setShowNewAccount(false);
      setNewAccountName('');
      setNewAccountCapital(1000000);
      setSelectedStrategyIds(['builtin_comprehensive']);
      showToast('success', `账户 ${newAccountName} 创建成功${strategy ? `（策略: ${strategy.name}）` : ''}`);
    }
  };

  const handleUpdateAccount = (updated: Account | null) => {
    if (updated) {
      updateAccount(updated);
    } else {
      window.location.reload();
    }
  };

  // 修改当前账户策略
  const handleChangeStrategy = () => {
    if (!currentAccount || selectedStrategyIds.length === 0) return;
    const selected = allStrategies.filter(s => selectedStrategyIds.includes(s.id));
    if (selected.length === 0) return;

    const allTheories = [...new Set(selected.flatMap(s => s.theories))] as StrategySource[];
    const name = selected.length === 1
      ? selected[0].name
      : `组合策略(${selected.map(s => s.name.replace('策略', '')).join('+')})`;

    const updated: Account = {
      ...currentAccount,
      strategy: {
        name,
        theories: allTheories.length > 0 ? allTheories : ['composite'],
        stopLossPercent: currentAccount.strategy?.stopLossPercent ?? 8,
        takeProfitPercent: currentAccount.strategy?.takeProfitPercent ?? 15,
        maxPositionPercent: currentAccount.strategy?.maxPositionPercent ?? 30,
        autoTrade: currentAccount.strategy?.autoTrade ?? false,
      },
      updatedAt: Date.now(),
    };
    updateAccount(updated);
    setShowChangeStrategy(false);
    showToast('success', `策略已更新为: ${name}`);
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
        <div className="flex items-center gap-1">
          {currentAccount.type === 'quant' && (
            <button
              onClick={() => {
                // 初始化选中当前策略
                const currentName = currentAccount.strategy?.name || '';
                const match = allStrategies.find(s => s.name === currentName);
                if (match) setSelectedStrategyIds([match.id]);
                setShowChangeStrategy(!showChangeStrategy);
                setShowNewAccount(false);
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
              title="修改策略"
            >
              <Settings className="w-3 h-3" />
              策略
            </button>
          )}
          <button
            onClick={() => { setShowNewAccount(!showNewAccount); setShowChangeStrategy(false); }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            <Plus className="w-3 h-3" />
            新建
          </button>
        </div>
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

          {/* 策略选择区域 - 仅量化类型显示 */}
          {newAccountType === 'quant' && (
            <div className="space-y-2">
              <button
                onClick={() => setShowStrategyPicker(!showStrategyPicker)}
                className="flex items-center justify-between w-full px-2 py-1.5 text-xs bg-gray-800/50 border border-gray-700 rounded text-gray-300 hover:bg-gray-700/50 transition-colors"
              >
                <span>选择策略 ({selectedStrategyIds.length}个已选)</span>
                {showStrategyPicker ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showStrategyPicker && (
                <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-700 rounded bg-[#0a0e17] p-1.5">
                  {allStrategies.map((s) => {
                    const isSelected = selectedStrategyIds.includes(s.id);
                    const isBuiltin = s.source === 'builtin';
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleStrategy(s.id)}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-start gap-2 ${
                          isSelected
                            ? 'bg-blue-500/15 border border-blue-500/30'
                            : 'bg-gray-800/30 border border-transparent hover:bg-gray-700/40'
                        }`}
                      >
                        <div className={`flex-shrink-0 w-3.5 h-3.5 mt-0.5 rounded border flex items-center justify-center ${
                          isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
                        }`}>
                          {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-200 font-medium">{s.name}</span>
                            <span className={`px-1 py-0 rounded text-[9px] ${
                              isBuiltin ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                            }`}>
                              {isBuiltin ? '内置' : '自定义'}
                            </span>
                            <span className="text-gray-500 text-[10px]">置信度 {s.confidence}%</span>
                          </div>
                          <div className="text-gray-500 text-[10px] mt-0.5 truncate">{s.description}</div>
                          <div className="text-gray-600 text-[10px] mt-0.5">
                            理论: {formatTheories(s.theories)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 交易阈值 */}
              <div className="flex items-center gap-2 px-1">
                <span className="text-[10px] text-gray-500 whitespace-nowrap">交易阈值</span>
                <input
                  type="range"
                  min={40}
                  max={90}
                  value={tradeThreshold}
                  onChange={(e) => setTradeThreshold(Number(e.target.value))}
                  className="flex-1 h-1 accent-blue-500"
                />
                <span className="text-[10px] text-gray-400 w-6 text-right">{tradeThreshold}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleCreateAccount}
            className="w-full px-3 py-1.5 text-xs font-medium rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
          >
            创建账户
          </button>
        </div>
      )}

      {/* 修改策略面板 */}
      {showChangeStrategy && currentAccount.type === 'quant' && (
        <div className="p-3 border-b border-gray-800 bg-[#111827] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300 font-medium">修改策略</span>
            <span className="text-[10px] text-gray-500">当前: {currentAccount.strategy?.name || '默认'}</span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-700 rounded bg-[#0a0e17] p-1.5">
            {allStrategies.map((s) => {
              const isSelected = selectedStrategyIds.includes(s.id);
              const isBuiltin = s.source === 'builtin';
              return (
                <button
                  key={s.id}
                  onClick={() => toggleStrategy(s.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-start gap-2 ${
                    isSelected
                      ? 'bg-blue-500/15 border border-blue-500/30'
                      : 'bg-gray-800/30 border border-transparent hover:bg-gray-700/40'
                  }`}
                >
                  <div className={`flex-shrink-0 w-3.5 h-3.5 mt-0.5 rounded border flex items-center justify-center ${
                    isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
                  }`}>
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-200 font-medium">{s.name}</span>
                      <span className={`px-1 py-0 rounded text-[9px] ${
                        isBuiltin ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                      }`}>
                        {isBuiltin ? '内置' : '自定义'}
                      </span>
                      <span className="text-gray-500 text-[10px]">置信度 {s.confidence}%</span>
                    </div>
                    <div className="text-gray-500 text-[10px] mt-0.5">
                      理论: {formatTheories(s.theories)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleChangeStrategy}
              disabled={selectedStrategyIds.length === 0}
              className="flex-1 px-3 py-1.5 text-xs font-medium rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              确认修改
            </button>
            <button
              onClick={() => setShowChangeStrategy(false)}
              className="px-3 py-1.5 text-xs text-gray-400 border border-gray-700 rounded hover:bg-gray-700/50 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 主内容区 */}
      <div className="flex-1 p-3 space-y-3">
        {/* 账户概览 */}
        <AccountOverview account={currentAccount} />

        {/* 当前策略信息（量化账户） */}
        {currentAccount.type === 'quant' && currentAccount.strategy && (
          <div className="px-3 py-2 bg-[#111827] border border-gray-800 rounded">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs text-gray-300 font-medium">{currentAccount.strategy.name}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <span>止损 {currentAccount.strategy.stopLossPercent}%</span>
                <span>止盈 {currentAccount.strategy.takeProfitPercent}%</span>
                <span>仓位上限 {currentAccount.strategy.maxPositionPercent}%</span>
              </div>
            </div>
            <div className="mt-1 text-[10px] text-gray-500">
              理论: {formatTheories(currentAccount.strategy.theories)}
              {currentAccount.strategy.autoTrade && (
                <span className="ml-2 text-green-400">自动交易已开启</span>
              )}
            </div>
          </div>
        )}

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
